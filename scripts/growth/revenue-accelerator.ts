import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const METRICS_FILE = join(ROOT, 'data', 'growth', 'metrics', 'latest.json')
const OPPORTUNITIES_FILE = join(ROOT, 'data', 'growth', 'opportunities.json')
const ACCELERATOR_DIR = join(ROOT, 'data', 'growth', 'accelerator')
const TARGET_MONTHLY_REVENUE_JPY =
  Number.parseInt(process.env.REVENUE_ACCELERATOR_TARGET_JPY ?? '', 10) || 50000

interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface MetricsSnapshot {
  generatedAt: string
  range: { startDate: string; endDate: string }
  searchConsole: {
    totals: { clicks: number; impressions: number; ctr: number; position: number }
    topPages: GscRow[]
    topQueries: GscRow[]
  } | null
  ga4: {
    totals: { pageviews: number; activeUsers: number }
    topPages: Array<{ path: string; pageviews: number }>
  } | null
  kpi: {
    month: string
    actualPageviews28d: number | null
    actualRevenueJpy: number | null
  }
}

type Tier = 'low' | 'medium' | 'high'
type AutomationMode = 'auto-pr' | 'draft-pr' | 'issue-only'

interface RevenueOpportunity {
  id: string
  kind: 'tool' | 'content' | 'optimization'
  path: string
  title: string
  primaryLocale: 'en' | 'ja'
  primaryIntent: string
  cpcTier: Tier
  revenuePotential: Tier
  implementationEffort: Tier
  policyRisk: Tier
  automationMode: AutomationMode
  status: 'planned' | 'in_progress' | 'launched' | 'paused'
  rationale: string
}

interface OpportunitiesFile {
  targetMonthlyRevenueJpy?: number
  domainConstraint: string
  opportunities: RevenueOpportunity[]
}

export interface AcceleratorAction {
  type: 'new-high-cpc-tool' | 'ctr-rewrite' | 'existing-page-expansion' | 'measurement' | 'no-data'
  priority: number
  title: string
  target: string
  automationMode: AutomationMode
  rationale: string
}

export interface RevenueAcceleratorPlan {
  generatedAt: string
  targetMonthlyRevenueJpy: number
  targetDailyRevenueJpy: number
  actualRevenueJpy: number | null
  actualDailyRevenueJpy: number | null
  actualPageviews28d: number | null
  currentRpmJpy: number | null
  requiredMonthlyPageviewsAtCurrentRpm: number | null
  topActions: AcceleratorAction[]
}

const tierScore: Record<Tier, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

const effortScore: Record<Tier, number> = {
  low: 3,
  medium: 2,
  high: 1,
}

const policyScore: Record<Tier, number> = {
  low: 3,
  medium: 1,
  high: -2,
}

function formatDate(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function plannedOpportunityScore(opportunity: RevenueOpportunity): number {
  if (opportunity.status !== 'planned') return -100

  return (
    tierScore[opportunity.revenuePotential] * 4 +
    tierScore[opportunity.cpcTier] * 3 +
    effortScore[opportunity.implementationEffort] * 2 +
    policyScore[opportunity.policyRisk] +
    (opportunity.automationMode === 'auto-pr' ? 2 : 0)
  )
}

export function findCtrRewriteActions(snapshot: MetricsSnapshot): AcceleratorAction[] {
  const rows = snapshot.searchConsole?.topQueries ?? []

  return rows
    .filter((row) => row.impressions >= 20 && row.ctr < 0.03)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 3)
    .map((row, index) => ({
      type: 'ctr-rewrite',
      priority: 70 - index,
      title: `Rewrite title/meta for query: ${row.keys[0]}`,
      target: row.keys[0] ?? 'unknown query',
      automationMode: 'draft-pr',
      rationale: `${row.impressions} impressions, ${round(row.ctr * 100)}% CTR, average position ${round(
        row.position,
        1
      )}.`,
    }))
}

export function findExistingPageExpansionActions(snapshot: MetricsSnapshot): AcceleratorAction[] {
  const rows = snapshot.searchConsole?.topPages ?? []

  return rows
    .map((row) => ({
      row,
      url: row.keys[0] ?? '',
    }))
    .filter(({ url, row }) => url.includes('/tools/') && row.impressions > 0)
    .sort((a, b) => b.row.impressions - a.row.impressions)
    .slice(0, 3)
    .map(({ row, url }, index) => ({
      type: 'existing-page-expansion',
      priority: 60 - index,
      title: `Expand existing tool page: ${url}`,
      target: url,
      automationMode: 'auto-pr',
      rationale: `${row.impressions} impressions and ${row.clicks} clicks in the latest GSC window. Add supporting copy, FAQ, and internal links without changing ad density.`,
    }))
}

export function findNewToolActions(opportunities: RevenueOpportunity[]): AcceleratorAction[] {
  return [...opportunities]
    .filter((opportunity) => opportunity.status === 'planned')
    .sort((a, b) => plannedOpportunityScore(b) - plannedOpportunityScore(a))
    .slice(0, 5)
    .map((opportunity, index) => ({
      type: 'new-high-cpc-tool',
      priority: 100 - index,
      title: `Build ${opportunity.title}`,
      target: opportunity.path,
      automationMode: opportunity.automationMode,
      rationale: `${opportunity.primaryIntent}. CPC tier: ${opportunity.cpcTier}; potential: ${opportunity.revenuePotential}; effort: ${opportunity.implementationEffort}; policy risk: ${opportunity.policyRisk}. ${opportunity.rationale}`,
    }))
}

export function buildRevenueAcceleratorPlan(
  snapshot: MetricsSnapshot,
  opportunitiesFile: OpportunitiesFile,
  now = new Date()
): RevenueAcceleratorPlan {
  const actualRevenueJpy = snapshot.kpi.actualRevenueJpy
  const actualPageviews28d = snapshot.kpi.actualPageviews28d
  const actualDailyRevenueJpy = actualRevenueJpy === null ? null : round(actualRevenueJpy / 28, 2)
  const currentRpmJpy =
    actualRevenueJpy === null || !actualPageviews28d
      ? null
      : round((actualRevenueJpy / actualPageviews28d) * 1000, 2)
  const requiredMonthlyPageviewsAtCurrentRpm =
    currentRpmJpy && currentRpmJpy > 0
      ? Math.ceil((TARGET_MONTHLY_REVENUE_JPY / currentRpmJpy) * 1000)
      : null
  const targetDailyRevenueJpy = round(TARGET_MONTHLY_REVENUE_JPY / 30, 2)

  const dataDrivenActions = snapshot.searchConsole
    ? [...findCtrRewriteActions(snapshot), ...findExistingPageExpansionActions(snapshot)]
    : [
        {
          type: 'no-data' as const,
          priority: 90,
          title: 'Restore Search Console data before aggressive growth',
          target: 'data/growth/metrics/latest.json',
          automationMode: 'issue-only' as const,
          rationale: 'Search Console data is unavailable, so traffic-led changes cannot be ranked.',
        },
      ]

  const topActions = [...findNewToolActions(opportunitiesFile.opportunities), ...dataDrivenActions]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8)

  return {
    generatedAt: now.toISOString(),
    targetMonthlyRevenueJpy: TARGET_MONTHLY_REVENUE_JPY,
    targetDailyRevenueJpy,
    actualRevenueJpy,
    actualDailyRevenueJpy,
    actualPageviews28d,
    currentRpmJpy,
    requiredMonthlyPageviewsAtCurrentRpm,
    topActions,
  }
}

export function renderAcceleratorReport(plan: RevenueAcceleratorPlan): string {
  const lines = [
    `# Revenue Accelerator ${formatDate(new Date(plan.generatedAt))}`,
    '',
    'Scope: `https://rrih.github.io/` only.',
    '',
    '## Revenue Gap',
    '',
    `- Target monthly revenue: ${plan.targetMonthlyRevenueJpy.toLocaleString('en-US')} JPY`,
    `- Target daily revenue: ${plan.targetDailyRevenueJpy.toLocaleString('en-US')} JPY`,
    `- Actual recorded revenue: ${
      plan.actualRevenueJpy === null ? 'NOT AVAILABLE' : `${plan.actualRevenueJpy} JPY`
    }`,
    `- Actual daily pace: ${
      plan.actualDailyRevenueJpy === null
        ? 'NOT AVAILABLE'
        : `${plan.actualDailyRevenueJpy} JPY/day`
    }`,
    `- 28-day pageviews: ${plan.actualPageviews28d ?? 'NOT AVAILABLE'}`,
    `- Current RPM: ${plan.currentRpmJpy === null ? 'NOT AVAILABLE' : `${plan.currentRpmJpy} JPY`}`,
    `- Required monthly PV at current RPM: ${
      plan.requiredMonthlyPageviewsAtCurrentRpm === null
        ? 'NOT AVAILABLE'
        : plan.requiredMonthlyPageviewsAtCurrentRpm.toLocaleString('en-US')
    }`,
    '',
    '## Top Actions',
    '',
    ...plan.topActions.flatMap((action, index) => [
      `### ${index + 1}. ${action.title}`,
      '',
      `- Type: ${action.type}`,
      `- Target: ${action.target}`,
      `- Automation mode: ${action.automationMode}`,
      `- Priority: ${action.priority}`,
      `- Rationale: ${action.rationale}`,
      '',
    ]),
    '## Automation Boundary',
    '',
    '- `auto-pr`: may be implemented automatically only when deterministic tests and allowlists pass.',
    '- `draft-pr`: Codex may create a PR, but calculation-heavy or policy-sensitive changes need review before merge.',
    '- `issue-only`: record the blocker or recommendation without changing production.',
  ]

  return `${lines.join('\n')}\n`
}

function main() {
  mkdirSync(ACCELERATOR_DIR, { recursive: true })

  const snapshot = JSON.parse(readFileSync(METRICS_FILE, 'utf8')) as MetricsSnapshot
  const opportunities = JSON.parse(readFileSync(OPPORTUNITIES_FILE, 'utf8')) as OpportunitiesFile
  const plan = buildRevenueAcceleratorPlan(snapshot, opportunities)
  const report = renderAcceleratorReport(plan)
  const date = formatDate(new Date(plan.generatedAt))

  writeFileSync(join(ACCELERATOR_DIR, `${date}.json`), `${JSON.stringify(plan, null, 2)}\n`)
  writeFileSync(join(ACCELERATOR_DIR, `${date}.md`), report)
  writeFileSync(join(ACCELERATOR_DIR, 'latest.json'), `${JSON.stringify(plan, null, 2)}\n`)
  writeFileSync(join(ACCELERATOR_DIR, 'latest.md'), report)

  console.log(`Revenue Accelerator top action: ${plan.topActions[0]?.title ?? 'none'}`)
}

if (import.meta.main) {
  main()
}
