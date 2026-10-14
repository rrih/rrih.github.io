# Advertising migration regression coverage

Advertising tests use local SDK/CMP fixtures. They never send real advertising
requests. The Rust controller keeps one instance per document and shares the
native-tested eligibility functions in `rust/src/core/advertising.rs`.

| Former unit-test contract | Rust / browser regression coverage |
| --- | --- |
| Exactly 44 supported languages and exact production hostname | Native `exactly_44_existing_languages_on_the_exact_production_host_are_eligible`; unsupported-initial locale cases |
| TCF errors, incomplete responses, open dialogs and strict US status values fail closed | Native `tcf_errors_unknown_dialog_and_incomplete_responses_cannot_grant_ads` and `us_status_requires_known_numeric_not_applicable_or_not_opted_out`; TCF/CMP/US rejection browser cases |
| Remounts retain one script and subscription, with no premature ad pushes | `desktop-fixed-size-and-spa`, `unsupported-switch-removes-unit`, bootstrap assertions in `showAd` |
| API availability alone is insufficient; known regional non-applicability allows NPA; later API failure revokes permission | `cmp-missing`, `tcf-unknown`, `us-unknown`, `non-eu-consent-not-applicable`, `tcf-api-failure-retires-unit` |
| EU privacy reopening pauses ads, refusal propagates, and late consent cannot revive a deactivated placement | `withdrawal-and-remount`, `unsupported-switch-removes-unit` |
| US eligibility requires current GPP, and opt-out removes permission | `gpp-not-ready`, `us-choices-retire-unit` |
| GPP changes cannot revive stale initial US permission regardless of callback order | `gpp-change-before-initial-us`, `gpp-change-after-initial-us` |
| Unknown or initially opted-out US status cannot be replaced by other ready signals | `us-unknown`, `us-opted-out` |
| Script failures and timeouts stay terminal after late load/consent and language remounts | `script-failure`, `independent-cmp-failure`, `advertising-timeout-late-load`, `consent-timeout-late-load` |
| A functioning CMP retains withdrawal controls if the independent ad SDK fails | `ad-sdk-failure-preserves-cmp-choices` |
| An already-present unowned SDK is neither trusted nor duplicated | `unowned-advertising-script-id`, `unowned-advertising-script-url` |

The ordinary `advertising` E2E suite includes every browser case above. Use
`ATLAS_CASE` only for targeted diagnosis; the deployment gate runs the complete
suite. Browser execution results and captured diagnostics remain in the chosen
`ATLAS_QA_DIR`.
