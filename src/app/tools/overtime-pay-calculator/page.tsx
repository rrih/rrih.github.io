'use client'

import { AdUnit } from '@/components/ads/ad-unit'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import {
  type OvertimePayInput,
  calculateOvertimePay,
  defaultOvertimePayInput,
} from '@/lib/overtime-pay'
import { AlertTriangle, Calculator, Clock3, Info, Landmark, Moon, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'

const yenFormatter = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
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

export default function OvertimePayCalculatorPage() {
  const [input, setInput] = useState<OvertimePayInput>(defaultOvertimePayInput)
  const result = useMemo(() => calculateOvertimePay(input), [input])

  const updateInput = (key: keyof OvertimePayInput, value: number) => {
    setInput((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }))
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Clock3 className="h-6 w-6" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-end">
            <div>
              <h1 className="mb-4 text-3xl font-bold text-foreground-light dark:text-foreground-dark sm:text-4xl">
                Overtime Pay Calculator for Japan
              </h1>
              <p className="max-w-3xl text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Estimate statutory overtime, monthly overtime over 60 hours, late-night work, and
                legal-holiday premiums from a direct hourly wage or monthly base pay.
              </p>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">
                  Draft estimate only. Company rules, excluded allowances, rounding, and actual
                  statutory-holiday treatment can change payroll results.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground-light dark:text-foreground-dark">
                Wage and work assumptions
              </h2>
              <button
                type="button"
                onClick={() => setInput(defaultOvertimePayInput)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-light px-4 text-sm font-medium text-foreground-light transition-colors hover:bg-background-light dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <NumberField
                id="hourly-wage"
                label="Direct hourly wage"
                value={input.hourlyWage}
                min={0}
                max={1000000}
                step={10}
                suffix="JPY"
                onChange={(value) => updateInput('hourlyWage', value)}
              />
              <NumberField
                id="monthly-base-pay"
                label="Monthly base pay"
                value={input.monthlyBasePay}
                min={0}
                max={100000000}
                step={1000}
                suffix="JPY"
                onChange={(value) => updateInput('monthlyBasePay', value)}
              />
              <NumberField
                id="scheduled-hours"
                label="Scheduled hours"
                value={input.scheduledHoursPerMonth}
                min={1}
                max={744}
                step={0.25}
                suffix="h/mo"
                onChange={(value) => updateInput('scheduledHoursPerMonth', value)}
              />
            </div>

            <h3 className="mb-3 text-sm font-semibold text-foreground-light dark:text-foreground-dark">
              Monthly work buckets
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="overtime-hours"
                label="Overtime up to 60h"
                value={input.overtimeHours}
                min={0}
                max={744}
                step={0.25}
                suffix="hours"
                onChange={(value) => updateInput('overtimeHours', value)}
              />
              <NumberField
                id="overtime-over-60"
                label="Overtime over 60h"
                value={input.overtimeHoursOver60}
                min={0}
                max={744}
                step={0.25}
                suffix="hours"
                onChange={(value) => updateInput('overtimeHoursOver60', value)}
              />
              <NumberField
                id="night-overtime"
                label="Night overtime up to 60h"
                value={input.nightOvertimeHours}
                min={0}
                max={744}
                step={0.25}
                suffix="hours"
                onChange={(value) => updateInput('nightOvertimeHours', value)}
              />
              <NumberField
                id="night-overtime-over-60"
                label="Night overtime over 60h"
                value={input.nightOvertimeHoursOver60}
                min={0}
                max={744}
                step={0.25}
                suffix="hours"
                onChange={(value) => updateInput('nightOvertimeHoursOver60', value)}
              />
              <NumberField
                id="legal-holiday-hours"
                label="Legal holiday work"
                value={input.legalHolidayHours}
                min={0}
                max={744}
                step={0.25}
                suffix="hours"
                onChange={(value) => updateInput('legalHolidayHours', value)}
              />
              <NumberField
                id="night-legal-holiday-hours"
                label="Night legal holiday work"
                value={input.nightLegalHolidayHours}
                min={0}
                max={744}
                step={0.25}
                suffix="hours"
                onChange={(value) => updateInput('nightLegalHolidayHours', value)}
              />
            </div>
          </div>

          <aside className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <h2 className="mb-5 text-xl font-semibold text-foreground-light dark:text-foreground-dark">
              Estimated overtime pay
            </h2>
            <div className="mb-5 rounded-lg bg-accent/10 p-5">
              <p className="text-sm font-medium text-accent">Total for selected month</p>
              <p className="mt-2 text-3xl font-bold text-foreground-light dark:text-foreground-dark">
                {yenFormatter.format(result.totalOvertimePay)}
              </p>
              <p className="mt-2 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Premium portion: {yenFormatter.format(result.premiumPay)}
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <ResultRow
                label="Base hourly wage"
                value={yenFormatter.format(result.baseHourlyWage)}
              />
              <ResultRow
                label="Total extra hours"
                value={`${numberFormatter.format(result.totalExtraHours)} h`}
              />
              <ResultRow
                label="Regular equivalent"
                value={yenFormatter.format(result.regularEquivalentPay)}
              />
              <ResultRow
                label="Average multiplier"
                value={`${numberFormatter.format(result.averageMultiplier)}x`}
              />
            </div>
          </aside>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <h2 className="mb-5 text-xl font-semibold text-foreground-light dark:text-foreground-dark">
              Pay breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="border-b border-border-light text-foreground-light-secondary dark:border-border-dark dark:text-foreground-dark-secondary">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Bucket</th>
                    <th className="py-2 pr-4 text-right font-medium">Hours</th>
                    <th className="py-2 pr-4 text-right font-medium">Premium</th>
                    <th className="py-2 pr-4 text-right font-medium">Multiplier</th>
                    <th className="py-2 text-right font-medium">Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {result.segments.map((segment) => (
                    <tr key={segment.id}>
                      <td className="py-3 pr-4 text-foreground-light dark:text-foreground-dark">
                        {segment.label}
                      </td>
                      <td className="py-3 pr-4 text-right text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        {numberFormatter.format(segment.hours)}
                      </td>
                      <td className="py-3 pr-4 text-right text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        {percentFormatter.format(segment.premiumRate)}%
                      </td>
                      <td className="py-3 pr-4 text-right text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        {numberFormatter.format(segment.multiplier)}x
                      </td>
                      <td className="py-3 text-right font-semibold text-foreground-light dark:text-foreground-dark">
                        {yenFormatter.format(segment.totalPay)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <h2 className="mb-5 text-xl font-semibold text-foreground-light dark:text-foreground-dark">
              Premium rates
            </h2>
            <div className="space-y-4">
              <NumberField
                id="overtime-premium-rate"
                label="Overtime"
                value={input.overtimePremiumRate}
                min={0}
                max={300}
                step={0.1}
                suffix="%"
                onChange={(value) => updateInput('overtimePremiumRate', value)}
              />
              <NumberField
                id="overtime-over-60-rate"
                label="Overtime over 60h"
                value={input.overtimeOver60PremiumRate}
                min={0}
                max={300}
                step={0.1}
                suffix="%"
                onChange={(value) => updateInput('overtimeOver60PremiumRate', value)}
              />
              <NumberField
                id="night-premium-rate"
                label="Night work"
                value={input.nightPremiumRate}
                min={0}
                max={300}
                step={0.1}
                suffix="%"
                onChange={(value) => updateInput('nightPremiumRate', value)}
              />
              <NumberField
                id="legal-holiday-premium-rate"
                label="Legal holiday"
                value={input.legalHolidayPremiumRate}
                min={0}
                max={300}
                step={0.1}
                suffix="%"
                onChange={(value) => updateInput('legalHolidayPremiumRate', value)}
              />
            </div>
          </div>
        </section>

        <AdUnit slot="toolContent" className="mb-8 sm:mb-12" />

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Landmark className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-3 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              Legal-rate defaults
            </h2>
            <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              Defaults use 25% for statutory overtime, 50% after monthly overtime exceeds 60 hours,
              25% for late-night work, and 35% for legal-holiday work.
            </p>
          </div>
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Moon className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-3 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              Combined premiums
            </h2>
            <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              Night overtime combines the overtime and night premiums. Night work on a legal holiday
              combines the legal-holiday and night premiums.
            </p>
          </div>
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Info className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-3 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              Payroll boundary
            </h2>
            <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              The calculator does not decide whether a day is a legal holiday, which allowances are
              excluded from the base wage, or whether your workplace uses higher company rates.
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
                Which official rules does this draft follow?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                The default rates follow current Japanese labor references for statutory overtime,
                monthly overtime over 60 hours, late-night work from 22:00 to 5:00, and
                legal-holiday work. They are editable because employment contracts and work rules
                may set higher rates.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
                Should I enter all night hours twice?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                No. Put each hour in exactly one bucket. For example, a late-night overtime hour
                within the first 60 monthly overtime hours belongs in Night overtime up to 60h, not
                in the regular overtime field.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
                Why is this a draft calculator?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Exact payroll can depend on work-rule definitions, excluded allowances, variable
                pay, statutory-holiday classification, and rounding rules. Use this as a planning
                estimate and review the assumptions before relying on it.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
