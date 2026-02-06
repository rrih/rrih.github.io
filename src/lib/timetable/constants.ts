import type {
  DayIndex,
  TimeRange,
  TimetableCell,
  TimetableFilters,
  TimetableUiState,
} from './types'

export const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const
export const FULL_DAY_LABELS = [
  '日曜日',
  '月曜日',
  '火曜日',
  '水曜日',
  '木曜日',
  '金曜日',
  '土曜日',
] as const

export const DAY_INDEXES: DayIndex[] = [0, 1, 2, 3, 4, 5, 6]

export const MAX_PERIODS = 8
export const MIN_PERIODS = 1

export const URL_VERSION = '1'
export const URL_VERSION_PARAM = 'v'
export const URL_DATA_PARAM = 't'
export const URL_MAX_LENGTH = 2000

export const URL_WARN_LENGTH = 1700
export const URL_DANGER_LENGTH = 1900

export const DEFAULT_CELL_COLOR = '#5A8BFF'

export const DEFAULT_PERIOD_TIME: TimeRange = {
  start: '09:00',
  end: '09:50',
}

export const EMPTY_CELL: TimetableCell = {
  subject: '',
  teacher: '',
  room: '',
  memo: '',
  color: DEFAULT_CELL_COLOR,
}

export const DEFAULT_FILTERS: TimetableFilters = {
  query: '',
  subject: '',
  teacher: '',
  room: '',
  color: '',
}

export const DEFAULT_UI_STATE: TimetableUiState = {
  tab: 'week',
  selectedDay: 1,
  mobileExpandedWeek: false,
  compactWeek: true,
  readOnly: false,
  showFilters: true,
}

export const TEMPLATE_COLORS = [
  '#5A8BFF',
  '#6FCF97',
  '#F6B94C',
  '#E86B6B',
  '#8D74E8',
  '#36A9E1',
  '#F29E4C',
  '#6CC5A2',
]
