import { describe, expect, it } from 'bun:test'
import {
  calculateElectricityCost,
  normalizeElectricityCostInput,
} from '../src/lib/electricity-cost'

describe('electricity cost calculator', () => {
  it('calculates cost from watts, hours, days, quantity, and kWh rate', () => {
    const result = calculateElectricityCost({
      watts: 1000,
      quantity: 1,
      hoursPerDay: 2,
      days: 30,
      ratePerKwh: 31,
    })

    expect(result.kwhPerDay).toBe(2)
    expect(result.totalKwh).toBe(60)
    expect(result.totalCost).toBe(1860)
    expect(result.averageDailyCost).toBe(62)
    expect(result.annualizedCost).toBe(22630)
  })

  it('accounts for multiple matching appliances', () => {
    const result = calculateElectricityCost({
      watts: 60,
      quantity: 4,
      hoursPerDay: 5,
      days: 7,
      ratePerKwh: 30,
    })

    expect(result.effectiveWatts).toBe(240)
    expect(result.totalKwh).toBe(8.4)
    expect(result.totalCost).toBe(252)
  })

  it('normalizes invalid or excessive values into safe calculator bounds', () => {
    const normalized = normalizeElectricityCostInput({
      watts: Number.NaN,
      quantity: -5,
      hoursPerDay: 48,
      days: 0,
      ratePerKwh: Number.POSITIVE_INFINITY,
    })

    expect(normalized).toEqual({
      watts: 0,
      quantity: 1,
      hoursPerDay: 24,
      days: 1,
      ratePerKwh: 0,
    })
  })
})
