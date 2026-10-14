//! Fail-closed advertising eligibility, shared by native tests and the browser.
use super::locales::LOCALES;
use serde_json::Value;

pub fn is_advertising_page(host: &str, locale: &str) -> bool {
    host == "rrih.github.io"
        && LOCALES.iter().any(|language| language.0 == locale)
        && !["is", "fa", "ne", "sw", "af"].contains(&locale)
}

pub fn permits_tcf_advertising(data: &Value, success: bool) -> bool {
    success
        && !data.is_null()
        && data["cmpStatus"] != "error"
        && (data["gdprApplies"] == false
            || (data["gdprApplies"] == true
                && data["cmpStatus"] == "loaded"
                && ["tcloaded", "useractioncomplete"]
                    .contains(&data["eventStatus"].as_str().unwrap_or_default())
                && data["tcString"]
                    .as_str()
                    .is_some_and(|value| !value.is_empty())
                && data["purpose"]["consents"]["1"] == true
                && data["vendor"]["consents"]["755"] == true))
}

pub fn permits_initial_us_advertising(status: &Value) -> bool {
    status
        .as_f64()
        .is_some_and(|status| [1.0, 2.0].contains(&status))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn exactly_44_existing_languages_on_the_exact_production_host_are_eligible() {
        assert_eq!(
            LOCALES
                .iter()
                .filter(|language| is_advertising_page("rrih.github.io", language.0))
                .count(),
            44
        );
        for locale in ["is", "fa", "ne", "sw", "af", "unknown", "", "EN"] {
            assert!(!is_advertising_page("rrih.github.io", locale));
        }
        for host in [
            "localhost",
            "127.0.0.1",
            "evil.rrih.github.io",
            "rrih.github.io.evil",
            "rrih.github.io.",
            "",
        ] {
            assert!(!is_advertising_page(host, "en"));
        }
    }

    #[test]
    fn tcf_errors_unknown_dialog_and_incomplete_responses_cannot_grant_ads() {
        let accepted = json!({"gdprApplies":true,"cmpStatus":"loaded","eventStatus":"useractioncomplete","tcString":"test-consent-string","purpose":{"consents":{"1":true}},"vendor":{"consents":{"755":true}}});
        assert!(permits_tcf_advertising(&accepted, true));
        assert!(!permits_tcf_advertising(&accepted, false));
        assert!(permits_tcf_advertising(&json!({"gdprApplies":false}), true));
        for data in [
            Value::Null,
            json!({}),
            json!({"gdprApplies":true}),
            json!({"gdprApplies":false,"cmpStatus":"error"}),
            json!(false),
            json!([]),
        ] {
            assert!(!permits_tcf_advertising(&data, true));
        }
        for (pointer, invalid) in [
            ("/cmpStatus", json!("loading")),
            ("/eventStatus", json!("cmpuishown")),
            ("/tcString", json!("")),
            ("/purpose/consents/1", json!(false)),
            ("/vendor/consents/755", json!(false)),
            ("/gdprApplies", json!("false")),
        ] {
            let mut data = accepted.clone();
            *data.pointer_mut(pointer).unwrap() = invalid;
            assert!(!permits_tcf_advertising(&data, true), "{pointer}");
        }
        let mut loaded = accepted;
        loaded["eventStatus"] = json!("tcloaded");
        assert!(permits_tcf_advertising(&loaded, true));
    }

    #[test]
    fn us_status_requires_known_numeric_not_applicable_or_not_opted_out() {
        for status in [
            Value::Null,
            json!(0),
            json!(3),
            json!(4),
            json!(-1),
            json!(1.1),
            json!("1"),
            json!(true),
            json!({}),
        ] {
            assert!(!permits_initial_us_advertising(&status), "{status}");
        }
        for status in [json!(1), json!(2), json!(1.0), json!(2.0)] {
            assert!(permits_initial_us_advertising(&status));
        }
    }
}
