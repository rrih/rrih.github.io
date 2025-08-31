#!/usr/bin/env bun

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { siteConfig } from '../src/config/site'
import { tools } from '../src/config/tools'
import { getBlogSitemapEntries } from '../src/lib/blog'

interface SitemapEntry {
  url: string
  lastmod: string
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

const generateSitemap = async () => {
  const baseUrl = siteConfig.url
  const currentDate = new Date().toISOString().split('T')[0]

  // Define all pages with their priorities and change frequencies
  const pages: SitemapEntry[] = [
    // Main pages - highest priority
    {
      url: baseUrl,
      lastmod: currentDate,
      changefreq: 'weekly',
      priority: 1.0,
    },
    // Blog main page
    {
      url: `${baseUrl}/blog`,
      lastmod: currentDate,
      changefreq: 'weekly',
      priority: 0.9,
    },
    // About, Privacy, Terms pages
    {
      url: `${baseUrl}/about`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: 0.7,
    },
  ]

  // Add all tool pages
  for (const tool of tools) {
    if (tool.status === 'available') {
      pages.push({
        url: `${baseUrl}${tool.href}`,
        lastmod: currentDate,
        changefreq: 'weekly',
        priority: tool.featured ? 0.9 : 0.8,
      })
    }
  }

  // Add blog posts
  try {
    const blogEntries = await getBlogSitemapEntries()
    pages.push(
      ...blogEntries.map((entry) => ({
        url: entry.url,
        lastmod: entry.lastModified,
        changefreq: entry.changeFrequency,
        priority: entry.priority,
      }))
    )
  } catch (error) {
    console.warn('Could not load blog entries for sitemap:', error)
  }

  // Generate XML content
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${pages
  .map(
    (page) => `  <url>
    <loc>${page.url}/</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

  // Write sitemap to public directory
  const sitemapPath = join(process.cwd(), 'public', 'sitemap.xml')
  writeFileSync(sitemapPath, xmlContent, 'utf-8')

  console.log('✅ Sitemap generated successfully at public/sitemap.xml')
  console.log(`📊 Total URLs: ${pages.length}`)
  console.log('   - Main pages: 4')
  console.log(`   - Tool pages: ${pages.length - 4}`)
}

// Run the generator
try {
  await generateSitemap()
} catch (error) {
  console.error('❌ Error generating sitemap:', error)
  process.exit(1)
}
