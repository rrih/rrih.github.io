import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import {
  URL_DANGER_LENGTH,
  URL_DATA_PARAM,
  URL_VERSION,
  URL_VERSION_PARAM,
  URL_WARN_LENGTH,
} from './constants'
import { cloneTimetableState, createTimetableFromTemplate } from './templates'
import type { DayIndex, TabMode, TemplateKind, TimetableCodecResult, TimetableState } from './types'
import {
  getShareReadyState,
  hasCellContent,
  isValidTimeRange,
  normalizeHexColor,
  sanitizeTimetableState,
} from './utils'

interface EncodedPayloadV1 {
  m: {
    a: number[]
    p: number
    t: TemplateKind
    n?: string
    sf?: 0 | 1
  }
  p: Array<[string, string]>
  o?: Record<string, Record<string, [string, string]>>
  c?: Record<string, Record<string, [string, string, string, string, string]>>
  g?: Record<string, Record<string, number>>
  f?: {
    q?: string
    s?: string
    t?: string
    r?: string
    c?: string
  }
  u?: {
    t?: 'w' | 'd' | 's'
    d?: number
    mw?: 0 | 1
    cp?: 0 | 1
    ro?: 0 | 1
    fp?: 0 | 1
  }
}

function tabToShort(tab: TabMode): 'w' | 'd' | 's' {
  switch (tab) {
    case 'week':
      return 'w'
    case 'day':
      return 'd'
    case 'settings':
      return 's'
    default:
      return 'w'
  }
}

function shortToTab(shortTab: 'w' | 'd' | 's' | undefined): TabMode {
  switch (shortTab) {
    case 'd':
      return 'day'
    case 's':
      return 'settings'
    default:
      return 'week'
  }
}

function toEncodedPayload(state: TimetableState): EncodedPayloadV1 {
  const shared = getShareReadyState(state)
  const payload: EncodedPayloadV1 = {
    m: {
      a: [...shared.meta.activeDays],
      p: shared.meta.periodCount,
      t: shared.meta.template,
      n: shared.meta.title,
      sf: shared.meta.shareFilters ? 1 : 0,
    },
    p: [],
  }

  for (let period = 1; period <= 8; period += 1) {
    const time = shared.periods[period]
    payload.p.push([time.start, time.end])
  }

  const encodedOverrides: Record<string, Record<string, [string, string]>> = {}
  const encodedCells: Record<string, Record<string, [string, string, string, string, string]>> = {}
  const encodedMerges: Record<string, Record<string, number>> = {}

  for (let day = 0; day <= 6; day += 1) {
    for (let period = 1; period <= shared.meta.periodCount; period += 1) {
      const override = shared.overrides[day]?.[period]
      if (override && isValidTimeRange(override)) {
        encodedOverrides[day] = encodedOverrides[day] ?? {}
        encodedOverrides[day][period] = [override.start, override.end]
      }

      const cell = shared.cells[day]?.[period]
      if (hasCellContent(cell)) {
        encodedCells[day] = encodedCells[day] ?? {}
        encodedCells[day][period] = [
          cell?.subject ?? '',
          cell?.teacher ?? '',
          cell?.room ?? '',
          cell?.memo ?? '',
          normalizeHexColor(cell?.color ?? ''),
        ]
      }

      const span = shared.merges[day]?.[period]
      if (span && span >= 2) {
        encodedMerges[day] = encodedMerges[day] ?? {}
        encodedMerges[day][period] = span
      }
    }
  }

  if (Object.keys(encodedOverrides).length > 0) {
    payload.o = encodedOverrides
  }

  if (Object.keys(encodedCells).length > 0) {
    payload.c = encodedCells
  }

  if (Object.keys(encodedMerges).length > 0) {
    payload.g = encodedMerges
  }

  if (shared.meta.shareFilters) {
    const filters = shared.filters
    payload.f = {
      q: filters.query || undefined,
      s: filters.subject || undefined,
      t: filters.teacher || undefined,
      r: filters.room || undefined,
      c: filters.color || undefined,
    }
  }

  payload.u = {
    t: tabToShort(shared.ui.tab),
    d: shared.ui.selectedDay,
    mw: shared.ui.mobileExpandedWeek ? 1 : 0,
    cp: shared.ui.compactWeek ? 1 : 0,
    ro: shared.ui.readOnly ? 1 : 0,
    fp: shared.ui.showFilters ? 1 : 0,
  }

  return payload
}

function fromEncodedPayload(payload: EncodedPayloadV1): TimetableState {
  const templateId = payload.m?.t ?? 'junior-high'
  const base = createTimetableFromTemplate(templateId)

  const candidateActiveDays = payload.m?.a ?? base.meta.activeDays
  base.meta.activeDays = candidateActiveDays
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .map((day) => day as DayIndex)
  base.meta.periodCount = payload.m?.p ?? base.meta.periodCount
  base.meta.template = templateId
  base.meta.title = payload.m?.n ?? base.meta.title
  base.meta.shareFilters = payload.m?.sf !== 0

  if (Array.isArray(payload.p)) {
    for (let period = 1; period <= Math.min(8, payload.p.length); period += 1) {
      const entry = payload.p[period - 1]
      if (entry) {
        base.periods[period] = {
          start: entry[0],
          end: entry[1],
        }
      }
    }
  }

  if (payload.o && typeof payload.o === 'object') {
    for (const [dayText, byPeriod] of Object.entries(payload.o)) {
      const day = Number.parseInt(dayText, 10)
      if (!Number.isFinite(day) || day < 0 || day > 6) {
        continue
      }

      for (const [periodText, value] of Object.entries(byPeriod)) {
        const period = Number.parseInt(periodText, 10)
        if (!Number.isFinite(period) || period < 1 || period > 8) {
          continue
        }

        base.overrides[day][period] = {
          start: value[0],
          end: value[1],
        }
      }
    }
  }

  if (payload.c && typeof payload.c === 'object') {
    for (const [dayText, byPeriod] of Object.entries(payload.c)) {
      const day = Number.parseInt(dayText, 10)
      if (!Number.isFinite(day) || day < 0 || day > 6) {
        continue
      }

      for (const [periodText, value] of Object.entries(byPeriod)) {
        const period = Number.parseInt(periodText, 10)
        if (!Number.isFinite(period) || period < 1 || period > 8) {
          continue
        }

        base.cells[day][period] = {
          subject: value[0],
          teacher: value[1],
          room: value[2],
          memo: value[3],
          color: value[4],
        }
      }
    }
  }

  if (payload.g && typeof payload.g === 'object') {
    for (const [dayText, byPeriod] of Object.entries(payload.g)) {
      const day = Number.parseInt(dayText, 10)
      if (!Number.isFinite(day) || day < 0 || day > 6) {
        continue
      }

      for (const [periodText, value] of Object.entries(byPeriod)) {
        const period = Number.parseInt(periodText, 10)
        if (!Number.isFinite(period) || period < 1 || period > 8) {
          continue
        }

        base.merges[day][period] = value
      }
    }
  }

  if (payload.f) {
    base.filters = {
      query: payload.f.q ?? '',
      subject: payload.f.s ?? '',
      teacher: payload.f.t ?? '',
      room: payload.f.r ?? '',
      color: payload.f.c ?? '',
    }
  }

  if (payload.u) {
    base.ui.tab = shortToTab(payload.u.t)
    base.ui.selectedDay = (payload.u.d ??
      base.ui.selectedDay) as TimetableState['ui']['selectedDay']
    base.ui.mobileExpandedWeek = payload.u.mw === 1
    base.ui.compactWeek = payload.u.cp !== 0
    base.ui.readOnly = payload.u.ro === 1
    base.ui.showFilters = payload.u.fp !== 0
  }

  return sanitizeTimetableState(base)
}

export function encodeTimetableState(state: TimetableState): string {
  const payload = toEncodedPayload(state)
  const json = JSON.stringify(payload)
  return compressToEncodedURIComponent(json)
}

export function decodeTimetableState(encoded: string): TimetableCodecResult {
  if (!encoded) {
    return {
      state: createTimetableFromTemplate('junior-high'),
      error: 'クエリに時間割データがありません。',
    }
  }

  try {
    const json = decompressFromEncodedURIComponent(encoded)
    if (!json) {
      return {
        state: createTimetableFromTemplate('junior-high'),
        error: 'URLの復元に失敗しました。',
      }
    }

    const parsed = JSON.parse(json) as EncodedPayloadV1
    const state = fromEncodedPayload(parsed)

    return {
      state,
      error: null,
    }
  } catch (_error) {
    return {
      state: createTimetableFromTemplate('junior-high'),
      error: 'URLデータが壊れているため初期値を表示しています。',
    }
  }
}

export function encodeTimetableQuery(state: TimetableState): string {
  const params = new URLSearchParams()
  params.set(URL_VERSION_PARAM, URL_VERSION)
  params.set(URL_DATA_PARAM, encodeTimetableState(state))
  return `?${params.toString()}`
}

export function decodeTimetableFromSearch(
  search: string,
  fallbackTemplate: TemplateKind = 'junior-high'
): TimetableCodecResult {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const version = params.get(URL_VERSION_PARAM)
  const encoded = params.get(URL_DATA_PARAM)

  if (!version || !encoded) {
    return {
      state: createTimetableFromTemplate(fallbackTemplate),
      error: null,
    }
  }

  if (version !== URL_VERSION) {
    return {
      state: createTimetableFromTemplate(fallbackTemplate),
      error: `URLバージョン v=${version} は未対応です。`,
    }
  }

  const decoded = decodeTimetableState(encoded)

  if (decoded.error) {
    return {
      state: createTimetableFromTemplate(fallbackTemplate),
      error: decoded.error,
    }
  }

  return decoded
}

export function buildTimetableUrl(
  state: TimetableState,
  baseUrl: string
): {
  url: string
  query: string
  length: number
} {
  const query = encodeTimetableQuery(state)
  const nextUrl = new URL(baseUrl)
  nextUrl.search = query

  return {
    url: nextUrl.toString(),
    query,
    length: nextUrl.toString().length,
  }
}

export function getUrlLengthState(length: number): {
  level: 'safe' | 'warn' | 'danger'
  message: string
} {
  if (length >= URL_DANGER_LENGTH) {
    return {
      level: 'danger',
      message: 'URLが長すぎる可能性があります。メモを短くするか、科目名を省略してみてください。',
    }
  }

  if (length >= URL_WARN_LENGTH) {
    return {
      level: 'warn',
      message: 'URLが長くなっています。共有前にメモ・説明文の長さを確認してください。',
    }
  }

  return {
    level: 'safe',
    message: 'URL長は安全です。',
  }
}

export function clearQueryFromState(state: TimetableState): TimetableState {
  return sanitizeTimetableState(cloneTimetableState(state))
}
