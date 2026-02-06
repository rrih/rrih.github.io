'use client'

import { DAY_LABELS, FULL_DAY_LABELS } from '@/lib/timetable/constants'
import type { DayIndex, TimetableState } from '@/lib/timetable/types'
import {
  getEffectiveTimeRange,
  getMergeSpan,
  hasCellContent,
  isCoveredByMerge,
  normalizeHexColor,
  parseTimeToMinutes,
} from '@/lib/timetable/utils'
import { cn } from '@/lib/utils'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface DayChartPanelProps {
  state: TimetableState
  selectedDay: DayIndex
  onSelectDay: (day: DayIndex) => void
}

interface TimelineSegment {
  key: string
  name: string
  value: number
  color: string
  isClass: boolean
  startMinute: number
  endMinute: number
  subject?: string
  teacher?: string
  room?: string
  memo?: string
}

interface ClassBlock {
  key: string
  subject: string
  teacher: string
  room: string
  memo: string
  color: string
  startMinute: number
  endMinute: number
  span: number
}

function toTimeText(minutes: number): string {
  const safe = Math.max(0, Math.min(24 * 60, minutes))
  const hour = Math.floor(safe / 60)
  const minute = safe % 60
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

function toDurationText(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${hour}時間${minute.toString().padStart(2, '0')}分`
}

function collectClassBlocks(state: TimetableState, day: DayIndex): ClassBlock[] {
  const blocks: ClassBlock[] = []

  for (let period = 1; period <= state.meta.periodCount; period += 1) {
    if (isCoveredByMerge(state, day, period)) {
      continue
    }

    const span = getMergeSpan(state, day, period)
    const cell = state.cells[day]?.[period]

    if (!hasCellContent(cell)) {
      continue
    }

    const startTime = getEffectiveTimeRange(state, day, period).start
    const endTime = getEffectiveTimeRange(state, day, period + span - 1).end
    const startMinute = parseTimeToMinutes(startTime)
    const endMinute = parseTimeToMinutes(endTime)

    if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute) {
      continue
    }

    blocks.push({
      key: `${day}-${period}`,
      subject: cell?.subject || '授業',
      teacher: cell?.teacher || '担当未設定',
      room: cell?.room || '教室未設定',
      memo: cell?.memo || '',
      color: normalizeHexColor(cell?.color || '#5A8BFF'),
      startMinute,
      endMinute,
      span,
    })
  }

  return blocks.sort((a, b) => a.startMinute - b.startMinute)
}

function buildTimelineSegments(blocks: ClassBlock[]): TimelineSegment[] {
  const segments: TimelineSegment[] = []
  let cursor = 0

  for (const block of blocks) {
    const start = Math.max(cursor, block.startMinute)
    const end = Math.max(start, Math.min(24 * 60, block.endMinute))

    if (start > cursor) {
      segments.push({
        key: `gap-${cursor}-${start}`,
        name: '授業外',
        value: start - cursor,
        color: '#cbd5e1',
        isClass: false,
        startMinute: cursor,
        endMinute: start,
      })
    }

    if (end > start) {
      segments.push({
        key: block.key,
        name: block.subject,
        value: end - start,
        color: block.color,
        isClass: true,
        startMinute: start,
        endMinute: end,
        subject: block.subject,
        teacher: block.teacher,
        room: block.room,
        memo: block.memo,
      })
    }

    cursor = end
  }

  if (cursor < 24 * 60) {
    segments.push({
      key: `gap-${cursor}-1440`,
      name: '授業外',
      value: 24 * 60 - cursor,
      color: '#cbd5e1',
      isClass: false,
      startMinute: cursor,
      endMinute: 24 * 60,
    })
  }

  if (segments.length === 0) {
    segments.push({
      key: 'all-gap',
      name: '授業外',
      value: 24 * 60,
      color: '#cbd5e1',
      isClass: false,
      startMinute: 0,
      endMinute: 24 * 60,
    })
  }

  return segments
}

export function DayChartPanel({ state, selectedDay, onSelectDay }: DayChartPanelProps) {
  const classBlocks = collectClassBlocks(state, selectedDay)
  const timelineSegments = buildTimelineSegments(classBlocks)
  const classMinutes = classBlocks.reduce(
    (sum, block) => sum + (block.endMinute - block.startMinute),
    0
  )

  return (
    <section className="rounded-2xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            日別24時間ドーナツ
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {FULL_DAY_LABELS[selectedDay]}の中で授業が入っている時間帯を24時間基準で表示します。
          </p>
        </div>
        <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          授業時間 {toDurationText(classMinutes)} / 24時間
        </div>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {state.meta.activeDays.map((day) => (
          <button
            type="button"
            key={day}
            onClick={() => onSelectDay(day)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              day === selectedDay
                ? 'border-accent bg-accent text-white'
                : 'border-border-light bg-white text-slate-700 hover:border-accent/60 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200'
            )}
            aria-label={`${FULL_DAY_LABELS[day]}を表示`}
          >
            {DAY_LABELS[day]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="h-[280px] rounded-xl border border-border-light bg-slate-50 px-2 py-2 dark:border-border-dark dark:bg-slate-950/60 sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={timelineSegments}
                dataKey="value"
                nameKey="name"
                innerRadius="48%"
                outerRadius="82%"
                paddingAngle={1}
                stroke="none"
              >
                {timelineSegments.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} fillOpacity={entry.isClass ? 1 : 0.55} />
                ))}
              </Pie>
              <Tooltip
                formatter={(_value: number, _name, item) => [
                  `${toTimeText(item.payload.startMinute)} - ${toTimeText(item.payload.endMinute)}`,
                  `${item.payload.name} (${toDurationText(item.payload.value)})`,
                ]}
                contentStyle={{
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(148,163,184,0.2)',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                  background: 'rgba(255,255,255,0.96)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border-light bg-white p-3 dark:border-border-dark dark:bg-slate-950/40">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            授業一覧
          </h3>
          {classBlocks.length > 0 ? (
            <ul className="space-y-2">
              {classBlocks.map((block) => (
                <li
                  key={block.key}
                  className="rounded-lg border border-border-light bg-slate-50 p-2.5 text-sm dark:border-border-dark dark:bg-slate-900"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: block.color }}
                      aria-hidden
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {block.subject}
                    </span>
                    {block.span > 1 && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        {block.span}コマ連続
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {toTimeText(block.startMinute)} - {toTimeText(block.endMinute)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {block.teacher} / {block.room}
                  </div>
                  {block.memo && (
                    <div className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      メモ: {block.memo}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              授業を追加するとここに一覧表示されます。
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
