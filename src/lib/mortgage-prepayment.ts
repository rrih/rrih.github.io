export interface MortgagePrepaymentInput {
  loanBalance: number
  annualInterestRate: number
  remainingMonths: number
  prepaymentAmount: number
  prepaymentFee: number
}

export interface MortgageScenario {
  monthlyPayment: number
  monthsToPayoff: number
  totalInterest: number
  totalPaid: number
}

export interface MortgagePrepaymentResult {
  loanBalance: number
  annualInterestRate: number
  remainingMonths: number
  prepaymentAmount: number
  prepaymentFee: number
  remainingBalanceAfterPrepayment: number
  current: MortgageScenario
  termShortening: MortgageScenario & {
    monthsShortened: number
    interestSaved: number
    netSavedAfterFee: number
  }
  paymentReduction: MortgageScenario & {
    monthlyPaymentReducedBy: number
    interestSaved: number
    netSavedAfterFee: number
  }
}

export const defaultMortgagePrepaymentInput: MortgagePrepaymentInput = {
  loanBalance: 30_000_000,
  annualInterestRate: 1.2,
  remainingMonths: 300,
  prepaymentAmount: 1_000_000,
  prepaymentFee: 0,
}

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

const roundYen = (value: number) => Math.round(value)
const roundRate = (value: number) => Math.round(value * 1000) / 1000

export function normalizeMortgagePrepaymentInput(
  input: MortgagePrepaymentInput
): MortgagePrepaymentInput {
  return {
    loanBalance: roundYen(clampNumber(input.loanBalance, 0, 1_000_000_000)),
    annualInterestRate: roundRate(clampNumber(input.annualInterestRate, 0, 20)),
    remainingMonths: Math.round(clampNumber(input.remainingMonths, 1, 600)),
    prepaymentAmount: roundYen(clampNumber(input.prepaymentAmount, 0, 1_000_000_000)),
    prepaymentFee: roundYen(clampNumber(input.prepaymentFee, 0, 1_000_000)),
  }
}

export function calculateMonthlyPayment(
  principal: number,
  annualInterestRate: number,
  months: number
) {
  const normalizedPrincipal = clampNumber(principal, 0, 1_000_000_000)
  const normalizedMonths = Math.round(clampNumber(months, 1, 600))
  const monthlyRate = clampNumber(annualInterestRate, 0, 20) / 100 / 12

  if (normalizedPrincipal <= 0) return 0
  if (monthlyRate === 0) return roundYen(normalizedPrincipal / normalizedMonths)

  const factor = (1 + monthlyRate) ** normalizedMonths
  return roundYen((normalizedPrincipal * monthlyRate * factor) / (factor - 1))
}

export function amortizeMortgage(
  principal: number,
  annualInterestRate: number,
  monthlyPayment: number,
  maxMonths = 600
): MortgageScenario {
  const monthlyRate = clampNumber(annualInterestRate, 0, 20) / 100 / 12
  let balance = roundYen(clampNumber(principal, 0, 1_000_000_000))
  let totalInterest = 0
  let totalPaid = 0
  let monthsToPayoff = 0

  if (balance <= 0) {
    return { monthlyPayment: 0, monthsToPayoff: 0, totalInterest: 0, totalPaid: 0 }
  }

  const safePayment = Math.max(0, monthlyPayment)
  if (safePayment <= 0 || safePayment <= balance * monthlyRate) {
    return {
      monthlyPayment: roundYen(safePayment),
      monthsToPayoff: maxMonths,
      totalInterest: 0,
      totalPaid: 0,
    }
  }

  while (balance > 0 && monthsToPayoff < maxMonths) {
    const interest = roundYen(balance * monthlyRate)
    const principalPayment = Math.min(balance, safePayment - interest)
    const payment = interest + principalPayment

    balance = roundYen(balance - principalPayment)
    totalInterest += interest
    totalPaid += payment
    monthsToPayoff += 1
  }

  return {
    monthlyPayment: roundYen(safePayment),
    monthsToPayoff,
    totalInterest: roundYen(totalInterest),
    totalPaid: roundYen(totalPaid),
  }
}

export function calculateMortgagePrepayment(
  input: MortgagePrepaymentInput
): MortgagePrepaymentResult {
  const normalized = normalizeMortgagePrepaymentInput(input)
  const prepaymentAmount = Math.min(normalized.prepaymentAmount, normalized.loanBalance)
  const remainingBalanceAfterPrepayment = normalized.loanBalance - prepaymentAmount
  const currentMonthlyPayment = calculateMonthlyPayment(
    normalized.loanBalance,
    normalized.annualInterestRate,
    normalized.remainingMonths
  )
  const current = amortizeMortgage(
    normalized.loanBalance,
    normalized.annualInterestRate,
    currentMonthlyPayment,
    normalized.remainingMonths
  )
  const shortened = amortizeMortgage(
    remainingBalanceAfterPrepayment,
    normalized.annualInterestRate,
    current.monthlyPayment,
    normalized.remainingMonths
  )
  const reducedPayment = calculateMonthlyPayment(
    remainingBalanceAfterPrepayment,
    normalized.annualInterestRate,
    normalized.remainingMonths
  )
  const reduced = amortizeMortgage(
    remainingBalanceAfterPrepayment,
    normalized.annualInterestRate,
    reducedPayment,
    normalized.remainingMonths
  )

  const termInterestSaved = Math.max(0, current.totalInterest - shortened.totalInterest)
  const paymentInterestSaved = Math.max(0, current.totalInterest - reduced.totalInterest)

  return {
    ...normalized,
    prepaymentAmount,
    remainingBalanceAfterPrepayment,
    current,
    termShortening: {
      ...shortened,
      monthsShortened: Math.max(0, current.monthsToPayoff - shortened.monthsToPayoff),
      interestSaved: termInterestSaved,
      netSavedAfterFee: termInterestSaved - normalized.prepaymentFee,
    },
    paymentReduction: {
      ...reduced,
      monthlyPaymentReducedBy: Math.max(0, current.monthlyPayment - reduced.monthlyPayment),
      interestSaved: paymentInterestSaved,
      netSavedAfterFee: paymentInterestSaved - normalized.prepaymentFee,
    },
  }
}
