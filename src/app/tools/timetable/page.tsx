'use client'

import { BottomSheet } from '@/components/tools/timetable/bottom-sheet'
import { DayChartPanel } from '@/components/tools/timetable/day-chart-panel'
import { SettingsPanel } from '@/components/tools/timetable/settings-panel'
import { UrlLengthDonut } from '@/components/tools/timetable/url-length-donut'
import { WeekGrid } from '@/components/tools/timetable/week-grid'
import { useErrorToast, useSuccessToast, useWarningToast } from '@/components/ui/toast'
import {
  DAY_LABELS,
  DEFAULT_FILTERS,
  FULL_DAY_LABELS,
  URL_MAX_LENGTH,
} from '@/lib/timetable/constants'
import {
  cloneTimetableState,
  createEmptyCell,
  createTimetableFromTemplate,
} from '@/lib/timetable/templates'
import type {
  DayIndex,
  PeriodIndex,
  TemplateKind,
  TimeRange,
  TimetableState,
} from '@/lib/timetable/types'
import {
  buildTimetableUrl,
  decodeTimetableFromSearch,
  encodeTimetableQuery,
} from '@/lib/timetable/urlCodec'
import {
  collectFilterOptions,
  getEffectiveTimeRange,
  getMergeSpan,
  hasActiveFilters,
  isValidHexColor,
  isValidTimeRange,
  normalizeHexColor,
  sanitizeTimetableState,
  setMergeSpan,
} from '@/lib/timetable/utils'
import { cn } from '@/lib/utils'
import html2canvas from 'html2canvas'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Filter,
  Grid3X3,
  PieChart,
  QrCode,
  RotateCcw,
  Settings,
  Share2,
  Unlink,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const HISTORY_LIMIT = 80
const URL_REPLACE_DEBOUNCE_MS = 240

type UrlMode = 'replace' | 'push'
type HistoryMode = 'silent' | 'checkpoint'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

interface EditingCell {
  day: DayIndex
  period: PeriodIndex
}

export default function TimetablePage() {
  const successToast = useSuccessToast()
  const errorToast = useErrorToast()
  const warningToast = useWarningToast()

  const [state, setState] = useState<TimetableState>(() =>
    createTimetableFromTemplate('junior-high')
  )
  const [undoStack, setUndoStack] = useState<TimetableState[]>([])
  const [redoStack, setRedoStack] = useState<TimetableState[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [urlLength, setUrlLength] = useState(0)
  const [shareUrl, setShareUrl] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [showQrPanel, setShowQrPanel] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [isExportingImage, setIsExportingImage] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallingPwa, setIsInstallingPwa] = useState(false)
  const [hexInput, setHexInput] = useState('#5A8BFF')
  const [timeError, setTimeError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const stateRef = useRef(state)
  const replaceTimerRef = useRef<number | null>(null)
  const applyingPopStateRef = useRef(false)
  const touchStartRef = useRef<number | null>(null)
  const weekGridRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const syncUrl = useCallback((nextState: TimetableState, mode: UrlMode) => {
    if (typeof window === 'undefined' || applyingPopStateRef.current) {
      return
    }

    const { query, url } = buildTimetableUrl(nextState, window.location.href)
    const relativeUrl = `${window.location.pathname}${query}`

    setShareUrl(url)
    setUrlLength(query.length)

    if (mode === 'push') {
      if (replaceTimerRef.current) {
        window.clearTimeout(replaceTimerRef.current)
        replaceTimerRef.current = null
      }

      if (window.location.search !== query) {
        window.history.pushState({ from: 'timetable' }, '', relativeUrl)
      }
      return
    }

    if (replaceTimerRef.current) {
      window.clearTimeout(replaceTimerRef.current)
    }

    replaceTimerRef.current = window.setTimeout(() => {
      if (window.location.search !== query) {
        window.history.replaceState({ from: 'timetable' }, '', relativeUrl)
      }
      replaceTimerRef.current = null
    }, URL_REPLACE_DEBOUNCE_MS)
  }, [])

  const updateState = useCallback(
    (
      producer: (prev: TimetableState) => TimetableState,
      options: { urlMode?: UrlMode; historyMode?: HistoryMode } = {}
    ) => {
      const { urlMode = 'replace', historyMode = 'silent' } = options
      const prev = stateRef.current
      const next = sanitizeTimetableState(producer(prev))

      if (JSON.stringify(prev) === JSON.stringify(next)) {
        return
      }

      if (historyMode === 'checkpoint') {
        setUndoStack((stack) => [...stack.slice(-(HISTORY_LIMIT - 1)), cloneTimetableState(prev)])
        setRedoStack([])
      }

      stateRef.current = next
      setState(next)
      syncUrl(next, urlMode)
    },
    [syncUrl]
  )

  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) {
        return stack
      }

      const previous = stack[stack.length - 1]
      const remainder = stack.slice(0, -1)
      setRedoStack((redo) => [
        ...redo.slice(-(HISTORY_LIMIT - 1)),
        cloneTimetableState(stateRef.current),
      ])

      stateRef.current = previous
      setState(previous)
      syncUrl(previous, 'push')
      return remainder
    })
  }, [syncUrl])

  const handleRedo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) {
        return stack
      }

      const next = stack[stack.length - 1]
      const remainder = stack.slice(0, -1)
      setUndoStack((undo) => [
        ...undo.slice(-(HISTORY_LIMIT - 1)),
        cloneTimetableState(stateRef.current),
      ])

      stateRef.current = next
      setState(next)
      syncUrl(next, 'push')
      return remainder
    })
  }, [syncUrl])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const decoded = decodeTimetableFromSearch(window.location.search, 'junior-high')
    const initialState = sanitizeTimetableState(decoded.state)

    stateRef.current = initialState
    setState(initialState)

    if (decoded.error) {
      warningToast('URLを復元できませんでした', decoded.error)
    }

    const { url, query } = buildTimetableUrl(initialState, window.location.href)
    setShareUrl(url)
    setUrlLength(query.length)

    if (!window.location.search) {
      window.history.replaceState(
        { from: 'timetable' },
        '',
        `${window.location.pathname}${encodeTimetableQuery(initialState)}`
      )
    }

    const onPopState = () => {
      applyingPopStateRef.current = true
      const result = decodeTimetableFromSearch(window.location.search, 'junior-high')
      const nextState = sanitizeTimetableState(result.state)

      stateRef.current = nextState
      setState(nextState)
      setEditingCell(null)
      setTimeError(null)
      setUndoStack([])
      setRedoStack([])

      const { url: nextUrl, query: nextQuery } = buildTimetableUrl(nextState, window.location.href)
      setShareUrl(nextUrl)
      setUrlLength(nextQuery.length)

      if (result.error) {
        warningToast('URLの状態を読み直しました', result.error)
      }

      window.setTimeout(() => {
        applyingPopStateRef.current = false
      }, 0)
    }

    const onResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('popstate', onPopState)
      if (replaceTimerRef.current) {
        window.clearTimeout(replaceTimerRef.current)
      }
    }
  }, [warningToast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return
      }

      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        handleUndo()
      } else if (
        (event.key.toLowerCase() === 'z' && event.shiftKey) ||
        event.key.toLowerCase() === 'y'
      ) {
        event.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleRedo, handleUndo])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setDeferredPrompt(null)
      successToast('時間割アプリをインストールしました')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [successToast])

  const filterOptions = useMemo(() => collectFilterOptions(state), [state])

  const visibleDays = useMemo(() => {
    if (isMobile && !state.ui.mobileExpandedWeek) {
      return [state.ui.selectedDay]
    }

    return state.meta.activeDays
  }, [isMobile, state.meta.activeDays, state.ui.mobileExpandedWeek, state.ui.selectedDay])

  const editingContext = useMemo(() => {
    if (!editingCell) {
      return null
    }

    const { day, period } = editingCell
    const cell = state.cells[day]?.[period] ?? createEmptyCell()
    const span = getMergeSpan(state, day, period)
    const hasOverride = Boolean(state.overrides[day]?.[period])
    const currentTime = hasOverride
      ? (state.overrides[day]?.[period] ?? getEffectiveTimeRange(state, day, period))
      : getEffectiveTimeRange(state, day, period)

    return {
      day,
      period,
      cell,
      span,
      hasOverride,
      currentTime,
      maxSpan: state.meta.periodCount - period + 1,
    }
  }, [editingCell, state])

  useEffect(() => {
    if (!editingContext) {
      return
    }

    setHexInput(normalizeHexColor(editingContext.cell.color))
    setTimeError(null)
  }, [editingContext])

  useEffect(() => {
    if (!showQrPanel || !shareUrl) {
      return
    }

    QRCode.toDataURL(shareUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        setQrCodeDataUrl(dataUrl)
      })
      .catch(() => {
        setQrCodeDataUrl('')
      })
  }, [shareUrl, showQrPanel])

  const setTab = (tab: TimetableState['ui']['tab']) => {
    updateState(
      (prev) => ({
        ...cloneTimetableState(prev),
        ui: {
          ...prev.ui,
          tab,
        },
      }),
      { urlMode: 'replace', historyMode: 'silent' }
    )
  }

  const setSelectedDay = (day: DayIndex) => {
    updateState(
      (prev) => ({
        ...cloneTimetableState(prev),
        ui: {
          ...prev.ui,
          selectedDay: day,
        },
      }),
      { urlMode: 'replace', historyMode: 'silent' }
    )
  }

  const updateCell = (
    day: DayIndex,
    period: number,
    patch: Partial<ReturnType<typeof createEmptyCell>>
  ) => {
    updateState(
      (prev) => {
        const next = cloneTimetableState(prev)
        const current = next.cells[day]?.[period] ?? createEmptyCell()
        const updated = {
          ...current,
          ...patch,
          color: normalizeHexColor(patch.color ?? current.color),
        }
        next.cells[day][period] = updated

        const span = getMergeSpan(next, day, period)
        if (span > 1) {
          for (let offset = 1; offset < span; offset += 1) {
            const targetPeriod = period + offset
            if (targetPeriod > next.meta.periodCount) {
              break
            }
            next.cells[day][targetPeriod] = { ...updated }
          }
        }

        return next
      },
      { urlMode: 'replace', historyMode: 'silent' }
    )
  }

  const clearCell = (day: DayIndex, period: PeriodIndex) => {
    updateState(
      (prev) => {
        const next = cloneTimetableState(prev)
        const span = getMergeSpan(next, day, period)
        delete next.merges[day][period]

        for (let offset = 0; offset < span; offset += 1) {
          const targetPeriod = period + offset
          next.cells[day][targetPeriod] = createEmptyCell()
          delete next.overrides[day][targetPeriod]
        }

        return next
      },
      { urlMode: 'push', historyMode: 'checkpoint' }
    )

    successToast('コマをクリアしました')
  }

  const updateMerge = (day: DayIndex, period: PeriodIndex, span: number) => {
    updateState((prev) => setMergeSpan(prev, day, period, span), {
      urlMode: 'push',
      historyMode: 'checkpoint',
    })
  }

  const updateTimeRange = (
    day: DayIndex,
    period: PeriodIndex,
    range: TimeRange,
    override: boolean,
    mode: UrlMode
  ) => {
    if (!isValidTimeRange(range)) {
      setTimeError('開始時刻は終了時刻より前に設定してください。')
      return
    }

    setTimeError(null)
    updateState(
      (prev) => {
        const next = cloneTimetableState(prev)

        if (override) {
          next.overrides[day][period] = range
        } else {
          next.periods[period] = range
        }

        return next
      },
      {
        urlMode: mode,
        historyMode: mode === 'push' ? 'checkpoint' : 'silent',
      }
    )
  }

  const toggleOverrideTime = (day: DayIndex, period: PeriodIndex, enabled: boolean) => {
    updateState(
      (prev) => {
        const next = cloneTimetableState(prev)
        if (enabled) {
          next.overrides[day][period] = next.periods[period]
        } else {
          delete next.overrides[day][period]
        }
        return next
      },
      { urlMode: 'push', historyMode: 'checkpoint' }
    )
  }

  const toggleActiveDay = (day: DayIndex) => {
    updateState(
      (prev) => {
        const next = cloneTimetableState(prev)
        const activeDays = new Set(next.meta.activeDays)

        if (activeDays.has(day)) {
          if (activeDays.size === 1) {
            warningToast('曜日は最低1つ必要です')
            return prev
          }
          activeDays.delete(day)
        } else {
          activeDays.add(day)
        }

        next.meta.activeDays = [...activeDays].sort((a, b) => a - b) as DayIndex[]

        if (!next.meta.activeDays.includes(next.ui.selectedDay)) {
          next.ui.selectedDay = next.meta.activeDays[0]
        }

        return next
      },
      { urlMode: 'push', historyMode: 'checkpoint' }
    )
  }

  const applyTemplate = (template: TemplateKind) => {
    updateState(
      (prev) =>
        createTimetableFromTemplate(template, {
          keepUi: true,
          keepFilters: true,
          previous: prev,
        }),
      { urlMode: 'push', historyMode: 'checkpoint' }
    )

    successToast('テンプレートを適用しました')
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      successToast('共有URLをコピーしました')
    } catch (_error) {
      errorToast('URLコピーに失敗しました')
    }
  }

  const handleNativeShare = async () => {
    if (!navigator.share || isSharing) {
      return
    }

    setIsSharing(true)
    try {
      await navigator.share({
        title: state.meta.title || '時間割',
        text: '時間割を共有します',
        url: shareUrl,
      })
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        errorToast('共有に失敗しました')
      }
    } finally {
      setIsSharing(false)
    }
  }

  const handleInstallPwa = async () => {
    if (!deferredPrompt || isInstallingPwa) {
      return
    }

    setIsInstallingPwa(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        successToast('ホーム画面に追加しました')
      }
      setDeferredPrompt(null)
    } catch (_error) {
      errorToast('インストールを開始できませんでした')
    } finally {
      setIsInstallingPwa(false)
    }
  }

  const handleExportImage = async () => {
    if (!weekGridRef.current || isExportingImage) {
      return
    }

    setIsExportingImage(true)
    try {
      const canvas = await html2canvas(weekGridRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      })
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `timetable-${new Date().toISOString().slice(0, 10)}.png`
      link.click()
      successToast('画像を保存しました')
    } catch (_error) {
      errorToast('画像保存に失敗しました')
    } finally {
      setIsExportingImage(false)
    }
  }

  const handleSwipeDay = (direction: 'prev' | 'next') => {
    const days = state.meta.activeDays
    const index = days.indexOf(state.ui.selectedDay)

    if (index === -1) {
      return
    }

    const nextIndex = direction === 'next' ? index + 1 : index - 1
    if (nextIndex < 0 || nextIndex >= days.length) {
      return
    }

    setSelectedDay(days[nextIndex])
  }

  const activeFilter = hasActiveFilters(state.filters)
  const selectedDayIndex = state.meta.activeDays.indexOf(state.ui.selectedDay)
  const canGoPrevDay = selectedDayIndex > 0
  const canGoNextDay = selectedDayIndex >= 0 && selectedDayIndex < state.meta.activeDays.length - 1
  const urlUsageRatio = Math.min(1, urlLength / URL_MAX_LENGTH)
  const urlUsageMessage =
    urlUsageRatio >= 0.95
      ? 'URLパラメータが上限に近いです。メモを短くすると共有しやすくなります。'
      : urlUsageRatio >= 0.85
        ? 'URLパラメータが長くなっています。共有時は一部環境で貼り付けに注意してください。'
        : 'URLパラメータ長は安定しています。'
  const showMobileUrlUsageMessage = urlUsageRatio >= 0.85

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border-light/70 bg-white/70 backdrop-blur-xl dark:border-border-dark/70 dark:bg-slate-950/70 md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.35rem)]">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {state.meta.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <UrlLengthDonut usedLength={urlLength} compact />
            <button
              type="button"
              onClick={handleCopyUrl}
              aria-label="URLコピー"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-sm transition hover:bg-accent-dark"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            {'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                disabled={isSharing}
                aria-label="共有"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-light bg-white text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-50 dark:border-border-dark dark:bg-slate-900 dark:text-slate-200"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            )}
            {deferredPrompt && (
              <button
                type="button"
                onClick={handleInstallPwa}
                disabled={isInstallingPwa}
                aria-label="アプリ追加"
                title="アプリ追加"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-light bg-white text-xs font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-50 dark:border-border-dark dark:bg-slate-900 dark:text-slate-200"
              >
                {isInstallingPwa ? '…' : '＋'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowQrPanel((value) => !value)}
              aria-label="QR表示切り替え"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-light bg-white text-slate-700 transition hover:border-accent hover:text-accent dark:border-border-dark dark:bg-slate-900 dark:text-slate-200"
            >
              <QrCode className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 pb-[calc(5.8rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+4.4rem)] sm:px-6 md:pb-10 md:pt-5 lg:px-8">
        <main className="pb-3 sm:space-y-6 sm:py-6">
          {showMobileUrlUsageMessage && (
            <p className="px-1 text-[10px] text-slate-600 dark:text-slate-300 md:hidden">
              {urlUsageMessage}
            </p>
          )}

          {showQrPanel && (
            <section className="rounded-2xl border border-border-light bg-white p-3 dark:border-border-dark dark:bg-slate-950/60 md:hidden">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  共有用QRコード
                </p>
                <button
                  type="button"
                  onClick={() => setShowQrPanel(false)}
                  className="text-[11px] text-slate-500 underline-offset-2 hover:underline"
                >
                  閉じる
                </button>
              </div>
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="時間割共有QRコード"
                  className="mt-2 h-36 w-36 rounded-lg border"
                />
              ) : (
                <p className="mt-2 text-xs text-slate-500">QRコードを生成中です...</p>
              )}
            </section>
          )}

          <section className="hidden rounded-3xl border border-border-light bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-3 shadow-sm dark:border-border-dark dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 sm:p-6 md:block">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                  {state.meta.title}
                </h1>
                <p className="mt-2 hidden max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:block">
                  URLだけで完全復元できる時間割。編集は即時反映、戻る/進むにも追従します。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <UrlLengthDonut usedLength={urlLength} />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-dark sm:min-h-11 sm:text-sm"
                >
                  <Copy className="h-4 w-4" />
                  URLコピー
                </button>
                {'share' in navigator && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    disabled={isSharing}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border-light bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-50 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200 sm:min-h-11 sm:text-sm"
                  >
                    <Share2 className="h-4 w-4" />
                    共有
                  </button>
                )}
                {deferredPrompt && (
                  <button
                    type="button"
                    onClick={handleInstallPwa}
                    disabled={isInstallingPwa}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border-light bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-50 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200 sm:min-h-11 sm:text-sm"
                  >
                    {isInstallingPwa ? '準備中...' : 'アプリ追加'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowQrPanel((value) => !value)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border-light bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-accent hover:text-accent dark:border-border-dark dark:bg-slate-950 dark:text-slate-200 sm:min-h-11 sm:text-sm"
                >
                  <QrCode className="h-4 w-4" />
                  QR
                </button>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 sm:text-xs">
              {urlUsageMessage}
            </p>

            {showQrPanel && (
              <div className="mt-4 rounded-2xl border border-border-light bg-white p-4 dark:border-border-dark dark:bg-slate-950/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    共有用QRコード（外部送信なし）
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowQrPanel(false)}
                    className="text-xs text-slate-500 underline-offset-2 hover:underline"
                  >
                    閉じる
                  </button>
                </div>
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="時間割共有QRコード"
                    className="mt-3 h-44 w-44 rounded-lg border"
                  />
                ) : (
                  <p className="mt-3 text-sm text-slate-500">QRコードを生成中です...</p>
                )}
              </div>
            )}
          </section>

          <div className="rounded-2xl border border-border-light bg-white p-2.5 shadow-sm dark:border-border-dark dark:bg-card-dark sm:p-4">
            <div className="mb-3 hidden md:flex md:flex-wrap md:gap-2">
              <button
                type="button"
                onClick={() => setTab('week')}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition',
                  state.ui.tab === 'week'
                    ? 'border-accent bg-accent text-white'
                    : 'border-border-light text-slate-700 hover:border-accent dark:border-border-dark dark:text-slate-200'
                )}
              >
                <Grid3X3 className="h-4 w-4" />
                週間
              </button>
              <button
                type="button"
                onClick={() => setTab('day')}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition',
                  state.ui.tab === 'day'
                    ? 'border-accent bg-accent text-white'
                    : 'border-border-light text-slate-700 hover:border-accent dark:border-border-dark dark:text-slate-200'
                )}
              >
                <PieChart className="h-4 w-4" />
                日別
              </button>
              <button
                type="button"
                onClick={() => setTab('settings')}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition',
                  state.ui.tab === 'settings'
                    ? 'border-accent bg-accent text-white'
                    : 'border-border-light text-slate-700 hover:border-accent dark:border-border-dark dark:text-slate-200'
                )}
              >
                <Settings className="h-4 w-4" />
                設定
              </button>
            </div>

            {state.ui.tab !== 'settings' && (
              <div className="mb-2 rounded-xl border border-border-light bg-slate-50 p-2 dark:border-border-dark dark:bg-slate-950/60 sm:p-3">
                <div
                  className={cn(
                    'mb-1.5 gap-1.5',
                    isMobile
                      ? 'flex items-center overflow-x-auto pb-0.5 whitespace-nowrap'
                      : 'flex items-center justify-between'
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      updateState(
                        (prev) => ({
                          ...cloneTimetableState(prev),
                          ui: {
                            ...prev.ui,
                            showFilters: !prev.ui.showFilters,
                          },
                        }),
                        { urlMode: 'replace', historyMode: 'silent' }
                      )
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-light bg-white px-2 text-[11px] font-semibold text-slate-700 dark:border-border-dark dark:bg-slate-900 dark:text-slate-200 sm:min-h-10 sm:px-3 sm:text-sm"
                  >
                    <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    フィルタ
                  </button>
                  {isMobile && state.ui.tab === 'week' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          updateState(
                            (prev) => ({
                              ...cloneTimetableState(prev),
                              ui: {
                                ...prev.ui,
                                mobileExpandedWeek: !prev.ui.mobileExpandedWeek,
                                compactWeek: !prev.ui.mobileExpandedWeek
                                  ? true
                                  : prev.ui.compactWeek,
                              },
                            }),
                            { urlMode: 'replace', historyMode: 'silent' }
                          )
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-light bg-white px-2 text-[11px] font-semibold text-slate-700 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200"
                      >
                        <Grid3X3 className="h-3.5 w-3.5" />
                        {state.ui.mobileExpandedWeek ? '1日表示' : '週全体'}
                      </button>

                      {state.ui.mobileExpandedWeek && (
                        <button
                          type="button"
                          onClick={() =>
                            updateState(
                              (prev) => ({
                                ...cloneTimetableState(prev),
                                ui: {
                                  ...prev.ui,
                                  compactWeek: !prev.ui.compactWeek,
                                },
                              }),
                              { urlMode: 'replace', historyMode: 'silent' }
                            )
                          }
                          className="inline-flex h-8 items-center rounded-lg border border-border-light bg-white px-2 text-[10px] font-semibold text-slate-700 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200"
                        >
                          {state.ui.compactWeek ? '時限:コンパクト' : '時限:標準'}
                        </button>
                      )}
                    </>
                  )}

                  {activeFilter && (
                    <button
                      type="button"
                      onClick={() =>
                        updateState(
                          (prev) => ({
                            ...cloneTimetableState(prev),
                            filters: { ...DEFAULT_FILTERS },
                          }),
                          { urlMode: 'replace', historyMode: 'checkpoint' }
                        )
                      }
                      className={cn(
                        'font-semibold text-accent',
                        isMobile
                          ? 'inline-flex h-8 items-center rounded-lg border border-accent/30 bg-accent/5 px-2 text-[11px]'
                          : 'text-[11px] hover:underline sm:text-xs'
                      )}
                    >
                      条件をリセット
                    </button>
                  )}
                </div>

                {state.ui.showFilters &&
                  (isMobile ? (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 whitespace-nowrap">
                      <input
                        type="search"
                        value={state.filters.query}
                        onChange={(event) =>
                          updateState(
                            (prev) => ({
                              ...cloneTimetableState(prev),
                              filters: {
                                ...prev.filters,
                                query: event.target.value,
                              },
                            }),
                            { urlMode: 'replace', historyMode: 'silent' }
                          )
                        }
                        className="h-8 min-w-[190px] rounded-lg border border-border-light bg-white px-2 text-[11px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-slate-900"
                        placeholder="科目/教室/担当で部分一致"
                      />

                      <select
                        value={state.filters.subject}
                        onChange={(event) =>
                          updateState(
                            (prev) => ({
                              ...cloneTimetableState(prev),
                              filters: {
                                ...prev.filters,
                                subject: event.target.value,
                              },
                            }),
                            { urlMode: 'replace', historyMode: 'silent' }
                          )
                        }
                        className="h-8 min-w-[122px] rounded-lg border border-border-light bg-white px-2 text-[11px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-slate-900"
                      >
                        <option value="">科目で絞る</option>
                        {filterOptions.subjects.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>

                      <select
                        value={state.filters.teacher}
                        onChange={(event) =>
                          updateState(
                            (prev) => ({
                              ...cloneTimetableState(prev),
                              filters: {
                                ...prev.filters,
                                teacher: event.target.value,
                              },
                            }),
                            { urlMode: 'replace', historyMode: 'silent' }
                          )
                        }
                        className="h-8 min-w-[122px] rounded-lg border border-border-light bg-white px-2 text-[11px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-slate-900"
                      >
                        <option value="">担当で絞る</option>
                        {filterOptions.teachers.map((teacher) => (
                          <option key={teacher} value={teacher}>
                            {teacher}
                          </option>
                        ))}
                      </select>

                      <select
                        value={state.filters.room}
                        onChange={(event) =>
                          updateState(
                            (prev) => ({
                              ...cloneTimetableState(prev),
                              filters: {
                                ...prev.filters,
                                room: event.target.value,
                              },
                            }),
                            { urlMode: 'replace', historyMode: 'silent' }
                          )
                        }
                        className="h-8 min-w-[122px] rounded-lg border border-border-light bg-white px-2 text-[11px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-slate-900"
                      >
                        <option value="">教室で絞る</option>
                        {filterOptions.rooms.map((room) => (
                          <option key={room} value={room}>
                            {room}
                          </option>
                        ))}
                      </select>

                      <div className="flex h-8 min-w-[118px] items-center gap-1.5 rounded-lg border border-border-light bg-white px-2 dark:border-border-dark dark:bg-slate-900">
                        <input
                          type="color"
                          value={state.filters.color || '#5A8BFF'}
                          onChange={(event) =>
                            updateState(
                              (prev) => ({
                                ...cloneTimetableState(prev),
                                filters: {
                                  ...prev.filters,
                                  color: event.target.value,
                                },
                              }),
                              { urlMode: 'replace', historyMode: 'silent' }
                            )
                          }
                          className="h-6 w-6 rounded border-none bg-transparent"
                          aria-label="色フィルタ"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateState(
                              (prev) => ({
                                ...cloneTimetableState(prev),
                                filters: {
                                  ...prev.filters,
                                  color: '',
                                },
                              }),
                              { urlMode: 'replace', historyMode: 'silent' }
                            )
                          }
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-300"
                        >
                          色解除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
                      <input
                        type="search"
                        value={state.filters.query}
                        onChange={(event) =>
                          updateState(
                            (prev) => ({
                              ...cloneTimetableState(prev),
                              filters: {
                                ...prev.filters,
                                query: event.target.value,
                              },
                            }),
                            { urlMode: 'replace', historyMode: 'silent' }
                          )
                        }
                        className="col-span-2 h-8 rounded-lg border border-border-light bg-white px-2 text-[11px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-slate-900 sm:h-11 sm:px-3 sm:text-sm lg:col-span-1"
                        placeholder="科目/教室/担当で部分一致"
                      />

                      <select
                        value={state.filters.subject}
                        onChange={(event) =>
                          updateState(
                            (prev) => ({
                              ...cloneTimetableState(prev),
                              filters: {
                                ...prev.filters,
                                subject: event.target.value,
                              },
                            }),
                            { urlMode: 'replace', historyMode: 'silent' }
                          )
                        }
                        className="h-8 rounded-lg border border-border-light bg-white px-2 text-[11px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-slate-900 sm:h-11 sm:px-3 sm:text-sm"
                      >
                        <option value="">科目で絞る</option>
                        {filterOptions.subjects.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>

                      <select
                        value={state.filters.teacher}
                        onChange={(event) =>
                          updateState(
                            (prev) => ({
                              ...cloneTimetableState(prev),
                              filters: {
                                ...prev.filters,
                                teacher: event.target.value,
                              },
                            }),
                            { urlMode: 'replace', historyMode: 'silent' }
                          )
                        }
                        className="h-8 rounded-lg border border-border-light bg-white px-2 text-[11px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-slate-900 sm:h-11 sm:px-3 sm:text-sm"
                      >
                        <option value="">担当で絞る</option>
                        {filterOptions.teachers.map((teacher) => (
                          <option key={teacher} value={teacher}>
                            {teacher}
                          </option>
                        ))}
                      </select>

                      <select
                        value={state.filters.room}
                        onChange={(event) =>
                          updateState(
                            (prev) => ({
                              ...cloneTimetableState(prev),
                              filters: {
                                ...prev.filters,
                                room: event.target.value,
                              },
                            }),
                            { urlMode: 'replace', historyMode: 'silent' }
                          )
                        }
                        className="h-8 rounded-lg border border-border-light bg-white px-2 text-[11px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-slate-900 sm:h-11 sm:px-3 sm:text-sm"
                      >
                        <option value="">教室で絞る</option>
                        {filterOptions.rooms.map((room) => (
                          <option key={room} value={room}>
                            {room}
                          </option>
                        ))}
                      </select>

                      <div className="col-span-2 flex h-8 items-center gap-1.5 rounded-lg border border-border-light bg-white px-2 dark:border-border-dark dark:bg-slate-900 lg:col-span-1 lg:h-9">
                        <input
                          type="color"
                          value={state.filters.color || '#5A8BFF'}
                          onChange={(event) =>
                            updateState(
                              (prev) => ({
                                ...cloneTimetableState(prev),
                                filters: {
                                  ...prev.filters,
                                  color: event.target.value,
                                },
                              }),
                              { urlMode: 'replace', historyMode: 'silent' }
                            )
                          }
                          className="h-6 w-6 rounded border-none bg-transparent"
                          aria-label="色フィルタ"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateState(
                              (prev) => ({
                                ...cloneTimetableState(prev),
                                filters: {
                                  ...prev.filters,
                                  color: '',
                                },
                              }),
                              { urlMode: 'replace', historyMode: 'silent' }
                            )
                          }
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-300"
                        >
                          色解除
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {state.ui.tab === 'week' && (
              <div className="space-y-2 md:space-y-3">
                {!(isMobile && state.ui.mobileExpandedWeek) && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSwipeDay('prev')}
                      disabled={!canGoPrevDay}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-light bg-white text-slate-600 disabled:opacity-40 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200"
                      aria-label="前の曜日"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                      {FULL_DAY_LABELS[state.ui.selectedDay]}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwipeDay('next')}
                      disabled={!canGoNextDay}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-light bg-white text-slate-600 disabled:opacity-40 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200"
                      aria-label="次の曜日"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {!state.ui.mobileExpandedWeek && isMobile && (
                  <div className="flex flex-wrap gap-1.5">
                    {state.meta.activeDays.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                          day === state.ui.selectedDay
                            ? 'border-accent bg-accent text-white'
                            : 'border-border-light bg-white text-slate-700 dark:border-border-dark dark:bg-slate-950 dark:text-slate-200'
                        )}
                      >
                        {DAY_LABELS[day]}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  onTouchStart={(event) => {
                    touchStartRef.current = event.changedTouches[0].clientX
                  }}
                  onTouchEnd={(event) => {
                    if (
                      state.ui.mobileExpandedWeek ||
                      !isMobile ||
                      touchStartRef.current === null
                    ) {
                      return
                    }
                    const deltaX = event.changedTouches[0].clientX - touchStartRef.current
                    touchStartRef.current = null

                    if (Math.abs(deltaX) < 48) {
                      return
                    }

                    if (deltaX < 0) {
                      handleSwipeDay('next')
                    } else {
                      handleSwipeDay('prev')
                    }
                  }}
                >
                  <WeekGrid
                    state={state}
                    visibleDays={visibleDays}
                    readOnly={state.ui.readOnly}
                    fitFullWidth={isMobile && state.ui.mobileExpandedWeek}
                    compact={isMobile && state.ui.mobileExpandedWeek && state.ui.compactWeek}
                    containerRef={weekGridRef}
                    onSelectCell={(day, period) => {
                      if (state.ui.readOnly) {
                        warningToast('読み取り専用モードです')
                        return
                      }
                      setEditingCell({ day, period: period as PeriodIndex })
                    }}
                  />
                </div>
              </div>
            )}

            {state.ui.tab === 'day' && (
              <DayChartPanel
                state={state}
                selectedDay={state.ui.selectedDay}
                onSelectDay={setSelectedDay}
              />
            )}

            {state.ui.tab === 'settings' && (
              <SettingsPanel
                state={state}
                onSetTitle={(title) =>
                  updateState(
                    (prev) => ({
                      ...cloneTimetableState(prev),
                      meta: {
                        ...prev.meta,
                        title,
                      },
                    }),
                    { urlMode: 'replace', historyMode: 'silent' }
                  )
                }
                onApplyTemplate={applyTemplate}
                onToggleDay={toggleActiveDay}
                onSetPeriodCount={(count) =>
                  updateState(
                    (prev) => ({
                      ...cloneTimetableState(prev),
                      meta: {
                        ...prev.meta,
                        periodCount: count,
                      },
                    }),
                    { urlMode: 'push', historyMode: 'checkpoint' }
                  )
                }
                onSetDefaultTime={(period, range) =>
                  updateTimeRange(state.ui.selectedDay, period as PeriodIndex, range, false, 'push')
                }
                onToggleShareFilters={(value) =>
                  updateState(
                    (prev) => ({
                      ...cloneTimetableState(prev),
                      meta: {
                        ...prev.meta,
                        shareFilters: value,
                      },
                    }),
                    { urlMode: 'push', historyMode: 'checkpoint' }
                  )
                }
                onToggleReadOnly={(value) =>
                  updateState(
                    (prev) => ({
                      ...cloneTimetableState(prev),
                      ui: {
                        ...prev.ui,
                        readOnly: value,
                      },
                    }),
                    { urlMode: 'push', historyMode: 'checkpoint' }
                  )
                }
                onPrint={() => window.print()}
                onExportImage={handleExportImage}
                onShareUrl={handleCopyUrl}
                exportingImage={isExportingImage}
              />
            )}
          </div>
        </main>
      </div>

      <BottomSheet
        open={Boolean(editingContext)}
        onClose={() => setEditingCell(null)}
        title={
          editingContext ? `${FULL_DAY_LABELS[editingContext.day]} ${editingContext.period}限` : ''
        }
        subtitle={state.ui.readOnly ? '読み取り専用モードです' : '変更は自動でURLへ保存されます'}
      >
        {editingContext && (
          <div className="space-y-4 pb-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">科目名</span>
                <input
                  type="text"
                  value={editingContext.cell.subject}
                  disabled={state.ui.readOnly}
                  onChange={(event) =>
                    updateCell(editingContext.day, editingContext.period, {
                      subject: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-slate-950"
                  placeholder="例: 数学II"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">担当教師</span>
                <input
                  type="text"
                  value={editingContext.cell.teacher}
                  disabled={state.ui.readOnly}
                  onChange={(event) =>
                    updateCell(editingContext.day, editingContext.period, {
                      teacher: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-slate-950"
                  placeholder="例: 田中先生"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">教室</span>
                <input
                  type="text"
                  value={editingContext.cell.room}
                  disabled={state.ui.readOnly}
                  onChange={(event) =>
                    updateCell(editingContext.day, editingContext.period, {
                      room: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-slate-950"
                  placeholder="例: 3-2 / A101"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">色（HEX）</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={normalizeHexColor(editingContext.cell.color)}
                    disabled={state.ui.readOnly}
                    onChange={(event) => {
                      setHexInput(event.target.value)
                      updateCell(editingContext.day, editingContext.period, {
                        color: event.target.value,
                      })
                    }}
                    className="h-11 w-14 rounded-lg border border-border-light bg-transparent"
                    aria-label="授業色"
                  />
                  <input
                    type="text"
                    value={hexInput}
                    disabled={state.ui.readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value.toUpperCase()
                      setHexInput(nextValue)
                      if (isValidHexColor(nextValue)) {
                        updateCell(editingContext.day, editingContext.period, {
                          color: nextValue,
                        })
                      }
                    }}
                    className="flex-1 rounded-xl border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-slate-950"
                    placeholder="#5A8BFF"
                  />
                </div>
                {hexInput && !isValidHexColor(hexInput) && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    HEXは `#RRGGBB` 形式で入力してください。
                  </p>
                )}
              </label>
            </div>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">メモ</span>
              <textarea
                value={editingContext.cell.memo}
                disabled={state.ui.readOnly}
                onChange={(event) =>
                  updateCell(editingContext.day, editingContext.period, {
                    memo: event.target.value,
                  })
                }
                className="h-20 w-full rounded-xl border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-slate-950"
                placeholder="持ち物・移動メモなど"
              />
            </label>

            <div className="rounded-xl border border-border-light bg-slate-50 p-3 dark:border-border-dark dark:bg-slate-950/60">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">時間設定</p>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingContext.hasOverride}
                    disabled={state.ui.readOnly}
                    onChange={(event) =>
                      toggleOverrideTime(
                        editingContext.day,
                        editingContext.period,
                        event.target.checked
                      )
                    }
                  />
                  この曜日だけ上書き
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  step={60}
                  value={editingContext.currentTime.start}
                  disabled={state.ui.readOnly}
                  onChange={(event) =>
                    updateTimeRange(
                      editingContext.day,
                      editingContext.period,
                      {
                        start: event.target.value,
                        end: editingContext.currentTime.end,
                      },
                      editingContext.hasOverride,
                      'replace'
                    )
                  }
                  className="h-11 rounded-lg border border-border-light bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-slate-950"
                />
                <input
                  type="time"
                  step={60}
                  value={editingContext.currentTime.end}
                  disabled={state.ui.readOnly}
                  onChange={(event) =>
                    updateTimeRange(
                      editingContext.day,
                      editingContext.period,
                      {
                        start: editingContext.currentTime.start,
                        end: event.target.value,
                      },
                      editingContext.hasOverride,
                      'replace'
                    )
                  }
                  className="h-11 rounded-lg border border-border-light bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-slate-950"
                />
              </div>
              {timeError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{timeError}</p>
              )}
            </div>

            <div className="rounded-xl border border-border-light bg-slate-50 p-3 dark:border-border-dark dark:bg-slate-950/60">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  連続コマ結合
                </p>
                {editingContext.span > 1 && (
                  <button
                    type="button"
                    onClick={() => updateMerge(editingContext.day, editingContext.period, 1)}
                    className="inline-flex items-center gap-1 rounded-md border border-border-light bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-600 dark:border-border-dark dark:bg-slate-900"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    結合解除
                  </button>
                )}
              </div>

              <label className="text-xs text-slate-600 dark:text-slate-300">
                開始時限: {editingContext.period}限 / 最大 {editingContext.maxSpan}コマ
                <select
                  value={editingContext.span}
                  disabled={state.ui.readOnly}
                  onChange={(event) =>
                    updateMerge(
                      editingContext.day,
                      editingContext.period,
                      Number.parseInt(event.target.value, 10)
                    )
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-border-light bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-slate-950"
                >
                  {Array.from({ length: editingContext.maxSpan }).map((_, index) => {
                    const value = index + 1
                    return (
                      <option key={value} value={value}>
                        {value}コマ{value > 1 ? '（結合）' : ''}
                      </option>
                    )
                  })}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => clearCell(editingContext.day, editingContext.period)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 hover:bg-red-100 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
              >
                <RotateCcw className="h-4 w-4" />
                このコマをクリア
              </button>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark"
              >
                完了
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-light bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2 backdrop-blur dark:border-border-dark dark:bg-slate-950/95 md:hidden">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            type="button"
            onClick={() => setTab('week')}
            className={cn(
              'flex min-h-12 flex-1 flex-col items-center justify-center rounded-xl text-[11px] font-semibold',
              state.ui.tab === 'week'
                ? 'bg-accent text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'
            )}
          >
            <Grid3X3 className="mb-0.5 h-4 w-4" />
            週間
          </button>
          <button
            type="button"
            onClick={() => setTab('day')}
            className={cn(
              'flex min-h-12 flex-1 flex-col items-center justify-center rounded-xl text-[11px] font-semibold',
              state.ui.tab === 'day'
                ? 'bg-accent text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'
            )}
          >
            <PieChart className="mb-0.5 h-4 w-4" />
            日別
          </button>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={cn(
              'flex min-h-12 flex-1 flex-col items-center justify-center rounded-xl text-[11px] font-semibold',
              state.ui.tab === 'settings'
                ? 'bg-accent text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'
            )}
          >
            <Settings className="mb-0.5 h-4 w-4" />
            設定
          </button>
        </div>
      </nav>

      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: print styles for timetable export
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            header, footer, nav, .no-print {
              display: none !important;
            }
            body {
              background: #fff !important;
            }
            .timetable-print-grid {
              box-shadow: none !important;
              border: 1px solid #d1d5db !important;
            }
          }
        `,
        }}
      />
    </div>
  )
}
