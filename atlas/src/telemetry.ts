import type { Metric } from 'web-vitals'

export type TelemetryName = 'atlas_web_vital' | 'atlas_model_load'
export type TelemetryParameters = Record<string, string | number>
export type TelemetrySender = (name: TelemetryName, parameters: TelemetryParameters) => void

let sender: TelemetrySender | undefined
let consentEpoch = 0
let vitalsStarted = false
let vitalsRetired = false

export function vitalParameters(
  metric: Pick<Metric, 'name' | 'id' | 'value' | 'delta' | 'rating'>,
): TelemetryParameters | null {
  if (
    !['LCP', 'CLS', 'INP'].includes(metric.name) ||
    !/^[\w-]{1,96}$/.test(metric.id) ||
    !Number.isFinite(metric.value) ||
    metric.value < 0 ||
    !Number.isFinite(metric.delta) ||
    metric.delta < 0 ||
    !['good', 'needs-improvement', 'poor'].includes(metric.rating)
  )
    return null
  return {
    metric_name: metric.name,
    metric_id: metric.id,
    metric_value: metric.value,
    metric_delta: metric.delta,
    metric_rating: metric.rating,
    value: metric.delta,
  }
}

function emit(name: TelemetryName, parameters: TelemetryParameters) {
  try {
    sender?.(name, parameters)
  } catch {
    /* Measurement must never interrupt browsing. */
  }
}

/** Privacy owns the consent decision and the only network-capable sender. */
export function setTelemetryEnabled(
  enabled: boolean,
  send?: TelemetrySender,
  options: { fromNavigationStart: boolean } = { fromNavigationStart: false },
) {
  if (!enabled) {
    if (sender) {
      consentEpoch++
      // A later opt-in must not send metrics spanning a withdrawn-consent interval.
      vitalsRetired = true
    }
    sender = undefined
    return
  }
  if (!sender) consentEpoch++
  sender = send || sender
  if (!sender || !options.fromNavigationStart || vitalsStarted || vitalsRetired) return
  vitalsStarted = true
  const epoch = consentEpoch
  void import('web-vitals')
    .then(({ onCLS, onINP, onLCP }) => {
      if (!sender || vitalsRetired || consentEpoch !== epoch) return
      const report = (metric: Metric) => {
        if (!sender || vitalsRetired || consentEpoch !== epoch) return
        const parameters = vitalParameters(metric)
        if (parameters) emit('atlas_web_vital', parameters)
      }
      onCLS(report)
      onINP(report)
      onLCP(report)
    })
    .catch(() => {
      /* Unsupported or unavailable metrics remain unknown. */
    })
}

/** Observe only loads that start while analytics is allowed; never send model identity. */
export function beginModelObservation(viewMode: 'solo' | 'together') {
  if (!sender) return (_outcome: 'ready' | 'failed') => {}
  const epoch = consentEpoch
  const start = performance.now()
  let finished = false
  return (outcome: 'ready' | 'failed') => {
    if (finished) return
    finished = true
    if (!sender || consentEpoch !== epoch) return
    const duration = performance.now() - start
    if (!Number.isFinite(duration) || duration < 0) return
    emit('atlas_model_load', {
      model_load_ms: Math.round(duration),
      outcome,
      view_mode: viewMode,
    })
  }
}
