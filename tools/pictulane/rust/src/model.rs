use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, PartialEq, Serialize, Deserialize, Debug)]
pub struct Photo {
    pub key: String,
    pub position: u8,
    pub url: String,
    pub thumb: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alt: Option<String>,
}
#[derive(Clone, PartialEq, Serialize, Deserialize, Debug)]
pub struct Post {
    pub id: String,
    pub author: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sensitive: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repost: Option<bool>,
    pub images: Vec<Photo>,
}
#[derive(Clone, PartialEq, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub version: u8,
    pub username: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    pub fetched_at: String,
    pub posts: Vec<Post>,
    pub range: String,
}
#[derive(Clone, PartialEq, Debug)]
pub struct Slide {
    pub photo: Photo,
    pub id: String,
    pub post: Post,
    pub total: usize,
}
#[derive(Clone, Default, PartialEq, Debug)]
pub struct Route {
    pub username: Option<String>,
    pub post_id: Option<String>,
    pub image_key: Option<String>,
    pub invalid: bool,
}
fn word(s: &str) -> bool {
    s.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_')
}
fn media_key(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 80
        && s.bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-'))
}
fn numeric(s: &str) -> bool {
    !s.is_empty() && s.len() <= 30 && s.bytes().all(|c| c.is_ascii_digit())
}
pub fn username(input: &str) -> Result<String, &'static str> {
    let mut s = input
        .trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
        .to_string();
    if s.encode_utf16().count() > 256 {
        return Err("invalid");
    }
    if s.contains("://") {
        let u = url::Url::parse(&s).map_err(|_| "invalid")?;
        if u.scheme() != "https"
            || !u.username().is_empty()
            || u.password().is_some()
            || u.port().is_some()
            || ![
                "x.com",
                "www.x.com",
                "twitter.com",
                "www.twitter.com",
                "mobile.twitter.com",
            ]
            .contains(&u.host_str().unwrap_or(""))
            || u.query().is_some_and(|query| !query.is_empty())
            || u.fragment().is_some_and(|fragment| !fragment.is_empty())
        {
            return Err("invalid");
        }
        let p: Vec<_> = u
            .path()
            .strip_prefix('/')
            .unwrap_or_default()
            .strip_suffix('/')
            .unwrap_or(u.path().strip_prefix('/').unwrap_or_default())
            .split('/')
            .collect();
        if !(p.len() == 1 || (p.len() == 2 && p[1] == "media")) || !word(p[0]) {
            return Err("invalid");
        }
        s = p[0].into();
    }
    s = s.strip_prefix('@').unwrap_or(&s).to_string();
    if s.is_empty()
        || s.len() > 15
        || !word(&s)
        || [
            "home", "explore", "search", "i", "settings", "intent", "login", "signup",
        ]
        .contains(&s.to_lowercase().as_str())
    {
        return Err("invalid");
    }
    Ok(s.to_lowercase())
}
pub fn image_url(raw: &str) -> bool {
    url::Url::parse(raw).is_ok_and(|u| {
        u.scheme() == "https"
            && u.host_str() == Some("pbs.twimg.com")
            && u.username().is_empty()
            && u.password().is_none()
            && u.port().is_none()
            && u.path().strip_prefix("/media/").is_some_and(|p| {
                !p.is_empty()
                    && p.bytes()
                        .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'.' | b'-'))
            })
    })
}
pub fn flatten(a: &Album) -> Vec<Slide> {
    let mut posts: Vec<_> = a
        .posts
        .iter()
        .filter(|p| {
            p.repost != Some(true) && p.author.to_lowercase() == a.username && numeric(&p.id)
        })
        .collect();
    posts.sort_by(|a, b| b.id.len().cmp(&a.id.len()).then_with(|| b.id.cmp(&a.id)));
    let mut seen = HashSet::new();
    posts
        .into_iter()
        .flat_map(|post| {
            let mut photos = post.images.clone();
            photos.sort_by_key(|p| p.position);
            photos
                .into_iter()
                .filter(|p| image_url(&p.url) && image_url(&p.thumb))
                .map(|photo| Slide {
                    id: format!("{}:{}", post.id, photo.key),
                    photo,
                    post: post.clone(),
                    total: post.images.len(),
                })
                .collect::<Vec<_>>()
        })
        .filter(|p| seen.insert(p.id.clone()))
        .collect()
}
pub fn parse_route(hash: &str) -> Route {
    if ["", "#", "#/"].contains(&hash) {
        return Route::default();
    }
    let invalid = || Route {
        invalid: true,
        ..Default::default()
    };
    let Some(path) = hash.strip_prefix("#/") else {
        return invalid();
    };
    let p: Vec<_> = path.strip_suffix('/').unwrap_or(path).split('/').collect();
    if !(p.len() == 1
        || (p.len() == 5
            && p[1] == "status"
            && numeric(p[2])
            && p[3] == "media"
            && media_key(p[4])))
        || !word(p[0])
    {
        return invalid();
    }
    let Ok(account) = username(p[0]) else {
        return invalid();
    };
    Route {
        username: Some(account),
        post_id: p.get(2).map(|v| v.to_string()),
        image_key: p.get(4).map(|v| v.to_string()),
        invalid: false,
    }
}
pub fn route_url(account: &str, slide: Option<&Slide>) -> String {
    format!(
        "#/{account}{}",
        slide
            .map(|s| format!("/status/{}/media/{}", s.post.id, s.photo.key))
            .unwrap_or_default()
    )
}
pub fn post_step(slides: &[Slide], index: usize, direction: i32) -> usize {
    let mut i = index as i32 + direction;
    while i >= 0 && i < slides.len() as i32 && slides[i as usize].post.id == slides[index].post.id {
        i += direction;
    }
    if i < 0 || i >= slides.len() as i32 {
        return index;
    }
    while i > 0 && slides[i as usize - 1].post.id == slides[i as usize].post.id {
        i -= 1;
    }
    i as usize
}
pub fn swipe(dx: f64, dy: f64, ms: f64, width: f64, start: f64, scale: f64, multi: bool) -> i32 {
    if !multi
        && scale <= 1.01
        && start > 24.0
        && start < width - 24.0
        && ms < 900.0
        && dx.abs() > 60.0
        && dx.abs() > dy.abs() * 1.8
    {
        if dx < 0.0 { 1 } else { -1 }
    } else {
        0
    }
}
pub fn valid_album(a: &Album, account: &str) -> bool {
    a.version == 1
        && a.username == account
        && a.posts.len() <= 300
        && ["end", "unavailable"].contains(&a.range.as_str())
        && a.posts.iter().all(|p| {
            numeric(&p.id)
                && username(&p.author).is_ok_and(|s| s == p.author)
                && p.images.len() <= 20
                && p.images.iter().all(|i| {
                    media_key(&i.key) && i.position < 20 && image_url(&i.url) && image_url(&i.thumb)
                })
        })
}
pub fn valid_resume(s: &str) -> bool {
    s.split_once(':')
        .is_some_and(|(p, i)| numeric(p) && media_key(i))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn strict_usernames_and_routes() {
        for s in [
            "NASA",
            "@NASA",
            "https://x.com/NASA/media",
            "https://twitter.com/NASA/",
            "\u{feff}@NASA",
            "https://x.com/nasa?",
        ] {
            assert_eq!(username(s), Ok("nasa".into()));
        }
        for s in [
            "https://x.com.evil/nasa",
            "https://evil@x.com/nasa",
            "http://x.com/nasa",
            "javascript:alert(1)",
            "https://x.com/nasa/status/12",
            "https://x.com:443/nasa?foo",
        ] {
            assert!(username(s).is_err(), "{s}");
        }
        assert!(!image_url("https://pbs.twimg.com.evil/media/x"));
        assert_eq!(
            parse_route("#/NASA/status/900000000000000003/media/A2").post_id,
            Some("900000000000000003".into())
        );
        assert!(parse_route("#/bad/route").invalid);
    }
    #[test]
    fn gesture_intent() {
        assert_eq!(swipe(-90.0, 5.0, 250.0, 375.0, 200.0, 1.0, false), 1);
        assert_eq!(swipe(90.0, 5.0, 250.0, 375.0, 100.0, 1.0, false), -1);
        for (dx, dy, start, scale, multi) in [
            (-90., 80., 200., 1., false),
            (-90., 0., 200., 2., false),
            (-90., 0., 200., 1., true),
            (-90., 0., 5., 1., false),
            (4., 0., 200., 1., false),
        ] {
            assert_eq!(swipe(dx, dy, 250., 375., start, scale, multi), 0);
        }
    }
    fn album() -> Album {
        serde_json::from_value(serde_json::json!({"version":1,"username":"nasa","fetchedAt":"2026-09-18T00:00:00Z","range":"end","posts":[
            {"id":"900000000000000003","author":"nasa","images":[{"key":"A2","position":1,"url":"https://pbs.twimg.com/media/A2","thumb":"https://pbs.twimg.com/media/A2"},{"key":"A1","position":0,"url":"https://pbs.twimg.com/media/A1","thumb":"https://pbs.twimg.com/media/A1"}]},
            {"id":"900000000000000002","author":"nasa","images":[{"key":"B1","position":0,"url":"https://pbs.twimg.com/media/B1","thumb":"https://pbs.twimg.com/media/B1"}]}
        ]})).unwrap()
    }
    #[test]
    fn stable_ids_filtering_ordering_and_post_navigation() {
        let mut a = album();
        a.posts.push(a.posts[0].clone());
        let mut other = a.posts[0].clone();
        other.author = "other".into();
        a.posts.push(other);
        let mut repost = a.posts[0].clone();
        repost.repost = Some(true);
        a.posts.push(repost);
        let slides = flatten(&a);
        assert_eq!(
            slides
                .iter()
                .map(|s| s.photo.key.as_str())
                .collect::<Vec<_>>(),
            vec!["A1", "A2", "B1"]
        );
        assert_eq!(post_step(&slides, 1, 1), 2);
        assert_eq!(post_step(&slides, 2, -1), 0);
        assert_eq!(
            route_url("nasa", Some(&slides[1])),
            "#/nasa/status/900000000000000003/media/A2"
        );
    }
    #[test]
    fn existing_storage_schema_and_corrupt_metadata() {
        let a = album();
        assert!(valid_album(&a, "nasa"));
        assert!(!valid_album(&a, "other"));
        let encoded = serde_json::to_string(&a).unwrap();
        assert!(encoded.contains("fetchedAt"));
        assert!(!encoded.contains("user_id"));
        let mut corrupt = serde_json::to_value(&a).unwrap();
        corrupt["posts"][0]["text"] = serde_json::json!({"bad":true});
        assert!(serde_json::from_value::<Album>(corrupt).is_err());
        let mut bad = a.clone();
        bad.posts[0].images[0].url = "https://evil.example/image".into();
        assert!(!valid_album(&bad, "nasa"));
        assert!(valid_resume("900000000000000003:A2"));
        assert!(!valid_resume("123:<img>"));
    }
}
