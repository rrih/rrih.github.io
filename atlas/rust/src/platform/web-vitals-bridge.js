// Third-party browser observer bindings. Consent and metric handling live in Rust.
import { onCLS, onINP, onLCP } from 'web-vitals'
export function observeVitals(callback) { onCLS(callback); onINP(callback); onLCP(callback) }
// gtag's documented queue entry is a native JavaScript Arguments object.
export function analyticsArguments(values) { return (function () { return arguments }).apply(null, values) }
