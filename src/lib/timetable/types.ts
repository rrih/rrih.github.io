export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type PeriodIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type TemplateKind = 'elementary' | 'junior-high' | 'high-school' | 'university' | 'custom'

export type TabMode = 'week' | 'day' | 'settings'

export interface TimeRange {
  start: string
  end: string
}

export interface TimetableCell {
  subject: string
  teacher: string
  room: string
  memo: string
  color: string
}

export interface TimetableMeta {
  title: string
  activeDays: DayIndex[]
  periodCount: number
  template: TemplateKind
  shareFilters: boolean
}

export interface TimetableFilters {
  query: string
  subject: string
  teacher: string
  room: string
  color: string
}

export interface TimetableUiState {
  tab: TabMode
  selectedDay: DayIndex
  mobileExpandedWeek: boolean
  compactWeek: boolean
  readOnly: boolean
  showFilters: boolean
}

export type PeriodTimes = Record<number, TimeRange>
export type DayOverrideTimes = Record<number, Partial<Record<number, TimeRange>>>
export type TimetableCells = Record<number, Partial<Record<number, TimetableCell>>>
export type TimetableMerges = Record<number, Partial<Record<number, number>>>

export interface TimetableState {
  meta: TimetableMeta
  periods: PeriodTimes
  overrides: DayOverrideTimes
  cells: TimetableCells
  merges: TimetableMerges
  filters: TimetableFilters
  ui: TimetableUiState
}

export interface TimetableTemplate {
  id: TemplateKind
  label: string
  description: string
  activeDays: DayIndex[]
  periodCount: number
  periodTimes: Partial<Record<PeriodIndex, TimeRange>>
  cells: Array<{
    day: DayIndex
    period: PeriodIndex
    cell: TimetableCell
  }>
  merges?: Array<{
    day: DayIndex
    start: PeriodIndex
    span: number
  }>
}

export interface DayScheduleBlock {
  key: string
  day: DayIndex
  startPeriod: number
  span: number
  subject: string
  teacher: string
  room: string
  memo: string
  color: string
  durationMinutes: number
  timeLabel: string
  empty: boolean
}

export interface TimetableCodecResult {
  state: TimetableState
  error: string | null
}
