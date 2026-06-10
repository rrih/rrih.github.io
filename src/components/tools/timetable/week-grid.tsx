'use client'

import { DAY_LABELS, FULL_DAY_LABELS, MAX_PERIODS } from '@/lib/timetable/constants'
import { createEmptyCell } from '@/lib/timetable/templates'
import type { DayIndex, TimetableState } from '@/lib/timetable/types'
import {
  cellMatchesFilters,
  formatTimeRange,
  getAccessibleTextColor,
  getEffectiveTimeRange,
  getMergeSpan,
  hasActiveFilters,
  hasCellContent,
  isCoveredByMerge,
  normalizeHexColor,
} from '@/lib/timetable/utils'
import { cn } from '@/lib/utils'

interface WeekGridProps {
  state: TimetableState
  visibleDays: DayIndex[]
  readOnly: boolean
  fitFullWidth?: boolean
  compact?: boolean
  containerRef?: React.RefObject<HTMLDivElement | null>
  onSelectCell: (day: DayIndex, period: number) => void
}

export function WeekGrid({
  state,
  visibleDays,
  readOnly,
  fitFullWidth = false,
  compact = false,
  containerRef,
  onSelectCell,
}: WeekGridProps) {
  const filterActive = hasActiveFilters(state.filters)

  return (
    <div
      ref={containerRef}
      className="timetable-print-grid rounded-2xl border border-border-light bg-white shadow-sm dark:border-border-dark dark:bg-card-dark"
    >
      <div className={cn(fitFullWidth ? '' : 'overflow-x-auto')}>
        <table
          className={cn('w-full border-collapse', fitFullWidth ? 'table-fixed' : 'min-w-[560px]')}
        >
          <thead>
            <tr>
              <th
                className={cn(
                  'sticky left-0 z-20 bg-slate-100 text-left font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  fitFullWidth
                    ? 'w-8 min-w-8 px-0.5 py-1 text-[10px] text-center'
                    : 'w-24 min-w-24 px-2 py-2 text-xs'
                )}
              >
                {fitFullWidth ? '限' : '時限'}
              </th>
              {visibleDays.map((day) => (
                <th
                  key={day}
                  className={cn(
                    'border-l border-border-light bg-slate-50 font-semibold text-slate-800 dark:border-border-dark dark:bg-slate-950/60 dark:text-slate-100',
                    fitFullWidth
                      ? 'px-0.5 py-1 text-center text-[10px]'
                      : 'min-w-[170px] px-3 py-3 text-left text-sm'
                  )}
                >
                  {fitFullWidth ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-[10px] text-accent dark:bg-accent/25">
                      {DAY_LABELS[day]}
                    </span>
                  ) : (
                    <>
                      <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-xs text-accent dark:bg-accent/25">
                        {DAY_LABELS[day]}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {FULL_DAY_LABELS[day]}
                      </span>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: state.meta.periodCount }).map((_, index) => {
              const period = index + 1
              const referenceDay = visibleDays[0]
              const periodTime = getEffectiveTimeRange(state, referenceDay, period)

              return (
                <tr key={period} className="align-top">
                  <th
                    className={cn(
                      'sticky left-0 z-10 border-t border-border-light bg-white text-left dark:border-border-dark dark:bg-card-dark',
                      fitFullWidth ? 'px-0.5 py-1 text-center' : 'px-2 py-2'
                    )}
                  >
                    {fitFullWidth ? (
                      <>
                        <div className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">
                          {period}
                        </div>
                        {compact ? (
                          <div className="text-[9px] text-slate-500 dark:text-slate-400">
                            {periodTime.start}
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-500 dark:text-slate-400">
                            {periodTime.start}-{periodTime.end}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {period}限
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatTimeRange(periodTime)}
                        </div>
                      </>
                    )}
                  </th>
                  {visibleDays.map((day) => {
                    if (isCoveredByMerge(state, day, period)) {
                      return null
                    }

                    const span = getMergeSpan(state, day, period)
                    const cell = state.cells[day]?.[period] ?? createEmptyCell()
                    const normalizedColor = normalizeHexColor(cell.color)
                    const textColor = getAccessibleTextColor(normalizedColor)
                    const matched = cellMatchesFilters(cell, state.filters)
                    const filled = hasCellContent(cell)

                    return (
                      <td
                        key={`${day}-${period}`}
                        rowSpan={span}
                        className={cn(
                          'border-l border-t border-border-light align-top dark:border-border-dark',
                          fitFullWidth ? 'p-0.5' : 'p-1'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectCell(day, period)}
                          disabled={readOnly}
                          aria-label={`${FULL_DAY_LABELS[day]} ${period}限を編集`}
                          className={cn(
                            'group relative flex h-full w-full flex-col rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                            compact || fitFullWidth ? 'min-h-[36px] p-1' : 'min-h-[82px] p-2',
                            readOnly
                              ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-80 dark:border-slate-800 dark:bg-slate-900'
                              : 'cursor-pointer border-slate-200 hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-700',
                            filterActive && !matched ? 'opacity-35 grayscale-[0.65]' : 'opacity-100'
                          )}
                          style={
                            filled
                              ? {
                                  backgroundColor: normalizedColor,
                                  color: textColor,
                                  borderColor: normalizedColor,
                                }
                              : undefined
                          }
                        >
                          {span > 1 && (
                            <span className="absolute right-0.5 top-0.5 rounded-full bg-black/15 px-1 py-0.5 text-[9px] font-semibold text-current backdrop-blur-sm">
                              {span}
                            </span>
                          )}

                          {filled ? (
                            compact || fitFullWidth ? (
                              <>
                                <span className="line-clamp-2 text-[10px] font-semibold leading-tight">
                                  {cell.subject || '授業'}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="line-clamp-2 text-sm font-semibold">
                                  {cell.subject || '科目名'}
                                </span>
                                <span className="mt-1 line-clamp-1 text-xs opacity-90">
                                  {cell.teacher || '担当未設定'}
                                </span>
                                <span className="mt-0.5 line-clamp-1 text-xs opacity-85">
                                  {cell.room || '教室未設定'}
                                </span>
                                {cell.memo && (
                                  <span className="mt-1 line-clamp-2 rounded-md bg-black/10 px-1.5 py-1 text-[11px]">
                                    {cell.memo}
                                  </span>
                                )}
                              </>
                            )
                          ) : compact || fitFullWidth ? (
                            <span className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                              +
                            </span>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-slate-500 transition-colors group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
                                タップして追加
                              </span>
                              <span className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                科目・教室・教師
                              </span>
                            </>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {state.meta.periodCount < MAX_PERIODS && !fitFullWidth && (
              <tr>
                <td
                  colSpan={visibleDays.length + 1}
                  className="border-t border-border-light px-3 py-2 text-xs text-slate-500 dark:border-border-dark dark:text-slate-400"
                >
                  {state.meta.periodCount + 1}〜{MAX_PERIODS}限は設定で表示できます。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
