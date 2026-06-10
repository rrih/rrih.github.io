'use client'

import { AdUnit } from '@/components/ads/ad-unit'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { AssignmentEditorSheet } from '@/components/tools/homework-tracker/assignment-editor-sheet'
import { AssignmentList } from '@/components/tools/homework-tracker/assignment-list'
import { FiltersPanel } from '@/components/tools/homework-tracker/filters-panel'
import { SharePanel } from '@/components/tools/homework-tracker/share-panel'
import { SummaryCards } from '@/components/tools/homework-tracker/summary-cards'
import { useErrorToast, useSuccessToast, useWarningToast } from '@/components/ui/toast'
import {
  clearHomeworkTrackerState,
  loadHomeworkTrackerState,
  saveHomeworkTrackerState,
} from '@/lib/homework-tracker/storage'
import {
  createHomeworkTrackerPersonalState,
  createHomeworkTrackerState,
} from '@/lib/homework-tracker/templates'
import type {
  HomeworkAssignment,
  HomeworkTrackerPersonalState,
  HomeworkTrackerSharedState,
  SchoolType,
} from '@/lib/homework-tracker/types'
import {
  buildHomeworkTrackerUrl,
  decodeHomeworkTrackerFromSearch,
} from '@/lib/homework-tracker/urlCodec'
import {
  buildAssignmentViewModels,
  createBlankAssignment,
  filterAssignmentViewModels,
  getSummaryCounts,
  sanitizeHomeworkTrackerPersonalState,
  sanitizeHomeworkTrackerState,
} from '@/lib/homework-tracker/utils'
import html2canvas from 'html2canvas'
import { ArrowRight, Copy, Filter, Plus, Share2, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'

const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  'junior-high': '中学',
  'high-school': '高校',
  university: '大学',
  custom: 'カスタム',
}

export default function HomeworkTrackerPage() {
  const successToast = useSuccessToast()
  const errorToast = useErrorToast()
  const warningToast = useWarningToast()

  const [sharedState, setSharedState] = useState<HomeworkTrackerSharedState>(() =>
    createHomeworkTrackerState('high-school')
  )
  const [personalState, setPersonalState] = useState<HomeworkTrackerPersonalState>(() =>
    createHomeworkTrackerPersonalState()
  )
  const [editorAssignment, setEditorAssignment] = useState<HomeworkAssignment | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [loadedFromSharedUrl, setLoadedFromSharedUrl] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const boardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const savedState = loadHomeworkTrackerState()
    let initialShared = savedState.shared
    let importedFromSharedUrl = false

    if (window.location.search.includes('h=')) {
      const decoded = decodeHomeworkTrackerFromSearch(window.location.search)
      initialShared = decoded.state
      importedFromSharedUrl = true

      if (decoded.error) {
        warningToast('共有URLを完全には復元できませんでした', decoded.error)
      }
    }

    const sanitizedShared = sanitizeHomeworkTrackerState(initialShared)
    const sanitizedPersonal = sanitizeHomeworkTrackerPersonalState(
      savedState.personal,
      sanitizedShared
    )

    setSharedState(sanitizedShared)
    setPersonalState(sanitizedPersonal)
    setLoadedFromSharedUrl(importedFromSharedUrl)
    setIsReady(true)
  }, [warningToast])

  useEffect(() => {
    if (!isReady) {
      return
    }

    saveHomeworkTrackerState(sharedState, personalState)
  }, [isReady, personalState, sharedState])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const { url } = buildHomeworkTrackerUrl(sharedState, window.location.href)
    setShareUrl(url)

    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then(setQrCodeDataUrl)
      .catch(() => setQrCodeDataUrl(''))
  }, [sharedState])

  const allItems = buildAssignmentViewModels(sharedState, personalState)
  const filteredItems = filterAssignmentViewModels(allItems, personalState)
  const pendingItems = filteredItems.filter((item) => !item.completed)
  const completedItems = filteredItems.filter((item) => item.completed)
  const summary = getSummaryCounts(sharedState, personalState)
  const subjectSnapshots = sharedState.subjects
    .map((subject) => {
      const total = allItems.filter((item) => item.assignment.subjectId === subject.id).length
      const pending = allItems.filter(
        (item) => item.assignment.subjectId === subject.id && !item.completed
      ).length

      return {
        ...subject,
        total,
        pending,
      }
    })
    .filter((subject) => subject.total > 0)
    .sort((left, right) => right.pending - left.pending)

  const updateSharedState = (next: HomeworkTrackerSharedState) => {
    setSharedState(sanitizeHomeworkTrackerState(next))
  }

  const updatePersonalState = (next: HomeworkTrackerPersonalState) => {
    setPersonalState(sanitizeHomeworkTrackerPersonalState(next, sharedState))
  }

  const handleAddAssignment = () => {
    setEditorAssignment(createBlankAssignment(sharedState.subjects[0]?.id ?? 'subject-1'))
  }

  const handleSaveAssignment = (assignment: HomeworkAssignment) => {
    const nextAssignments = [...sharedState.assignments]
    const index = nextAssignments.findIndex((item) => item.id === assignment.id)

    if (index >= 0) {
      nextAssignments[index] = assignment
    } else {
      nextAssignments.push(assignment)
    }

    updateSharedState({
      ...sharedState,
      assignments: nextAssignments,
    })
    setEditorAssignment(null)
    successToast('保存しました', '課題一覧を更新しました。')
  }

  const handleDeleteAssignment = (assignmentId: string) => {
    if (!confirm('この課題を削除しますか？')) {
      return
    }

    updateSharedState({
      ...sharedState,
      assignments: sharedState.assignments.filter((assignment) => assignment.id !== assignmentId),
    })
    updatePersonalState({
      ...personalState,
      completedIds: personalState.completedIds.filter((id) => id !== assignmentId),
    })
  }

  const handleToggleComplete = (assignmentId: string) => {
    const nextCompletedIds = personalState.completedIds.includes(assignmentId)
      ? personalState.completedIds.filter((id) => id !== assignmentId)
      : [...personalState.completedIds, assignmentId]

    updatePersonalState({
      ...personalState,
      completedIds: nextCompletedIds,
    })
  }

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      successToast('共有URLをコピーしました', 'このURLを送ると課題一覧を共有できます。')
    } catch {
      errorToast('コピーに失敗しました', 'ブラウザがクリップボードへの書き込みを許可していません。')
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: sharedState.title,
          text: '課題・提出物トラッカーを共有します。',
          url: shareUrl,
        })
        return
      } catch {
        return
      }
    }

    await handleCopyShareUrl()
  }

  const handleExportImage = async () => {
    if (!boardRef.current) {
      return
    }

    try {
      const canvas = await html2canvas(boardRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
      })
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = `homework-tracker-${new Date().toISOString().slice(0, 10)}.png`
      link.click()
      successToast('画像を保存しました', '今の課題一覧をPNGで保存しました。')
    } catch {
      errorToast('画像保存に失敗しました', '表示内容を画像化できませんでした。')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleReset = () => {
    if (!confirm('この端末の保存内容をすべて消去しますか？')) {
      return
    }

    const nextShared = createHomeworkTrackerState(sharedState.schoolType)
    const nextPersonal = createHomeworkTrackerPersonalState()
    clearHomeworkTrackerState()
    setSharedState(nextShared)
    setPersonalState(nextPersonal)
    successToast('リセットしました', '保存済みの課題を初期状態に戻しました。')
  }

  const handleChangeSchoolType = (schoolType: SchoolType) => {
    if (
      sharedState.assignments.length > 0 &&
      !confirm('学校種別を切り替えると課題一覧を初期化します。続けますか？')
    ) {
      return
    }

    const nextShared = createHomeworkTrackerState(schoolType)
    setSharedState(nextShared)
    setPersonalState(
      sanitizeHomeworkTrackerPersonalState(createHomeworkTrackerPersonalState(), nextShared)
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f3f6ff] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-violet-200/50 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-72 w-72 rounded-full bg-cyan-100/70 blur-3xl" />
      </div>
      <Header />

      <main className="relative mx-auto max-w-7xl px-4 pb-32 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.2),_transparent_32%),linear-gradient(135deg,#0f172a_0%,#1d4ed8_48%,#06b6d4_100%)] p-6 text-white shadow-[0_28px_80px_-32px_rgba(15,23,42,0.8)] sm:p-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
                課題・提出物トラッカー
              </h1>
              <p className="mt-4 text-sm leading-7 text-white/82 sm:text-base">
                今日やるものと、今週の締切をひとつの画面で整理します。完了状態はこの端末だけに残し、一覧はURLで共有できます。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddAssignment}
                  className="inline-flex items-center justify-center gap-2 rounded-[1.4rem] bg-white px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                  課題を追加
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-white/20 bg-white/10 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  <Share2 className="h-4 w-4" />
                  共有
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <select
                value={sharedState.schoolType}
                onChange={(event) => handleChangeSchoolType(event.target.value as SchoolType)}
                className="w-full rounded-[1.4rem] border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none"
              >
                {Object.entries(SCHOOL_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="text-slate-900">
                    {label}
                  </option>
                ))}
              </select>

              <input
                value={sharedState.title}
                onChange={(event) =>
                  updateSharedState({
                    ...sharedState,
                    title: event.target.value,
                  })
                }
                className="w-full rounded-[1.4rem] border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/50"
              />
            </div>
          </div>
        </section>

        {loadedFromSharedUrl && (
          <section className="mt-5 rounded-[1.5rem] border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-800 backdrop-blur">
            共有URLから読み込みました。完了状態や表示条件はこの端末にだけ保存されます。
          </section>
        )}

        <div ref={boardRef} className="mt-6 space-y-6">
          <div className="space-y-6">
            <SummaryCards
              todayCount={summary.today}
              weekCount={summary.week}
              overdueCount={summary.overdue}
            />

            <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/88 p-4 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.28)] backdrop-blur sm:p-6">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['today', '今日'],
                    ['week', '7日以内'],
                    ['all', 'すべて'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      updatePersonalState({
                        ...personalState,
                        tab: value,
                      })
                    }
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      personalState.tab === value
                        ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/15'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
                <input
                  value={personalState.query}
                  onChange={(event) =>
                    updatePersonalState({
                      ...personalState,
                      query: event.target.value,
                    })
                  }
                  placeholder="検索"
                  className="w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-accent focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent"
                >
                  <Filter className="h-4 w-4" />
                  絞り込み
                </button>
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent"
                >
                  <Share2 className="h-4 w-4" />
                  共有
                </button>
              </div>

              {subjectSnapshots.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {subjectSnapshots.map((subject) => (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() =>
                        updatePersonalState({
                          ...personalState,
                          subjectId: personalState.subjectId === subject.id ? 'all' : subject.id,
                        })
                      }
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                        personalState.subjectId === subject.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: subject.color }}
                      />
                      <span>{subject.name}</span>
                      <span
                        className={
                          personalState.subjectId === subject.id
                            ? 'text-white/75'
                            : 'text-slate-400'
                        }
                      >
                        {subject.pending}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <AssignmentList
                items={pendingItems}
                emptyMessage="条件に合う未完了の課題はありません。"
                onToggleComplete={handleToggleComplete}
                onEdit={(assignmentId) =>
                  setEditorAssignment(
                    sharedState.assignments.find((assignment) => assignment.id === assignmentId) ??
                      null
                  )
                }
                onDelete={handleDeleteAssignment}
              />

              {personalState.showCompleted && (
                <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/88 p-4 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.28)] backdrop-blur sm:p-6">
                  <h2 className="text-xl font-semibold text-slate-950">完了済み</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    提出済みのものはここにまとめて残します。
                  </p>
                  <div className="mt-4">
                    <AssignmentList
                      items={completedItems}
                      emptyMessage="完了済みの課題はありません。"
                      onToggleComplete={handleToggleComplete}
                      onEdit={(assignmentId) =>
                        setEditorAssignment(
                          sharedState.assignments.find(
                            (assignment) => assignment.id === assignmentId
                          ) ?? null
                        )
                      }
                      onDelete={handleDeleteAssignment}
                    />
                  </div>
                </section>
              )}
            </section>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" />
            この端末の保存を消去
          </button>
        </div>

        <div className="no-print fixed inset-x-4 bottom-4 z-40 sm:hidden">
          <div className="grid grid-cols-4 gap-2 rounded-[1.75rem] border border-white/70 bg-slate-950/92 p-2 shadow-2xl backdrop-blur">
            <button
              type="button"
              onClick={handleAddAssignment}
              className="rounded-2xl px-2 py-3 text-xs font-semibold text-white"
            >
              追加
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="rounded-2xl px-2 py-3 text-xs font-semibold text-white/75"
            >
              絞込
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="rounded-2xl px-2 py-3 text-xs font-semibold text-white/75"
            >
              共有
            </button>
            <button
              type="button"
              onClick={handleCopyShareUrl}
              className="rounded-2xl bg-white px-2 py-3 text-xs font-semibold text-slate-950"
            >
              <span className="flex items-center justify-center gap-1">
                <Copy className="h-3.5 w-3.5" />
                URL
              </span>
            </button>
          </div>
        </div>
      </main>

      <AssignmentEditorSheet
        open={Boolean(editorAssignment)}
        assignment={editorAssignment}
        subjects={sharedState.subjects}
        onClose={() => setEditorAssignment(null)}
        onSave={handleSaveAssignment}
      />

      <FiltersPanel
        open={filtersOpen}
        personalState={personalState}
        subjects={sharedState.subjects}
        onClose={() => setFiltersOpen(false)}
        onChange={updatePersonalState}
      />

      <SharePanel
        open={shareOpen}
        shareUrl={shareUrl}
        qrCodeDataUrl={qrCodeDataUrl}
        urlLength={shareUrl.length}
        onClose={() => setShareOpen(false)}
        onCopy={handleCopyShareUrl}
        onNativeShare={handleNativeShare}
        onExportImage={handleExportImage}
        onPrint={handlePrint}
      />

      <AdUnit slot="toolContent" className="mb-8" />

      <Footer />

      <style jsx global>{`
        @media print {
          header,
          footer,
          .no-print,
          dialog {
            display: none !important;
          }

          body {
            background: white !important;
          }

          main {
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
