'use client'

import { URL_MAX_LENGTH } from '@/lib/timetable/constants'
import { cn } from '@/lib/utils'

interface UrlLengthDonutProps {
  usedLength: number
  compact?: boolean
}

export function UrlLengthDonut({ usedLength, compact = false }: UrlLengthDonutProps) {
  const safeUsed = Math.max(0, usedLength)
  const ratio = Math.min(1, safeUsed / URL_MAX_LENGTH)
  const circumference = 2 * Math.PI * 14
  const offset = circumference - circumference * ratio

  const level = ratio >= 0.95 ? 'danger' : ratio >= 0.85 ? 'warn' : 'safe'

  return (
    <div className={cn('group relative inline-flex items-center', compact ? 'gap-0' : 'gap-2')}>
      <div
        className={cn(
          'rounded-full border border-border-light bg-white dark:border-border-dark dark:bg-slate-950',
          compact ? 'h-8 w-8 p-1' : 'h-10 w-10 p-1.5'
        )}
      >
        <svg viewBox="0 0 36 36" className="h-full w-full" role="img" aria-label="URL長さ使用率">
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="rgba(148,163,184,0.25)"
            strokeWidth="4"
          />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke={level === 'danger' ? '#dc2626' : level === 'warn' ? '#d97706' : '#059669'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 18 18)"
          />
        </svg>
      </div>
      {!compact && (
        <span
          className={cn(
            'text-xs font-semibold',
            level === 'danger'
              ? 'text-red-600 dark:text-red-400'
              : level === 'warn'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {Math.round(ratio * 100)}%
        </span>
      )}

      <div
        className={cn(
          'pointer-events-none absolute z-20 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900',
          compact
            ? 'left-auto right-0 top-full mt-1 max-w-[min(88vw,18rem)] translate-x-0 break-words'
            : '-top-11 left-1/2 -translate-x-1/2'
        )}
      >
        URLパラメータ長さ {safeUsed}/{URL_MAX_LENGTH} 使用済み
      </div>
    </div>
  )
}
