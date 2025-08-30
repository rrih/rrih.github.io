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
    icon: '{ }',
  },
  {
    id: 'base64',
    title: 'Base64 Encoder/Decoder',
    description: 'Encode and decode Base64 strings quickly and securely',
    category: 'converter',
    icon: '64',
  },
  {
    id: 'color-picker',
    title: 'Color Picker & Converter',
    description: 'Convert between color formats: HEX, RGB, HSL, and more',
    category: 'design',
    icon: '🎨',
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
    icon: '⬜',
  },
  {
    id: 'uuid-generator',
    title: 'UUID Generator',
    description: 'Generate UUID/GUID v1, v4, and other versions for development',
    category: 'developer',
    icon: '🆔',
  },
  {
    id: 'password-generator',
    title: 'Password Generator',
    description: 'Generate strong, secure passwords with customizable options',
    category: 'utility',
    icon: '🔒',
  },
  {
    id: 'image-converter',
    title: 'Image Converter',
    description: 'Convert images to WebP, AVIF and other formats with compression',
    category: 'converter',
    icon: '🖼️',
  },
  {
    id: 'gradient-generator',
    title: 'CSS Gradient Generator',
    description: 'Create beautiful CSS gradients with live preview and customization',
    category: 'design',
    icon: '📐',
  },
  {
    id: 'box-shadow-generator',
    title: 'Box Shadow Generator',
    description: 'Generate CSS box shadows with multiple layers and live preview',
    category: 'design',
    icon: '📦',
  },
  {
    id: 'animation-generator',
    title: 'CSS Animation Generator',
    description: 'Create smooth CSS animations with custom keyframes and timing',
    category: 'design',
    icon: '🎬',
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

  // Category color accent
  const categoryColor = categoryColors[tool.category] || '#0066cc'
  ctx.fillStyle = categoryColor
  ctx.fillRect(0, 0, 8, height)

  // Brand name
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif'
  ctx.fillText('ToolForge', 40, 60)

  // Tool icon (simple text representation)
  ctx.fillStyle = categoryColor
  ctx.font = 'bold 120px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(tool.icon, width - 200, height / 2 + 20)

  // Tool title
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 64px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(tool.title, 40, 180)

  // Tool description
  ctx.fillStyle = '#64748b'
  ctx.font = '28px system-ui, -apple-system, sans-serif'

  // Word wrap for description
  const words = tool.description.split(' ')
  let line = ''
  let y = 240
  const maxWidth = 800

  for (const word of words) {
    const testLine = `${line + word} `
    const metrics = ctx.measureText(testLine)

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, 40, y)
      line = `${word} `
      y += 40
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, 40, y)

  // Category badge
  ctx.fillStyle = categoryColor
  ctx.roundRect(40, height - 100, 160, 40, 20)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(tool.category.charAt(0).toUpperCase() + tool.category.slice(1), 120, height - 75)

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
