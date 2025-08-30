import type { Metadata } from 'next'
import { siteConfig } from './site'
import { tools } from './tools'

export interface PageMetadata {
  title: string
  description: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  keywords?: string[]
  url?: string
}

export interface ToolMetadata extends PageMetadata {
  toolId: string
  category: string
  icon: string
}

// Generate OGP metadata for homepage
export const homePageMetadata: PageMetadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  ogTitle: `${siteConfig.name} - ${siteConfig.tagline}`,
  ogDescription:
    'Privacy-first web tools with instant URL sharing. Beautiful UI/UX design meets client-side processing.',
  ogImage: '/og/homepage.png',
  keywords: siteConfig.keywords,
  url: siteConfig.url,
}

// Generate OGP metadata for About page
export const aboutPageMetadata: PageMetadata = {
  title: `About - ${siteConfig.name}`,
  description: `Learn more about ${siteConfig.name} - privacy-first web tools with beautiful design and instant sharing capabilities.`,
  ogTitle: `About ${siteConfig.name}`,
  ogDescription:
    'Discover the story behind privacy-first web tools designed for developers and creators.',
  ogImage: '/og/about.png',
  keywords: ['about', 'privacy-first tools', 'developer tools', 'web tools'],
  url: `${siteConfig.url}/about`,
}

// Generate OGP metadata for tool pages
export const generateToolMetadata = (toolId: string): ToolMetadata => {
  const tool = tools.find((t) => t.id === toolId)

  if (!tool) {
    throw new Error(`Tool with id "${toolId}" not found`)
  }

  return {
    toolId: tool.id,
    title: `${tool.title} - ${siteConfig.name}`,
    description: `${tool.description} | Privacy-first ${tool.title.toLowerCase()} with instant URL sharing and beautiful UI design.`,
    ogTitle: tool.title,
    ogDescription: `${tool.description} | Client-side processing, no tracking, instant sharing.`,
    ogImage: `/og/tools/${tool.id}.png`,
    category: tool.category,
    icon: tool.id,
    keywords: [
      tool.title.toLowerCase(),
      tool.category,
      'privacy-first',
      'client-side',
      'url sharing',
      'web tool',
      'browser tool',
      ...siteConfig.keywords.filter(
        (k) =>
          k.toLowerCase().includes(tool.title.toLowerCase()) ||
          k.toLowerCase().includes(tool.category)
      ),
    ],
    url: `${siteConfig.url}${tool.href}`,
  }
}

// Generate Next.js Metadata object
export const createMetadata = (pageMetadata: PageMetadata): Metadata => {
  return {
    title: pageMetadata.title,
    description: pageMetadata.description,
    keywords: pageMetadata.keywords,
    authors: [{ name: siteConfig.author.name }],
    creator: siteConfig.author.name,
    metadataBase: new URL(siteConfig.url),
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: pageMetadata.url || siteConfig.url,
      title: pageMetadata.ogTitle || pageMetadata.title,
      description: pageMetadata.ogDescription || pageMetadata.description,
      siteName: siteConfig.name,
      images: [
        {
          url: pageMetadata.ogImage || '/og/homepage.png',
          width: 1200,
          height: 630,
          alt: pageMetadata.ogTitle || pageMetadata.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageMetadata.ogTitle || pageMetadata.title,
      description: pageMetadata.ogDescription || pageMetadata.description,
      images: [pageMetadata.ogImage || '/og/homepage.png'],
      creator: `@${siteConfig.author.name}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

// Export all available tool metadata
export const toolsMetadata = tools.reduce(
  (acc, tool) => {
    acc[tool.id] = generateToolMetadata(tool.id)
    return acc
  },
  {} as Record<string, ToolMetadata>
)
