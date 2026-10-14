use crate::model::{Album, username, valid_album, valid_resume};
use serde::{Serialize, de::DeserializeOwned};
const PREFIX: &str = "pictulane:v1:";
fn store() -> Option<web_sys::Storage> {
    web_sys::window()?.local_storage().ok().flatten()
}
pub fn read<T: DeserializeOwned>(key: &str) -> Option<T> {
    let s = store()?.get_item(&format!("{PREFIX}{key}")).ok()??;
    if s.encode_utf16().count() > 600_000 {
        return None;
    };
    serde_json::from_str(&s).ok()
}
pub fn write<T: Serialize>(key: &str, value: &T) -> bool {
    let Ok(s) = serde_json::to_string(value) else {
        return false;
    };
    s.encode_utf16().count() <= 600_000
        && store().is_some_and(|st| st.set_item(&format!("{PREFIX}{key}"), &s).is_ok())
}
pub fn remove(key: &str) {
    if let Some(st) = store() {
        let _ = st.remove_item(&format!("{PREFIX}{key}"));
    }
}
pub fn recent() -> Vec<String> {
    read::<Vec<serde_json::Value>>("recent")
        .unwrap_or_default()
        .into_iter()
        .filter_map(|v| v.as_str().map(str::to_owned))
        .filter(|s| username(s).is_ok_and(|v| v == *s))
        .take(8)
        .collect()
}
pub fn remember(account: &str) {
    let old = recent();
    let mut list = vec![account.to_string()];
    list.extend(
        old.iter()
            .filter(|s| s.as_str() != account)
            .take(7)
            .cloned(),
    );
    for a in old.iter().filter(|s| !list.contains(s)) {
        remove(&format!("album:{a}"));
        remove(&format!("resume:{a}"));
    }
    write("recent", &list);
}
#[cfg(feature = "test-fixtures")]
pub fn save_album(a: &Album) -> bool {
    remember(&a.username);
    let mut bounded = a.clone();
    bounded.posts.truncate(300);
    if serde_json::to_string(&bounded).map_or(true, |s| s.encode_utf16().count() > 60_000) {
        return false;
    };
    write(&format!("album:{}", a.username), &bounded)
}
pub fn cached_album(account: &str) -> Option<Album> {
    let raw = read::<serde_json::Value>(&format!("album:{account}"))?;
    // Existing schema treats an explicitly null optional field as corrupt, not absent.
    for post in raw.get("posts")?.as_array()? {
        for key in ["text", "date"] {
            if post.get(key).is_some_and(|value| !value.is_string()) {
                return None;
            }
        }
        for key in ["sensitive", "repost"] {
            if post.get(key).is_some_and(|value| !value.is_boolean()) {
                return None;
            }
        }
        for photo in post.get("images")?.as_array()? {
            if photo.get("alt").is_some_and(|value| !value.is_string()) {
                return None;
            }
        }
    }
    let a: Album = serde_json::from_value(raw).ok()?;
    if valid_album(&a, account)
        && js_sys::Date::parse(&a.fetched_at).is_finite()
        && a.posts.iter().all(|p| {
            p.date
                .as_ref()
                .is_none_or(|d| js_sys::Date::parse(d).is_finite())
        })
    {
        Some(a)
    } else {
        None
    }
}
pub fn clear_history() {
    if let Some(st) = store() {
        let keys: Vec<_> = (0..st.length().unwrap_or(0))
            .filter_map(|i| st.key(i).ok().flatten())
            .filter(|k| {
                k.starts_with(&format!("{PREFIX}album:"))
                    || k.starts_with(&format!("{PREFIX}resume:"))
                    || k == &format!("{PREFIX}recent")
            })
            .collect();
        for key in keys {
            let _ = st.remove_item(&key);
        }
    }
}
pub fn resume(account: &str) -> Option<String> {
    read::<String>(&format!("resume:{account}")).filter(|s| valid_resume(s))
}
