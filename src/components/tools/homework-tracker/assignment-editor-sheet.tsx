'use client'

import { BottomSheet } from '@/components/tools/timetable/bottom-sheet'
import type {
  AssignmentType,
  HomeworkAssignment,
  HomeworkSubject,
} from '@/lib/homework-tracker/types'
import { ASSIGNMENT_TYPE_LABELS, IMPORTANCE_LABELS } from '@/lib/homework-tracker/types'
import { useEffect, useState } from 'react'

interface AssignmentEditorSheetProps {
  open: boolean
  assignment: HomeworkAssignment | null
  subjects: HomeworkSubject[]
  onClose: () => void
  onSave: (assignment: HomeworkAssignment) => void
}

export function AssignmentEditorSheet({
  open,
  assignment,
  subjects,
  onClose,
  onSave,
}: AssignmentEditorSheetProps) {
  const [draft, setDraft] = useState<HomeworkAssignment | null>(assignment)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    setDraft(assignment)
    setShowDetails(
      Boolean(assignment?.note || assignment?.room || assignment?.teacher || assignment?.link)
    )
  }, [assignment])

  if (!draft) {
    return null
  }

  const updateField = <K extends keyof HomeworkAssignment>(
    key: K,
    value: HomeworkAssignment[K]
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  }

  const handleSave = () => {
    if (!draft.title.trim()) {
      return
    }

    onSave({
      ...draft,
      title: draft.title.trim(),
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <BottomSheet
      open={open}
      title={assignment?.title ? '課題を編集' : '課題を追加'}
      subtitle="まずはタイトル・科目・締切だけで登録できます。"
      onClose={onClose}
    >
      <div className="space-y-4 pb-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">タイトル *</span>
          <input
            value={draft.title}
            onChange={(event) => updateField('title', event.target.value)}
            placeholder="英語ワーク 12ページまで"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">科目</span>
            <select
              value={draft.subjectId}
              onChange={(event) => updateField('subjectId', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">種別</span>
            <select
              value={draft.type}
              onChange={(event) => updateField('type', event.target.value as AssignmentType)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            >
              {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">締切日</span>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => updateField('dueDate', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">締切時刻</span>
            <input
              type="time"
              value={draft.dueTime}
              onChange={(event) => updateField('dueTime', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((current) => !current)}
          className="text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          {showDetails ? '詳細を閉じる' : '詳細を開く'}
        </button>

        {showDetails && (
          <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">先生</span>
                <input
                  value={draft.teacher}
                  onChange={(event) => updateField('teacher', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">教室</span>
                <input
                  value={draft.room}
                  onChange={(event) => updateField('room', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">リンク</span>
              <input
                value={draft.link}
                onChange={(event) => updateField('link', event.target.value)}
                placeholder="Google Classroom や提出フォームのURL"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">メモ</span>
              <textarea
                value={draft.note}
                onChange={(event) => updateField('note', event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">重要度</span>
              <select
                value={draft.importance}
                onChange={(event) =>
                  updateField('importance', Number(event.target.value) as 1 | 2 | 3)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
              >
                {Object.entries(IMPORTANCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!draft.title.trim()}
          className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          保存する
        </button>
      </div>
    </BottomSheet>
  )
}
