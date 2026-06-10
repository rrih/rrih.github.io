import TagPage, { generateMetadata as generateBaseMetadata } from '@/app/blog/tag/[tag]/page'
import { getAllBlogPosts } from '@/lib/blog'
import { type Locale, isLocale, localizeMetadata } from '@/lib/i18n'
import type { Metadata } from 'next'

export const dynamicParams = false

export async function generateStaticParams() {
  const allPosts = await getAllBlogPosts()
  const allTags = new Set<string>()

  for (const post of allPosts) {
    for (const tag of post.tags) {
      allTags.add(encodeURIComponent(tag))
    }
  }

  return Array.from(allTags).map((tag) => ({ tag }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; tag: string }>
}): Promise<Metadata> {
  const { locale, tag } = await params
  const resolvedLocale: Locale = isLocale(locale) ? locale : 'ja'
  const baseMetadata = await generateBaseMetadata({
    params: Promise.resolve({ tag }),
  })

  return localizeMetadata(baseMetadata, resolvedLocale, `/blog/tag/${tag}`)
}

export default async function LocalizedTagPage({
  params,
}: {
  params: Promise<{ tag: string }>
}) {
  const { tag } = await params

  return <TagPage params={Promise.resolve({ tag })} />
}
