use std::{collections::BTreeMap, sync::OnceLock};
use yew::{AttrValue, Html};
/// Lucide SVG paths, extracted without modification from lucide-react 0.542 (ISC).
/// Only the view implementation changes; the original stroke geometry is retained.
pub fn icon(name: &str, size: u16) -> Html {
    icon_class(name, size, "")
}
pub fn icon_class(name: &str, size: u16, class: &str) -> Html {
    render_icon(name, size, class, "none")
}
pub fn icon_filled(name: &str, size: u16, class: &str) -> Html {
    render_icon(name, size, class, "currentColor")
}
fn render_icon(name: &str, size: u16, class: &str, fill: &str) -> Html {
    static PATHS: OnceLock<BTreeMap<String, String>> = OnceLock::new();
    let paths = PATHS.get_or_init(|| serde_json::from_str(include_str!("icons.json")).unwrap());
    let shape = paths.get(name).map(String::as_str).unwrap_or("");
    let class = class.replace('&', "&amp;").replace('"', "&quot;");
    Html::from_html_unchecked(AttrValue::from(format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" viewBox=\"0 0 24 24\" fill=\"{fill}\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-{name} {class}\" aria-hidden=\"true\">{shape}</svg>"
    )))
}
