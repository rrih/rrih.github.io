#!/usr/bin/env bun

import fs from 'node:fs/promises'
import path from 'node:path'
import { createCanvas, loadImage } from 'canvas'
import { getAllBlogSlugs, getBlogPost } from '../src/lib/blog'

interface BlogOGConfig {
  slug: string
  title: string
  category: string
  readTime: string
}

async function generateBlogOGImage(config: BlogOGConfig): Promise<void> {
  const canvas = createCanvas(1200, 630)
  const ctx = canvas.getContext('2d')

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630)
  gradient.addColorStop(0, '#667eea')
  gradient.addColorStop(1, '#764ba2')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1200, 630)

  // Background pattern (subtle)
  ctx.globalAlpha = 0.1
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(i * 100 + 50, j * 105 + 50, 20, 20)
    }
  }
  ctx.globalAlpha = 1.0

  // White content area
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(60, 80, 1080, 470)

  // Category badge
  const categoryColors: { [key: string]: string } = {
    tutorials: '#3B82F6',
    guides: '#10B981',
    insights: '#8B5CF6',
    tools: '#F59E0B',
  }

  ctx.fillStyle = categoryColors[config.category] || '#6B7280'
  ctx.fillRect(80, 100, 200, 40)

  // Category text
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText(config.category.toUpperCase(), 180, 125)

  // Title
  ctx.fillStyle = '#1F2937'
  ctx.font = 'bold 48px system-ui'
  ctx.textAlign = 'left'

  // Word wrap for title
  const words = config.title.split(' ')
  const lines: string[] = []
  let currentLine = ''
  const maxWidth = 1000

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word
    const metrics = ctx.measureText(testLine)

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }

  // Limit to 3 lines
  const displayLines = lines.slice(0, 3)
  if (lines.length > 3) {
    displayLines[2] = `${displayLines[2].slice(0, -3)}...`
  }

  let titleY = 200
  for (const line of displayLines) {
    ctx.fillText(line, 80, titleY)
    titleY += 60
  }

  // Read time
  ctx.fillStyle = '#6B7280'
  ctx.font = '24px system-ui'
  ctx.fillText(config.readTime, 80, 480)

  // Poodware branding
  ctx.fillStyle = '#667eea'
  ctx.font = 'bold 32px system-ui'
  ctx.textAlign = 'right'
  ctx.fillText('Poodware', 1120, 520)

  ctx.fillStyle = '#9CA3AF'
  ctx.font = '20px system-ui'
  ctx.fillText('Web Solutions Hub', 1120, 480)

  // Save image
  const outputPath = path.join(process.cwd(), 'public/og', `blog-${config.slug}.png`)
  const buffer = canvas.toBuffer('image/png')
  await fs.writeFile(outputPath, buffer)

  console.log(`✅ Generated blog OG image: ${outputPath}`)
}

async function generateAllBlogOGImages(): Promise<void> {
  console.log('🎨 Starting blog OG image generation...\n')

  // Ensure output directory exists
  const ogDir = path.join(process.cwd(), 'public/og')
  try {
    await fs.access(ogDir)
  } catch {
    await fs.mkdir(ogDir, { recursive: true })
  }

  // Get all blog posts
  const slugs = await getAllBlogSlugs()

  let generated = 0
  let errors = 0

  for (const slug of slugs) {
    try {
      const post = await getBlogPost(slug)
      if (!post) {
        console.log(`❌ Could not load post: ${slug}`)
        errors++
        continue
      }

      const config: BlogOGConfig = {
        slug,
        title: post.title,
        category: post.category,
        readTime: post.readTime,
      }

      await generateBlogOGImage(config)
      generated++
    } catch (error) {
      console.error(`❌ Error generating OG image for ${slug}:`, error)
      errors++
    }
  }

  console.log('\n🎯 Blog OG image generation complete!')
  console.log(`✅ Generated: ${generated}`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`📊 Total processed: ${generated + errors}`)
}

// Run if called directly
if (import.meta.main) {
  generateAllBlogOGImages().catch(console.error)
}
