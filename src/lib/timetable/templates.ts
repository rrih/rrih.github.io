import {
  DAY_INDEXES,
  DEFAULT_CELL_COLOR,
  DEFAULT_FILTERS,
  DEFAULT_PERIOD_TIME,
  DEFAULT_UI_STATE,
  TEMPLATE_COLORS,
} from './constants'
import type {
  DayIndex,
  DayOverrideTimes,
  PeriodIndex,
  PeriodTimes,
  TemplateKind,
  TimeRange,
  TimetableCell,
  TimetableCells,
  TimetableMerges,
  TimetableState,
  TimetableTemplate,
} from './types'

const FALLBACK_PERIOD_TIMES: Record<PeriodIndex, TimeRange> = {
  1: { start: '08:30', end: '09:20' },
  2: { start: '09:30', end: '10:20' },
  3: { start: '10:40', end: '11:30' },
  4: { start: '11:40', end: '12:30' },
  5: { start: '13:20', end: '14:10' },
  6: { start: '14:20', end: '15:10' },
  7: { start: '15:20', end: '16:10' },
  8: { start: '16:20', end: '17:10' },
}

function cellEntry(
  day: DayIndex,
  period: PeriodIndex,
  subject: string,
  teacher: string,
  room: string,
  color: string,
  memo = ''
) {
  return {
    day,
    period,
    cell: {
      subject,
      teacher,
      room,
      memo,
      color,
    },
  }
}

export const TIMETABLE_TEMPLATES: TimetableTemplate[] = [
  {
    id: 'elementary',
    label: '小学校テンプレート',
    description: '45分授業を中心に、5〜6コマ運用をすぐ作成できます。',
    activeDays: [1, 2, 3, 4, 5],
    periodCount: 6,
    periodTimes: {
      1: { start: '08:35', end: '09:20' },
      2: { start: '09:30', end: '10:15' },
      3: { start: '10:35', end: '11:20' },
      4: { start: '11:30', end: '12:15' },
      5: { start: '13:20', end: '14:05' },
      6: { start: '14:15', end: '15:00' },
    },
    cells: [
      cellEntry(1, 1, '国語', '山田先生', '1年1組', TEMPLATE_COLORS[0]),
      cellEntry(1, 2, '算数', '山田先生', '1年1組', TEMPLATE_COLORS[1]),
      cellEntry(1, 3, '生活', '山田先生', '理科室', TEMPLATE_COLORS[5]),
      cellEntry(1, 4, '音楽', '田中先生', '音楽室', TEMPLATE_COLORS[4]),
      cellEntry(1, 5, '図工', '佐藤先生', '図工室', TEMPLATE_COLORS[2]),
      cellEntry(1, 6, '学活', '山田先生', '1年1組', TEMPLATE_COLORS[7]),
      cellEntry(2, 1, '国語', '山田先生', '1年1組', TEMPLATE_COLORS[0]),
      cellEntry(2, 2, '算数', '山田先生', '1年1組', TEMPLATE_COLORS[1]),
      cellEntry(2, 3, '体育', '鈴木先生', '校庭', TEMPLATE_COLORS[3]),
      cellEntry(2, 4, '図書', '司書先生', '図書室', TEMPLATE_COLORS[6]),
      cellEntry(2, 5, '生活', '山田先生', '理科室', TEMPLATE_COLORS[5]),
      cellEntry(2, 6, '道徳', '山田先生', '1年1組', TEMPLATE_COLORS[7]),
      cellEntry(3, 1, '国語', '山田先生', '1年1組', TEMPLATE_COLORS[0]),
      cellEntry(3, 2, '算数', '山田先生', '1年1組', TEMPLATE_COLORS[1]),
      cellEntry(3, 3, '理科', '高橋先生', '理科室', TEMPLATE_COLORS[5]),
      cellEntry(3, 4, '体育', '鈴木先生', '体育館', TEMPLATE_COLORS[3]),
      cellEntry(3, 5, '図工', '佐藤先生', '図工室', TEMPLATE_COLORS[2]),
      cellEntry(3, 6, '学活', '山田先生', '1年1組', TEMPLATE_COLORS[7]),
      cellEntry(4, 1, '国語', '山田先生', '1年1組', TEMPLATE_COLORS[0]),
      cellEntry(4, 2, '算数', '山田先生', '1年1組', TEMPLATE_COLORS[1]),
      cellEntry(4, 3, '社会', '高橋先生', '社会科室', TEMPLATE_COLORS[6]),
      cellEntry(4, 4, '音楽', '田中先生', '音楽室', TEMPLATE_COLORS[4]),
      cellEntry(4, 5, '生活', '山田先生', '1年1組', TEMPLATE_COLORS[5]),
      cellEntry(4, 6, '道徳', '山田先生', '1年1組', TEMPLATE_COLORS[7]),
      cellEntry(5, 1, '国語', '山田先生', '1年1組', TEMPLATE_COLORS[0]),
      cellEntry(5, 2, '算数', '山田先生', '1年1組', TEMPLATE_COLORS[1]),
      cellEntry(5, 3, '理科', '高橋先生', '理科室', TEMPLATE_COLORS[5]),
      cellEntry(5, 4, '社会', '高橋先生', '社会科室', TEMPLATE_COLORS[6]),
      cellEntry(5, 5, '体育', '鈴木先生', '校庭', TEMPLATE_COLORS[3]),
      cellEntry(5, 6, '終礼', '山田先生', '1年1組', TEMPLATE_COLORS[7]),
    ],
  },
  {
    id: 'junior-high',
    label: '中学校テンプレート',
    description: '50分授業を想定し、教科・教室・教員の管理に向いた構成です。',
    activeDays: [1, 2, 3, 4, 5, 6],
    periodCount: 7,
    periodTimes: {
      1: { start: '08:40', end: '09:30' },
      2: { start: '09:40', end: '10:30' },
      3: { start: '10:40', end: '11:30' },
      4: { start: '11:40', end: '12:30' },
      5: { start: '13:20', end: '14:10' },
      6: { start: '14:20', end: '15:10' },
      7: { start: '15:20', end: '16:10' },
    },
    cells: [
      cellEntry(1, 1, '国語', '橋本先生', '2-1', TEMPLATE_COLORS[0]),
      cellEntry(1, 2, '数学', '井上先生', '2-1', TEMPLATE_COLORS[1]),
      cellEntry(1, 3, '英語', 'Smith先生', 'LL教室', TEMPLATE_COLORS[4]),
      cellEntry(1, 4, '理科', '佐々木先生', '理科室', TEMPLATE_COLORS[5]),
      cellEntry(1, 5, '社会', '村上先生', '2-1', TEMPLATE_COLORS[6]),
      cellEntry(1, 6, '体育', '小林先生', '体育館', TEMPLATE_COLORS[3]),
      cellEntry(1, 7, '総合', '橋本先生', '2-1', TEMPLATE_COLORS[7]),
      cellEntry(2, 1, '数学', '井上先生', '2-1', TEMPLATE_COLORS[1]),
      cellEntry(2, 2, '国語', '橋本先生', '2-1', TEMPLATE_COLORS[0]),
      cellEntry(2, 3, '理科', '佐々木先生', '理科室', TEMPLATE_COLORS[5]),
      cellEntry(2, 4, '美術', '田辺先生', '美術室', TEMPLATE_COLORS[2]),
      cellEntry(2, 5, '英語', 'Smith先生', 'LL教室', TEMPLATE_COLORS[4]),
      cellEntry(2, 6, '技術', '岡田先生', '技術室', TEMPLATE_COLORS[6]),
      cellEntry(2, 7, '学活', '橋本先生', '2-1', TEMPLATE_COLORS[7]),
      cellEntry(3, 1, '社会', '村上先生', '2-1', TEMPLATE_COLORS[6]),
      cellEntry(3, 2, '数学', '井上先生', '2-1', TEMPLATE_COLORS[1]),
      cellEntry(3, 3, '英語', 'Smith先生', 'LL教室', TEMPLATE_COLORS[4]),
      cellEntry(3, 4, '家庭科', '伊藤先生', '家庭科室', TEMPLATE_COLORS[2]),
      cellEntry(3, 5, '国語', '橋本先生', '2-1', TEMPLATE_COLORS[0]),
      cellEntry(3, 6, '音楽', '松本先生', '音楽室', TEMPLATE_COLORS[4]),
      cellEntry(3, 7, '道徳', '橋本先生', '2-1', TEMPLATE_COLORS[7]),
      cellEntry(4, 1, '理科', '佐々木先生', '理科室', TEMPLATE_COLORS[5]),
      cellEntry(4, 2, '英語', 'Smith先生', 'LL教室', TEMPLATE_COLORS[4]),
      cellEntry(4, 3, '数学', '井上先生', '2-1', TEMPLATE_COLORS[1]),
      cellEntry(4, 4, '社会', '村上先生', '2-1', TEMPLATE_COLORS[6]),
      cellEntry(4, 5, '保健体育', '小林先生', '校庭', TEMPLATE_COLORS[3]),
      cellEntry(4, 6, '国語', '橋本先生', '2-1', TEMPLATE_COLORS[0]),
      cellEntry(4, 7, '総合', '橋本先生', '2-1', TEMPLATE_COLORS[7]),
      cellEntry(5, 1, '数学', '井上先生', '2-1', TEMPLATE_COLORS[1]),
      cellEntry(5, 2, '国語', '橋本先生', '2-1', TEMPLATE_COLORS[0]),
      cellEntry(5, 3, '理科', '佐々木先生', '理科室', TEMPLATE_COLORS[5]),
      cellEntry(5, 4, '英語', 'Smith先生', 'LL教室', TEMPLATE_COLORS[4]),
      cellEntry(5, 5, '社会', '村上先生', '2-1', TEMPLATE_COLORS[6]),
      cellEntry(5, 6, '体育', '小林先生', '体育館', TEMPLATE_COLORS[3]),
      cellEntry(5, 7, '終礼', '橋本先生', '2-1', TEMPLATE_COLORS[7]),
      cellEntry(6, 1, '数学', '井上先生', '2-1', TEMPLATE_COLORS[1]),
      cellEntry(6, 2, '国語', '橋本先生', '2-1', TEMPLATE_COLORS[0]),
      cellEntry(6, 3, '英語', 'Smith先生', 'LL教室', TEMPLATE_COLORS[4]),
      cellEntry(6, 4, '総合', '橋本先生', '2-1', TEMPLATE_COLORS[7]),
    ],
  },
  {
    id: 'high-school',
    label: '高校テンプレート',
    description: '6〜7コマ中心の高校運用向け。選択科目や土曜授業にも対応。',
    activeDays: [1, 2, 3, 4, 5, 6],
    periodCount: 7,
    periodTimes: {
      1: { start: '08:50', end: '09:40' },
      2: { start: '09:50', end: '10:40' },
      3: { start: '10:50', end: '11:40' },
      4: { start: '11:50', end: '12:40' },
      5: { start: '13:30', end: '14:20' },
      6: { start: '14:30', end: '15:20' },
      7: { start: '15:30', end: '16:20' },
    },
    cells: [
      cellEntry(1, 1, '現代文', '青木先生', '3-2', TEMPLATE_COLORS[0]),
      cellEntry(1, 2, '数学III', '斎藤先生', '3-2', TEMPLATE_COLORS[1]),
      cellEntry(1, 3, '化学', '長谷川先生', '化学室', TEMPLATE_COLORS[5]),
      cellEntry(1, 4, '英語表現', 'Brown先生', '3-2', TEMPLATE_COLORS[4]),
      cellEntry(1, 5, '日本史', '石川先生', '3-2', TEMPLATE_COLORS[6]),
      cellEntry(1, 6, '体育', '福田先生', '体育館', TEMPLATE_COLORS[3]),
      cellEntry(1, 7, 'LHR', '青木先生', '3-2', TEMPLATE_COLORS[7]),
      cellEntry(2, 1, '数学III', '斎藤先生', '3-2', TEMPLATE_COLORS[1]),
      cellEntry(2, 2, '古典', '青木先生', '3-2', TEMPLATE_COLORS[0]),
      cellEntry(2, 3, '物理', '長谷川先生', '物理室', TEMPLATE_COLORS[5]),
      cellEntry(2, 4, '英語表現', 'Brown先生', '3-2', TEMPLATE_COLORS[4]),
      cellEntry(2, 5, '地理', '石川先生', '3-2', TEMPLATE_COLORS[6]),
      cellEntry(2, 6, '情報', '山口先生', 'PC室', TEMPLATE_COLORS[2]),
      cellEntry(2, 7, '探究', '青木先生', '3-2', TEMPLATE_COLORS[7]),
      cellEntry(3, 1, '現代文', '青木先生', '3-2', TEMPLATE_COLORS[0]),
      cellEntry(3, 2, '数学III', '斎藤先生', '3-2', TEMPLATE_COLORS[1]),
      cellEntry(3, 3, '化学', '長谷川先生', '化学室', TEMPLATE_COLORS[5]),
      cellEntry(3, 4, '英語表現', 'Brown先生', '3-2', TEMPLATE_COLORS[4]),
      cellEntry(3, 5, '政治経済', '石川先生', '3-2', TEMPLATE_COLORS[6]),
      cellEntry(3, 6, '保健', '福田先生', '3-2', TEMPLATE_COLORS[3]),
      cellEntry(3, 7, '進路', '青木先生', '3-2', TEMPLATE_COLORS[7]),
      cellEntry(4, 1, '数学III', '斎藤先生', '3-2', TEMPLATE_COLORS[1]),
      cellEntry(4, 2, '古典', '青木先生', '3-2', TEMPLATE_COLORS[0]),
      cellEntry(4, 3, '物理', '長谷川先生', '物理室', TEMPLATE_COLORS[5]),
      cellEntry(4, 4, '英語表現', 'Brown先生', '3-2', TEMPLATE_COLORS[4]),
      cellEntry(4, 5, '選択演習', '各担当', '演習室', TEMPLATE_COLORS[2]),
      cellEntry(4, 6, '体育', '福田先生', '校庭', TEMPLATE_COLORS[3]),
      cellEntry(4, 7, '探究', '青木先生', '3-2', TEMPLATE_COLORS[7]),
      cellEntry(5, 1, '現代文', '青木先生', '3-2', TEMPLATE_COLORS[0]),
      cellEntry(5, 2, '数学III', '斎藤先生', '3-2', TEMPLATE_COLORS[1]),
      cellEntry(5, 3, '化学', '長谷川先生', '化学室', TEMPLATE_COLORS[5]),
      cellEntry(5, 4, '英語表現', 'Brown先生', '3-2', TEMPLATE_COLORS[4]),
      cellEntry(5, 5, '日本史', '石川先生', '3-2', TEMPLATE_COLORS[6]),
      cellEntry(5, 6, 'ホームルーム', '青木先生', '3-2', TEMPLATE_COLORS[7]),
      cellEntry(6, 1, '土曜講座', '各担当', '講義室A', TEMPLATE_COLORS[2]),
      cellEntry(6, 2, '土曜講座', '各担当', '講義室A', TEMPLATE_COLORS[2]),
      cellEntry(6, 3, '小テスト', '青木先生', '3-2', TEMPLATE_COLORS[6]),
    ],
  },
  {
    id: 'university',
    label: '大学テンプレート',
    description: '90分授業・空きコマ多め・連続コマを想定した大学向けテンプレートです。',
    activeDays: [1, 2, 3, 4, 5],
    periodCount: 6,
    periodTimes: {
      1: { start: '09:00', end: '10:30' },
      2: { start: '10:40', end: '12:10' },
      3: { start: '13:00', end: '14:30' },
      4: { start: '14:40', end: '16:10' },
      5: { start: '16:20', end: '17:50' },
      6: { start: '18:00', end: '19:30' },
    },
    cells: [
      cellEntry(1, 1, '線形代数', '佐藤教授', 'A101', TEMPLATE_COLORS[0]),
      cellEntry(1, 2, '英語アカデミック', 'Miller准教授', 'B202', TEMPLATE_COLORS[4]),
      cellEntry(1, 4, 'プログラミング演習', '田村講師', 'PC-1', TEMPLATE_COLORS[1]),
      cellEntry(2, 2, '微分積分学', '佐藤教授', 'A201', TEMPLATE_COLORS[1], '演習付き2コマ連続'),
      cellEntry(2, 3, '微分積分学', '佐藤教授', 'A201', TEMPLATE_COLORS[1], '演習付き2コマ連続'),
      cellEntry(2, 5, 'キャリア形成', '外部講師', 'C102', TEMPLATE_COLORS[7]),
      cellEntry(3, 1, '経済学入門', '森教授', 'A103', TEMPLATE_COLORS[6]),
      cellEntry(3, 4, '体育実技', '井上講師', '体育館', TEMPLATE_COLORS[3]),
      cellEntry(4, 4, '化学実験', '渡辺教授', '実験棟3F', TEMPLATE_COLORS[5], '白衣必須'),
      cellEntry(4, 5, '化学実験', '渡辺教授', '実験棟3F', TEMPLATE_COLORS[5], '白衣必須'),
      cellEntry(5, 2, 'メディア論', '川村教授', 'D303', TEMPLATE_COLORS[2]),
      cellEntry(5, 3, 'ゼミ', '川村教授', '研究室', TEMPLATE_COLORS[2], '発表資料持参'),
    ],
    merges: [
      { day: 2, start: 2, span: 2 },
      { day: 4, start: 4, span: 2 },
    ],
  },
  {
    id: 'custom',
    label: 'カスタム（空の時間割）',
    description: '曜日・時限・時刻を自由に編集できる空のテンプレートです。',
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    periodCount: 8,
    periodTimes: FALLBACK_PERIOD_TIMES,
    cells: [],
  },
]

export function getTemplateById(templateId: TemplateKind): TimetableTemplate {
  const found = TIMETABLE_TEMPLATES.find((template) => template.id === templateId)
  return found ?? TIMETABLE_TEMPLATES.find((template) => template.id === 'junior-high')!
}

export function createEmptyCells(): TimetableCells {
  const cells: TimetableCells = {}

  for (const day of DAY_INDEXES) {
    cells[day] = {}
  }

  return cells
}

export function createEmptyMerges(): TimetableMerges {
  const merges: TimetableMerges = {}

  for (const day of DAY_INDEXES) {
    merges[day] = {}
  }

  return merges
}

export function createEmptyOverrides(): DayOverrideTimes {
  const overrides: DayOverrideTimes = {}

  for (const day of DAY_INDEXES) {
    overrides[day] = {}
  }

  return overrides
}

export function createDefaultPeriods(template?: TimetableTemplate): PeriodTimes {
  const periods: PeriodTimes = {}

  for (let period = 1; period <= 8; period += 1) {
    const templateTime = template?.periodTimes[period as PeriodIndex]
    periods[period] =
      templateTime ?? FALLBACK_PERIOD_TIMES[period as PeriodIndex] ?? DEFAULT_PERIOD_TIME
  }

  return periods
}

export function createEmptyCell(overrides?: Partial<TimetableCell>): TimetableCell {
  return {
    subject: '',
    teacher: '',
    room: '',
    memo: '',
    color: DEFAULT_CELL_COLOR,
    ...overrides,
  }
}

export function createTimetableFromTemplate(
  templateId: TemplateKind,
  options?: {
    keepUi?: boolean
    keepFilters?: boolean
    previous?: TimetableState
  }
): TimetableState {
  const template = getTemplateById(templateId)
  const cells = createEmptyCells()
  const merges = createEmptyMerges()
  const overrides = createEmptyOverrides()

  for (const { day, period, cell } of template.cells) {
    cells[day][period] = {
      ...createEmptyCell(),
      ...cell,
    }
  }

  if (template.merges) {
    for (const merge of template.merges) {
      merges[merge.day][merge.start] = merge.span
    }
  }

  const previousUi = options?.previous?.ui ?? DEFAULT_UI_STATE
  const previousFilters = options?.previous?.filters ?? DEFAULT_FILTERS

  const fallbackSelectedDay = template.activeDays[0] ?? 1

  return {
    meta: {
      title: 'わたしの時間割',
      activeDays: [...template.activeDays],
      periodCount: template.periodCount,
      template: template.id,
      shareFilters: options?.previous?.meta.shareFilters ?? true,
    },
    periods: createDefaultPeriods(template),
    overrides,
    cells,
    merges,
    filters: options?.keepFilters ? previousFilters : { ...DEFAULT_FILTERS },
    ui: options?.keepUi
      ? {
          ...previousUi,
          selectedDay: template.activeDays.includes(previousUi.selectedDay)
            ? previousUi.selectedDay
            : fallbackSelectedDay,
        }
      : {
          ...DEFAULT_UI_STATE,
          selectedDay: fallbackSelectedDay,
        },
  }
}

export function cloneTimetableState(state: TimetableState): TimetableState {
  const periods: TimetableState['periods'] = {}
  const overrides: TimetableState['overrides'] = {}
  const cells: TimetableState['cells'] = {}
  const merges: TimetableState['merges'] = {}

  for (const [periodText, time] of Object.entries(state.periods)) {
    const period = Number.parseInt(periodText, 10)
    periods[period] = { ...time }
  }

  for (const [dayText, byPeriod] of Object.entries(state.overrides)) {
    const day = Number.parseInt(dayText, 10)
    overrides[day] = {}
    for (const [periodText, time] of Object.entries(byPeriod)) {
      const period = Number.parseInt(periodText, 10)
      if (!time) {
        continue
      }
      overrides[day][period] = { ...time }
    }
  }

  for (const [dayText, byPeriod] of Object.entries(state.cells)) {
    const day = Number.parseInt(dayText, 10)
    cells[day] = {}
    for (const [periodText, cell] of Object.entries(byPeriod)) {
      const period = Number.parseInt(periodText, 10)
      if (!cell) {
        continue
      }
      cells[day][period] = { ...cell }
    }
  }

  for (const [dayText, byPeriod] of Object.entries(state.merges)) {
    const day = Number.parseInt(dayText, 10)
    merges[day] = {}
    for (const [periodText, span] of Object.entries(byPeriod)) {
      const period = Number.parseInt(periodText, 10)
      if (typeof span !== 'number') {
        continue
      }
      merges[day][period] = span
    }
  }

  return {
    meta: {
      ...state.meta,
      activeDays: [...state.meta.activeDays],
    },
    periods,
    overrides,
    cells,
    merges,
    filters: {
      ...state.filters,
    },
    ui: {
      ...state.ui,
    },
  }
}
