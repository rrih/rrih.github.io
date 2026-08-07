'use client'

import { AdUnit } from '@/components/ads/ad-unit'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import {
  type MortgagePrepaymentInput,
  calculateMortgagePrepayment,
  defaultMortgagePrepaymentInput,
} from '@/lib/mortgage-prepayment'
import {
  AlertTriangle,
  Calculator,
  Clock,
  Home,
  Landmark,
  Receipt,
  RotateCcw,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'

const yenFormatter = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
})

const monthFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

const fieldDefinitions = [
  {
    id: 'loan-balance',
    key: 'loanBalance',
    label: 'Current loan balance',
    suffix: 'JPY',
    min: 0,
    max: 1_000_000_000,
    step: 100_000,
  },
  {
    id: 'annual-interest-rate',
    key: 'annualInterestRate',
    label: 'Annual interest rate',
    suffix: '%',
    min: 0,
    max: 20,
    step: 0.01,
  },
  {
    id: 'remaining-months',
    key: 'remainingMonths',
    label: 'Remaining term',
    suffix: 'months',
    min: 1,
    max: 600,
    step: 1,
  },
  {
    id: 'prepayment-amount',
    key: 'prepaymentAmount',
    label: 'Prepayment amount',
    suffix: 'JPY',
    min: 0,
    max: 1_000_000_000,
    step: 100_000,
  },
  {
    id: 'prepayment-fee',
    key: 'prepaymentFee',
    label: 'Prepayment fee',
    suffix: 'JPY',
    min: 0,
    max: 1_000_000,
    step: 1_000,
  },
] as const

const comparisonNotes = [
  {
    icon: Clock,
    title: 'Term shortening',
    text: 'Keeps the monthly payment close to the current payment and estimates how many months may disappear from the schedule.',
  },
  {
    icon: Wallet,
    title: 'Payment reduction',
    text: 'Keeps the remaining term and recalculates a lower monthly payment after the principal is reduced.',
  },
  {
    icon: Receipt,
    title: 'Fee-aware savings',
    text: 'Shows interest saved separately from net savings after an optional prepayment fee.',
  },
]

const cautionItems = [
  'This is a fixed-rate equal-payment estimate and does not model rate resets, bonus repayments, guarantee fees, or tax credits.',
  'Your lender may apply accrued interest, minimum prepayment amounts, or different handling for partial prepayments.',
  'Compare the result with emergency savings, investment risk, and housing-loan tax benefit timing before acting.',
]

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
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

export default function MortgagePrepaymentCalculatorPage() {
  const [input, setInput] = useState<MortgagePrepaymentInput>(defaultMortgagePrepaymentInput)
  const result = useMemo(() => calculateMortgagePrepayment(input), [input])

  const updateInput = (key: keyof MortgagePrepaymentInput, value: number) => {
    setInput((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }))
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Home className="h-6 w-6" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-end">
            <div>
              <h1 className="mb-4 text-3xl font-bold text-foreground-light dark:text-foreground-dark sm:text-4xl">
                Mortgage Prepayment Calculator
              </h1>
              <p className="max-w-3xl text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Compare a mortgage prepayment as a term-shortening plan or a payment-reduction plan.
                Estimate interest savings, months shortened, and the monthly payment change from a
                fixed-rate equal-payment schedule.
              </p>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">
                  Draft estimate only. Confirm lender rules, current rates, tax-credit effects, and
                  fees before making a repayment decision.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground-light dark:text-foreground-dark">
                Loan and prepayment assumptions
              </h2>
              <button
                type="button"
                onClick={() => setInput(defaultMortgagePrepaymentInput)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-light px-4 text-sm font-medium text-foreground-light transition-colors hover:bg-background-light dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {fieldDefinitions.map((field) => (
                <NumberField
                  key={field.id}
                  id={field.id}
                  label={field.label}
                  value={input[field.key]}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  suffix={field.suffix}
                  onChange={(value) => updateInput(field.key, value)}
                />
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <h2 className="mb-5 text-xl font-semibold text-foreground-light dark:text-foreground-dark">
              Current loan estimate
            </h2>
            <div className="mb-5 rounded-lg bg-accent/10 p-5">
              <p className="text-sm font-medium text-accent">Estimated monthly payment</p>
              <p className="mt-2 text-3xl font-bold text-foreground-light dark:text-foreground-dark">
                {yenFormatter.format(result.current.monthlyPayment)}
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <ResultRow
                label="Remaining interest"
                value={yenFormatter.format(result.current.totalInterest)}
              />
              <ResultRow
                label="Remaining total paid"
                value={yenFormatter.format(result.current.totalPaid)}
              />
              <ResultRow
                label="Balance after prepayment"
                value={yenFormatter.format(result.remainingBalanceAfterPrepayment)}
              />
            </div>
          </aside>
        </section>

        <AdUnit slot="toolContent" className="mb-8" />

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <Clock className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-semibold text-foreground-light dark:text-foreground-dark">
                Term-shortening result
              </h2>
            </div>
            <div className="mb-5 rounded-lg bg-background-light p-5 dark:bg-background-dark">
              <p className="text-sm font-medium text-accent">Net savings after fee</p>
              <p className="mt-2 text-3xl font-bold text-foreground-light dark:text-foreground-dark">
                {yenFormatter.format(result.termShortening.netSavedAfterFee)}
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <ResultRow
                label="Months shortened"
                value={`${monthFormatter.format(result.termShortening.monthsShortened)} months`}
              />
              <ResultRow
                label="Interest saved"
                value={yenFormatter.format(result.termShortening.interestSaved)}
              />
              <ResultRow
                label="New payoff timing"
                value={`${monthFormatter.format(result.termShortening.monthsToPayoff)} months`}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-semibold text-foreground-light dark:text-foreground-dark">
                Payment-reduction result
              </h2>
            </div>
            <div className="mb-5 rounded-lg bg-background-light p-5 dark:bg-background-dark">
              <p className="text-sm font-medium text-accent">New monthly payment</p>
              <p className="mt-2 text-3xl font-bold text-foreground-light dark:text-foreground-dark">
                {yenFormatter.format(result.paymentReduction.monthlyPayment)}
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <ResultRow
                label="Monthly payment reduced by"
                value={yenFormatter.format(result.paymentReduction.monthlyPaymentReducedBy)}
              />
              <ResultRow
                label="Interest saved"
                value={yenFormatter.format(result.paymentReduction.interestSaved)}
              />
              <ResultRow
                label="Net savings after fee"
                value={yenFormatter.format(result.paymentReduction.netSavedAfterFee)}
              />
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Calculator className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-semibold text-foreground-light dark:text-foreground-dark">
              How to compare the two repayment types
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {comparisonNotes.map((note) => {
              const Icon = note.icon
              return (
                <div
                  key={note.title}
                  className="rounded-lg border border-border-light bg-background-light p-4 dark:border-border-dark dark:bg-background-dark"
                >
                  <Icon className="mb-3 h-5 w-5 text-accent" />
                  <h3 className="mb-2 font-semibold text-foreground-light dark:text-foreground-dark">
                    {note.title}
                  </h3>
                  <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    {note.text}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <Landmark className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-semibold text-foreground-light dark:text-foreground-dark">
                Prepayment checks before you decide
              </h2>
            </div>
            <ul className="space-y-3 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              {cautionItems.map((item) => (
                <li
                  key={item}
                  className="rounded-lg bg-background-light p-4 dark:bg-background-dark"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground-light dark:text-foreground-dark">
              Related calculators
            </h2>
            <div className="space-y-3">
              <a
                href="/tools/investment-calculator/"
                className="block rounded-lg border border-border-light p-4 text-sm font-medium text-accent transition-colors hover:bg-accent/5 dark:border-border-dark"
              >
                Compare long-term compounding in the Investment Calculator
              </a>
              <a
                href="/tools/take-home-pay-calculator/"
                className="block rounded-lg border border-border-light p-4 text-sm font-medium text-accent transition-colors hover:bg-accent/5 dark:border-border-dark"
              >
                Estimate monthly cash flow with the Take-Home Pay Calculator
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
