pub const IMAGE_CACHE: &str = "pictulane-images-v1";
pub const META_CACHE: &str = "pictulane-image-meta-v1";
pub const TTL_MS: f64 = 24.0 * 60.0 * 60.0 * 1000.0;
pub fn valid_media_path(path: &str) -> bool {
    path.strip_prefix("/media/").is_some_and(|media| {
        !media.is_empty()
            && media
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'.' | b'-'))
    })
}
pub fn expired(saved: Option<f64>, now: f64) -> bool {
    saved.is_none_or(|saved| !saved.is_finite() || now - saved > TTL_MS)
}
pub fn image_limit(opaque: bool) -> usize {
    if opaque { 10 } else { 100 }
}
/// Only immutable runtime URLs may fall back to an older Pictulane shell.
pub fn versioned_runtime_path(path: &str) -> bool {
    let Some(path) = path.strip_prefix("/tools/pictulane/") else {
        return false;
    };
    let hash = |value: &str| {
        value.len() == 20
            && value
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    };
    if let Some(value) = path.strip_prefix("bootstrap-") {
        return value.strip_suffix(".js").is_some_and(hash);
    }
    let Some((directory, file)) = path.split_once('/') else {
        return false;
    };
    (directory
        .strip_prefix("pkg-")
        .or_else(|| directory.strip_prefix("worker-"))
        .is_some_and(hash))
        && (file.ends_with(".js") || file.ends_with(".wasm"))
        && file.split('/').all(|part| {
            !part.is_empty()
                && part != "."
                && part != ".."
                && part
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.'))
        })
}
#[cfg(target_arch = "wasm32")]
mod worker;
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn media_paths_are_strict() {
        assert!(valid_media_path("/media/a_B-1.png"));
        for path in [
            "/media/",
            "/other/x",
            "/media/x/y",
            "/media/x%20",
            "/media/é",
        ] {
            assert!(!valid_media_path(path));
        }
    }
    #[test]
    fn expiry_and_type_limits_match_existing_cache() {
        assert!(!expired(Some(1.0), TTL_MS + 1.0));
        assert!(expired(Some(1.0), TTL_MS + 2.0));
        assert!(expired(None, 0.0));
        assert!(expired(Some(f64::NAN), 0.0));
        assert_eq!(image_limit(false), 100);
        assert_eq!(image_limit(true), 10);
    }
    #[test]
    fn previous_shell_runtime_urls_stay_in_the_immutable_namespace() {
        let hash = "0123456789abcdefabcd";
        for suffix in [
            format!("pkg-{hash}/pictulane.js"),
            format!("pkg-{hash}/pictulane_bg.wasm"),
            format!("pkg-{hash}/snippets/example/module.js"),
            format!("worker-{hash}/pictulane_worker_bg.wasm"),
            format!("bootstrap-{hash}.js"),
        ] {
            assert!(versioned_runtime_path(&format!(
                "/tools/pictulane/{suffix}"
            )));
        }
        for path in [
            "/atlas/pkg-0123456789abcdefabcd/app.js",
            "/tools/pictulane/pkg/pictulane.js",
            "/tools/pictulane/pkg-0123456789abcdefabcg/pictulane.js",
            "/tools/pictulane/pkg-0123456789abcdefabcd/../other.js",
            "/tools/pictulane/pkg-0123456789abcdefabcd//other.js",
            "/tools/pictulane/pkg-0123456789abcdefabcd/image.png",
            "/tools/pictulane/bootstrap-0123456789abcdefabcd.js/other.js",
            "/tools/pictulane/bootstrap-0123456789abcdefabcd.js?different",
        ] {
            assert!(!versioned_runtime_path(path), "{path}");
        }
    }
}
