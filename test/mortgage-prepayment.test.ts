import { describe, expect, it } from 'bun:test'
import {
  amortizeMortgage,
  calculateMonthlyPayment,
  calculateMortgagePrepayment,
  normalizeMortgagePrepaymentInput,
} from '../src/lib/mortgage-prepayment'

describe('mortgage prepayment calculator', () => {
  it('calculates a fixed-rate equal-payment monthly amount', () => {
    expect(calculateMonthlyPayment(30_000_000, 1.2, 300)).toBe(115_798)
    expect(calculateMonthlyPayment(12_000_000, 0, 120)).toBe(100_000)
  })

  it('amortizes the balance with a final partial payment', () => {
    const result = amortizeMortgage(1_000_000, 1.2, 100_000, 120)

    expect(result.monthsToPayoff).toBe(11)
    expect(result.totalInterest).toBe(5_539)
    expect(result.totalPaid).toBe(1_005_539)
  })

  it('compares term-shortening and payment-reduction prepayments', () => {
    const result = calculateMortgagePrepayment({
      loanBalance: 30_000_000,
      annualInterestRate: 1.2,
      remainingMonths: 300,
      prepaymentAmount: 1_000_000,
      prepaymentFee: 0,
    })

    expect(result.remainingBalanceAfterPrepayment).toBe(29_000_000)
    expect(result.current.monthlyPayment).toBe(115_798)
    expect(result.current.totalInterest).toBe(4_739_564)
    expect(result.termShortening.monthsToPayoff).toBe(289)
    expect(result.termShortening.monthsShortened).toBe(11)
    expect(result.termShortening.interestSaved).toBe(342_492)
    expect(result.paymentReduction.monthlyPayment).toBe(111_939)
    expect(result.paymentReduction.monthlyPaymentReducedBy).toBe(3_859)
    expect(result.paymentReduction.interestSaved).toBe(158_030)
  })

  it('normalizes invalid and extreme values into safe bounds', () => {
    expect(
      normalizeMortgagePrepaymentInput({
        loanBalance: Number.POSITIVE_INFINITY,
        annualInterestRate: -1,
        remainingMonths: 0,
        prepaymentAmount: Number.NaN,
        prepaymentFee: 2_000_000,
      })
    ).toEqual({
      loanBalance: 0,
      annualInterestRate: 0,
      remainingMonths: 1,
      prepaymentAmount: 0,
      prepaymentFee: 1_000_000,
    })
  })
})
