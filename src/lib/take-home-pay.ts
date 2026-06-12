export interface TakeHomePayInput {
  annualSalary: number
  socialInsuranceRate: number
  employmentInsuranceRate: number
  residentTaxRate: number
  residentTaxPerCapita: number
  additionalIncomeDeductions: number
  additionalResidentDeductions: number
}

export interface TaxBreakdown {
  taxableIncome: number
  tax: number
}

export interface TakeHomePayResult {
  annualSalary: number
  monthlyGrossAverage: number
  salaryIncome: number
  incomeTaxBasicDeduction: number
  socialInsurance: number
  employmentInsurance: number
  totalInsurance: number
  incomeTax: TaxBreakdown
  reconstructionTax: number
  residentTax: TaxBreakdown
  residentTaxPerCapita: number
  totalTax: number
  totalDeductions: number
  annualTakeHome: number
  monthlyTakeHomeAverage: number
  deductionRate: number
}

export const defaultTakeHomePayInput: TakeHomePayInput = {
  annualSalary: 5_000_000,
  socialInsuranceRate: 14.4,
  employmentInsuranceRate: 0.55,
  residentTaxRate: 10,
  residentTaxPerCapita: 5_000,
  additionalIncomeDeductions: 0,
  additionalResidentDeductions: 0,
}

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

const roundYen = (value: number) => Math.round(value)
const floorYen = (value: number) => Math.floor(value)
const floorToThousand = (value: number) => Math.floor(value / 1000) * 1000

export function normalizeTakeHomePayInput(input: TakeHomePayInput): TakeHomePayInput {
  return {
    annualSalary: roundYen(clampNumber(input.annualSalary, 0, 100_000_000)),
    socialInsuranceRate: clampNumber(input.socialInsuranceRate, 0, 40),
    employmentInsuranceRate: clampNumber(input.employmentInsuranceRate, 0, 5),
    residentTaxRate: clampNumber(input.residentTaxRate, 0, 20),
    residentTaxPerCapita: roundYen(clampNumber(input.residentTaxPerCapita, 0, 100_000)),
    additionalIncomeDeductions: roundYen(
      clampNumber(input.additionalIncomeDeductions, 0, 50_000_000)
    ),
    additionalResidentDeductions: roundYen(
      clampNumber(input.additionalResidentDeductions, 0, 50_000_000)
    ),
  }
}

export function calculateSalaryIncome(annualSalary: number) {
  const salary = roundYen(clampNumber(annualSalary, 0, 100_000_000))

  if (salary < 741_000) return 0
  if (salary < 2_191_000) return salary - 740_000
  if (salary < 2_193_000) return 1_451_000
  if (salary < 2_196_000) return 1_453_000
  if (salary < 2_200_000) return 1_456_000

  if (salary <= 3_599_999) {
    const base = floorToThousand(salary / 4)
    return floorYen(base * 2.8 - 80_000)
  }

  if (salary <= 6_599_999) {
    const base = floorToThousand(salary / 4)
    return floorYen(base * 3.2 - 440_000)
  }

  if (salary <= 8_499_999) return floorYen(salary * 0.9 - 1_100_000)

  return salary - 1_950_000
}

export function calculateIncomeTaxBasicDeduction(totalIncome: number) {
  const income = roundYen(clampNumber(totalIncome, 0, 100_000_000))

  if (income <= 1_320_000) return 1_040_000
  if (income <= 3_360_000) return 620_000
  if (income <= 4_890_000) return 680_000
  if (income <= 6_550_000) return 670_000
  if (income <= 23_500_000) return 620_000
  if (income <= 24_000_000) return 480_000
  if (income <= 24_500_000) return 320_000
  if (income <= 25_000_000) return 160_000

  return 0
}

export function calculateNationalIncomeTax(taxableIncome: number): TaxBreakdown {
  const taxable = floorToThousand(clampNumber(taxableIncome, 0, 100_000_000))

  const bracket =
    taxable < 1_950_000
      ? { rate: 0.05, deduction: 0 }
      : taxable < 3_300_000
        ? { rate: 0.1, deduction: 97_500 }
        : taxable < 6_950_000
          ? { rate: 0.2, deduction: 427_500 }
          : taxable < 9_000_000
            ? { rate: 0.23, deduction: 636_000 }
            : taxable < 18_000_000
              ? { rate: 0.33, deduction: 1_536_000 }
              : taxable < 40_000_000
                ? { rate: 0.4, deduction: 2_796_000 }
                : { rate: 0.45, deduction: 4_796_000 }

  return {
    taxableIncome: taxable,
    tax: Math.max(0, floorYen(taxable * bracket.rate - bracket.deduction)),
  }
}

export function calculateTakeHomePay(input: TakeHomePayInput): TakeHomePayResult {
  const normalized = normalizeTakeHomePayInput(input)
  const salaryIncome = calculateSalaryIncome(normalized.annualSalary)
  const socialInsurance = roundYen(normalized.annualSalary * (normalized.socialInsuranceRate / 100))
  const employmentInsurance = roundYen(
    normalized.annualSalary * (normalized.employmentInsuranceRate / 100)
  )
  const totalInsurance = socialInsurance + employmentInsurance
  const incomeTaxBasicDeduction = calculateIncomeTaxBasicDeduction(salaryIncome)

  const incomeTaxableIncome =
    salaryIncome - incomeTaxBasicDeduction - totalInsurance - normalized.additionalIncomeDeductions
  const incomeTax = calculateNationalIncomeTax(incomeTaxableIncome)
  const reconstructionTax = floorYen(incomeTax.tax * 0.021)

  const residentTaxableIncome =
    salaryIncome - 430_000 - totalInsurance - normalized.additionalResidentDeductions
  const residentTaxable = floorToThousand(clampNumber(residentTaxableIncome, 0, 100_000_000))
  const residentTax: TaxBreakdown = {
    taxableIncome: residentTaxable,
    tax: floorYen(residentTaxable * (normalized.residentTaxRate / 100)),
  }

  const totalTax =
    incomeTax.tax + reconstructionTax + residentTax.tax + normalized.residentTaxPerCapita
  const totalDeductions = totalInsurance + totalTax
  const annualTakeHome = Math.max(0, normalized.annualSalary - totalDeductions)

  return {
    annualSalary: normalized.annualSalary,
    monthlyGrossAverage: roundYen(normalized.annualSalary / 12),
    salaryIncome,
    incomeTaxBasicDeduction,
    socialInsurance,
    employmentInsurance,
    totalInsurance,
    incomeTax,
    reconstructionTax,
    residentTax,
    residentTaxPerCapita: normalized.residentTaxPerCapita,
    totalTax,
    totalDeductions,
    annualTakeHome,
    monthlyTakeHomeAverage: roundYen(annualTakeHome / 12),
    deductionRate:
      normalized.annualSalary > 0
        ? Math.round((totalDeductions / normalized.annualSalary) * 1000) / 10
        : 0,
  }
}
