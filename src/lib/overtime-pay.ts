export interface OvertimePayInput {
  hourlyWage: number
  monthlyBasePay: number
  scheduledHoursPerMonth: number
  overtimeHours: number
  overtimeHoursOver60: number
  nightOvertimeHours: number
  nightOvertimeHoursOver60: number
  legalHolidayHours: number
  nightLegalHolidayHours: number
  overtimePremiumRate: number
  overtimeOver60PremiumRate: number
  nightPremiumRate: number
  legalHolidayPremiumRate: number
}

export interface OvertimePaySegment {
  id: string
  label: string
  hours: number
  premiumRate: number
  multiplier: number
  totalPay: number
  premiumPay: number
}

export interface OvertimePayResult {
  baseHourlyWage: number
  totalExtraHours: number
  regularEquivalentPay: number
  premiumPay: number
  totalOvertimePay: number
  averageMultiplier: number
  segments: OvertimePaySegment[]
}

export const defaultOvertimePayInput: OvertimePayInput = {
  hourlyWage: 0,
  monthlyBasePay: 300_000,
  scheduledHoursPerMonth: 160,
  overtimeHours: 20,
  overtimeHoursOver60: 0,
  nightOvertimeHours: 0,
  nightOvertimeHoursOver60: 0,
  legalHolidayHours: 0,
  nightLegalHolidayHours: 0,
  overtimePremiumRate: 25,
  overtimeOver60PremiumRate: 50,
  nightPremiumRate: 25,
  legalHolidayPremiumRate: 35,
}

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

const roundYen = (value: number) => Math.round(value)
const roundHours = (value: number) => Math.round(value * 100) / 100
const roundRate = (value: number) => Math.round(value * 10) / 10
const roundMultiplier = (value: number) => Math.round(value * 100) / 100

export function normalizeOvertimePayInput(input: OvertimePayInput): OvertimePayInput {
  return {
    hourlyWage: roundYen(clampNumber(input.hourlyWage, 0, 1_000_000)),
    monthlyBasePay: roundYen(clampNumber(input.monthlyBasePay, 0, 100_000_000)),
    scheduledHoursPerMonth: roundHours(clampNumber(input.scheduledHoursPerMonth, 1, 744)),
    overtimeHours: roundHours(clampNumber(input.overtimeHours, 0, 744)),
    overtimeHoursOver60: roundHours(clampNumber(input.overtimeHoursOver60, 0, 744)),
    nightOvertimeHours: roundHours(clampNumber(input.nightOvertimeHours, 0, 744)),
    nightOvertimeHoursOver60: roundHours(clampNumber(input.nightOvertimeHoursOver60, 0, 744)),
    legalHolidayHours: roundHours(clampNumber(input.legalHolidayHours, 0, 744)),
    nightLegalHolidayHours: roundHours(clampNumber(input.nightLegalHolidayHours, 0, 744)),
    overtimePremiumRate: roundRate(clampNumber(input.overtimePremiumRate, 0, 300)),
    overtimeOver60PremiumRate: roundRate(clampNumber(input.overtimeOver60PremiumRate, 0, 300)),
    nightPremiumRate: roundRate(clampNumber(input.nightPremiumRate, 0, 300)),
    legalHolidayPremiumRate: roundRate(clampNumber(input.legalHolidayPremiumRate, 0, 300)),
  }
}

export function calculateBaseHourlyWage(input: OvertimePayInput) {
  const normalized = normalizeOvertimePayInput(input)
  if (normalized.hourlyWage > 0) return normalized.hourlyWage
  return roundYen(normalized.monthlyBasePay / normalized.scheduledHoursPerMonth)
}

function createSegment({
  id,
  label,
  hours,
  premiumRate,
  baseHourlyWage,
}: {
  id: string
  label: string
  hours: number
  premiumRate: number
  baseHourlyWage: number
}): OvertimePaySegment {
  const multiplier = 1 + premiumRate / 100
  const totalPay = roundYen(baseHourlyWage * hours * multiplier)

  return {
    id,
    label,
    hours,
    premiumRate,
    multiplier: roundMultiplier(multiplier),
    totalPay,
    premiumPay: roundYen(baseHourlyWage * hours * (premiumRate / 100)),
  }
}

export function calculateOvertimePay(input: OvertimePayInput): OvertimePayResult {
  const normalized = normalizeOvertimePayInput(input)
  const baseHourlyWage = calculateBaseHourlyWage(normalized)

  const segments = [
    createSegment({
      id: 'overtime',
      label: 'Statutory overtime up to 60h',
      hours: normalized.overtimeHours,
      premiumRate: normalized.overtimePremiumRate,
      baseHourlyWage,
    }),
    createSegment({
      id: 'overtime-over-60',
      label: 'Statutory overtime over 60h',
      hours: normalized.overtimeHoursOver60,
      premiumRate: normalized.overtimeOver60PremiumRate,
      baseHourlyWage,
    }),
    createSegment({
      id: 'night-overtime',
      label: 'Night overtime up to 60h',
      hours: normalized.nightOvertimeHours,
      premiumRate: normalized.overtimePremiumRate + normalized.nightPremiumRate,
      baseHourlyWage,
    }),
    createSegment({
      id: 'night-overtime-over-60',
      label: 'Night overtime over 60h',
      hours: normalized.nightOvertimeHoursOver60,
      premiumRate: normalized.overtimeOver60PremiumRate + normalized.nightPremiumRate,
      baseHourlyWage,
    }),
    createSegment({
      id: 'legal-holiday',
      label: 'Legal holiday work',
      hours: normalized.legalHolidayHours,
      premiumRate: normalized.legalHolidayPremiumRate,
      baseHourlyWage,
    }),
    createSegment({
      id: 'night-legal-holiday',
      label: 'Night legal holiday work',
      hours: normalized.nightLegalHolidayHours,
      premiumRate: normalized.legalHolidayPremiumRate + normalized.nightPremiumRate,
      baseHourlyWage,
    }),
  ]

  const totalExtraHours = roundHours(segments.reduce((total, segment) => total + segment.hours, 0))
  const totalOvertimePay = roundYen(
    segments.reduce((total, segment) => total + segment.totalPay, 0)
  )
  const premiumPay = roundYen(segments.reduce((total, segment) => total + segment.premiumPay, 0))
  const regularEquivalentPay = roundYen(baseHourlyWage * totalExtraHours)

  return {
    baseHourlyWage,
    totalExtraHours,
    regularEquivalentPay,
    premiumPay,
    totalOvertimePay,
    averageMultiplier:
      regularEquivalentPay > 0 ? roundMultiplier(totalOvertimePay / regularEquivalentPay) : 0,
    segments,
  }
}
