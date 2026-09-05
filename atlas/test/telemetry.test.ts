import { expect, test } from 'bun:test'
import {
  beginModelObservation,
  setTelemetryEnabled,
  type TelemetryParameters,
  vitalParameters,
} from '../src/telemetry'

test('telemetry excludes loads before consent, revoked loads, duplicate outcomes, and model identity', () => {
  const events: { name: string; parameters: TelemetryParameters }[] = []
  const send = (name: string, parameters: TelemetryParameters) => {
    events.push({ name, parameters })
  }
  setTelemetryEnabled(false)
  const before = beginModelObservation('solo')
  setTelemetryEnabled(true, send)
  before('ready')
  expect(events).toEqual([])
  const revoked = beginModelObservation('together')
  setTelemetryEnabled(false)
  setTelemetryEnabled(true, send)
  revoked('ready')
  expect(events).toEqual([])
  const allowed = beginModelObservation('solo')
  allowed('failed')
  allowed('ready')
  expect(events).toHaveLength(1)
  expect(events[0].name).toBe('atlas_model_load')
  expect(Object.keys(events[0].parameters).sort()).toEqual(['model_load_ms', 'outcome', 'view_mode'])
  expect(events[0].parameters.outcome).toBe('failed')
  expect(events[0].parameters.model_load_ms).toBeGreaterThanOrEqual(0)
  setTelemetryEnabled(false)
})

test('only valid CWV values and nonidentifying metric fields reach the analytics boundary', () => {
  const metric = {
    name: 'CLS' as const,
    id: 'v6-123456-789',
    value: 0.08,
    delta: 0.02,
    rating: 'good' as const,
  }
  expect(vitalParameters(metric)).toEqual({
    metric_name: 'CLS',
    metric_id: metric.id,
    metric_value: 0.08,
    metric_delta: 0.02,
    metric_rating: 'good',
    value: 0.02,
  })
  expect(vitalParameters({ ...metric, id: 'https://example.com/private-scene' })).toBeNull()
  expect(vitalParameters({ ...metric, value: Number.NaN })).toBeNull()
  expect(vitalParameters({ ...metric, delta: -1 })).toBeNull()
  expect(vitalParameters({ ...metric, name: 'FCP' })).toBeNull()
})

test('a failed analytics sender cannot break the model viewer', () => {
  setTelemetryEnabled(true, () => {
    throw new Error('Analytics unavailable')
  })
  expect(() => beginModelObservation('solo')('ready')).not.toThrow()
  setTelemetryEnabled(false)
})
