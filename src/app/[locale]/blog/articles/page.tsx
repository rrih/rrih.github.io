import ArticlesPage, { metadata as baseMetadata } from '@/app/blog/articles/page'
import { type Locale, isLocale, localizeMetadata } from '@/lib/i18n'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const resolvedLocale: Locale = isLocale(locale) ? locale : 'ja'

  return localizeMetadata(baseMetadata, resolvedLocale, '/blog/articles')
}

export default function LocalizedArticlesPage() {
  return <ArticlesPage />
}
