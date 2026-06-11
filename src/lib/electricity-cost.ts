export interface ElectricityCostInput {
  watts: number
  quantity: number
  hoursPerDay: number
  days: number
  ratePerKwh: number
}

export interface ElectricityCostResult {
  effectiveWatts: number
  kwhPerDay: number
  totalKwh: number
  totalCost: number
  averageDailyCost: number
  annualizedCost: number
}

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

const clampInteger = (value: number, min: number, max: number) => {
  return Math.round(clampNumber(value, min, max))
}

const roundMoney = (value: number) => Math.round(value * 100) / 100
const roundKwh = (value: number) => Math.round(value * 1000) / 1000

export function normalizeElectricityCostInput(input: ElectricityCostInput): ElectricityCostInput {
  return {
    watts: clampNumber(input.watts, 0, 1_000_000),
    quantity: clampInteger(input.quantity, 1, 1_000),
    hoursPerDay: clampNumber(input.hoursPerDay, 0, 24),
    days: clampInteger(input.days, 1, 3_660),
    ratePerKwh: clampNumber(input.ratePerKwh, 0, 10_000),
  }
}

export function calculateElectricityCost(input: ElectricityCostInput): ElectricityCostResult {
  const normalized = normalizeElectricityCostInput(input)
  const effectiveWatts = normalized.watts * normalized.quantity
  const kwhPerDay = (effectiveWatts * normalized.hoursPerDay) / 1000
  const totalKwh = kwhPerDay * normalized.days
  const totalCost = totalKwh * normalized.ratePerKwh
  const averageDailyCost = normalized.days > 0 ? totalCost / normalized.days : 0

  return {
    effectiveWatts: roundKwh(effectiveWatts),
    kwhPerDay: roundKwh(kwhPerDay),
    totalKwh: roundKwh(totalKwh),
    totalCost: roundMoney(totalCost),
    averageDailyCost: roundMoney(averageDailyCost),
    annualizedCost: roundMoney(averageDailyCost * 365),
  }
}
