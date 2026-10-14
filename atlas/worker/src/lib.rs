//! Atlas service-worker policy. Workbox supplies cache strategies and event wiring.

pub fn normalized_path(path: &str, kind: &str) -> String {
    let prefix = format!("/atlas/{kind}/");
    path.strip_prefix(&prefix)
        .map(|remainder| format!("/{kind}/{remainder}"))
        .unwrap_or_else(|| path.to_owned())
}

pub fn preview_species(path: &str) -> Option<&str> {
    let species = path.rsplit_once("/previews/")?.1.strip_suffix(".webp")?;
    (!species.is_empty() && species.bytes().all(|byte| byte.is_ascii_digit())).then_some(species)
}

pub fn navigation_uses_shell(path: &str) -> bool {
    let Some(relative) = path.strip_prefix("/atlas/") else {
        return false;
    };
    let relative = relative
        .split_once('/')
        .filter(|(locale, _)| {
            ["ja", "fr", "de", "es", "it", "ko", "zh-Hans", "zh-Hant"].contains(locale)
        })
        .map_or(relative, |(_, path)| path);
    if relative.is_empty() {
        return true;
    }
    let Some(route) = relative.strip_prefix("pokemon/") else {
        return false;
    };
    let Some((id, tail)) = route.split_once('/') else {
        return false;
    };
    if id.is_empty()
        || !id.bytes().all(|byte| byte.is_ascii_digit())
        || !id
            .trim_start_matches('0')
            .parse::<u16>()
            .is_ok_and(|id| (1..=1025).contains(&id))
    {
        return false;
    }
    if tail.is_empty() {
        return true;
    }
    let Some(form) = tail
        .strip_prefix("forms/")
        .and_then(|form| form.strip_suffix('/'))
    else {
        return false;
    };
    !form.is_empty()
        && form
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

#[cfg(target_arch = "wasm32")]
mod browser {
    use super::*;
    use wasm_bindgen::{JsCast, prelude::*};
    use wasm_bindgen_futures::JsFuture;
    use web_sys::{CacheQueryOptions, Response, ResponseInit, Url, WorkerGlobalScope};

    async fn cached(path: &str) -> Result<Option<Response>, JsValue> {
        let scope: WorkerGlobalScope = js_sys::global().unchecked_into();
        let options = CacheQueryOptions::new();
        options.set_ignore_search(true);
        let response =
            JsFuture::from(scope.caches()?.match_with_str_and_options(path, &options)).await?;
        Ok(response.dyn_into::<Response>().ok())
    }

    #[wasm_bindgen]
    pub fn cache_key(request_url: &str, kind: &str) -> Result<String, JsValue> {
        let url = Url::new(request_url)?;
        if !["artwork", "models"].contains(&kind) {
            return Err(JsValue::from_str("Unknown Atlas cache"));
        }
        url.set_pathname(&normalized_path(&url.pathname(), kind));
        Ok(url.href())
    }

    #[wasm_bindgen]
    pub fn artwork_unavailable() -> Result<Response, JsValue> {
        // A missing offline image is an HTTP failure, not an unhandled worker error.
        // Workbox returns this outside CacheFirst's write path, so it cannot replace artwork.
        let init = ResponseInit::new();
        init.set_status(503);
        Response::new_with_opt_str_and_init(Some(""), &init)
    }

    #[wasm_bindgen]
    pub async fn preview_fallback(request_url: String) -> Result<Response, JsValue> {
        let url = Url::new(&request_url)?;
        if let Some(species) = preview_species(&url.pathname()) {
            for path in [
                format!("/artwork/{species}.webp"),
                format!("/atlas/artwork/{species}.webp"),
            ] {
                if let Some(response) = cached(&path).await? {
                    return Ok(response);
                }
            }
        }
        if let Some(response) = cached("/atlas/icon.svg").await? {
            return Ok(response);
        }
        let init = ResponseInit::new();
        init.set_status(503);
        Response::new_with_opt_str_and_init(Some(""), &init)
    }

    #[wasm_bindgen]
    pub async fn navigation_fallback(request_url: String) -> Result<Response, JsValue> {
        let url = Url::new(&request_url)?;
        if navigation_uses_shell(&url.pathname())
            && let Some(response) = cached("/atlas/index.html").await?
        {
            return Ok(response);
        }
        let init = ResponseInit::new();
        init.set_status(503);
        let headers = web_sys::Headers::new()?;
        headers.set("Content-Type", "text/html; charset=utf-8")?;
        init.set_headers(&headers);
        Response::new_with_opt_str_and_init(
            Some(
                "<!doctype html><meta name=\"robots\" content=\"noindex\"><title>Offline</title><p>This page is not saved offline.</p><a href=\"/atlas/\">Pokémon Atlas</a>",
            ),
            &init,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cache_paths_preserve_existing_storage_identity() {
        for kind in ["models", "artwork"] {
            for suffix in [
                "6.glb",
                "home/6.glb",
                "shiny-home/6.glb",
                "forms/charizard-mega-x.glb",
                "6.webp",
            ] {
                assert_eq!(
                    normalized_path(&format!("/atlas/{kind}/{suffix}"), kind),
                    format!("/{kind}/{suffix}")
                );
                assert_eq!(
                    normalized_path(&format!("/{kind}/{suffix}"), kind),
                    format!("/{kind}/{suffix}")
                );
            }
        }
        assert_eq!(
            normalized_path("/other/atlas/models/6.glb", "models"),
            "/other/atlas/models/6.glb"
        );
    }
    #[test]
    fn preview_fallback_never_substitutes_another_species_or_form() {
        assert_eq!(preview_species("/atlas/previews/6.webp"), Some("6"));
        assert_eq!(preview_species("/previews/0025.webp"), Some("0025"));
        for path in [
            "/atlas/previews/forms/charizard-mega-x.webp",
            "/atlas/previews/a.webp",
            "/atlas/previews/6.png",
            "/atlas/previews/.webp",
            "/atlas/previews/6.WEBP",
        ] {
            assert_eq!(preview_species(path), None);
        }
    }
    #[test]
    fn shell_fallback_matches_all_existing_valid_routes_only() {
        assert!(navigation_uses_shell(
            "/atlas/pokemon/0000000000000000000000000006/"
        ));
        for locale in [
            "", "ja/", "fr/", "de/", "es/", "it/", "ko/", "zh-Hans/", "zh-Hant/",
        ] {
            assert!(navigation_uses_shell(&format!("/atlas/{locale}")));
            for id in 1..=1025 {
                assert!(navigation_uses_shell(&format!(
                    "/atlas/{locale}pokemon/{id}/"
                )));
                assert!(navigation_uses_shell(&format!(
                    "/atlas/{locale}pokemon/{id}/forms/form-1/"
                )));
            }
        }
        for path in [
            "/",
            "/atlas",
            "/atlas/en/",
            "/atlas/pt/",
            "/atlas/types/fire/",
            "/atlas/help/",
            "/atlas/pokemon/0/",
            "/atlas/pokemon/1026/",
            "/atlas/pokemon/-1/",
            "/atlas/pokemon/6",
            "/atlas/pokemon/6/forms/",
            "/atlas/pokemon/6/forms/Mega/",
            "/atlas/pokemon/6/forms/mega/extra/",
            "/atlas/pokemon/6/extra/",
        ] {
            assert!(!navigation_uses_shell(path), "{path}");
        }
    }
}
