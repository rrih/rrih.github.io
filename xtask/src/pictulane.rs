use crate::{Result, command, copy_file, copy_tree, fresh_dir, tool, write};
use sha2::{Digest, Sha256};
use std::{fs, path::Path};
const BASE: &str = "/tools/pictulane/";
pub fn build(test: bool) -> Result {
    let dist = Path::new("tools/pictulane/dist");
    let mut args = vec![
        "build",
        "--locked",
        "--release",
        "--target",
        "wasm32-unknown-unknown",
        "-p",
        "pictulane",
    ];
    if test {
        args.extend(["--features", "test-fixtures"]);
    }
    command(&tool("cargo"), &args)?;
    command(
        &tool("cargo"),
        &[
            "build",
            "--locked",
            "--release",
            "--target",
            "wasm32-unknown-unknown",
            "-p",
            "pictulane-worker",
        ],
    )?;
    fresh_dir(dist)?;
    copy_tree(Path::new("tools/pictulane/public"), dist)?;
    copy_file("tools/pictulane/src/style.css", dist.join("style.css"))?;
    command(
        &tool("wasm-bindgen"),
        &[
            "target/wasm32-unknown-unknown/release/pictulane.wasm",
            "--target",
            "web",
            "--out-dir",
            "tools/pictulane/dist/pkg",
            "--out-name",
            "pictulane",
            "--no-typescript",
            "--remove-name-section",
        ],
    )?;
    command(
        &tool("wasm-bindgen"),
        &[
            "target/wasm32-unknown-unknown/release/pictulane_worker.wasm",
            "--target",
            "no-modules",
            "--out-dir",
            "tools/pictulane/dist/worker",
            "--out-name",
            "pictulane_worker",
            "--no-typescript",
            "--remove-name-section",
        ],
    )?;
    let app = versioned_package(dist, "pkg")?;
    let worker = versioned_package(dist, "worker")?;
    let bootstrap = fs::read_to_string("tools/pictulane/bootstrap.js")?
        .replace("__APP_MODULE__", &format!("{BASE}{app}/pictulane.js"));
    let bootstrap_hash = format!("{:x}", Sha256::digest(bootstrap.as_bytes()));
    let bootstrap_name = format!("bootstrap-{}.js", &bootstrap_hash[..20]);
    write(dist.join(&bootstrap_name), bootstrap)?;
    write(
        dist.join("index.html"),
        fs::read_to_string("tools/pictulane/index.html")?
            .replace("__BOOTSTRAP__", &format!("{BASE}{bootstrap_name}")),
    )?;
    let mut files = Vec::new();
    collect(dist, dist, &mut files)?;
    files.retain(|path| path != "sw.js");
    files.sort();
    let mut hash = Sha256::new();
    for f in &files {
        hash.update(fs::read(dist.join(f))?);
    }
    let source = fs::read_to_string("tools/pictulane/public/sw.js")?
        .replace(
            "__WORKER_JS__",
            &format!("{BASE}{worker}/pictulane_worker.js"),
        )
        .replace(
            "__WORKER_WASM__",
            &format!("{BASE}{worker}/pictulane_worker_bg.wasm"),
        );
    hash.update(source.as_bytes());
    let version = format!("{:x}", hash.finalize());
    let assets: Vec<_> = std::iter::once(BASE.to_string())
        .chain(files.iter().map(|f| format!("{BASE}{f}")))
        .collect();
    write(
        dist.join("sw.js"),
        source
            .replace("__BUILD__", &version[..12])
            .replace("__ASSETS__", &serde_json::to_string(&assets)?),
    )?;
    if test {
        write(dist.join("TEST-ONLY"), "Do not deploy")?;
    }
    println!(
        "Built pictulane Rust/WASM ({})",
        if test { "test fixtures" } else { "production" }
    );
    Ok(())
}
// Hash the entire generated package, including any wasm-bindgen snippets. A JS
// module's relative WASM URL therefore always names the same immutable package.
fn versioned_package(dist: &Path, directory: &str) -> Result<String> {
    let root = dist.join(directory);
    let mut files = Vec::new();
    collect(&root, &root, &mut files)?;
    files.sort();
    let mut hash = Sha256::new();
    for path in files {
        let bytes = fs::read(root.join(&path))?;
        hash.update((path.len() as u64).to_le_bytes());
        hash.update(path.as_bytes());
        hash.update((bytes.len() as u64).to_le_bytes());
        hash.update(bytes);
    }
    let hash = format!("{:x}", hash.finalize());
    let name = format!("{directory}-{}", &hash[..20]);
    fs::rename(&root, dist.join(&name))?;
    Ok(name)
}
fn collect(root: &Path, dir: &Path, files: &mut Vec<String>) -> Result {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if entry.file_type()?.is_dir() {
            collect(root, &path, files)?;
        } else {
            files.push(
                path.strip_prefix(root)?
                    .to_string_lossy()
                    .replace('\\', "/"),
            );
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn package_version_covers_bindings_wasm_and_snippets() {
        let root = std::env::temp_dir().join(format!(
            "pictulane-package-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let package = |case: &str, js: &[u8], wasm: &[u8], snippet: &[u8]| {
            let dist = root.join(case);
            fs::create_dir_all(dist.join("pkg/snippets")).unwrap();
            fs::write(dist.join("pkg/pictulane.js"), js).unwrap();
            fs::write(dist.join("pkg/pictulane_bg.wasm"), wasm).unwrap();
            fs::write(dist.join("pkg/snippets/browser.js"), snippet).unwrap();
            let name = versioned_package(&dist, "pkg").unwrap();
            assert!(!dist.join("pkg").exists());
            assert_eq!(fs::read(dist.join(&name).join("pictulane.js")).unwrap(), js);
            name
        };
        let first = package("first", b"js-a", b"wasm-a", b"browser-a");
        assert_eq!(first, package("repeat", b"js-a", b"wasm-a", b"browser-a"));
        assert_ne!(first, package("js", b"js-b", b"wasm-a", b"browser-a"));
        assert_ne!(first, package("wasm", b"js-a", b"wasm-b", b"browser-a"));
        assert_ne!(first, package("snippet", b"js-a", b"wasm-a", b"browser-b"));
        fs::remove_dir_all(root).unwrap();
    }
}
