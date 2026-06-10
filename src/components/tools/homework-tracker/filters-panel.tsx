'use client'

import { BottomSheet } from '@/components/tools/timetable/bottom-sheet'
import type {
  AssignmentType,
  HomeworkSubject,
  HomeworkTrackerPersonalState,
} from '@/lib/homework-tracker/types'
import { ASSIGNMENT_TYPE_LABELS } from '@/lib/homework-tracker/types'

interface FiltersPanelProps {
  open: boolean
  personalState: HomeworkTrackerPersonalState
  subjects: HomeworkSubject[]
  onClose: () => void
  onChange: (next: HomeworkTrackerPersonalState) => void
}

export function FiltersPanel({
  open,
  personalState,
  subjects,
  onClose,
  onChange,
}: FiltersPanelProps) {
  const update = <K extends keyof HomeworkTrackerPersonalState>(
    key: K,
    value: HomeworkTrackerPersonalState[K]
  ) => {
    onChange({
      ...personalState,
      [key]: value,
    })
  }

  return (
    <BottomSheet
      open={open}
      title="表示条件"
      subtitle="見たい課題だけに絞り込みます。"
      onClose={onClose}
    >
      <div className="space-y-4 pb-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">キーワード検索</span>
          <input
            value={personalState.query}
            onChange={(event) => update('query', event.target.value)}
            placeholder="タイトル・メモ・先生名で検索"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">科目</span>
            <select
              value={personalState.subjectId}
              onChange={(event) => update('subjectId', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            >
              <option value="all">すべての科目</option>
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
              value={personalState.type}
              onChange={(event) => update('type', event.target.value as AssignmentType | 'all')}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            >
              <option value="all">すべての種別</option>
              {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={personalState.showCompleted}
            onChange={(event) => update('showCompleted', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          完了済みも表示する
        </label>

        <button
          type="button"
          onClick={() =>
            onChange({
              ...personalState,
              query: '',
              subjectId: 'all',
              type: 'all',
              showCompleted: false,
            })
          }
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent"
        >
          絞り込みをリセット
        </button>
      </div>
    </BottomSheet>
  )
}
