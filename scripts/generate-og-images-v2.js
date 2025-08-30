import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from 'canvas'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Modern color gradients for each category
const categoryGradients = {
  developer: {
    colors: ['#667eea', '#764ba2'],
    accent: '#8b5cf6',
  },
  design: {
    colors: ['#f093fb', '#f5576c'],
    accent: '#ec4899',
  },
  utility: {
    colors: ['#4facfe', '#00f2fe'],
    accent: '#06b6d4',
  },
  converter: {
    colors: ['#fa709a', '#fee140'],
    accent: '#f59e0b',
  },
  default: {
    colors: ['#667eea', '#764ba2'],
    accent: '#8b5cf6',
  },
}

// Tool configurations with better icons
const tools = [
  {
    id: 'json-formatter',
    title: 'JSON Formatter',
    subtitle: 'Format & Validate',
    description: 'Beautiful JSON formatting with syntax highlighting',
    category: 'developer',
    icon: '{ }',
  },
  {
    id: 'base64',
    title: 'Base64',
    subtitle: 'Encode & Decode',
    description: 'Fast and secure Base64 encoding/decoding',
    category: 'converter',
    icon: 'B64',
  },
  {
    id: 'color-picker',
    title: 'Color Picker',
    subtitle: 'HEX, RGB, HSL',
    description: 'Professional color format converter',
    category: 'design',
    icon: '#',
  },
  {
    id: 'markdown-editor',
    title: 'Markdown Editor',
    subtitle: 'Live Preview',
    description: 'Write Markdown with real-time rendering',
    category: 'utility',
    icon: 'MD',
  },
  {
    id: 'qr-generator',
    title: 'QR Generator',
    subtitle: 'Custom QR Codes',
    description: 'Generate QR codes for any content',
    category: 'utility',
    icon: 'QR',
  },
  {
    id: 'uuid-generator',
    title: 'UUID Generator',
    subtitle: 'v1, v4, v5',
    description: 'Generate unique identifiers instantly',
    category: 'developer',
    icon: 'ID',
  },
  {
    id: 'password-generator',
    title: 'Password Generator',
    subtitle: 'Secure & Strong',
    description: 'Create unbreakable passwords',
    category: 'utility',
    icon: '***',
  },
  {
    id: 'image-converter',
    title: 'Image Converter',
    subtitle: 'WebP, AVIF, PNG',
    description: 'Modern image format conversion',
    category: 'converter',
    icon: 'IMG',
  },
  {
    id: 'gradient-generator',
    title: 'CSS Gradients',
    subtitle: 'Beautiful Colors',
    description: 'Create stunning CSS gradients',
    category: 'design',
    icon: '▥',
  },
  {
    id: 'box-shadow-generator',
    title: 'Box Shadows',
    subtitle: 'CSS Effects',
    description: 'Design perfect box shadows',
    category: 'design',
    icon: '▦',
  },
  {
    id: 'animation-generator',
    title: 'CSS Animations',
    subtitle: 'Keyframes & Timing',
    description: 'Create smooth animations easily',
    category: 'design',
    icon: '◉',
  },
]

async function generateModernOGImage(tool, outputPath) {
  const width = 1200
  const height = 630
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Get gradient for category
  const gradient = categoryGradients[tool.category] || categoryGradients.default

  // Create gradient background
  const bgGradient = ctx.createLinearGradient(0, 0, width, height)
  bgGradient.addColorStop(0, gradient.colors[0])
  bgGradient.addColorStop(1, gradient.colors[1])
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  // Add subtle pattern overlay
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
  for (let i = 0; i < width; i += 40) {
    for (let j = 0; j < height; j += 40) {
      if ((i + j) % 80 === 0) {
        ctx.fillRect(i, j, 20, 20)
      }
    }
  }

  // White content card
  const cardX = 60
  const cardY = 60
  const cardWidth = width - 120
  const cardHeight = height - 120
  const borderRadius = 24

  // Draw card with rounded corners
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, borderRadius)
  ctx.fill()

  // Add subtle shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 20
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // Icon badge in top left
  const badgeSize = 100
  const badgeX = cardX + 60
  const badgeY = cardY + 60

  // Icon background with gradient
  const iconGradient = ctx.createLinearGradient(
    badgeX,
    badgeY,
    badgeX + badgeSize,
    badgeY + badgeSize
  )
  iconGradient.addColorStop(0, gradient.colors[0])
  iconGradient.addColorStop(1, gradient.colors[1])
  ctx.fillStyle = iconGradient
  ctx.beginPath()
  ctx.roundRect(badgeX, badgeY, badgeSize, badgeSize, 20)
  ctx.fill()

  // Icon text
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(tool.icon, badgeX + badgeSize / 2, badgeY + badgeSize / 2)

  // Main title
  ctx.fillStyle = '#1a1a1a'
  ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(tool.title, badgeX + badgeSize + 40, badgeY)

  // Subtitle
  ctx.fillStyle = gradient.accent
  ctx.font = '36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(tool.subtitle, badgeX + badgeSize + 40, badgeY + 80)

  // Description
  ctx.fillStyle = '#6b7280'
  ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const descY = cardY + 260

  // Word wrap for description
  const maxWidth = cardWidth - 240
  const words = tool.description.split(' ')
  let line = ''
  let y = descY

  for (const word of words) {
    const testLine = `${line}${word} `
    const metrics = ctx.measureText(testLine)

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), cardX + 60, y)
      line = `${word} `
      y += 45
    } else {
      line = testLine
    }
  }
  ctx.fillText(line.trim(), cardX + 60, y)

  // Brand footer
  ctx.fillStyle = '#9ca3af'
  ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('ToolForge', cardX + 60, cardY + cardHeight - 80)

  // Category pill
  const categoryText = tool.category.charAt(0).toUpperCase() + tool.category.slice(1)
  const pillPadding = 20
  const metrics = ctx.measureText(categoryText)
  const pillWidth = metrics.width + pillPadding * 2
  const pillHeight = 40
  const pillX = cardX + cardWidth - 60 - pillWidth
  const pillY = cardY + cardHeight - 100

  ctx.fillStyle = gradient.accent
  ctx.beginPath()
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 20)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(categoryText, pillX + pillWidth / 2, pillY + pillHeight / 2 + 7)

  // Decorative elements
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 8])

  // Top right decoration
  ctx.beginPath()
  ctx.arc(width - 100, 100, 30, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(width - 100, 100, 50, 0, Math.PI * 2)
  ctx.stroke()

  // Bottom left decoration
  ctx.beginPath()
  ctx.arc(100, height - 100, 30, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(100, height - 100, 50, 0, Math.PI * 2)
  ctx.stroke()

  // Save image
  const buffer = canvas.toBuffer('image/png')
  await fs.writeFile(outputPath, buffer)
  console.log(`✨ Generated modern OG image: ${outputPath}`)
}

async function generateHomeOGImage(outputPath) {
  const width = 1200
  const height = 630
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Beautiful gradient background
  const bgGradient = ctx.createLinearGradient(0, 0, width, height)
  bgGradient.addColorStop(0, '#667eea')
  bgGradient.addColorStop(0.5, '#764ba2')
  bgGradient.addColorStop(1, '#f093fb')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  // Geometric pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 2
  for (let i = 0; i < width; i += 60) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + height, height)
    ctx.stroke()
  }

  // Central white card
  const cardWidth = 800
  const cardHeight = 400
  const cardX = (width - cardWidth) / 2
  const cardY = (height - cardHeight) / 2

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 30)
  ctx.fill()

  // Logo/Brand
  ctx.fillStyle = '#1a1a1a'
  ctx.font = 'bold 96px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ToolForge', width / 2, cardY + 120)

  // Tagline
  ctx.fillStyle = '#8b5cf6'
  ctx.font = '42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('Craft. Share. Create.', width / 2, cardY + 200)

  // Description
  ctx.fillStyle = '#6b7280'
  ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('Privacy-first web tools with instant sharing', width / 2, cardY + 260)

  // URL
  ctx.fillStyle = '#9ca3af'
  ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('rrih.github.io', width / 2, cardY + 320)

  // Decorative circles
  const circles = [
    { x: 150, y: 150, r: 80 },
    { x: width - 150, y: 150, r: 60 },
    { x: 150, y: height - 150, r: 60 },
    { x: width - 150, y: height - 150, r: 80 },
  ]

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 3
  circles.forEach((circle) => {
    ctx.beginPath()
    ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(circle.x, circle.y, circle.r - 20, 0, Math.PI * 2)
    ctx.stroke()
  })

  // Save image
  const buffer = canvas.toBuffer('image/png')
  await fs.writeFile(outputPath, buffer)
  console.log('✨ Generated modern home OG image:', outputPath)
}

async function main() {
  try {
    const publicDir = path.join(__dirname, '../public')
    const ogDir = path.join(publicDir, 'og')

    // Create og directory if it doesn't exist
    await fs.mkdir(ogDir, { recursive: true })

    console.log('🎨 Starting modern OG image generation...\n')

    // Generate home page OG image
    await generateHomeOGImage(path.join(ogDir, 'home.png'))

    // Generate tool OG images
    for (const tool of tools) {
      await generateModernOGImage(tool, path.join(ogDir, `${tool.id}.png`))
    }

    console.log('\n✅ All modern OG images generated successfully!')
  } catch (error) {
    console.error('❌ Error generating OG images:', error)
    process.exit(1)
  }
}

main()
