'use client'

import { AdUnit } from '@/components/ads/ad-unit'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import {
  type TakeHomePayInput,
  calculateTakeHomePay,
  defaultTakeHomePayInput,
} from '@/lib/take-home-pay'
import { AlertTriangle, Calculator, Info, Landmark, Receipt, RotateCcw, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'

const yenFormatter = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-foreground-light dark:text-foreground-dark"
      >
        {label}
      </label>
      <div className="flex min-h-12 overflow-hidden rounded-lg border border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-foreground-light outline-none focus:ring-2 focus:ring-accent dark:text-foreground-dark"
        />
        <span className="flex items-center border-l border-border-light px-3 text-sm text-foreground-light-secondary dark:border-border-dark dark:text-foreground-dark-secondary">
          {suffix}
        </span>
      </div>
    </div>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
        {label}
      </span>
      <strong className="text-right text-foreground-light dark:text-foreground-dark">
        {value}
      </strong>
    </div>
  )
}

export default function TakeHomePayCalculatorPage() {
  const [input, setInput] = useState<TakeHomePayInput>(defaultTakeHomePayInput)
  const result = useMemo(() => calculateTakeHomePay(input), [input])

  const updateInput = (key: keyof TakeHomePayInput, value: number) => {
    setInput((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }))
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Wallet className="h-6 w-6" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_23rem] lg:items-end">
            <div>
              <h1 className="mb-4 text-3xl font-bold text-foreground-light dark:text-foreground-dark sm:text-4xl">
                Take-Home Pay Calculator for Japan
              </h1>
              <p className="max-w-3xl text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Estimate annual and monthly net pay from gross salary, 2026 income-tax bands,
                payroll insurance assumptions, and editable resident-tax settings.
              </p>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">
                  Draft estimate only. Local resident tax, dependents, spouse deductions, bonuses,
                  and health-insurance grades can change the final payslip.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground-light dark:text-foreground-dark">
                Salary and deduction assumptions
              </h2>
              <button
                type="button"
                onClick={() => setInput(defaultTakeHomePayInput)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-light px-4 text-sm font-medium text-foreground-light transition-colors hover:bg-background-light dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="annual-salary"
                label="Annual gross salary"
                value={input.annualSalary}
                min={0}
                max={100000000}
                step={10000}
                suffix="JPY"
                onChange={(value) => updateInput('annualSalary', value)}
              />
              <NumberField
                id="social-insurance-rate"
                label="Social insurance estimate"
                value={input.socialInsuranceRate}
                min={0}
                max={40}
                step={0.05}
                suffix="%"
                onChange={(value) => updateInput('socialInsuranceRate', value)}
              />
              <NumberField
                id="employment-insurance-rate"
                label="Employment insurance"
                value={input.employmentInsuranceRate}
                min={0}
                max={5}
                step={0.01}
                suffix="%"
                onChange={(value) => updateInput('employmentInsuranceRate', value)}
              />
              <NumberField
                id="resident-tax-rate"
                label="Resident tax rate"
                value={input.residentTaxRate}
                min={0}
                max={20}
                step={0.1}
                suffix="%"
                onChange={(value) => updateInput('residentTaxRate', value)}
              />
              <NumberField
                id="resident-tax-per-capita"
                label="Resident per-capita tax"
                value={input.residentTaxPerCapita}
                min={0}
                max={100000}
                step={100}
                suffix="JPY"
                onChange={(value) => updateInput('residentTaxPerCapita', value)}
              />
              <NumberField
                id="additional-income-deductions"
                label="Other income-tax deductions"
                value={input.additionalIncomeDeductions}
                min={0}
                max={50000000}
                step={10000}
                suffix="JPY"
                onChange={(value) => updateInput('additionalIncomeDeductions', value)}
              />
              <NumberField
                id="additional-resident-deductions"
                label="Other resident-tax deductions"
                value={input.additionalResidentDeductions}
                min={0}
                max={50000000}
                step={10000}
                suffix="JPY"
                onChange={(value) => updateInput('additionalResidentDeductions', value)}
              />
            </div>
          </div>

          <aside className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <h2 className="mb-5 text-xl font-semibold text-foreground-light dark:text-foreground-dark">
              Estimated take-home pay
            </h2>
            <div className="mb-5 rounded-lg bg-accent/10 p-5">
              <p className="text-sm font-medium text-accent">Monthly average</p>
              <p className="mt-2 text-3xl font-bold text-foreground-light dark:text-foreground-dark">
                {yenFormatter.format(result.monthlyTakeHomeAverage)}
              </p>
              <p className="mt-2 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Annual take-home: {yenFormatter.format(result.annualTakeHome)}
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <ResultRow
                label="Gross monthly average"
                value={yenFormatter.format(result.monthlyGrossAverage)}
              />
              <ResultRow
                label="Total deductions"
                value={yenFormatter.format(result.totalDeductions)}
              />
              <ResultRow
                label="Deduction rate"
                value={`${percentFormatter.format(result.deductionRate)}%`}
              />
              <ResultRow
                label="Taxable salary income"
                value={yenFormatter.format(result.salaryIncome)}
              />
            </div>
          </aside>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Receipt className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-4 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              Payroll deductions
            </h2>
            <div className="space-y-3 text-sm">
              <ResultRow
                label="Social insurance"
                value={yenFormatter.format(result.socialInsurance)}
              />
              <ResultRow
                label="Employment insurance"
                value={yenFormatter.format(result.employmentInsurance)}
              />
              <ResultRow
                label="Insurance total"
                value={yenFormatter.format(result.totalInsurance)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Landmark className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-4 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              Income tax estimate
            </h2>
            <div className="space-y-3 text-sm">
              <ResultRow
                label="Basic deduction"
                value={yenFormatter.format(result.incomeTaxBasicDeduction)}
              />
              <ResultRow
                label="Taxable income"
                value={yenFormatter.format(result.incomeTax.taxableIncome)}
              />
              <ResultRow label="Income tax" value={yenFormatter.format(result.incomeTax.tax)} />
              <ResultRow
                label="Reconstruction surtax"
                value={yenFormatter.format(result.reconstructionTax)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Calculator className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-4 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              Resident tax estimate
            </h2>
            <div className="space-y-3 text-sm">
              <ResultRow
                label="Taxable income"
                value={yenFormatter.format(result.residentTax.taxableIncome)}
              />
              <ResultRow
                label="Income portion"
                value={yenFormatter.format(result.residentTax.tax)}
              />
              <ResultRow
                label="Per-capita portion"
                value={yenFormatter.format(result.residentTaxPerCapita)}
              />
            </div>
          </div>
        </section>

        <AdUnit slot="toolContent" className="mb-8 sm:mb-12" />

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Info className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-3 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              What this includes
            </h2>
            <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              The estimate applies the 2026 salary-income deduction, income-tax basic deduction,
              national income-tax quick table, 2.1% reconstruction surtax, and editable payroll
              insurance assumptions.
            </p>
          </div>
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Wallet className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-3 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              Tune it to your payslip
            </h2>
            <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              Enter your actual health, pension, nursing-care, employment-insurance, and municipal
              resident-tax assumptions when you need a closer estimate.
            </p>
          </div>
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <AlertTriangle className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-3 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              Review before relying on it
            </h2>
            <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              This first draft excludes dependent, spouse, disability, housing-loan, and year-end
              adjustment details. Treat it as planning support, not payroll or tax advice.
            </p>
          </div>
        </section>

        <section className="mt-12 rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
          <h2 className="mb-5 text-2xl font-bold text-foreground-light dark:text-foreground-dark">
            Source notes and FAQ
          </h2>
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
                Which official data does the draft use?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                The formulas follow National Tax Agency references for 2026 salary income, basic
                deduction, income-tax rate brackets, and the reconstruction surtax. Resident tax
                uses the common 10% standard-rate assumption, with editable local settings.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
                Why is social insurance a percentage input?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Health insurance varies by prefecture, insurer, age, and standard remuneration
                grade. A user-editable percentage keeps the calculator useful without pretending
                every employee has the same payroll deduction.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
                Will this match my monthly payslip exactly?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                No. Monthly withholding, bonuses, year-end adjustment, dependents, commute
                reimbursements, and municipality rules can all change the result.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
