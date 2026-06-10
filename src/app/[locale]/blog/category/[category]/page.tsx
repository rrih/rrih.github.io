import CategoryPage, {
  generateMetadata as generateBaseMetadata,
} from '@/app/blog/category/[category]/page'
import { type Locale, isLocale, localizeMetadata } from '@/lib/i18n'
import type { Metadata } from 'next'

const categories = ['tutorials', 'guides', 'insights', 'tools'] as const

export const dynamicParams = false

export function generateStaticParams() {
  return categories.map((category) => ({ category }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>
}): Promise<Metadata> {
  const { locale, category } = await params
  const resolvedLocale: Locale = isLocale(locale) ? locale : 'ja'
  const baseMetadata = await generateBaseMetadata({
    params: Promise.resolve({ category }),
  })

  return localizeMetadata(baseMetadata, resolvedLocale, `/blog/category/${category}`)
}

export default async function LocalizedCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params

  return <CategoryPage params={Promise.resolve({ category })} />
}
