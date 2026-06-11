import { describe, expect, it } from 'bun:test'
import {
  buildRevenueAcceleratorPlan,
  findCtrRewriteActions,
  findNewToolActions,
  renderAcceleratorReport,
} from '../scripts/growth/revenue-accelerator'

const snapshot = {
  generatedAt: '2026-06-11T00:00:00.000Z',
  range: { startDate: '2026-05-14', endDate: '2026-06-10' },
  searchConsole: {
    totals: { clicks: 2, impressions: 1000, ctr: 0.002, position: 25 },
    topPages: [
      {
        keys: ['https://rrih.github.io/tools/animation-generator/'],
        clicks: 2,
        impressions: 660,
        ctr: 0.003,
        position: 28,
      },
    ],
    topQueries: [
      {
        keys: ['css animation generator'],
        clicks: 0,
        impressions: 120,
        ctr: 0,
        position: 22,
      },
    ],
  },
  ga4: {
    totals: { pageviews: 51, activeUsers: 20 },
    topPages: [{ path: '/tools/animation-generator/', pageviews: 10 }],
  },
  kpi: {
    month: '2026-06',
    actualPageviews28d: 51,
    actualRevenueJpy: 2,
  },
}

const opportunities = {
  domainConstraint: 'All opportunities must ship under https://rrih.github.io/.',
  opportunities: [
    {
      id: 'take-home-pay-calculator',
      kind: 'tool' as const,
      path: '/tools/take-home-pay-calculator/',
      title: 'Take-Home Pay Calculator',
      primaryLocale: 'ja' as const,
      primaryIntent: 'salary net income calculator',
      cpcTier: 'high' as const,
      revenuePotential: 'high' as const,
      implementationEffort: 'medium' as const,
      policyRisk: 'medium' as const,
      automationMode: 'draft-pr' as const,
      status: 'planned' as const,
      rationale: 'Higher-value finance query.',
    },
    {
      id: 'electricity-cost-calculator',
      kind: 'tool' as const,
      path: '/tools/electricity-cost-calculator/',
      title: 'Electricity Cost Calculator',
      primaryLocale: 'ja' as const,
      primaryIntent: 'appliance electricity cost calculator',
      cpcTier: 'medium' as const,
      revenuePotential: 'medium' as const,
      implementationEffort: 'low' as const,
      policyRisk: 'low' as const,
      automationMode: 'auto-pr' as const,
      status: 'planned' as const,
      rationale: 'Deterministic calculator.',
    },
  ],
}

describe('revenue accelerator', () => {
  it('prioritizes high-revenue rrih.github.io tool opportunities', () => {
    const actions = findNewToolActions(opportunities.opportunities)

    expect(actions[0].target).toBe('/tools/take-home-pay-calculator/')
    expect(actions.every((action) => action.target.startsWith('/tools/'))).toBe(true)
  })

  it('excludes launched tool opportunities from new-tool actions', () => {
    const actions = findNewToolActions([
      {
        ...opportunities.opportunities[0],
        status: 'launched' as const,
      },
    ])

    expect(actions).toEqual([])
  })

  it('detects low-CTR queries for rewrite candidates', () => {
    const actions = findCtrRewriteActions(snapshot)

    expect(actions[0]).toMatchObject({
      type: 'ctr-rewrite',
      target: 'css animation generator',
      automationMode: 'draft-pr',
    })
  })

  it('computes the revenue gap and required PV at current RPM', () => {
    const plan = buildRevenueAcceleratorPlan(
      snapshot,
      opportunities,
      new Date('2026-06-11T00:00:00.000Z')
    )

    expect(plan.targetMonthlyRevenueJpy).toBe(50000)
    expect(plan.currentRpmJpy).toBe(39.22)
    expect(plan.requiredMonthlyPageviewsAtCurrentRpm).toBe(1274860)
    expect(plan.topActions.length).toBeGreaterThan(0)
  })

  it('renders a report with automation boundaries', () => {
    const plan = buildRevenueAcceleratorPlan(
      snapshot,
      opportunities,
      new Date('2026-06-11T00:00:00.000Z')
    )
    const report = renderAcceleratorReport(plan)

    expect(report).toContain('Scope: `https://rrih.github.io/` only.')
    expect(report).toContain('Automation Boundary')
    expect(report).toContain('Take-Home Pay Calculator')
  })
})
