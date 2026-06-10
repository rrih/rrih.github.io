import PrivacyPage from '@/app/privacy/page'
import { createMetadata, privacyPageMetadata } from '@/config/metadata'
import { type Locale, isLocale, localizeMetadata } from '@/lib/i18n'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const resolvedLocale: Locale = isLocale(locale) ? locale : 'ja'

  return localizeMetadata(createMetadata(privacyPageMetadata), resolvedLocale, '/privacy')
}

export default function LocalizedPrivacyPage() {
  return <PrivacyPage />
}
