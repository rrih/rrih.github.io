'use client'

interface SummaryCardsProps {
  todayCount: number
  weekCount: number
  overdueCount: number
}

const cards = [
  {
    key: 'today',
    title: '今日やること',
    tone: 'from-sky-500 via-blue-500 to-cyan-400',
  },
  {
    key: 'week',
    title: '7日以内',
    tone: 'from-violet-500 via-fuchsia-500 to-pink-400',
  },
  {
    key: 'overdue',
    title: '期限切れ',
    tone: 'from-rose-500 via-orange-500 to-amber-400',
  },
] as const

export function SummaryCards({ todayCount, weekCount, overdueCount }: SummaryCardsProps) {
  const values = {
    today: todayCount,
    week: weekCount,
    overdue: overdueCount,
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <section
          key={card.key}
          className={`relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br ${card.tone} p-5 text-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.6)]`}
        >
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-white/20 blur-2xl" />
          <p className="relative inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
            {card.title}
          </p>
          <p className="relative mt-4 text-4xl font-bold leading-none">{values[card.key]}</p>
        </section>
      ))}
    </div>
  )
}
