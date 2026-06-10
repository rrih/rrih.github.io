import AchievementTreePage from '@/app/app/achievement-tree/page'
import { type Locale, isLocale, localizeMetadata } from '@/lib/i18n'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const resolvedLocale: Locale = isLocale(locale) ? locale : 'ja'

  return localizeMetadata(
    {
      title: 'Achievement Tree',
      description: 'Visual planning space for goals and milestones.',
    },
    resolvedLocale,
    '/app/achievement-tree'
  )
}

export default function LocalizedAchievementTreePage() {
  return <AchievementTreePage />
}
