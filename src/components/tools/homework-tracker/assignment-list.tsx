'use client'

import type { AssignmentViewModel } from '@/lib/homework-tracker/types'
import { ASSIGNMENT_TYPE_LABELS, IMPORTANCE_LABELS } from '@/lib/homework-tracker/types'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Pencil, Trash2 } from 'lucide-react'

interface AssignmentListProps {
  items: AssignmentViewModel[]
  emptyMessage: string
  onToggleComplete: (assignmentId: string) => void
  onEdit: (assignmentId: string) => void
  onDelete: (assignmentId: string) => void
}

function getStatusChipClass(status: AssignmentViewModel['derivedStatus']) {
  switch (status) {
    case 'done':
      return 'bg-emerald-100 text-emerald-700'
    case 'overdue':
      return 'bg-rose-100 text-rose-700'
    case 'today':
      return 'bg-amber-100 text-amber-800'
    case 'week':
      return 'bg-sky-100 text-sky-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function getStatusLabel(status: AssignmentViewModel['derivedStatus']) {
  switch (status) {
    case 'done':
      return '完了'
    case 'overdue':
      return '期限切れ'
    case 'today':
      return '今日'
    case 'week':
      return '7日以内'
    default:
      return '予定'
  }
}

export function AssignmentList({
  items,
  emptyMessage,
  onToggleComplete,
  onEdit,
  onDelete,
}: AssignmentListProps) {
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500">
        {emptyMessage}
      </section>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.assignment.id}
          className={cn(
            'overflow-hidden rounded-[1.75rem] border bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)] transition',
            item.completed
              ? 'border-emerald-200 bg-emerald-50/60'
              : item.derivedStatus === 'overdue'
                ? 'border-rose-200'
                : 'border-slate-200'
          )}
          style={{
            boxShadow: item.completed ? '0 18px 45px -28px rgba(5, 150, 105, 0.25)' : undefined,
          }}
        >
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: item.subject?.color ?? '#CBD5E1' }}
          />
          <div className="flex items-start gap-3 p-4">
            <button
              type="button"
              onClick={() => onToggleComplete(item.assignment.id)}
              className="mt-0.5 rounded-full text-slate-400 transition hover:text-emerald-600"
              aria-label={item.completed ? '未完了に戻す' : '完了にする'}
            >
              {item.completed ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : (
                <Circle className="h-6 w-6" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {item.subject && (
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{
                      backgroundColor: `${item.subject.color}20`,
                      color: item.subject.color,
                    }}
                  >
                    {item.subject.name}
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {ASSIGNMENT_TYPE_LABELS[item.assignment.type]}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getStatusChipClass(item.derivedStatus)}`}
                >
                  {getStatusLabel(item.derivedStatus)}
                </span>
                {item.assignment.importance > 1 && (
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                    {IMPORTANCE_LABELS[item.assignment.importance]}
                  </span>
                )}
              </div>

              <h3
                className={cn(
                  'mt-3 text-lg font-semibold leading-tight text-slate-900',
                  item.completed && 'text-slate-500 line-through'
                )}
              >
                {item.assignment.title}
              </h3>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                <span>締切: {item.dueLabel}</span>
                {item.assignment.teacher && <span>担当: {item.assignment.teacher}</span>}
                {item.assignment.room && <span>場所: {item.assignment.room}</span>}
              </div>

              {(item.assignment.note || item.assignment.link) && (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {item.assignment.note || item.assignment.link}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit(item.assignment.id)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="編集"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.assignment.id)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-rose-100 hover:text-rose-700"
                aria-label="削除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
