import BlogPostPage, { generateMetadata as generateBaseMetadata } from '@/app/blog/[slug]/page'
import { getAllBlogSlugs } from '@/lib/blog'
import { type Locale, isLocale, localizeMetadata } from '@/lib/i18n'
import type { Metadata } from 'next'

export const dynamicParams = false

export async function generateStaticParams() {
  const slugs = await getAllBlogSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const resolvedLocale: Locale = isLocale(locale) ? locale : 'ja'
  const baseMetadata = await generateBaseMetadata({
    params: Promise.resolve({ slug }),
  })

  return localizeMetadata(baseMetadata, resolvedLocale, `/blog/${slug}`)
}

export default async function LocalizedBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return <BlogPostPage params={Promise.resolve({ slug })} />
}
