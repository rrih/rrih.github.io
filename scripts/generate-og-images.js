import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage, registerFont } from 'canvas'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Tool configurations
const tools = [
  {
    id: 'json-formatter',
    title: 'JSON Formatter',
    description: 'Format, validate, and beautify JSON data with syntax highlighting',
    category: 'developer',
    icon: 'JSON',
  },
  {
    id: 'base64',
    title: 'Base64 Encoder/Decoder',
    description: 'Encode and decode Base64 strings quickly and securely',
    category: 'converter',
    icon: 'B64',
  },
  {
    id: 'color-picker',
    title: 'Color Picker & Converter',
    description: 'Convert between color formats: HEX, RGB, HSL, and more',
    category: 'design',
    icon: 'HEX',
  },
  {
    id: 'markdown-editor',
    title: 'Markdown Editor',
    description: 'Write and preview Markdown with live rendering and export options',
    category: 'utility',
    icon: 'MD',
  },
  {
    id: 'qr-generator',
    title: 'QR Code Generator',
    description: 'Generate QR codes for URLs, text, WiFi, and more with customization',
    category: 'utility',
    icon: 'QR',
  },
  {
    id: 'uuid-generator',
    title: 'UUID Generator',
    description: 'Generate UUID/GUID v1, v4, and other versions for development',
    category: 'developer',
    icon: 'UUID',
  },
  {
    id: 'password-generator',
    title: 'Password Generator',
    description: 'Generate strong, secure passwords with customizable options',
    category: 'utility',
    icon: 'PWD',
  },
  {
    id: 'image-converter',
    title: 'Image Converter',
    description: 'Convert images to WebP, AVIF and other formats with compression',
    category: 'converter',
    icon: 'IMG',
  },
  {
    id: 'gradient-generator',
    title: 'CSS Gradient Generator',
    description: 'Create beautiful CSS gradients with live preview and customization',
    category: 'design',
    icon: 'CSS',
  },
  {
    id: 'box-shadow-generator',
    title: 'Box Shadow Generator',
    description: 'Generate CSS box shadows with multiple layers and live preview',
    category: 'design',
    icon: 'BOX',
  },
  {
    id: 'animation-generator',
    title: 'CSS Animation Generator',
    description: 'Create smooth CSS animations with custom keyframes and timing',
    category: 'design',
    icon: 'ANIM',
  },
]

const categoryColors = {
  developer: '#0066cc',
  design: '#8b5cf6',
  utility: '#10b981',
  converter: '#f59e0b',
}

async function generateOGImage(tool, outputPath) {
  const width = 1200
  const height = 630
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(1, '#f8fafc')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Category color accent bar
  const categoryColor = categoryColors[tool.category] || '#0066cc'
  ctx.fillStyle = categoryColor
  ctx.fillRect(0, 0, 12, height)

  // Brand name - increased size
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 48px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('ToolForge', 50, 80)

  // Tool icon - much larger and more visible
  ctx.fillStyle = categoryColor
  ctx.font = 'bold 180px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'

  // Icon background circle for better visibility
  const iconX = width - 200
  const iconY = height / 2
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.beginPath()
  ctx.arc(iconX, iconY, 120, 0, 2 * Math.PI)
  ctx.fill()

  // Draw icon text
  ctx.fillStyle = categoryColor
  ctx.fillText(tool.icon, iconX, iconY + 30)

  // Tool title - much larger
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 96px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'

  // Handle long titles with line breaks
  const titleWords = tool.title.split(' ')
  let titleY = 220
  let titleLine = ''
  const titleMaxWidth = 650

  for (const word of titleWords) {
    const testLine = `${titleLine + word} `
    const metrics = ctx.measureText(testLine)

    if (metrics.width > titleMaxWidth && titleLine !== '') {
      ctx.fillText(titleLine.trim(), 50, titleY)
      titleLine = `${word} `
      titleY += 100
    } else {
      titleLine = testLine
    }
  }
  ctx.fillText(titleLine.trim(), 50, titleY)

  // Tool description - larger and more readable
  ctx.fillStyle = '#64748b'
  ctx.font = '42px system-ui, -apple-system, sans-serif'

  // Word wrap for description
  const words = tool.description.split(' ')
  let line = ''
  let y = titleY + 80
  const maxWidth = 650

  for (const word of words) {
    const testLine = `${line + word} `
    const metrics = ctx.measureText(testLine)

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, 50, y)
      line = `${word} `
      y += 50
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, 50, y)

  // Category badge - larger
  ctx.fillStyle = categoryColor
  ctx.roundRect(50, height - 120, 220, 60, 30)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(tool.category.charAt(0).toUpperCase() + tool.category.slice(1), 160, height - 85)

  // Save image
  const buffer = canvas.toBuffer('image/png')
  await fs.writeFile(outputPath, buffer)
  console.log(`Generated OG image: ${outputPath}`)
}

async function generateHomeOGImage(outputPath) {
  const width = 1200
  const height = 630
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#0066cc')
  gradient.addColorStop(1, '#3b82f6')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Brand name
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 96px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('ToolForge', width / 2, 250)

  // Tagline
  ctx.fillStyle = '#e2e8f0'
  ctx.font = '36px system-ui, -apple-system, sans-serif'
  ctx.fillText('Craft. Share. Create.', width / 2, 320)

  // Description
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '24px system-ui, -apple-system, sans-serif'
  ctx.fillText('Privacy-first web tools with instant URL sharing', width / 2, 380)

  // URL
  ctx.fillStyle = '#94a3b8'
  ctx.font = '20px system-ui, -apple-system, sans-serif'
  ctx.fillText('rrih.github.io', width / 2, 450)

  // Save image
  const buffer = canvas.toBuffer('image/png')
  await fs.writeFile(outputPath, buffer)
  console.log(`Generated home OG image: ${outputPath}`)
}

async function main() {
  try {
    const publicDir = path.join(__dirname, '../public')
    const ogDir = path.join(publicDir, 'og')

    // Create og directory if it doesn't exist
    await fs.mkdir(ogDir, { recursive: true })

    // Generate home page OG image
    await generateHomeOGImage(path.join(ogDir, 'home.png'))

    // Generate tool OG images
    for (const tool of tools) {
      await generateOGImage(tool, path.join(ogDir, `${tool.id}.png`))
    }

    console.log('All OG images generated successfully!')
  } catch (error) {
    console.error('Error generating OG images:', error)
    process.exit(1)
  }
}

main()
