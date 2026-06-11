/**
 * Growth metrics collector for rrih.github.io
 *
 * Fetches Search Console (impressions/clicks), GA4 (pageviews/users), and
 * AdSense revenue data, then writes:
 *   - data/growth/metrics/<YYYY-MM-DD>.json (snapshot)
 *   - data/growth/metrics/latest.json       (same content, stable path)
 *   - data/growth/reports/<YYYY-MM-DD>.md   (human/LLM-readable report)
 *
 * Auth: either:
 *   - a Google Cloud service account with read access to:
 *   - Search Console property https://rrih.github.io/ (add SA email as user)
 *   - GA4 property 503144752 (add SA email as Viewer)
 *   - or an authorized_user OAuth credential JSON for a Google user that has
 *     direct access to both products.
 *
 * Env vars:
 *   GOOGLE_SERVICE_ACCOUNT_KEY   service account key JSON (string), or
 *   GOOGLE_APPLICATION_CREDENTIALS path to the key file
 *   GOOGLE_OAUTH_CREDENTIALS     authorized_user JSON (string)
 *   GOOGLE_QUOTA_PROJECT_ID      quota project for OAuth user credentials
 *   ADSENSE_ACCOUNT_NAME         default: accounts/pub-6426570202991325
 *   ADSENSE_SITE_DOMAIN          default: rrih.github.io
 *   ADSENSE_REVENUE_MONTH        optional YYYY-MM override; defaults to current + previous month
 *   GA4_PROPERTY_ID              default: 503144752
 *   GSC_SITE_URL                 default: https://rrih.github.io/
 *
 * Run: bun scripts/growth/fetch-metrics.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? '503144752'
const GSC_SITE_URL = process.env.GSC_SITE_URL ?? 'https://rrih.github.io/'
const ADSENSE_ACCOUNT_NAME = process.env.ADSENSE_ACCOUNT_NAME ?? 'accounts/pub-6426570202991325'
const ADSENSE_SITE_DOMAIN = process.env.ADSENSE_SITE_DOMAIN ?? 'rrih.github.io'
const ROOT = join(import.meta.dir, '..', '..')
const METRICS_DIR = join(ROOT, 'data', 'growth', 'metrics')
const REPORTS_DIR = join(ROOT, 'data', 'growth', 'reports')
const REVENUE_FILE = join(ROOT, 'data', 'growth', 'revenue.json')

// Monthly KPI curve toward 10,000 JPY/month by 2026-12 (28-day PV basis)
const KPI_TARGETS: Record<string, { pageviews: number; revenueJpy: number }> = {
  '2026-06': { pageviews: 3000, revenueJpy: 0 },
  '2026-07': { pageviews: 6000, revenueJpy: 500 },
  '2026-08': { pageviews: 10000, revenueJpy: 1500 },
  '2026-09': { pageviews: 16000, revenueJpy: 3000 },
  '2026-10': { pageviews: 24000, revenueJpy: 5000 },
  '2026-11': { pageviews: 32000, revenueJpy: 7500 },
  '2026-12': { pageviews: 40000, revenueJpy: 10000 },
}

interface ServiceAccountKey {
  type?: 'service_account'
  client_email: string
  private_key: string
  token_uri: string
}

interface AuthorizedUserCredentials {
  type: 'authorized_user'
  client_id: string
  client_secret: string
  refresh_token: string
  token_uri?: string
  quota_project_id?: string
}

type GoogleCredentials = ServiceAccountKey | AuthorizedUserCredentials

interface AuthContext {
  token: string
  quotaProjectId?: string
}

interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface GscResponse {
  rows?: GscRow[]
}

interface Ga4Response {
  rows?: Array<{
    dimensionValues: Array<{ value: string }>
    metricValues: Array<{ value: string }>
  }>
}

interface RevenueEntry {
  month: string
  estimatedEarnings: number
}

interface RevenueFile {
  currency: string
  entries: RevenueEntry[]
}

interface MetricsSnapshot {
  generatedAt: string
  range: { startDate: string; endDate: string }
  searchConsole: {
    totals: { clicks: number; impressions: number; ctr: number; position: number }
    byDate: GscRow[]
    topPages: GscRow[]
    topQueries: GscRow[]
  } | null
  ga4: {
    totals: { pageviews: number; activeUsers: number }
    byDate: Array<{ date: string; pageviews: number; activeUsers: number }>
    topPages: Array<{ path: string; pageviews: number }>
  } | null
  revenue: RevenueFile
  kpi: {
    month: string
    target: { pageviews: number; revenueJpy: number } | null
    actualPageviews28d: number | null
    actualRevenueJpy: number | null
  }
}

function isAuthorizedUserCredentials(value: GoogleCredentials): value is AuthorizedUserCredentials {
  return value.type === 'authorized_user'
}

function loadGoogleCredentials(): GoogleCredentials | null {
  const oauth = process.env.GOOGLE_OAUTH_CREDENTIALS
  if (oauth) return JSON.parse(oauth) as AuthorizedUserCredentials

  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (inline) return JSON.parse(inline) as GoogleCredentials

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (path) return JSON.parse(readFileSync(path, 'utf8')) as GoogleCredentials

  return null
}

function base64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return Buffer.from(bytes).toString('base64url')
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  return Buffer.from(body, 'base64').buffer as ArrayBuffer
}

async function getAccessToken(key: ServiceAccountKey, scopes: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: scopes.join(' '),
      aud: key.token_uri,
      iat: now,
      exp: now + 3600,
    })
  )
  const signingInput = `${header}.${claims}`
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(key.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )
  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`

  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

async function getUserAccessToken(credentials: AuthorizedUserCredentials): Promise<string> {
  const res = await fetch(credentials.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`OAuth token refresh failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

async function getAuthContext(credentials: GoogleCredentials): Promise<AuthContext> {
  if (isAuthorizedUserCredentials(credentials)) {
    return {
      token: await getUserAccessToken(credentials),
      quotaProjectId:
        process.env.GOOGLE_QUOTA_PROJECT_ID ??
        credentials.quota_project_id ??
        process.env.GOOGLE_CLOUD_PROJECT ??
        process.env.GCLOUD_PROJECT,
    }
  }

  return {
    token: await getAccessToken(credentials, [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/adsense.readonly',
    ]),
  }
}

function authHeaders(auth: AuthContext): Record<string, string> {
  return {
    Authorization: `Bearer ${auth.token}`,
    ...(auth.quotaProjectId ? { 'x-goog-user-project': auth.quotaProjectId } : {}),
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function queryGsc(auth: AuthContext, body: Record<string, unknown>): Promise<GscResponse> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    GSC_SITE_URL
  )}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(auth), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GSC query failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as GscResponse
}

async function queryGa4(auth: AuthContext, body: Record<string, unknown>): Promise<Ga4Response> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(auth), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GA4 query failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as Ga4Response
}

async function queryAdsenseMonthlyRevenue(
  auth: AuthContext,
  month: string,
  domain: string,
  today: Date
): Promise<number | null> {
  const [year, monthNumber] = month.split('-').map(Number)
  const isCurrentMonth = year === today.getFullYear() && monthNumber === today.getMonth() + 1
  const endDay = isCurrentMonth ? today.getDate() : new Date(year, monthNumber, 0).getDate()
  const params = new URLSearchParams({
    dateRange: 'CUSTOM',
    'startDate.year': String(year),
    'startDate.month': String(monthNumber),
    'startDate.day': '1',
    'endDate.year': String(year),
    'endDate.month': String(monthNumber),
    'endDate.day': String(endDay),
    dimensions: 'DOMAIN_NAME',
    metrics: 'ESTIMATED_EARNINGS',
    currencyCode: 'JPY',
  })
  const url = `https://adsense.googleapis.com/v2/${ADSENSE_ACCOUNT_NAME}/reports:generate?${params}`
  const res = await fetch(url, { headers: authHeaders(auth) })
  if (!res.ok) throw new Error(`AdSense report failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as {
    rows?: Array<{ cells: Array<{ value?: string }> }>
  }
  const row = json.rows?.find((r) => r.cells[0]?.value === domain)
  const value = row?.cells[1]?.value
  return value === undefined ? null : Number(value)
}

function sumGsc(rows: GscRow[]): {
  clicks: number
  impressions: number
  ctr: number
  position: number
} {
  const clicks = rows.reduce((a, r) => a + r.clicks, 0)
  const impressions = rows.reduce((a, r) => a + r.impressions, 0)
  const position =
    impressions > 0 ? rows.reduce((a, r) => a + r.position * r.impressions, 0) / impressions : 0
  return { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0, position }
}

function loadRevenue(): RevenueFile {
  try {
    return JSON.parse(readFileSync(REVENUE_FILE, 'utf8')) as RevenueFile
  } catch {
    return { currency: 'JPY', entries: [] }
  }
}

function upsertRevenueEntry(revenue: RevenueFile, month: string, estimatedEarnings: number): void {
  const existing = revenue.entries.find((entry) => entry.month === month)
  if (existing) {
    existing.estimatedEarnings = estimatedEarnings
  } else {
    revenue.entries.push({ month, estimatedEarnings })
    revenue.entries.sort((a, b) => a.month.localeCompare(b.month))
  }
}

function previousMonth(date: Date): string {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`
}

function currentMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function revenueMonthsToSync(today: Date): string[] {
  if (process.env.ADSENSE_REVENUE_MONTH) return [process.env.ADSENSE_REVENUE_MONTH]
  return Array.from(new Set([previousMonth(today), currentMonth(today)]))
}

function buildReport(snapshot: MetricsSnapshot, previous: MetricsSnapshot | null): string {
  const lines: string[] = []
  const { kpi } = snapshot
  lines.push(`# Growth Report ${snapshot.generatedAt.slice(0, 10)}`)
  lines.push('')
  lines.push(`Period: ${snapshot.range.startDate} .. ${snapshot.range.endDate} (28 days)`)
  lines.push('')
  lines.push('## KPI vs Target')
  lines.push('')
  if (kpi.target) {
    const pv = kpi.actualPageviews28d
    const rev = kpi.actualRevenueJpy
    lines.push(`- Month: ${kpi.month}`)
    lines.push(
      `- Pageviews (28d): ${pv ?? 'n/a'} / target ${kpi.target.pageviews} (${
        pv !== null ? `${Math.round((pv / kpi.target.pageviews) * 100)}%` : 'n/a'
      })`
    )
    lines.push(
      `- Revenue (month, recorded): ${rev ?? 'not recorded'} JPY / target ${kpi.target.revenueJpy} JPY`
    )
  } else {
    lines.push(`- No KPI target defined for ${kpi.month}`)
  }
  lines.push('')

  if (snapshot.searchConsole) {
    const t = snapshot.searchConsole.totals
    lines.push('## Search Console (28d)')
    lines.push('')
    lines.push(
      `- Clicks: ${t.clicks} / Impressions: ${t.impressions} / CTR: ${(t.ctr * 100).toFixed(2)}% / Avg position: ${t.position.toFixed(1)}`
    )
    if (previous?.searchConsole) {
      const p = previous.searchConsole.totals
      lines.push(
        `- vs previous snapshot: clicks ${t.clicks - p.clicks >= 0 ? '+' : ''}${t.clicks - p.clicks}, impressions ${t.impressions - p.impressions >= 0 ? '+' : ''}${t.impressions - p.impressions}`
      )
    }
    lines.push('')
    lines.push('### Top pages (clicks)')
    lines.push('')
    for (const row of snapshot.searchConsole.topPages.slice(0, 10)) {
      lines.push(`- ${row.keys[0]} — ${row.clicks} clicks, ${row.impressions} impressions`)
    }
    lines.push('')
    lines.push('### Top queries (clicks)')
    lines.push('')
    for (const row of snapshot.searchConsole.topQueries.slice(0, 15)) {
      lines.push(
        `- "${row.keys[0]}" — ${row.clicks} clicks, ${row.impressions} impressions, pos ${row.position.toFixed(1)}`
      )
    }
    lines.push('')
  } else {
    lines.push('## Search Console: NOT AVAILABLE (credentials missing or API error)')
    lines.push('')
  }

  if (snapshot.ga4) {
    lines.push('## GA4 (28d)')
    lines.push('')
    lines.push(
      `- Pageviews: ${snapshot.ga4.totals.pageviews} / Active users: ${snapshot.ga4.totals.activeUsers}`
    )
    lines.push('')
    lines.push('### Top pages (pageviews)')
    lines.push('')
    for (const row of snapshot.ga4.topPages.slice(0, 10)) {
      lines.push(`- ${row.path} — ${row.pageviews}`)
    }
    lines.push('')
  } else {
    lines.push('## GA4: NOT AVAILABLE (credentials missing or API error)')
    lines.push('')
  }

  lines.push('## Next actions')
  lines.push('')
  lines.push(
    'Follow docs/growth/playbooks/weekly-review.md to derive concrete actions from this report.'
  )
  lines.push('')
  return lines.join('\n')
}

async function main(): Promise<void> {
  const now = new Date()
  const today = formatDate(now)
  const month = today.slice(0, 7)
  const end = new Date()
  end.setDate(end.getDate() - 3) // GSC data lags ~2-3 days
  const start = new Date(end)
  start.setDate(start.getDate() - 27)
  const startDate = formatDate(start)
  const endDate = formatDate(end)

  const credentials = loadGoogleCredentials()
  let auth: AuthContext | null = null
  let searchConsole: MetricsSnapshot['searchConsole'] = null
  let ga4: MetricsSnapshot['ga4'] = null

  if (credentials) {
    try {
      auth = await getAuthContext(credentials)
    } catch (err) {
      console.error('Google auth failed:', err)
    }
  } else {
    console.warn(
      'No Google credentials (GOOGLE_OAUTH_CREDENTIALS / GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_APPLICATION_CREDENTIALS). Writing snapshot without API data.'
    )
  }

  if (auth) {
    try {
      const [byDate, byPage, byQuery] = await Promise.all([
        queryGsc(auth, { startDate, endDate, dimensions: ['date'], rowLimit: 28 }),
        queryGsc(auth, { startDate, endDate, dimensions: ['page'], rowLimit: 50 }),
        queryGsc(auth, { startDate, endDate, dimensions: ['query'], rowLimit: 100 }),
      ])
      const dateRows = byDate.rows ?? []
      searchConsole = {
        totals: sumGsc(dateRows),
        byDate: dateRows,
        topPages: byPage.rows ?? [],
        topQueries: byQuery.rows ?? [],
      }

      const [ga4ByDate, ga4ByPage] = await Promise.all([
        queryGa4(auth, {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
          limit: 28,
        }),
        queryGa4(auth, {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 50,
        }),
      ])
      const ga4Dates = (ga4ByDate.rows ?? []).map((r) => ({
        date: r.dimensionValues[0]?.value ?? '',
        pageviews: Number(r.metricValues[0]?.value ?? 0),
        activeUsers: Number(r.metricValues[1]?.value ?? 0),
      }))
      ga4 = {
        totals: {
          pageviews: ga4Dates.reduce((a, r) => a + r.pageviews, 0),
          activeUsers: ga4Dates.reduce((a, r) => a + r.activeUsers, 0),
        },
        byDate: ga4Dates,
        topPages: (ga4ByPage.rows ?? []).map((r) => ({
          path: r.dimensionValues[0]?.value ?? '',
          pageviews: Number(r.metricValues[0]?.value ?? 0),
        })),
      }
    } catch (err) {
      console.error('GSC / GA4 fetch failed:', err)
    }
  }

  const revenue = loadRevenue()
  if (auth) {
    try {
      for (const revenueMonth of revenueMonthsToSync(now)) {
        const estimatedEarnings = await queryAdsenseMonthlyRevenue(
          auth,
          revenueMonth,
          ADSENSE_SITE_DOMAIN,
          now
        )
        if (estimatedEarnings !== null) {
          upsertRevenueEntry(revenue, revenueMonth, estimatedEarnings)
        } else {
          console.warn(`No AdSense revenue row found for ${ADSENSE_SITE_DOMAIN} in ${revenueMonth}`)
        }
      }
      writeFileSync(REVENUE_FILE, `${JSON.stringify(revenue, null, 2)}\n`)
    } catch (err) {
      console.error('AdSense revenue fetch failed:', err)
    }
  }
  const monthRevenue = revenue.entries.find((e) => e.month === month)?.estimatedEarnings ?? null

  const snapshot: MetricsSnapshot = {
    generatedAt: new Date().toISOString(),
    range: { startDate, endDate },
    searchConsole,
    ga4,
    revenue,
    kpi: {
      month,
      target: KPI_TARGETS[month] ?? null,
      actualPageviews28d: ga4?.totals.pageviews ?? null,
      actualRevenueJpy: monthRevenue,
    },
  }

  let previous: MetricsSnapshot | null = null
  try {
    previous = JSON.parse(readFileSync(join(METRICS_DIR, 'latest.json'), 'utf8')) as MetricsSnapshot
  } catch {
    // first run
  }

  mkdirSync(METRICS_DIR, { recursive: true })
  mkdirSync(REPORTS_DIR, { recursive: true })
  const json = JSON.stringify(snapshot, null, 2)
  writeFileSync(join(METRICS_DIR, `${today}.json`), json)
  writeFileSync(join(METRICS_DIR, 'latest.json'), json)
  writeFileSync(join(REPORTS_DIR, `${today}.md`), buildReport(snapshot, previous))

  console.log(`Wrote data/growth/metrics/${today}.json and data/growth/reports/${today}.md`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
