'use client'

import { DAY_LABELS, MAX_PERIODS } from '@/lib/timetable/constants'
import { TIMETABLE_TEMPLATES } from '@/lib/timetable/templates'
import type { DayIndex, TemplateKind, TimeRange, TimetableState } from '@/lib/timetable/types'
import { cn } from '@/lib/utils'
import { Download, Printer, Share2, Smartphone } from 'lucide-react'
import { useState } from 'react'

interface SettingsPanelProps {
  state: TimetableState
  onSetTitle: (title: string) => void
  onApplyTemplate: (template: TemplateKind) => void
  onToggleDay: (day: DayIndex) => void
  onSetPeriodCount: (count: number) => void
  onSetDefaultTime: (period: number, range: TimeRange) => void
  onToggleShareFilters: (value: boolean) => void
  onToggleReadOnly: (value: boolean) => void
  onPrint: () => void
  onExportImage: () => void
  onShareUrl: () => void
  exportingImage: boolean
}

export function SettingsPanel({
  state,
  onSetTitle,
  onApplyTemplate,
  onToggleDay,
  onSetPeriodCount,
  onSetDefaultTime,
  onToggleShareFilters,
  onToggleReadOnly,
  onPrint,
  onExportImage,
  onShareUrl,
  exportingImage,
}: SettingsPanelProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKind>(state.meta.template)

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">基本設定</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">時間割タイトル</span>
            <input
              type="text"
              value={state.meta.title}
              onChange={(event) => onSetTitle(event.target.value)}
              maxLength={80}
              className="w-full rounded-xl border border-border-light bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-border-dark dark:bg-slate-950 dark:text-slate-100"
              placeholder="例: 3年2組 1学期"
            />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">表示時限数</span>
            <select
              value={state.meta.periodCount}
              onChange={(event) => onSetPeriodCount(Number.parseInt(event.target.value, 10))}
              className="w-full rounded-xl border border-border-light bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-border-dark dark:bg-slate-950 dark:text-slate-100"
            >
              {Array.from({ length: MAX_PERIODS }).map((_, index) => {
                const value = index + 1
                return (
                  <option key={value} value={value}>
                    {value}限まで表示
                  </option>
                )
              })}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            使用する曜日
          </p>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, dayIndex) => {
              const active = state.meta.activeDays.includes(dayIndex as DayIndex)
              return (
                <button
                  type="button"
                  key={label}
                  onClick={() => onToggleDay(dayIndex as DayIndex)}
                  className={cn(
                    'min-h-11 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    active
                      ? 'border-accent bg-accent text-white'
                      : 'border-border-light bg-white text-slate-700 hover:border-accent/60 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200'
                  )}
                  aria-pressed={active}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">テンプレート</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          小学校〜大学までの標準パターンを1タップで適用できます。
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedTemplate}
            onChange={(event) => setSelectedTemplate(event.target.value as TemplateKind)}
            className="w-full rounded-xl border border-border-light bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-border-dark dark:bg-slate-950 dark:text-slate-100"
          >
            {TIMETABLE_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onApplyTemplate(selectedTemplate)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            テンプレートを適用
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {TIMETABLE_TEMPLATES.find((template) => template.id === selectedTemplate)?.description}
        </p>
      </div>

      <div className="rounded-2xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          時限ごとの標準時刻
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: state.meta.periodCount }).map((_, index) => {
            const period = index + 1
            const time = state.periods[period]

            return (
              <div
                key={period}
                className="rounded-xl border border-border-light bg-slate-50 p-3 dark:border-border-dark dark:bg-slate-950/60"
              >
                <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {period}限
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={time.start}
                    step={60}
                    onChange={(event) =>
                      onSetDefaultTime(period, { start: event.target.value, end: time.end })
                    }
                    className="w-full rounded-lg border border-border-light bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200"
                    aria-label={`${period}限 開始時刻`}
                  />
                  <input
                    type="time"
                    value={time.end}
                    step={60}
                    onChange={(event) =>
                      onSetDefaultTime(period, { start: time.start, end: event.target.value })
                    }
                    className="w-full rounded-lg border border-border-light bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200"
                    aria-label={`${period}限 終了時刻`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          共有・表示オプション
        </h2>

        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border-light bg-slate-50 px-3 py-2 text-sm dark:border-border-dark dark:bg-slate-950/60">
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-200">
                フィルタ状態もURLに含める
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                有効時は検索・絞り込み条件も共有されます。
              </p>
            </div>
            <input
              type="checkbox"
              checked={state.meta.shareFilters}
              onChange={(event) => onToggleShareFilters(event.target.checked)}
              className="h-4 w-4 rounded border-border-light text-accent focus:ring-accent dark:border-border-dark"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-border-light bg-slate-50 px-3 py-2 text-sm dark:border-border-dark dark:bg-slate-950/60">
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-200">読み取り専用モード</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                誤操作を防ぎたい共有リンクで有効化します。
              </p>
            </div>
            <input
              type="checkbox"
              checked={state.ui.readOnly}
              onChange={(event) => onToggleReadOnly(event.target.checked)}
              className="h-4 w-4 rounded border-border-light text-accent focus:ring-accent dark:border-border-dark"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={onShareUrl}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-white transition hover:bg-accent-dark"
          >
            <Share2 className="h-4 w-4" />
            共有URLコピー
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-light bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent dark:border-border-dark dark:bg-slate-950 dark:text-slate-200"
          >
            <Printer className="h-4 w-4" />
            印刷
          </button>
          <button
            type="button"
            onClick={onExportImage}
            disabled={exportingImage}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-light bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200"
          >
            <Download className="h-4 w-4" />
            {exportingImage ? '画像生成中...' : '画像保存'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">PWAガイド</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          ホーム画面へ追加するとオフラインでもアプリシェルを起動できます。
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>iPhone Safari: 共有メニューから「ホーム画面に追加」。</li>
          <li>Chrome: アドレスバー右のインストールボタンを選択。</li>
          <li>追加後は独立アプリとして起動可能です。</li>
        </ol>
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent">
          <Smartphone className="h-4 w-4" />
          このアプリはURLだけで時間割を完全復元できます。
        </div>
      </div>
    </section>
  )
}
