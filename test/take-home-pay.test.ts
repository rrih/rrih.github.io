import { describe, expect, it } from 'bun:test'
import {
  calculateIncomeTaxBasicDeduction,
  calculateNationalIncomeTax,
  calculateSalaryIncome,
  calculateTakeHomePay,
  normalizeTakeHomePayInput,
} from '../src/lib/take-home-pay'

describe('take-home pay calculator', () => {
  it('calculates salary income from the 2026 salary-income deduction table', () => {
    expect(calculateSalaryIncome(740_999)).toBe(0)
    expect(calculateSalaryIncome(1_200_000)).toBe(460_000)
    expect(calculateSalaryIncome(2_192_000)).toBe(1_451_000)
    expect(calculateSalaryIncome(3_000_000)).toBe(2_020_000)
    expect(calculateSalaryIncome(5_000_000)).toBe(3_560_000)
    expect(calculateSalaryIncome(7_000_000)).toBe(5_200_000)
    expect(calculateSalaryIncome(9_000_000)).toBe(7_050_000)
  })

  it('uses the 2026 income tax basic deduction bands', () => {
    expect(calculateIncomeTaxBasicDeduction(1_320_000)).toBe(1_040_000)
    expect(calculateIncomeTaxBasicDeduction(3_360_001)).toBe(680_000)
    expect(calculateIncomeTaxBasicDeduction(6_550_001)).toBe(620_000)
    expect(calculateIncomeTaxBasicDeduction(25_000_001)).toBe(0)
  })

  it('calculates national income tax with the quick deduction table', () => {
    expect(calculateNationalIncomeTax(1_949_000)).toEqual({
      taxableIncome: 1_949_000,
      tax: 97_450,
    })
    expect(calculateNationalIncomeTax(7_000_000)).toEqual({
      taxableIncome: 7_000_000,
      tax: 974_000,
    })
  })

  it('estimates annual and monthly take-home pay with editable payroll rates', () => {
    const result = calculateTakeHomePay({
      annualSalary: 5_000_000,
      socialInsuranceRate: 14.4,
      employmentInsuranceRate: 0.55,
      residentTaxRate: 10,
      residentTaxPerCapita: 5_000,
      additionalIncomeDeductions: 0,
      additionalResidentDeductions: 0,
    })

    expect(result.salaryIncome).toBe(3_560_000)
    expect(result.incomeTaxBasicDeduction).toBe(680_000)
    expect(result.totalInsurance).toBe(747_500)
    expect(result.incomeTax.tax).toBe(115_700)
    expect(result.reconstructionTax).toBe(2429)
    expect(result.residentTax.tax).toBe(238_200)
    expect(result.annualTakeHome).toBe(3_891_171)
    expect(result.monthlyTakeHomeAverage).toBe(324_264)
    expect(result.deductionRate).toBe(22.2)
  })

  it('normalizes invalid and extreme inputs into safe bounds', () => {
    expect(
      normalizeTakeHomePayInput({
        annualSalary: Number.POSITIVE_INFINITY,
        socialInsuranceRate: -1,
        employmentInsuranceRate: Number.NaN,
        residentTaxRate: 30,
        residentTaxPerCapita: -100,
        additionalIncomeDeductions: 100_000_000,
        additionalResidentDeductions: -5,
      })
    ).toEqual({
      annualSalary: 0,
      socialInsuranceRate: 0,
      employmentInsuranceRate: 0,
      residentTaxRate: 20,
      residentTaxPerCapita: 0,
      additionalIncomeDeductions: 50_000_000,
      additionalResidentDeductions: 0,
    })
  })
})
