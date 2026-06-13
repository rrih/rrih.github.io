import { describe, expect, it } from 'bun:test'
import {
  calculateBaseHourlyWage,
  calculateOvertimePay,
  normalizeOvertimePayInput,
} from '../src/lib/overtime-pay'

describe('overtime pay calculator', () => {
  it('derives the hourly wage from monthly base pay and scheduled hours', () => {
    expect(
      calculateBaseHourlyWage({
        hourlyWage: 0,
        monthlyBasePay: 320_000,
        scheduledHoursPerMonth: 160,
        overtimeHours: 0,
        overtimeHoursOver60: 0,
        nightOvertimeHours: 0,
        nightOvertimeHoursOver60: 0,
        legalHolidayHours: 0,
        nightLegalHolidayHours: 0,
        overtimePremiumRate: 25,
        overtimeOver60PremiumRate: 50,
        nightPremiumRate: 25,
        legalHolidayPremiumRate: 35,
      })
    ).toBe(2000)
  })

  it('calculates combined overtime, night, and legal holiday premium pay', () => {
    const result = calculateOvertimePay({
      hourlyWage: 0,
      monthlyBasePay: 320_000,
      scheduledHoursPerMonth: 160,
      overtimeHours: 10,
      overtimeHoursOver60: 2,
      nightOvertimeHours: 3,
      nightOvertimeHoursOver60: 1,
      legalHolidayHours: 4,
      nightLegalHolidayHours: 2,
      overtimePremiumRate: 25,
      overtimeOver60PremiumRate: 50,
      nightPremiumRate: 25,
      legalHolidayPremiumRate: 35,
    })

    expect(result.baseHourlyWage).toBe(2000)
    expect(result.totalExtraHours).toBe(22)
    expect(result.regularEquivalentPay).toBe(44_000)
    expect(result.premiumPay).toBe(16_700)
    expect(result.totalOvertimePay).toBe(60_700)
    expect(result.averageMultiplier).toBe(1.38)
    expect(result.segments.map((segment) => segment.multiplier)).toEqual([
      1.25, 1.5, 1.5, 1.75, 1.35, 1.6,
    ])
    expect(result.segments.map((segment) => segment.totalPay)).toEqual([
      25_000, 6_000, 9_000, 3_500, 10_800, 6_400,
    ])
  })

  it('uses direct hourly wage when provided', () => {
    const result = calculateOvertimePay({
      hourlyWage: 1800,
      monthlyBasePay: 320_000,
      scheduledHoursPerMonth: 160,
      overtimeHours: 5,
      overtimeHoursOver60: 0,
      nightOvertimeHours: 0,
      nightOvertimeHoursOver60: 0,
      legalHolidayHours: 0,
      nightLegalHolidayHours: 0,
      overtimePremiumRate: 25,
      overtimeOver60PremiumRate: 50,
      nightPremiumRate: 25,
      legalHolidayPremiumRate: 35,
    })

    expect(result.baseHourlyWage).toBe(1800)
    expect(result.totalOvertimePay).toBe(11_250)
  })

  it('normalizes invalid and excessive inputs into safe bounds', () => {
    expect(
      normalizeOvertimePayInput({
        hourlyWage: Number.POSITIVE_INFINITY,
        monthlyBasePay: -1,
        scheduledHoursPerMonth: 0,
        overtimeHours: Number.NaN,
        overtimeHoursOver60: 900,
        nightOvertimeHours: -2,
        nightOvertimeHoursOver60: 1.234,
        legalHolidayHours: 2.345,
        nightLegalHolidayHours: Number.NEGATIVE_INFINITY,
        overtimePremiumRate: -5,
        overtimeOver60PremiumRate: 400,
        nightPremiumRate: Number.NaN,
        legalHolidayPremiumRate: 35.55,
      })
    ).toEqual({
      hourlyWage: 0,
      monthlyBasePay: 0,
      scheduledHoursPerMonth: 1,
      overtimeHours: 0,
      overtimeHoursOver60: 744,
      nightOvertimeHours: 0,
      nightOvertimeHoursOver60: 1.23,
      legalHolidayHours: 2.35,
      nightLegalHolidayHours: 0,
      overtimePremiumRate: 0,
      overtimeOver60PremiumRate: 300,
      nightPremiumRate: 0,
      legalHolidayPremiumRate: 35.6,
    })
  })
})
