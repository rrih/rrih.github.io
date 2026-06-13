'use client'

import { AdUnit } from '@/components/ads/ad-unit'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { type ElectricityCostInput, calculateElectricityCost } from '@/lib/electricity-cost'
import { Calculator, Info, RotateCcw, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'

const presets = [
  { name: 'LED bulb', watts: 9, hoursPerDay: 5 },
  { name: 'Laptop', watts: 65, hoursPerDay: 6 },
  { name: 'Air conditioner', watts: 900, hoursPerDay: 8 },
  { name: 'Heater', watts: 1200, hoursPerDay: 4 },
]

const exampleCosts = [
  { name: 'LED bulb', watts: 9, hoursPerDay: 5, note: 'Bedroom or desk lamp' },
  { name: 'Laptop', watts: 65, hoursPerDay: 6, note: 'Work-from-home day' },
  { name: 'Air conditioner', watts: 900, hoursPerDay: 8, note: 'Summer cooling estimate' },
  { name: 'Electric heater', watts: 1200, hoursPerDay: 4, note: 'Spot heating comparison' },
]

const estimateChecks = [
  'Use the measured wattage from the appliance label, manual, or a plug-in power meter.',
  'Split time-of-use plans into separate morning, daytime, and night calculations.',
  'Run high-use appliances separately before combining them into a monthly household estimate.',
]

const defaultInput: ElectricityCostInput = {
  watts: 900,
  quantity: 1,
  hoursPerDay: 8,
  days: 30,
  ratePerKwh: 31,
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 3,
})

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
})

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground-light dark:text-foreground-dark">
        {label}
      </span>
      <div className="flex min-h-12 overflow-hidden rounded-lg border border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark">
        <input
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
    </label>
  )
}

export default function ElectricityCostCalculatorPage() {
  const [input, setInput] = useState<ElectricityCostInput>(defaultInput)
  const result = useMemo(() => calculateElectricityCost(input), [input])

  const updateInput = (key: keyof ElectricityCostInput, value: number) => {
    setInput((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }))
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Zap className="h-6 w-6" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <h1 className="mb-4 text-3xl font-bold text-foreground-light dark:text-foreground-dark sm:text-4xl">
                Electricity Cost Calculator
              </h1>
              <p className="max-w-3xl text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Estimate the running cost of appliances from wattage, usage time, quantity, and your
                own electricity rate. Compare daily, monthly, and annualized costs without sending
                your appliance data to a server.
              </p>
            </div>
            <div className="rounded-lg border border-border-light bg-card-light p-4 dark:border-border-dark dark:bg-card-dark">
              <div className="flex items-center gap-3">
                <Calculator className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Formula
                  </p>
                  <p className="text-sm font-semibold text-foreground-light dark:text-foreground-dark">
                    watts x hours x days / 1000 x rate
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground-light dark:text-foreground-dark">
                Appliance details
              </h2>
              <button
                type="button"
                onClick={() => setInput(defaultInput)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-light px-4 text-sm font-medium text-foreground-light transition-colors hover:bg-background-light dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Power draw"
                value={input.watts}
                min={0}
                max={1000000}
                suffix="W"
                onChange={(value) => updateInput('watts', value)}
              />
              <NumberField
                label="Quantity"
                value={input.quantity}
                min={1}
                max={1000}
                suffix="units"
                onChange={(value) => updateInput('quantity', value)}
              />
              <NumberField
                label="Use per day"
                value={input.hoursPerDay}
                min={0}
                max={24}
                step={0.25}
                suffix="hours"
                onChange={(value) => updateInput('hoursPerDay', value)}
              />
              <NumberField
                label="Period"
                value={input.days}
                min={1}
                max={3660}
                suffix="days"
                onChange={(value) => updateInput('days', value)}
              />
              <NumberField
                label="Electricity rate"
                value={input.ratePerKwh}
                min={0}
                max={10000}
                step={0.01}
                suffix="per kWh"
                onChange={(value) => updateInput('ratePerKwh', value)}
              />
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-foreground-light dark:text-foreground-dark">
                Quick presets
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {presets.map((preset) => (
                  <button
                    type="button"
                    key={preset.name}
                    onClick={() =>
                      setInput((current) => ({
                        ...current,
                        watts: preset.watts,
                        hoursPerDay: preset.hoursPerDay,
                      }))
                    }
                    className="min-h-12 rounded-lg border border-border-light px-3 py-2 text-left text-sm transition-colors hover:border-accent hover:bg-accent/5 dark:border-border-dark"
                  >
                    <span className="block font-medium text-foreground-light dark:text-foreground-dark">
                      {preset.name}
                    </span>
                    <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      {preset.watts} W for {preset.hoursPerDay} h/day
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
            <h2 className="mb-5 text-xl font-semibold text-foreground-light dark:text-foreground-dark">
              Estimated cost
            </h2>
            <div className="mb-5 rounded-lg bg-accent/10 p-5">
              <p className="text-sm font-medium text-accent">Total for selected period</p>
              <p className="mt-2 text-3xl font-bold text-foreground-light dark:text-foreground-dark">
                {currencyFormatter.format(result.totalCost)}
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Daily cost
                </span>
                <strong className="text-right text-foreground-light dark:text-foreground-dark">
                  {currencyFormatter.format(result.averageDailyCost)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Annualized cost
                </span>
                <strong className="text-right text-foreground-light dark:text-foreground-dark">
                  {currencyFormatter.format(result.annualizedCost)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Energy per day
                </span>
                <strong className="text-right text-foreground-light dark:text-foreground-dark">
                  {numberFormatter.format(result.kwhPerDay)} kWh
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Total energy
                </span>
                <strong className="text-right text-foreground-light dark:text-foreground-dark">
                  {numberFormatter.format(result.totalKwh)} kWh
                </strong>
              </div>
            </div>
          </aside>
        </section>

        <AdUnit slot="toolContent" className="mb-8 sm:mb-12" />

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Info className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-3 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              How to read the result
            </h2>
            <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              The calculator converts appliance wattage into kilowatt-hours, then multiplies that
              energy use by your price per kWh. Use the rate shown on your electricity bill for the
              closest estimate.
            </p>
          </div>
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Zap className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-3 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              Compare appliances
            </h2>
            <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              Try the same usage period with different wattage values to compare heaters, air
              conditioners, lighting, laptops, or standby devices before changing habits.
            </p>
          </div>
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <Calculator className="mb-4 h-6 w-6 text-accent" />
            <h2 className="mb-3 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              Privacy-focused
            </h2>
            <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              Inputs are calculated locally in the browser. No account is required, and the result
              does not depend on any external energy pricing API.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-foreground-light dark:text-foreground-dark">
              Common Appliance Monthly Examples
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              These examples use a 30-day month and the default JPY 31 per kWh rate. Adjust the
              fields above when your bill shows a different electricity rate or your appliance runs
              for a different number of hours.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {exampleCosts.map((example) => {
              const exampleResult = calculateElectricityCost({
                watts: example.watts,
                quantity: 1,
                hoursPerDay: example.hoursPerDay,
                days: 30,
                ratePerKwh: defaultInput.ratePerKwh,
              })

              return (
                <div
                  key={example.name}
                  className="rounded-lg border border-border-light bg-card-light p-4 dark:border-border-dark dark:bg-card-dark"
                >
                  <p className="text-sm font-medium text-accent">{example.note}</p>
                  <h3 className="mt-2 font-semibold text-foreground-light dark:text-foreground-dark">
                    {example.name}
                  </h3>
                  <p className="mt-2 text-2xl font-bold text-foreground-light dark:text-foreground-dark">
                    {currencyFormatter.format(exampleResult.totalCost)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    {example.watts} W for {example.hoursPerDay} hours per day
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div>
            <h2 className="text-2xl font-bold text-foreground-light dark:text-foreground-dark">
              How to Improve Your Estimate
            </h2>
            <p className="mt-3 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              Electricity use changes by mode, season, and thermostat behavior. Use this checklist
              before comparing appliances or deciding whether a usage habit is worth changing.
            </p>
            <div className="mt-5 grid gap-3">
              {estimateChecks.map((check) => (
                <div
                  key={check}
                  className="rounded-lg border border-border-light bg-card-light p-4 dark:border-border-dark dark:bg-card-dark"
                >
                  <p className="text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    {check}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
            <h3 className="text-lg font-semibold text-foreground-light dark:text-foreground-dark">
              When to use annualized cost
            </h3>
            <p className="mt-3 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              Annualized cost is useful for devices that run all year, such as refrigerators,
              routers, dehumidifiers, aquariums, or standby equipment. For seasonal devices, compare
              the selected period total instead.
            </p>
          </div>
        </section>

        <section className="mt-12 rounded-lg border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark sm:p-6">
          <h2 className="mb-5 text-2xl font-bold text-foreground-light dark:text-foreground-dark">
            Frequently Asked Questions
          </h2>
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
                What electricity rate should I enter?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Use the price per kWh from your bill. If your plan has time-of-use rates, run the
                calculator separately for each rate period and add the totals.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
                Why does wattage differ from real usage?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Many appliances cycle on and off or change power draw by mode. Use measured wattage
                from a smart plug when you need a tighter estimate.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
                Can I calculate monthly cost?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Yes. Set the period to 30 or 31 days. The annualized figure uses your average daily
                cost multiplied by 365.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
                How do I compare two appliances fairly?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Keep the same period and rate per kWh, then change only the wattage, quantity, or
                hours per day. That makes the cost difference easier to read.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
                Should standby power be included?
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Include standby power for devices that stay plugged in all day. Use a low wattage
                value, 24 hours per day, and a 30-day period to estimate the monthly cost.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
