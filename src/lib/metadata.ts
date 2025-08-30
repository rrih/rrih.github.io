import { siteConfig } from '@/config/site'
import { tools } from '@/config/tools'
import type { Metadata } from 'next'

export function generateToolMetadata(toolId: string): Metadata {
  const tool = tools.find((t) => t.id === toolId)

  if (!tool) {
    return generateDefaultMetadata()
  }

  const title = `${tool.title} | ${siteConfig.name}`
  const description = tool.description
  const ogImage = `/og/${toolId}.png`
  const url = `${siteConfig.url}${tool.href}`

  return {
    title,
    description,
    keywords: [
      tool.title.toLowerCase(),
      tool.category,
      'web tool',
      'online tool',
      'free tool',
      ...siteConfig.keywords,
    ],
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url,
      title,
      description,
      siteName: siteConfig.name,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${tool.title} - ${description}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
      creator: `@${siteConfig.author.name}`,
    },
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export function generateDefaultMetadata(): Metadata {
  const title = `${siteConfig.name} | ${siteConfig.tagline}`
  const description = siteConfig.description
  const ogImage = '/og/home.png'

  return {
    title,
    description,
    keywords: siteConfig.keywords,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: siteConfig.url,
      title,
      description,
      siteName: siteConfig.name,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} - ${siteConfig.tagline}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
      creator: `@${siteConfig.author.name}`,
    },
    alternates: {
      canonical: siteConfig.url,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}
