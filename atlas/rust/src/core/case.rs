//! Full Unicode case conversion. Native generation retains Rust's original mapping.
pub(crate) fn lower(value: &str) -> String {
    #[cfg(target_arch = "wasm32")]
    {
        String::from(js_sys::JsString::from(value).to_lower_case())
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        value.to_lowercase()
    }
}
pub(crate) fn upper(value: &str) -> String {
    #[cfg(target_arch = "wasm32")]
    {
        String::from(js_sys::JsString::from(value).to_upper_case())
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        value.to_uppercase()
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    #[test]
    fn native_generation_preserves_full_case_mapping_and_context() {
        for (input, lower, upper) in [
            ("", "", ""),
            ("ΟΣ", "ος", "ΟΣ"),
            ("ΟΣΑ", "οσα", "ΟΣΑ"),
            ("İ", "i\u{307}", "İ"),
            ("ß", "ß", "SS"),
            ("𐐀", "𐐨", "𐐀"),
        ] {
            assert_eq!(super::lower(input), lower);
            assert_eq!(super::upper(input), upper);
        }
    }
}
