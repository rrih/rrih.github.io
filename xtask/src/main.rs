mod assets;
mod atlas;
mod atlas_worker;
mod pictulane;
mod production;
mod profile;
mod server;

use std::{
    env,
    error::Error,
    fs,
    path::{Path, PathBuf},
    process::{Command, ExitCode},
};
type Result<T = ()> = std::result::Result<T, Box<dyn Error + Send + Sync>>;

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("Error: {error}");
            ExitCode::FAILURE
        }
    }
}
fn run() -> Result {
    env::set_current_dir(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or("Missing root")?,
    )?;
    let args: Vec<String> = env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("profile") => profile::build(),
        Some("atlas-prepare") => atlas::prepare(),
        Some("atlas-seo") => atlas::seo(),
        Some("atlas-legacy") => atlas::legacy(),
        Some("atlas-verify") => atlas::verify(),
        Some("atlas-worker") => atlas_worker::build(),
        Some("atlas-verify-assets") => assets::verify(),
        Some("atlas-prepare-artwork") => assets::prepare_artwork(),
        Some("atlas-optimize-models") => assets::optimize_home_models(&args[1..]),
        Some("atlas") => build_atlas(),
        Some("pictulane") => pictulane::build(args.iter().any(|arg| arg == "--test")),
        Some("verify-profile") => profile::verify(),
        Some("verify-production") => production::verify(),
        Some("serve") => server::serve(args.get(1).cloned()),
        Some("compose") => compose(&args[1..]),
        Some("wasm") => {
            if args.len() != 4 { return Err("Usage: cargo run -p xtask -- wasm PACKAGE OUT_DIR NAME".into()); }
            wasm(&args[1], &args[2], &args[3])
        }
        _ => Err("Usage: cargo run -p xtask -- profile | verify-profile | serve [directory] | compose [profile atlas compatibility output pictulane] | wasm PACKAGE OUT_DIR NAME".into())
    }
}
fn tool(name: &str) -> PathBuf {
    let candidate = env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default()
        .join(".cargo/bin")
        .join(name);
    if candidate.is_file() {
        candidate
    } else {
        PathBuf::from(name)
    }
}
fn command(program: &Path, args: &[&str]) -> Result {
    let status = Command::new(program).args(args).status()?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{} {} failed ({status})", program.display(), args.join(" ")).into())
    }
}
fn wasm(package: &str, output: &str, name: &str) -> Result {
    command(
        &tool("cargo"),
        &[
            "build",
            "--locked",
            "--release",
            "--target",
            "wasm32-unknown-unknown",
            "-p",
            package,
        ],
    )?;
    let module = format!(
        "target/wasm32-unknown-unknown/release/{}.wasm",
        package.replace('-', "_")
    );
    command(
        &tool("wasm-bindgen"),
        &[
            &module,
            "--target",
            "web",
            "--out-dir",
            output,
            "--out-name",
            name,
            "--no-typescript",
            "--remove-name-section",
        ],
    )
}
fn build_atlas() -> Result {
    assets::verify()?;
    atlas::prepare()?;
    wasm("atlas-app", "atlas/rust/pkg", "atlas")?;
    fresh_dir("atlas/dist")?;
    copy_tree(Path::new("atlas/public"), Path::new("atlas/dist"))?;
    atlas_worker::build()?;
    let bun = env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default()
        .join(".bun/bin/bun");
    let status = Command::new(if bun.is_file() {
        bun
    } else {
        PathBuf::from("bun")
    })
    .current_dir("atlas")
    .args(["x", "vite", "build", "--config", "vite.config.mjs"])
    .status()?;
    if !status.success() {
        return Err("Atlas browser dependency bundling failed".into());
    }
    atlas::seo()?;
    atlas::verify()?;
    atlas::legacy()?;
    Ok(())
}
fn fresh_dir(path: impl AsRef<Path>) -> Result {
    let path = path.as_ref();
    if path.is_dir() {
        fs::remove_dir_all(path)?;
    }
    fs::create_dir_all(path)?;
    Ok(())
}
fn write(path: impl AsRef<Path>, contents: impl AsRef<[u8]>) -> Result {
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, contents)?;
    Ok(())
}
fn copy_file(source: impl AsRef<Path>, dest: impl AsRef<Path>) -> Result {
    if let Some(parent) = dest.as_ref().parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, dest)?;
    Ok(())
}
fn copy_tree(source: &Path, dest: &Path) -> Result {
    if !source.is_dir() {
        return Err(format!("Missing build directory: {}", source.display()).into());
    }
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            copy_tree(&entry.path(), &dest.join(entry.file_name()))?;
        } else if entry.file_type()?.is_file() {
            copy_file(entry.path(), dest.join(entry.file_name()))?;
        } else {
            return Err(format!("Unsupported build entry: {}", entry.path().display()).into());
        }
    }
    Ok(())
}
fn composition_output(output: &Path, inputs: &[&Path]) -> Result<PathBuf> {
    // Reject parent components before resolving ancestors: canonicalizing only the
    // inputs lets aliases such as "unrelated/../dist" bypass an overlap check.
    if output
        .components()
        .any(|part| part == std::path::Component::ParentDir)
    {
        return Err("Composition output must not contain parent-directory components".into());
    }
    let absolute = std::path::absolute(output)?;
    let mut ancestor = absolute.as_path();
    let mut missing = Vec::new();
    let mut resolved = loop {
        match fs::canonicalize(ancestor) {
            Ok(path) => break path,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                // A dangling symlink must not be treated as a new output directory.
                if fs::symlink_metadata(ancestor).is_ok() {
                    return Err("Composition output contains a dangling symbolic link".into());
                }
                missing.push(
                    ancestor
                        .file_name()
                        .ok_or("Missing output ancestor")?
                        .to_owned(),
                );
                ancestor = ancestor.parent().ok_or("Missing output parent")?;
            }
            Err(error) => return Err(error.into()),
        }
    };
    for part in missing.iter().rev() {
        resolved.push(part);
    }
    for input in inputs {
        let input = fs::canonicalize(input)?;
        if resolved.starts_with(&input) || input.starts_with(&resolved) {
            return Err("Output must not overlap any input build".into());
        }
    }
    Ok(resolved)
}
fn compose(args: &[String]) -> Result {
    if args.len() > 5 {
        return Err("compose accepts at most five directories".into());
    }
    let defaults = [
        "dist",
        "atlas/dist",
        "atlas/hosting",
        "site-dist",
        "tools/pictulane/dist",
    ];
    let dirs: Vec<PathBuf> = defaults
        .iter()
        .enumerate()
        .map(|(index, fallback)| {
            PathBuf::from(args.get(index).map(String::as_str).unwrap_or(fallback))
        })
        .collect();
    let [profile, atlas, compatibility, output, pictulane] = dirs.as_slice() else {
        unreachable!()
    };
    for input in [profile, atlas, compatibility, pictulane] {
        if !input.is_dir() {
            return Err(format!("Missing build: {}", input.display()).into());
        }
    }
    if !pictulane.join("index.html").is_file() || pictulane.join("TEST-ONLY").exists() {
        return Err("A production pictulane build is required".into());
    }
    composition_output(output, &[profile, atlas, compatibility, pictulane])?;
    fresh_dir(output)?;
    copy_tree(profile, output)?;
    copy_tree(atlas, &output.join("atlas"))?;
    copy_tree(compatibility, output)?;
    copy_tree(pictulane, &output.join("tools/pictulane"))?;
    write(
        output.join("robots.txt"),
        format!(
            "{}Sitemap: https://rrih.github.io/atlas/sitemap.xml\n",
            fs::read_to_string(profile.join("robots.txt"))?
        ),
    )?;
    println!(
        "Composed independent product builds into {}",
        output.display()
    );
    Ok(())
}

#[cfg(test)]
mod composition_tests {
    use super::*;
    #[test]
    fn output_aliases_cannot_delete_input_builds() -> Result {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_nanos();
        let root = env::temp_dir().join(format!("atlas-compose-{}-{unique}", std::process::id()));
        fs::create_dir_all(root.join("input"))?;
        fs::write(root.join("input/sentinel"), "preserve")?;
        fs::create_dir_all(root.join("unrelated"))?;
        let input = root.join("input");
        let inputs = [input.as_path()];
        for output in [
            input.clone(),
            root.clone(),
            input.join("child"),
            root.join("unrelated/../input"),
        ] {
            assert!(
                composition_output(&output, &inputs).is_err(),
                "{}",
                output.display()
            );
        }
        assert_eq!(
            composition_output(&root.join("new/output"), &inputs)?,
            fs::canonicalize(&root)?.join("new/output")
        );
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&input, root.join("alias"))?;
            assert!(composition_output(&root.join("alias"), &inputs).is_err());
            assert!(composition_output(&root.join("alias/new/output"), &inputs).is_err());
            std::os::unix::fs::symlink(root.join("missing"), root.join("dangling"))?;
            assert!(composition_output(&root.join("dangling/output"), &inputs).is_err());
            std::os::unix::fs::symlink(root.join("unrelated"), root.join("safe-alias"))?;
            assert_eq!(
                composition_output(&root.join("safe-alias/output"), &inputs)?,
                fs::canonicalize(root.join("unrelated"))?.join("output")
            );
        }
        assert_eq!(fs::read_to_string(root.join("input/sentinel"))?, "preserve");
        fs::remove_dir_all(root)?;
        Ok(())
    }
}
