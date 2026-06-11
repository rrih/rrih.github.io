import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const METRICS_FILE = join(ROOT, 'data', 'growth', 'metrics', 'latest.json')
const RELATED_TOOLS_FILE = join(ROOT, 'src', 'config', 'tool-related-links.ts')
const SITE_ORIGIN = 'https://rrih.github.io'

interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface MetricsSnapshot {
  searchConsole: {
    topPages: GscRow[]
  } | null
}

interface ToolMeta {
  id: string
  category: 'developer' | 'design' | 'utility' | 'converter'
}

export interface SafeGrowthPlan {
  targetToolIds: string[]
  relatedToolIdsByToolId: Record<string, string[]>
  changed: boolean
}

const toolCatalog: ToolMeta[] = [
  { id: 'json-formatter', category: 'developer' },
  { id: 'base64', category: 'converter' },
  { id: 'color-picker', category: 'design' },
  { id: 'markdown-editor', category: 'utility' },
  { id: 'qr-generator', category: 'utility' },
  { id: 'timetable', category: 'utility' },
  { id: 'uuid-generator', category: 'developer' },
  { id: 'password-generator', category: 'utility' },
  { id: 'image-converter', category: 'converter' },
  { id: 'gradient-generator', category: 'design' },
  { id: 'box-shadow-generator', category: 'design' },
  { id: 'animation-generator', category: 'design' },
  { id: 'investment-calculator', category: 'utility' },
]

const preferredRelatedToolIds: Record<string, string[]> = {
  'animation-generator': ['gradient-generator', 'box-shadow-generator', 'color-picker'],
  'gradient-generator': ['color-picker', 'box-shadow-generator', 'animation-generator'],
  'box-shadow-generator': ['gradient-generator', 'color-picker', 'animation-generator'],
  'color-picker': ['gradient-generator', 'box-shadow-generator', 'animation-generator'],
  'json-formatter': ['base64', 'uuid-generator', 'markdown-editor'],
  base64: ['json-formatter', 'image-converter', 'markdown-editor'],
  'image-converter': ['base64', 'color-picker', 'gradient-generator'],
  'qr-generator': ['markdown-editor', 'image-converter', 'base64'],
  'password-generator': ['uuid-generator', 'json-formatter', 'base64'],
  'uuid-generator': ['json-formatter', 'password-generator', 'base64'],
  'markdown-editor': ['json-formatter', 'base64', 'qr-generator'],
  timetable: ['homework-tracker', 'markdown-editor', 'qr-generator'],
  'homework-tracker': ['timetable', 'markdown-editor', 'qr-generator'],
  'investment-calculator': ['markdown-editor', 'uuid-generator', 'json-formatter'],
}

function toolOrder(id: string): number {
  const index = toolCatalog.findIndex((tool) => tool.id === id)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function toolCategory(id: string): ToolMeta['category'] | null {
  return toolCatalog.find((tool) => tool.id === id)?.category ?? null
}

export function toolIdFromUrl(url: string): string | null {
  if (!url.startsWith(`${SITE_ORIGIN}/tools/`)) return null
  const match = url.match(/^https:\/\/rrih\.github\.io\/tools\/([^/]+)\/?$/)
  const toolId = match?.[1]
  if (!toolId) return null
  return toolCatalog.some((tool) => tool.id === toolId) ? toolId : null
}

export function parseRelatedToolConfig(source: string): Record<string, string[]> {
  const mappings: Record<string, string[]> = {}
  const entryPattern = /'([^']+)': \[([^\]]*)\]/g

  for (const match of source.matchAll(entryPattern)) {
    const [, toolId, idsSource] = match
    const ids = Array.from(idsSource.matchAll(/'([^']+)'/g), (idMatch) => idMatch[1])
    mappings[toolId] = ids
  }

  return mappings
}

export function selectTargetToolIds(topPages: GscRow[], limit = 5): string[] {
  return topPages
    .filter((row) => row.impressions > 0 || row.clicks > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .map((row) => toolIdFromUrl(row.keys[0] ?? ''))
    .filter((toolId): toolId is string => Boolean(toolId))
    .filter((toolId, index, all) => all.indexOf(toolId) === index)
    .slice(0, limit)
}

export function relatedToolIdsFor(toolId: string): string[] {
  const preferred = preferredRelatedToolIds[toolId] ?? []
  if (preferred.length > 0) return preferred

  const category = toolCategory(toolId)
  return toolCatalog
    .filter((tool) => tool.id !== toolId && tool.category === category)
    .map((tool) => tool.id)
    .slice(0, 3)
}

export function buildSafeGrowthPlan(
  snapshot: MetricsSnapshot,
  currentMapping: Record<string, string[]>
): SafeGrowthPlan {
  const targetToolIds = snapshot.searchConsole
    ? selectTargetToolIds(snapshot.searchConsole.topPages)
    : []
  const nextMapping: Record<string, string[]> = { ...currentMapping }
  let changed = false

  for (const toolId of targetToolIds) {
    const existing = nextMapping[toolId] ?? []
    const next = Array.from(new Set([...existing, ...relatedToolIdsFor(toolId)]))
      .filter((id) => id !== toolId)
      .sort((a, b) => toolOrder(a) - toolOrder(b))
      .slice(0, 3)

    if (next.join('|') !== existing.join('|')) {
      nextMapping[toolId] = next
      changed = true
    }
  }

  return {
    targetToolIds,
    relatedToolIdsByToolId: nextMapping,
    changed,
  }
}

export function renderRelatedToolConfig(mapping: Record<string, string[]>): string {
  const keys = Object.keys(mapping).sort((a, b) => toolOrder(a) - toolOrder(b))
  if (keys.length === 0) {
    return 'export const relatedToolIdsByToolId: Record<string, readonly string[]> = {}\n'
  }

  const lines = [
    'export const relatedToolIdsByToolId: Record<string, readonly string[]> = {',
    ...keys.map((toolId) => {
      const relatedIds = mapping[toolId].map((id) => `'${id}'`).join(', ')
      return `  '${toolId}': [${relatedIds}],`
    }),
    '}\n',
  ]

  return lines.join('\n')
}

export function applySafeGrowthActions(
  metricsSource: string,
  configSource: string
): SafeGrowthPlan {
  const snapshot = JSON.parse(metricsSource) as MetricsSnapshot
  return buildSafeGrowthPlan(snapshot, parseRelatedToolConfig(configSource))
}

function main() {
  const plan = applySafeGrowthActions(
    readFileSync(METRICS_FILE, 'utf8'),
    readFileSync(RELATED_TOOLS_FILE, 'utf8')
  )

  if (!plan.changed) {
    console.log('No safe growth changes to apply.')
    return
  }

  writeFileSync(RELATED_TOOLS_FILE, renderRelatedToolConfig(plan.relatedToolIdsByToolId))
  console.log(`Updated related tool links for: ${plan.targetToolIds.join(', ')}`)
}

if (import.meta.main) {
  main()
}
