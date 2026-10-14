//! Consent and nonidentifying measurement policy, independent of the browser.
use serde_json::{Value, json};

#[derive(Default)]
pub struct Consent {
    enabled: bool,
    epoch: u64,
    vitals_started: bool,
    vitals_retired: bool,
}
impl Consent {
    pub fn update(
        &mut self,
        enabled: bool,
        sender_ready: bool,
        from_navigation_start: bool,
    ) -> Option<u64> {
        if !enabled {
            if self.enabled {
                self.epoch += 1;
                self.vitals_retired = true;
            }
            self.enabled = false;
            return None;
        }
        if !self.enabled {
            self.epoch += 1;
        }
        self.enabled = sender_ready;
        if !self.enabled || !from_navigation_start || self.vitals_started || self.vitals_retired {
            return None;
        }
        self.vitals_started = true;
        Some(self.epoch)
    }
    pub fn current(&self, epoch: u64) -> bool {
        self.enabled && self.epoch == epoch
    }
    pub fn permits_vital(&self, epoch: u64) -> bool {
        self.current(epoch) && !self.vitals_retired
    }
    pub fn observe_model(&self, view_mode: &str, start: f64) -> Observation {
        Observation {
            epoch: self.enabled.then_some(self.epoch),
            start,
            view_mode: view_mode.into(),
            finished: false,
        }
    }
}
pub struct Observation {
    epoch: Option<u64>,
    start: f64,
    view_mode: String,
    finished: bool,
}
impl Observation {
    pub fn finish(&mut self, consent: &Consent, outcome: &str, now: f64) -> Option<(u64, Value)> {
        if self.finished {
            return None;
        }
        self.finished = true;
        let epoch = self.epoch.filter(|epoch| consent.current(*epoch))?;
        let duration = now - self.start;
        if !duration.is_finite()
            || duration < 0.
            || !["ready", "failed"].contains(&outcome)
            || !["solo", "together"].contains(&self.view_mode.as_str())
        {
            return None;
        }
        Some((
            epoch,
            json!({"model_load_ms":duration.round(),"outcome":outcome,"view_mode":self.view_mode}),
        ))
    }
}
pub fn vital_parameters(metric: &Value) -> Option<Value> {
    let name = metric["name"].as_str()?;
    let id = metric["id"].as_str()?;
    let value = metric["value"].as_f64()?;
    let delta = metric["delta"].as_f64()?;
    let rating = metric["rating"].as_str()?;
    if !["LCP", "CLS", "INP"].contains(&name)
        || id.is_empty()
        || id.len() > 96
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
        || !value.is_finite()
        || value < 0.
        || !delta.is_finite()
        || delta < 0.
        || !["good", "needs-improvement", "poor"].contains(&rating)
    {
        return None;
    }
    Some(
        json!({"metric_name":name,"metric_id":id,"metric_value":value,"metric_delta":delta,"metric_rating":rating,"value":delta}),
    )
}
/// Browser adapters return a caught external error; measurement never owns UI flow.
pub fn emit_ignoring_failure<E>(send: impl FnOnce() -> Result<(), E>) {
    let _ = send();
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn consent_excludes_prior_revoked_duplicate_and_identifying_model_observations() {
        let mut consent = Consent::default();
        let mut before = consent.observe_model("solo", 0.);
        consent.update(true, true, false);
        assert!(before.finish(&consent, "ready", 10.).is_none());
        let mut revoked = consent.observe_model("together", 10.);
        consent.update(false, false, false);
        consent.update(true, true, false);
        assert!(revoked.finish(&consent, "ready", 20.).is_none());
        let mut allowed = consent.observe_model("solo", 20.);
        let (_, event) = allowed.finish(&consent, "failed", 32.6).unwrap();
        assert_eq!(
            event,
            json!({"model_load_ms":13.,"outcome":"failed","view_mode":"solo"})
        );
        assert!(allowed.finish(&consent, "ready", 40.).is_none());
        for now in [19., f64::NAN, f64::INFINITY] {
            assert!(
                consent
                    .observe_model("solo", 20.)
                    .finish(&consent, "ready", now)
                    .is_none()
            );
        }
        assert!(
            consent
                .observe_model("private-model-name", 0.)
                .finish(&consent, "ready", 1.)
                .is_none()
        );
        assert!(
            consent
                .observe_model("solo", 0.)
                .finish(&consent, "private-model-name", 1.)
                .is_none()
        );
    }
    #[test]
    fn only_valid_web_vitals_and_nonidentifying_fields_cross_the_boundary() {
        let metric = json!({"name":"CLS","id":"v6-123456-789","value":0.08,"delta":0.02,"rating":"good","entries":["private-scene"]});
        assert_eq!(
            vital_parameters(&metric),
            Some(
                json!({"metric_name":"CLS","metric_id":"v6-123456-789","metric_value":0.08,"metric_delta":0.02,"metric_rating":"good","value":0.02})
            )
        );
        for (key, value) in [
            ("id", json!("https://example.com/private-scene")),
            ("value", json!(f64::NAN)),
            ("delta", json!(-1)),
            ("name", json!("FCP")),
            ("rating", json!("unknown")),
            ("id", json!("")),
            ("id", json!("a".repeat(97))),
        ] {
            let mut invalid = metric.clone();
            invalid[key] = value;
            assert!(vital_parameters(&invalid).is_none(), "{invalid}");
        }
    }
    #[test]
    fn failed_external_sender_does_not_interrupt_the_viewer() {
        let mut attempted = false;
        emit_ignoring_failure(|| {
            attempted = true;
            Err("Analytics unavailable")
        });
        assert!(attempted);
        let mut consent = Consent::default();
        consent.update(true, true, false);
        let mut observation = consent.observe_model("solo", 0.);
        let (_, value) = observation.finish(&consent, "ready", 10.).unwrap();
        emit_ignoring_failure(|| {
            assert_eq!(value["outcome"], "ready");
            Err("Sender threw")
        });
        assert!(observation.finish(&consent, "ready", 20.).is_none());
    }
    #[test]
    fn web_vitals_start_once_and_never_span_withdrawn_consent() {
        let mut consent = Consent::default();
        assert!(consent.update(true, true, false).is_none());
        let epoch = consent.update(true, true, true).unwrap();
        assert!(consent.permits_vital(epoch));
        assert!(consent.update(true, true, true).is_none());
        consent.update(false, false, false);
        assert!(!consent.permits_vital(epoch));
        assert!(consent.update(true, true, true).is_none());
        assert!(!consent.permits_vital(epoch));
    }
}
