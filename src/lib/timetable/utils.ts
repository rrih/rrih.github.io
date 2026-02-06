import {
  DAY_INDEXES,
  DEFAULT_CELL_COLOR,
  DEFAULT_FILTERS,
  DEFAULT_PERIOD_TIME,
  MAX_PERIODS,
  MIN_PERIODS,
} from './constants'
import { cloneTimetableState, createEmptyCell, createTimetableFromTemplate } from './templates'
import type {
  DayIndex,
  DayScheduleBlock,
  PeriodIndex,
  TimeRange,
  TimetableCell,
  TimetableFilters,
  TimetableState,
} from './types'

const HEX_COLOR_REGEX = /^#(?:[0-9A-Fa-f]{6})$/
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value)
}

export function normalizeHexColor(value: string): string {
  const normalized = value.trim()

  if (isValidHexColor(normalized)) {
    return normalized.toUpperCase()
  }

  const prefixed = normalized.startsWith('#') ? normalized : `#${normalized}`
  if (isValidHexColor(prefixed)) {
    return prefixed.toUpperCase()
  }

  return DEFAULT_CELL_COLOR
}

export function isValidTimeValue(value: string): boolean {
  return TIME_REGEX.test(value)
}

export function parseTimeToMinutes(value: string): number {
  if (!isValidTimeValue(value)) {
    return Number.NaN
  }

  const [hoursText, minutesText] = value.split(':')
  const hours = Number.parseInt(hoursText, 10)
  const minutes = Number.parseInt(minutesText, 10)

  return hours * 60 + minutes
}

export function isValidTimeRange(range: TimeRange): boolean {
  if (!isValidTimeValue(range.start) || !isValidTimeValue(range.end)) {
    return false
  }

  return parseTimeToMinutes(range.start) < parseTimeToMinutes(range.end)
}

export function formatTimeRange(range: TimeRange): string {
  return `${range.start} - ${range.end}`
}

export function getDurationMinutes(range: TimeRange): number {
  if (!isValidTimeRange(range)) {
    return 0
  }

  return parseTimeToMinutes(range.end) - parseTimeToMinutes(range.start)
}

export function hasCellContent(cell?: TimetableCell): boolean {
  if (!cell) {
    return false
  }

  return Boolean(
    cell.subject.trim() ||
      cell.teacher.trim() ||
      cell.room.trim() ||
      cell.memo.trim() ||
      normalizeHexColor(cell.color) !== DEFAULT_CELL_COLOR
  )
}

export function hasActiveFilters(filters: TimetableFilters): boolean {
  return Boolean(
    filters.query.trim() ||
      filters.subject.trim() ||
      filters.teacher.trim() ||
      filters.room.trim() ||
      filters.color.trim()
  )
}

function includesPart(source: string, keyword: string): boolean {
  if (!keyword) {
    return true
  }

  return source.toLowerCase().includes(keyword.toLowerCase())
}

export function cellMatchesFilters(
  cell: TimetableCell | undefined,
  filters: TimetableFilters
): boolean {
  if (!hasActiveFilters(filters)) {
    return true
  }

  if (!cell || !hasCellContent(cell)) {
    return false
  }

  const query = filters.query.trim()
  const subjectFilter = filters.subject.trim()
  const teacherFilter = filters.teacher.trim()
  const roomFilter = filters.room.trim()
  const colorFilter = filters.color.trim().toUpperCase()

  const searchable = `${cell.subject} ${cell.teacher} ${cell.room}`

  if (query && !includesPart(searchable, query)) {
    return false
  }

  if (subjectFilter && !includesPart(cell.subject, subjectFilter)) {
    return false
  }

  if (teacherFilter && !includesPart(cell.teacher, teacherFilter)) {
    return false
  }

  if (roomFilter && !includesPart(cell.room, roomFilter)) {
    return false
  }

  if (colorFilter && normalizeHexColor(cell.color) !== normalizeHexColor(colorFilter)) {
    return false
  }

  return true
}

export function collectFilterOptions(state: TimetableState): {
  subjects: string[]
  teachers: string[]
  rooms: string[]
  colors: string[]
} {
  const subjects = new Set<string>()
  const teachers = new Set<string>()
  const rooms = new Set<string>()
  const colors = new Set<string>()

  for (const day of DAY_INDEXES) {
    for (let period = 1; period <= MAX_PERIODS; period += 1) {
      const cell = state.cells[day]?.[period]
      if (!cell || !hasCellContent(cell)) {
        continue
      }

      if (cell.subject.trim()) subjects.add(cell.subject.trim())
      if (cell.teacher.trim()) teachers.add(cell.teacher.trim())
      if (cell.room.trim()) rooms.add(cell.room.trim())

      const normalizedColor = normalizeHexColor(cell.color)
      colors.add(normalizedColor)
    }
  }

  const byLocale = (a: string, b: string) => a.localeCompare(b, 'ja')

  return {
    subjects: [...subjects].sort(byLocale),
    teachers: [...teachers].sort(byLocale),
    rooms: [...rooms].sort(byLocale),
    colors: [...colors].sort(),
  }
}

export function getEffectiveTimeRange(
  state: TimetableState,
  day: number,
  period: number
): TimeRange {
  const dayOverride = state.overrides[day]?.[period]

  if (dayOverride && isValidTimeRange(dayOverride)) {
    return dayOverride
  }

  const periodTime = state.periods[period]
  if (periodTime && isValidTimeRange(periodTime)) {
    return periodTime
  }

  return DEFAULT_PERIOD_TIME
}

export function getMergeSpan(state: TimetableState, day: number, period: number): number {
  const rawSpan = state.merges[day]?.[period]
  if (!rawSpan || rawSpan < 2) {
    return 1
  }

  const maxSpan = Math.max(1, state.meta.periodCount - period + 1)
  return Math.min(rawSpan, maxSpan)
}

export function isCoveredByMerge(state: TimetableState, day: number, period: number): boolean {
  for (let start = 1; start < period; start += 1) {
    const span = getMergeSpan(state, day, start)
    if (span > 1 && start + span - 1 >= period) {
      return true
    }
  }

  return false
}

export function setMergeSpan(
  state: TimetableState,
  day: DayIndex,
  startPeriod: PeriodIndex,
  nextSpan: number
): TimetableState {
  const cloned = cloneTimetableState(state)
  const clampedSpan = Math.min(Math.max(1, nextSpan), cloned.meta.periodCount - startPeriod + 1)

  const dayMerges = { ...cloned.merges[day] }
  const targetEnd = startPeriod + clampedSpan - 1

  for (const [startText, spanValue] of Object.entries(dayMerges)) {
    const start = Number.parseInt(startText, 10)
    const safeSpan = spanValue ?? 1
    const end = start + safeSpan - 1

    const hasOverlap = !(targetEnd < start || end < startPeriod)
    if (hasOverlap) {
      delete dayMerges[start]
    }
  }

  if (clampedSpan >= 2) {
    dayMerges[startPeriod] = clampedSpan

    const startCell = cloned.cells[day][startPeriod] ?? createEmptyCell()
    for (let offset = 1; offset < clampedSpan; offset += 1) {
      const period = startPeriod + offset
      if (period > cloned.meta.periodCount) {
        break
      }
      cloned.cells[day][period] = { ...startCell }
    }
  }

  cloned.merges[day] = dayMerges

  return sanitizeTimetableState(cloned)
}

export function getDayBlocks(state: TimetableState, day: DayIndex): DayScheduleBlock[] {
  const blocks: DayScheduleBlock[] = []

  for (let period = 1; period <= state.meta.periodCount; period += 1) {
    if (isCoveredByMerge(state, day, period)) {
      continue
    }

    const span = getMergeSpan(state, day, period)
    const cell = state.cells[day]?.[period] ?? createEmptyCell()
    let duration = 0

    for (let offset = 0; offset < span; offset += 1) {
      const targetPeriod = period + offset
      const range = getEffectiveTimeRange(state, day, targetPeriod)
      duration += getDurationMinutes(range)
    }

    const startRange = getEffectiveTimeRange(state, day, period)
    const endRange = getEffectiveTimeRange(state, day, period + span - 1)

    blocks.push({
      key: `${day}-${period}`,
      day,
      startPeriod: period,
      span,
      subject: cell.subject,
      teacher: cell.teacher,
      room: cell.room,
      memo: cell.memo,
      color: normalizeHexColor(cell.color),
      durationMinutes: duration,
      timeLabel: `${startRange.start} - ${endRange.end}`,
      empty: !hasCellContent(cell),
    })
  }

  return blocks
}

export function getAccessibleTextColor(backgroundColor: string): '#111111' | '#FFFFFF' {
  const normalized = normalizeHexColor(backgroundColor).replace('#', '')
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)

  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > 0.55 ? '#111111' : '#FFFFFF'
}

function sanitizeActiveDays(activeDays: number[]): DayIndex[] {
  const sanitized = [...new Set(activeDays.filter((day) => day >= 0 && day <= 6))]
    .sort((a, b) => a - b)
    .map((day) => day as DayIndex)

  return sanitized.length > 0 ? sanitized : [1]
}

function sanitizeCell(cell: TimetableCell | undefined): TimetableCell {
  const fallback = createEmptyCell()

  if (!cell) {
    return fallback
  }

  return {
    subject: (cell.subject ?? '').slice(0, 80),
    teacher: (cell.teacher ?? '').slice(0, 80),
    room: (cell.room ?? '').slice(0, 80),
    memo: (cell.memo ?? '').slice(0, 240),
    color: normalizeHexColor(cell.color ?? DEFAULT_CELL_COLOR),
  }
}

function sanitizePeriodTime(range: TimeRange | undefined): TimeRange {
  if (!range) {
    return DEFAULT_PERIOD_TIME
  }

  const candidate = {
    start: (range.start ?? '').slice(0, 5),
    end: (range.end ?? '').slice(0, 5),
  }

  if (isValidTimeRange(candidate)) {
    return candidate
  }

  return DEFAULT_PERIOD_TIME
}

export function sanitizeTimetableState(input: TimetableState): TimetableState {
  const fallback = createTimetableFromTemplate('junior-high')
  const state = cloneTimetableState(input)

  const periodCount = Math.max(MIN_PERIODS, Math.min(MAX_PERIODS, state.meta.periodCount))
  const activeDays = sanitizeActiveDays(state.meta.activeDays)
  const selectedDay = activeDays.includes(state.ui.selectedDay)
    ? state.ui.selectedDay
    : activeDays[0]

  state.meta.periodCount = periodCount
  state.meta.activeDays = activeDays
  state.ui.selectedDay = selectedDay
  state.ui.compactWeek = state.ui.compactWeek !== false

  for (let period = 1; period <= MAX_PERIODS; period += 1) {
    state.periods[period] = sanitizePeriodTime(state.periods[period])
  }

  for (const day of DAY_INDEXES) {
    state.cells[day] = state.cells[day] ?? {}
    state.overrides[day] = state.overrides[day] ?? {}
    state.merges[day] = state.merges[day] ?? {}

    for (let period = 1; period <= MAX_PERIODS; period += 1) {
      const cell = state.cells[day][period]
      if (cell) {
        state.cells[day][period] = sanitizeCell(cell)
      }

      const override = state.overrides[day][period]
      if (override) {
        if (isValidTimeRange(override)) {
          state.overrides[day][period] = {
            start: override.start,
            end: override.end,
          }
        } else {
          delete state.overrides[day][period]
        }
      }
    }

    const mergeEntries = Object.entries(state.merges[day])
      .map(([start, span]) => ({
        start: Number.parseInt(start, 10),
        span,
      }))
      .filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.span))
      .sort((a, b) => a.start - b.start)

    const sanitizedMerges: Record<number, number> = {}
    let lastCoveredPeriod = 0

    for (const merge of mergeEntries) {
      if (merge.start < 1 || merge.start > periodCount) {
        continue
      }

      const maxSpan = periodCount - merge.start + 1
      const safeSpan = merge.span ?? 1
      const span = Math.max(1, Math.min(maxSpan, safeSpan))

      if (span < 2) {
        continue
      }

      if (merge.start <= lastCoveredPeriod) {
        continue
      }

      sanitizedMerges[merge.start] = span
      lastCoveredPeriod = merge.start + span - 1
    }

    state.merges[day] = sanitizedMerges

    for (let period = periodCount + 1; period <= MAX_PERIODS; period += 1) {
      delete state.cells[day][period]
      delete state.overrides[day][period]
      delete state.merges[day][period]
    }
  }

  const sanitizedFilters = {
    ...DEFAULT_FILTERS,
    ...state.filters,
  }
  state.filters = {
    query: sanitizedFilters.query.slice(0, 80),
    subject: sanitizedFilters.subject.slice(0, 80),
    teacher: sanitizedFilters.teacher.slice(0, 80),
    room: sanitizedFilters.room.slice(0, 80),
    color: sanitizedFilters.color ? normalizeHexColor(sanitizedFilters.color) : '',
  }

  state.meta.title = state.meta.title?.trim().slice(0, 80) || fallback.meta.title

  return state
}

export function getShareReadyState(state: TimetableState): TimetableState {
  const cloned = cloneTimetableState(state)

  if (!cloned.meta.shareFilters) {
    cloned.filters = { ...DEFAULT_FILTERS }
  }

  return sanitizeTimetableState(cloned)
}
