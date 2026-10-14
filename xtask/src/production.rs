//! Read-only public HTTP verification; this does not certify search indexing or browser rendering.
use crate::{Result, write};
use regex::Regex;
use serde::Serialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    process::Command,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

const CANONICAL_ORIGIN: &str = "https://rrih.github.io";

#[derive(Serialize)]
struct ResponseCheck {
    path: String,
    status: u16,
    milliseconds: u128,
}

struct Checks {
    origin: String,
    results: Vec<ResponseCheck>,
    sitemap_urls: usize,
}

fn require(condition: bool, message: impl Into<String>) -> Result {
    if condition {
        Ok(())
    } else {
        Err(message.into().into())
    }
}

fn response_parts(bytes: &[u8]) -> Result<(&[u8], u16, &str)> {
    let mut parts = bytes.rsplitn(3, |byte| *byte == b'\n');
    let content_type = std::str::from_utf8(parts.next().ok_or("Missing content type")?)?;
    let status = std::str::from_utf8(parts.next().ok_or("Missing HTTP status")?)?.parse::<u16>()?;
    let body = parts.next().ok_or("Missing HTTP body")?;
    Ok((body, status, content_type))
}

impl Checks {
    fn get(&mut self, path: &str, status: u16) -> Result<String> {
        Ok(String::from_utf8(self.get_bytes(path, status)?)?)
    }

    fn get_bytes(&mut self, path: &str, status: u16) -> Result<Vec<u8>> {
        let begin = Instant::now();
        let response = Command::new("curl")
            .args([
                "--silent",
                "--show-error",
                "--max-time",
                "30",
                "--header",
                "Cache-Control: no-cache",
                "--write-out",
                "\n%{http_code}\n%{content_type}",
                &format!("{}{path}", self.origin),
            ])
            .output()?;
        if !response.status.success() {
            return Err(format!(
                "{path}: HTTP request failed: {}",
                String::from_utf8_lossy(&response.stderr).trim()
            )
            .into());
        }
        let (body, actual, content_type) = response_parts(&response.stdout)?;
        self.results.push(ResponseCheck {
            path: path.into(),
            status: actual,
            milliseconds: begin.elapsed().as_millis(),
        });
        require(
            actual == status,
            format!("{path}: HTTP {actual}, expected {status}"),
        )?;
        if path.ends_with(".wasm") && status == 200 {
            require(
                content_type
                    .split(';')
                    .next()
                    .unwrap_or("")
                    .trim()
                    .eq_ignore_ascii_case("application/wasm"),
                format!("{path}: expected application/wasm, received {content_type}"),
            )?;
        }
        Ok(body.to_vec())
    }

    fn verify(&mut self) -> Result {
        let root = self.get("/", 200)?;
        canonical(&root, "/")?;
        require(
            root.contains("<title>rrih — Web Developer</title>"),
            "Personal root title",
        )?;
        require(
            !Regex::new("(?i)atlas|manifest|projects")?.is_match(&root),
            "Personal root independence",
        )?;
        require(
            !Regex::new("adsbygoogle|googletagmanager")?.is_match(&root),
            "Personal root must remain lightweight",
        )?;
        // Legacy single-JS profiles remain readable by this comparison checker.
        // A Rust profile must resolve its entry, bindings and WASM in one bundle.
        if let Some(entry) = Regex::new(r#"src="(/wasm/profile-[a-f0-9]{20}/entry\.js)""#)?
            .captures(&root)
            .map(|capture| capture[1].to_string())
        {
            let directory = entry.trim_end_matches("/entry.js");
            require(
                self.get(&entry, 200)?
                    .contains("import init from './profile.js'"),
                "Profile entry pins its paired bindings",
            )?;
            require(
                self.get(&format!("{directory}/profile.js"), 200)?
                    .contains("new URL('profile_bg.wasm', import.meta.url)"),
                "Profile bindings pin their paired WASM",
            )?;
            require(
                self.get_bytes(&format!("{directory}/profile_bg.wasm"), 200)?
                    .starts_with(b"\0asm\x01\0\0\0"),
                "Profile WASM module",
            )?;
        }
        require(
            self.get("/googleb565df21987f6d4c.html", 200)?.trim()
                == "google-site-verification: googleb565df21987f6d4c.html",
            "Google ownership verification",
        )?;
        let main_heading = Regex::new(r"<h1[ >]")?;
        for path in [
            "/atlas/",
            "/atlas/ja/",
            "/atlas/pokemon/6/",
            "/atlas/ja/pokemon/753/",
            "/atlas/fr/pokemon/1025/",
            "/atlas/zh-Hant/pokemon/6/forms/charizard-mega-x/",
            "/atlas/pokemon/",
            "/atlas/ja/types/grass/",
            "/atlas/ja/forms/mega/",
            "/atlas/ja/help/",
            "/atlas/ja/about/",
            "/atlas/legal/ja/privacy.html",
        ] {
            let document = self.get(path, 200)?;
            canonical(&document, path)?;
            require(
                main_heading.is_match(&document),
                format!("{path}: meaningful initial HTML"),
            )?;
            require(
                !document.contains("name=\"robots\" content=\"noindex"),
                format!("{path}: unexpected noindex"),
            )?;
        }
        for path in ["/pokemon/6/", "/ja/pokemon/753/", "/legal/ja/privacy.html"] {
            let document = self.get(path, 200)?;
            canonical(&document, &format!("/atlas{path}"))?;
            require(
                document.contains("http-equiv=\"refresh\""),
                format!("{path}: immediate move"),
            )?;
        }
        let profile_map = self.get("/sitemap.xml", 200)?;
        require(
            profile_map.matches("<loc>").count() == 12,
            "Profile sitemap coverage",
        )?;
        require(
            !profile_map.contains("/atlas/"),
            "Independent profile sitemap",
        )?;
        let sitemap = self.get("/atlas/sitemap.xml", 200)?;
        let location = Regex::new(r"<loc>([^<]+)</loc>")?;
        let locations = location
            .captures_iter(&sitemap)
            .map(|capture| capture[1].to_owned())
            .collect::<Vec<_>>();
        self.sitemap_urls = locations.len();
        require(
            locations.iter().collect::<BTreeSet<_>>().len() == locations.len(),
            "Unique sitemap URLs",
        )?;
        require(
            locations.len() == 10756,
            "Complete independent Atlas sitemap",
        )?;
        require(
            locations.iter().all(|url| {
                url == &format!("{CANONICAL_ORIGIN}/")
                    || url.starts_with(&format!("{CANONICAL_ORIGIN}/atlas/"))
            }),
            "Sitemap origin and scope",
        )?;
        require(
            self.get("/robots.txt", 200)?
                .contains(&format!("Sitemap: {CANONICAL_ORIGIN}/sitemap.xml")),
            "Robots sitemap",
        )?;
        require(
            self.get("/ads.txt", 200)?.trim()
                == "google.com, pub-6426570202991325, DIRECT, f08c47fec0942fa0",
            "Advertising ownership",
        )?;
        let manifest: Value = serde_json::from_str(&self.get("/atlas/manifest.webmanifest", 200)?)?;
        for key in ["id", "scope", "start_url"] {
            require(manifest[key] == "/atlas/", format!("Atlas manifest {key}"))?;
        }
        require(
            self.get("/sw.js", 200)?
                .contains("self.registration.unregister()"),
            "Root worker retirement",
        )?;
        self.get("/manifest.webmanifest", 404)?;
        self.get("/atlas/sw.js", 200)?;
        for path in [
            "/atlas/pokemon/99999/",
            "/atlas/not-a-real-page/",
            "/shitsugyo-hoken/",
        ] {
            require(
                self.get(path, 404)?.contains("noindex"),
                format!("{path}: real missing page"),
            )?;
        }
        let pictulane = self.get("/tools/pictulane/", 200)?;
        require(
            pictulane.contains("<title>pictulane</title>"),
            "Pictulane title",
        )?;
        require(
            pictulane.contains("/tools/pictulane/manifest.webmanifest"),
            "Pictulane PWA manifest",
        )?;
        require(
            !pictulane.contains("fixture-provider"),
            "Production Pictulane must not contain test provider",
        )?;
        let pictulane_manifest: Value =
            serde_json::from_str(&self.get("/tools/pictulane/manifest.webmanifest", 200)?)?;
        for key in ["id", "scope", "start_url"] {
            require(
                pictulane_manifest[key] == "/tools/pictulane/",
                format!("Pictulane manifest {key}"),
            )?;
        }
        let pictulane_worker = self.get("/tools/pictulane/sw.js", 200)?;
        if !pictulane_worker.contains("wasm_bindgen") {
            // Keep this read-only checker usable for comparison against the pre-migration site.
            require(
                pictulane_worker.contains("pictulane-images-v1")
                    && pictulane_worker.contains("pictulane-image-meta-v1"),
                "Legacy Pictulane cache identity",
            )?;
        } else {
            let bootstrap_path = Regex::new(r"/tools/pictulane/bootstrap-[a-f0-9]{20}\.js")?
                .find(&pictulane)
                .ok_or("Pictulane immutable bootstrap missing")?
                .as_str();
            let bootstrap = self.get(bootstrap_path, 200)?;
            let bootstrap_hash = format!("{:x}", Sha256::digest(bootstrap.as_bytes()));
            require(
                bootstrap_path.ends_with(&format!("bootstrap-{}.js", &bootstrap_hash[..20])),
                "Pictulane bootstrap content hash",
            )?;
            let app = Regex::new(r"/tools/pictulane/(pkg-[a-f0-9]{20})/pictulane\.js")?
                .captures(&bootstrap)
                .ok_or("Pictulane immutable app package missing")?[1]
                .to_owned();
            let worker =
                Regex::new(r"/tools/pictulane/(worker-[a-f0-9]{20})/pictulane_worker_bg\.wasm")?
                    .captures(&pictulane_worker)
                    .ok_or("Pictulane immutable worker package missing")?[1]
                    .to_owned();
            require(
                pictulane_worker.contains(&format!(
                    "importScripts('/tools/pictulane/{worker}/pictulane_worker.js')"
                )) && pictulane_worker.contains("pictulane-shell-"),
                "Pictulane worker ABI pair",
            )?;
            let assets = Regex::new(r"const ASSETS = (\[[^\n]+\])")?
                .captures(&pictulane_worker)
                .ok_or("Pictulane shell assets missing")?[1]
                .to_owned();
            let assets: Vec<String> = serde_json::from_str(&assets)?;
            require(
                assets.iter().any(|path| path == bootstrap_path),
                "Pictulane bootstrap precache",
            )?;
            for (directory, stem) in [(&app, "pictulane"), (&worker, "pictulane_worker")] {
                let prefix = format!("/tools/pictulane/{directory}/");
                let mut paths: Vec<_> = assets
                    .iter()
                    .filter_map(|path| path.strip_prefix(&prefix))
                    .collect();
                paths.sort();
                require(
                    paths.contains(&format!("{stem}.js").as_str())
                        && paths.contains(&format!("{stem}_bg.wasm").as_str()),
                    "Pictulane complete ABI precache",
                )?;
                let mut hash = Sha256::new();
                for path in paths {
                    let bytes = self.get_bytes(&format!("{prefix}{path}"), 200)?;
                    hash.update((path.len() as u64).to_le_bytes());
                    hash.update(path.as_bytes());
                    hash.update((bytes.len() as u64).to_le_bytes());
                    hash.update(&bytes);
                    if path.ends_with(".wasm") {
                        require(bytes.starts_with(b"\0asm\x01\0\0\0"), "Pictulane WASM")?;
                    }
                    require(
                        !bytes.windows(15).any(|part| part == b"PICTULANE_TEST_"),
                        "Production Pictulane fixture exclusion",
                    )?;
                    if path == "pictulane_worker_bg.wasm" {
                        for name in [
                            b"pictulane-images-v1".as_slice(),
                            b"pictulane-image-meta-v1".as_slice(),
                        ] {
                            require(
                                bytes.windows(name.len()).any(|part| part == name),
                                "Pictulane cache identity",
                            )?;
                        }
                    }
                }
                let hash = format!("{:x}", hash.finalize());
                require(
                    directory.ends_with(&hash[..20]),
                    "Pictulane complete package content hash",
                )?;
            }
        }
        let atlas_worker = self.get("/atlas/sw.js", 200)?;
        if !atlas_worker.contains("atlasWorker") && !atlas_worker.contains("worker-runtime-") {
            require(
                atlas_worker.contains("atlas-models-v1")
                    && atlas_worker.contains("atlas-artwork-v1"),
                "Legacy Atlas cache identity",
            )?;
        } else {
            let entry = crate::atlas::app_module(&self.get("/atlas/", 200)?)?;
            let bindings = self.get(&entry, 200)?;
            let wasm_path = crate::atlas::app_wasm(&bindings)?;
            let app_wasm = self.get_bytes(&wasm_path, 200)?;
            require(
                app_wasm.starts_with(b"\0asm\x01\0\0\0"),
                "Atlas application WASM",
            )?;
            crate::atlas::app_precache(&atlas_worker, &entry, bindings.as_bytes())?;
            crate::atlas::app_precache(&atlas_worker, &wasm_path, &app_wasm)?;
            let not_found = self.get("/atlas/404.html", 200)?;
            require(
                crate::atlas::app_module(&not_found)? == entry,
                "Atlas 404 module pair",
            )?;
            crate::atlas::app_precache(&atlas_worker, "/atlas/404.html", not_found.as_bytes())?;
            let loader = Regex::new(r"worker-runtime-[a-f0-9]{20}\.js")?
                .find(&atlas_worker)
                .ok_or("Missing Atlas worker runtime")?
                .as_str()
                .to_owned();
            let loader_name = loader;
            let loader = self.get(&format!("/atlas/{loader_name}"), 200)?;
            let loader_digest = format!("{:x}", Sha256::digest(loader.as_bytes()));
            require(
                loader_name == format!("worker-runtime-{}.js", &loader_digest[..20]),
                "Atlas worker loader content hash",
            )?;
            let module = Regex::new(r"worker-([a-f0-9]{20})\.wasm")?
                .captures(&loader)
                .ok_or("Missing Atlas policy module")?;
            let hash = module[1].to_owned();
            require(
                loader.contains(&format!("worker-{hash}.js")),
                "Atlas worker ABI/module generation",
            )?;
            let bindings = self.get_bytes(&format!("/atlas/worker-{hash}.js"), 200)?;
            let wasm = self.get_bytes(&format!("/atlas/worker-{hash}.wasm"), 200)?;
            require(wasm.starts_with(b"\0asm\x01\0\0\0"), "Atlas worker WASM")?;
            let mut digest = Sha256::new();
            digest.update(&bindings);
            digest.update(&wasm);
            require(
                format!("{:x}", digest.finalize()).starts_with(&hash),
                "Atlas worker ABI/module content hash",
            )?;
        }
        self.get("/tools/pictulane/not-found.js", 404)?;
        self.get("/tools/pictulane/src/main.tsx", 404)?;
        Ok(())
    }
}

fn canonical(document: &str, path: &str) -> Result {
    require(
        document.contains(&format!(
            "rel=\"canonical\" href=\"{CANONICAL_ORIGIN}{path}\""
        )),
        format!("{path}: canonical"),
    )
}

pub fn verify() -> Result {
    let origin = std::env::var("SITE_URL")
        .unwrap_or_else(|_| CANONICAL_ORIGIN.into())
        .trim_end_matches('/')
        .to_owned();
    let mut checks = Checks {
        origin,
        results: vec![],
        sitemap_urls: 0,
    };
    let result = checks.verify();
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)?;
    let seconds = timestamp.as_secs() % 86400;
    let checked_at = format!(
        "{}T{:02}:{:02}:{:02}.{:03}Z",
        crate::atlas::civil_date((timestamp.as_secs() / 86400) as i64),
        seconds / 3600,
        seconds / 60 % 60,
        seconds % 60,
        timestamp.subsec_millis()
    );
    write(
        "work/production-check/latest.json",
        format!(
            "{}\n",
            serde_json::to_string_pretty(&json!({
                "checkedAt": checked_at, "origin": checks.origin, "sitemapURLs": checks.sitemap_urls,
                "results": checks.results, "verified": result.is_ok(), "error": result.as_ref().err().map(ToString::to_string),
                "scope": "Public HTTP and initial HTML. Does not measure Google indexing, field performance, or ad delivery.",
            }))?
        ),
    )?;
    result?;
    println!(
        "Verified {} public responses and {} sitemap URLs.",
        checks.results.len(),
        checks.sitemap_urls
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn binary_http_metadata_does_not_decode_or_truncate_wasm() -> Result {
        let binary = b"\0asm\x01\0\0\0\xff\n\n";
        let mut response = binary.to_vec();
        response.extend_from_slice(b"\n200\napplication/wasm");
        assert_eq!(
            response_parts(&response)?,
            (binary.as_slice(), 200, "application/wasm")
        );
        assert_eq!(
            response_parts(b"\n404\ntext/html")?,
            (b"".as_slice(), 404, "text/html")
        );
        assert!(response_parts(b"body\nnot-status\ntext/plain").is_err());
        assert!(response_parts(b"incomplete").is_err());
        Ok(())
    }
}
