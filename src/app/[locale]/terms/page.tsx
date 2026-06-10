import TermsPage from '@/app/terms/page'
import { createMetadata, termsPageMetadata } from '@/config/metadata'
import { type Locale, isLocale, localizeMetadata } from '@/lib/i18n'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const resolvedLocale: Locale = isLocale(locale) ? locale : 'ja'

  return localizeMetadata(createMetadata(termsPageMetadata), resolvedLocale, '/terms')
}

export default function LocalizedTermsPage() {
  return <TermsPage />
}
