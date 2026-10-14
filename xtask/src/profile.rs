use crate::{Result, copy_file, write};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs, path::Path};

const ORIGIN: &str = "https://rrih.github.io";
const ENTRY: &str = "import init from './profile.js';\ninit().catch(error => console.error('Profile interactions unavailable', error));\n";

fn bundle_files(root: &Path) -> Result<BTreeMap<String, Vec<u8>>> {
    fn collect(root: &Path, dir: &Path, files: &mut BTreeMap<String, Vec<u8>>) -> Result {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if entry.file_type()?.is_dir() {
                collect(root, &path, files)?;
            } else if entry.file_type()?.is_file() {
                files.insert(
                    path.strip_prefix(root)?
                        .to_string_lossy()
                        .replace('\\', "/"),
                    fs::read(path)?,
                );
            } else {
                return Err(format!("Unsupported profile bundle entry: {}", path.display()).into());
            }
        }
        Ok(())
    }
    let mut files = BTreeMap::new();
    collect(root, root, &mut files)?;
    Ok(files)
}

fn bundle_directory(files: &BTreeMap<String, Vec<u8>>) -> String {
    let mut hash = Sha256::new();
    for (path, bytes) in files {
        // Include names and lengths, so different file boundaries cannot collide.
        hash.update((path.len() as u64).to_le_bytes());
        hash.update(path.as_bytes());
        hash.update((bytes.len() as u64).to_le_bytes());
        hash.update(bytes);
    }
    format!("wasm/profile-{}", &format!("{:x}", hash.finalize())[..20])
}

fn publish_bundle(output: &Path, files: &BTreeMap<String, Vec<u8>>) -> Result<String> {
    let directory = bundle_directory(files);
    for (name, bytes) in files {
        write(output.join(&directory).join(name), bytes)?;
    }
    Ok(format!("/{directory}/entry.js"))
}

fn verify_bundle(output: &Path, html: &str) -> Result<String> {
    let entry = regex::Regex::new(
        r#"<script src="(/wasm/profile-[a-f0-9]{20}/entry\.js)" type="module">"#,
    )?
    .captures(html)
    .ok_or("Missing content-addressed profile entry")?[1]
        .to_string();
    let directory = entry
        .strip_suffix("/entry.js")
        .ok_or("Invalid profile entry")?;
    let files = bundle_files(&output.join(directory.trim_start_matches('/')))?;
    if format!("/{}", bundle_directory(&files)) != directory {
        return Err("Profile bundle content does not match its address".into());
    }
    if files.get("entry.js").map(Vec::as_slice) != Some(ENTRY.as_bytes())
        || files.get("profile.js").is_none_or(Vec::is_empty)
        || !files
            .get("profile_bg.wasm")
            .is_some_and(|bytes| bytes.starts_with(b"\0asm\x01\0\0\0"))
    {
        return Err("Incomplete profile JS/WASM bundle".into());
    }
    Ok(entry)
}
fn route(locale: &str) -> String {
    if locale == "en" {
        "/".into()
    } else {
        format!("/{locale}/")
    }
}
fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
}

pub fn render(
    template: &str,
    locales: &Value,
    locale: &str,
    copy: &Value,
    entry: &str,
) -> Result<String> {
    let all = locales.as_object().ok_or("Expected profile locales")?;
    let url = format!("{ORIGIN}{}", route(locale));
    let alternates = all
        .keys()
        .map(|code| {
            format!(
                "<link rel=\"alternate\" hreflang=\"{code}\" href=\"{ORIGIN}{}\">",
                route(code)
            )
        })
        .chain(std::iter::once(format!(
            "<link rel=\"alternate\" hreflang=\"x-default\" href=\"{ORIGIN}/\">"
        )))
        .collect::<Vec<_>>()
        .join("\n");
    let languages = all
        .iter()
        .map(|(code, text)| {
            format!(
                "<a href=\"{}\" hreflang=\"{code}\" lang=\"{code}\"{}>{}</a>",
                route(code),
                if code == locale {
                    " aria-current=\"page\""
                } else {
                    ""
                },
                escape(text["label"].as_str().unwrap_or_default())
            )
        })
        .collect::<String>();
    let structured = json!({
        "@context": "https://schema.org", "@type": "ProfilePage", "url": url,
        "name": "rrih — Web Developer", "inLanguage": locale,
        "mainEntity": { "@type": "Person", "@id": format!("{ORIGIN}/#person"), "name": "rrih", "jobTitle": "Web Developer", "description": copy["description"], "image": "https://github.com/rrih.png", "url": format!("{ORIGIN}/"), "sameAs": ["https://x.com/rrih_dev", "https://github.com/rrih"], "knowsAbout": ["Web development", "Frontend development", "Backend development", "Infrastructure", "TypeScript", "Go", "Cloudflare"] }
    });
    let og = BTreeMap::from([
        ("en", "en_US"),
        ("ja", "ja_JP"),
        ("fr", "fr_FR"),
        ("de", "de_DE"),
        ("es", "es_ES"),
        ("it", "it_IT"),
        ("pt", "pt_BR"),
        ("ko", "ko_KR"),
        ("zh-Hans", "zh_CN"),
        ("zh-Hant", "zh_TW"),
        ("ar", "ar_AR"),
        ("ru", "ru_RU"),
    ]);
    let mut values: BTreeMap<String, String> = copy
        .as_object()
        .ok_or("Expected translated copy")?
        .iter()
        .map(|(key, value)| {
            Ok((
                key.clone(),
                escape(value.as_str().ok_or("Non-string profile copy")?),
            ))
        })
        .collect::<Result<_>>()?;
    values.extend([
        ("locale".into(), locale.into()),
        ("entry".into(), escape(entry)),
        (
            "direction".into(),
            if locale == "ar" { "rtl" } else { "ltr" }.into(),
        ),
        ("url".into(), url),
        (
            "ogLocale".into(),
            og.get(locale).ok_or("Unknown OG locale")?.to_string(),
        ),
        ("alternates".into(), alternates),
        ("languages".into(), languages),
        (
            "structured".into(),
            format!(
                "<script type=\"application/ld+json\">{}</script>",
                serde_json::to_string(&structured)?.replace('<', "\\u003c")
            ),
        ),
    ]);
    let mut html = String::new();
    let mut rest = template;
    while let Some(start) = rest.find("{{") {
        html.push_str(&rest[..start]);
        let tail = &rest[start + 2..];
        let end = tail.find("}}").ok_or("Unclosed template key")?;
        html.push_str(
            values
                .get(&tail[..end])
                .ok_or_else(|| format!("Unknown template key: {}", &tail[..end]))?,
        );
        rest = &tail[end + 2..];
    }
    html.push_str(rest);
    Ok(html)
}

pub fn build() -> Result<()> {
    crate::wasm("profile-app", "profile/rust/pkg", "profile")?;
    let locales: Value = serde_json::from_str(&fs::read_to_string("profile/locales.json")?)?;
    let template = fs::read_to_string("index.html")?;
    crate::fresh_dir("dist")?;
    let mut files = bundle_files(Path::new("profile/rust/pkg"))?;
    files.insert("entry.js".into(), ENTRY.as_bytes().to_vec());
    let entry = publish_bundle(Path::new("dist"), &files)?;
    for (locale, copy) in locales.as_object().ok_or("Expected locales")? {
        write(
            format!("dist{}index.html", route(locale)),
            render(&template, &locales, locale, copy, &entry)?,
        )?;
    }
    for file in [
        "style.css",
        "profile-card.png",
        "googleb565df21987f6d4c.html",
    ] {
        copy_file(file, format!("dist/{file}"))?;
    }
    // A cached pre-migration HTML page may still request this former entry URL.
    // New HTML always uses the immutable entry, which pins the entire ABI pair.
    write("dist/profile.js", format!("import '{entry}';\n"))?;
    copy_file("scripts/retire-root-worker.js", "dist/sw.js")?;
    write("dist/.nojekyll", "")?;
    write(
        "dist/robots.txt",
        format!("User-agent: *\nAllow: /\n\nSitemap: {ORIGIN}/sitemap.xml\n"),
    )?;
    let urls = locales
        .as_object()
        .unwrap()
        .keys()
        .map(|locale| format!("<url><loc>{ORIGIN}{}</loc></url>", route(locale)))
        .collect::<String>();
    write(
        "dist/sitemap.xml",
        format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">{urls}</urlset>\n"
        ),
    )?;
    write(
        "dist/404.html",
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>Page not found</title><style>body{font:18px/1.7 system-ui;margin:15vh auto;padding:24px;max-width:640px;color:#222724;background:#f6f5f1}</style></head><body><main><h1>404</h1><p>Page not found. Check the address and try again.</p></main></body></html>",
    )?;
    verify()?;
    println!(
        "Built Rust profile in {} languages",
        locales.as_object().unwrap().len()
    );
    Ok(())
}

pub fn verify() -> Result<()> {
    let locales: Value = serde_json::from_str(&fs::read_to_string("profile/locales.json")?)?;
    let entry = verify_bundle(Path::new("dist"), &fs::read_to_string("dist/index.html")?)?;
    if fs::read_to_string("dist/profile.js")? != format!("import '{entry}';\n") {
        return Err("Legacy profile entry does not resolve the current immutable bundle".into());
    }
    for locale in locales.as_object().ok_or("Expected locales")?.keys() {
        let html = fs::read_to_string(format!("dist{}index.html", route(locale)))?;
        if !html.contains(&format!("src=\"{entry}\"")) {
            return Err(
                format!("Profile locale {locale} uses a different application bundle").into(),
            );
        }
        for required in [
            format!("lang=\"{locale}\""),
            format!("rel=\"canonical\" href=\"{ORIGIN}{}\"", route(locale)),
            "https://github.com/rrih.png".into(),
            "https://x.com/rrih_dev".into(),
            "2019".into(),
        ] {
            if !html.contains(&required) {
                return Err(format!("Missing profile content: {required}").into());
            }
        }
        if html.matches("rel=\"alternate\"").count() != 13 {
            return Err("Incorrect profile alternates".into());
        }
        let lower = html.to_lowercase();
        for forbidden in [
            "atlas",
            "pokémon",
            "manifest",
            "projects",
            "orimemo",
            "zenn",
            "googletagmanager",
            "adsbygoogle",
            "{{",
        ] {
            if lower.contains(forbidden) {
                return Err(format!("Profile contains {forbidden}").into());
            }
        }
        let start = html
            .find("<script type=\"application/ld+json\">")
            .ok_or("Profile JSON-LD missing")?
            + "<script type=\"application/ld+json\">".len();
        let end = html[start..].find("</script>").ok_or("Invalid JSON-LD")? + start;
        let data: Value = serde_json::from_str(&html[start..end])?;
        if data["@type"] != "ProfilePage" || data["mainEntity"]["jobTitle"] != "Web Developer" {
            return Err("Profile schema changed".into());
        }
    }
    for file in ["manifest.webmanifest", "atlas", "icon-192.png"] {
        if Path::new(&format!("dist/{file}")).exists() {
            return Err(format!("Unexpected profile file: {file}").into());
        }
    }
    if !Path::new("dist/profile-card.png").is_file() {
        return Err("Missing profile artifact: profile-card.png".into());
    }
    let worker = fs::read_to_string("dist/sw.js")?;
    if !worker.contains("self.registration.unregister()")
        || ["addEventListener('fetch'", "caches.delete", "clients.claim"]
            .iter()
            .any(|s| worker.contains(s))
    {
        return Err("Root worker must only retire itself".into());
    }
    if fs::read_to_string("dist/sitemap.xml")?
        .matches("<loc>")
        .count()
        != 12
    {
        return Err("Profile sitemap changed".into());
    }
    let readme = fs::read_to_string("README.md")?.to_lowercase();
    if ["atlas", "pokémon", "orimemo", "zenn"]
        .iter()
        .any(|s| readme.contains(s))
    {
        return Err("Profile README must remain independent".into());
    }
    println!("Profile content, metadata, social links, WASM and root worker verified");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_real_translations_render_and_escape_in_context() {
        let template = include_str!("../../index.html");
        let locales: Value =
            serde_json::from_str(include_str!("../../profile/locales.json")).unwrap();
        let entry = "/wasm/profile-0123456789abcdef0123/entry.js";
        for (locale, copy) in locales.as_object().unwrap() {
            let html = render(template, &locales, locale, copy, entry).unwrap();
            assert!(!html.contains("{{"));
            assert_eq!(html.matches("rel=\"alternate\"").count(), 13);
            assert!(html.contains(&format!("lang=\"{locale}\"")));
            assert!(html.contains(&format!("src=\"{entry}\"")));
        }
        assert_eq!(escape("<&\""), "&lt;&amp;&quot;");
        assert!(render("{{missing}}", &locales, "en", &locales["en"], entry).is_err());
    }

    fn example_bundle() -> BTreeMap<String, Vec<u8>> {
        BTreeMap::from([
            ("entry.js".into(), ENTRY.as_bytes().to_vec()),
            (
                "profile.js".into(),
                b"import './snippets/helper.js'; export default async function init() {}".to_vec(),
            ),
            ("profile_bg.wasm".into(), b"\0asm\x01\0\0\0".to_vec()),
            (
                "snippets/helper.js".into(),
                b"export const value = 1;".to_vec(),
            ),
        ])
    }

    #[test]
    fn every_binding_wasm_entry_and_support_file_changes_the_bundle_address() {
        let files = example_bundle();
        let original = bundle_directory(&files);
        for name in files.keys() {
            let mut changed = files.clone();
            changed.get_mut(name).unwrap().push(b' ');
            assert_ne!(bundle_directory(&changed), original, "{name}");
        }
        let mut renamed = files.clone();
        let support = renamed.remove("snippets/helper.js").unwrap();
        renamed.insert("snippets/renamed.js".into(), support);
        assert_ne!(bundle_directory(&renamed), original);
        let reordered = files.into_iter().rev().collect();
        assert_eq!(bundle_directory(&reordered), original);
    }

    #[test]
    fn publishing_a_new_pair_preserves_the_old_pair_and_detects_mixed_bytes() -> Result {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_nanos();
        let output =
            std::env::temp_dir().join(format!("profile-bundle-{}-{unique}", std::process::id()));
        let old = example_bundle();
        let old_entry = publish_bundle(&output, &old)?;
        let mut new = old.clone();
        new.get_mut("profile.js")
            .unwrap()
            .extend_from_slice(b"\n// changed ABI bindings");
        new.get_mut("profile_bg.wasm")
            .unwrap()
            .extend_from_slice(&[0, 2, 1, b'x']);
        let new_entry = publish_bundle(&output, &new)?;
        assert_ne!(new_entry, old_entry);
        for (entry, files) in [(&old_entry, &old), (&new_entry, &new)] {
            let document = format!("<script src=\"{entry}\" type=\"module\"></script>");
            assert_eq!(verify_bundle(&output, &document)?, *entry);
            let directory = entry
                .trim_start_matches('/')
                .strip_suffix("/entry.js")
                .unwrap();
            for (name, bytes) in files {
                assert_eq!(&fs::read(output.join(directory).join(name))?, bytes);
            }
        }
        let new_directory = new_entry
            .trim_start_matches('/')
            .strip_suffix("/entry.js")
            .unwrap();
        fs::write(
            output.join(new_directory).join("profile_bg.wasm"),
            &old["profile_bg.wasm"],
        )?;
        let document = format!("<script src=\"{new_entry}\" type=\"module\"></script>");
        assert!(
            verify_bundle(&output, &document).is_err(),
            "An old WASM must not pass as the new binding pair"
        );
        fs::remove_dir_all(output)?;
        Ok(())
    }
}
