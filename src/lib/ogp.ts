import { siteConfig } from '@/config/site'
import { tools } from '@/config/tools'

export interface OGPImageOptions {
  title: string
  description: string
  icon?: string
  category?: string
  theme?: 'light' | 'dark'
}

export function generateOGPImageUrl(options: OGPImageOptions): string {
  const params = new URLSearchParams({
    title: options.title,
    description: options.description,
    ...(options.icon && { icon: options.icon }),
    ...(options.category && { category: options.category }),
    theme: options.theme || 'light',
  })

  return `${siteConfig.url}/api/og?${params.toString()}`
}

export function getToolOGPData(toolId: string) {
  const tool = tools.find((t) => t.id === toolId)
  if (!tool) {
    return {
      title: siteConfig.name,
      description: siteConfig.description,
      image: `${siteConfig.url}/icons/icon-512x512.png`,
    }
  }

  return {
    title: `${tool.title} | ${siteConfig.name}`,
    description: tool.description,
    image: generateOGPImageUrl({
      title: tool.title,
      description: tool.description,
      category: tool.category,
    }),
  }
}

export function getDefaultOGPData() {
  return {
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description: siteConfig.description,
    image: generateOGPImageUrl({
      title: siteConfig.name,
      description: siteConfig.tagline,
    }),
  }
}
