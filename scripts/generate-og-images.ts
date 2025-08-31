import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Canvas, type CanvasRenderingContext2D, createCanvas } from 'canvas'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface CategoryGradient {
  colors: [string, string]
  accent: string
}

interface Tool {
  id: string
  title: string
  subtitle: string
  description: string
  category: string
  icon: string
}

// Modern color gradients for each category
const categoryGradients: Record<string, CategoryGradient> = {
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

// Tool configurations
const tools: Tool[] = [
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

async function generateSimpleOGImage(tool: Tool, outputPath: string): Promise<void> {
  const width = 1200
  const height = 630
  const canvas: Canvas = createCanvas(width, height)
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d')

  // Get gradient for category
  const gradient = categoryGradients[tool.category] || categoryGradients.default

  // Create gradient background
  const bgGradient = ctx.createLinearGradient(0, 0, width, height)
  bgGradient.addColorStop(0, gradient.colors[0])
  bgGradient.addColorStop(1, gradient.colors[1])
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  // Elegant white card with shadow
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 10
  ctx.fillRect(60, 60, width - 120, height - 120)
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // LARGE TITLE - Readable but fits nicely
  ctx.fillStyle = '#1a1a1a'
  ctx.font = 'bold 120px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Split title into multiple lines if needed
  const titleWords = tool.title.split(' ')
  if (titleWords.length > 1) {
    // Multi-word title - check length and adjust font size
    const fullTitle = tool.title
    let fontSize = 120
    let lineSpacing = 60

    // Reduce size for very long titles
    if (fullTitle.length > 15) {
      fontSize = 120
      lineSpacing = 50
      ctx.font = `bold ${fontSize}px Arial`
    } else if (fullTitle.length > 12) {
      fontSize = 120
      lineSpacing = 50
      ctx.font = `bold ${fontSize}px Arial`
    }

    const line1 = titleWords[0]
    const line2 = titleWords.slice(1).join(' ')
    ctx.fillText(line1, width / 2, height / 2 - lineSpacing)
    ctx.fillText(line2, width / 2, height / 2 + lineSpacing)
  } else {
    // Single word title
    ctx.fillText(tool.title, width / 2, height / 2)
  }

  // SUBTITLE - Balanced size
  ctx.fillStyle = gradient.accent
  ctx.font = 'bold 90px Arial'
  ctx.fillText(tool.subtitle, width / 2, height - 120)

  // Elegant brand in corner
  ctx.fillStyle = '#888'
  ctx.font = '36px Arial'
  ctx.textAlign = 'left'
  ctx.fillText('ToolForge', 100, 130)

  // Save image
  const buffer = canvas.toBuffer('image/png')
  await fs.writeFile(outputPath, buffer)
  console.log(`✨ Generated SIMPLE MASSIVE font OG image: ${outputPath}`)
}

async function generateHomeOGImage(outputPath: string): Promise<void> {
  const width = 1200
  const height = 630
  const canvas: Canvas = createCanvas(width, height)
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d')

  // Beautiful gradient background
  const bgGradient = ctx.createLinearGradient(0, 0, width, height)
  bgGradient.addColorStop(0, '#667eea')
  bgGradient.addColorStop(0.5, '#764ba2')
  bgGradient.addColorStop(1, '#f093fb')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  // White overlay
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.fillRect(50, 50, width - 100, height - 100)

  // LARGE Logo/Brand - Fits within frame
  ctx.fillStyle = '#1a1a1a'
  ctx.font = 'bold 200px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ToolForge', width / 2, height / 2 - 60)

  // MEDIUM Tagline
  ctx.fillStyle = '#8b5cf6'
  ctx.font = 'bold 100px Arial'
  ctx.fillText('Craft. Share. Create.', width / 2, height / 2 + 100)

  // Save image
  const buffer = canvas.toBuffer('image/png')
  await fs.writeFile(outputPath, buffer)
  console.log('✨ Generated SIMPLE MASSIVE font home OG image:', outputPath)
}

async function main(): Promise<void> {
  try {
    const publicDir = path.join(__dirname, '../public')
    const ogDir = path.join(publicDir, 'og')

    // Create og directory if it doesn't exist
    await fs.mkdir(ogDir, { recursive: true })

    console.log('🎨 Starting SIMPLE MASSIVE READABLE font OG generation...\n')

    // Delete old images first
    try {
      const files = await fs.readdir(ogDir)
      for (const file of files) {
        if (file.endsWith('.png')) {
          await fs.unlink(path.join(ogDir, file))
        }
      }
    } catch (_error) {
      // Directory might not exist, ignore
    }

    // Generate home page OG image
    await generateHomeOGImage(path.join(ogDir, 'home.png'))

    // Generate tool OG images
    for (const tool of tools) {
      await generateSimpleOGImage(tool, path.join(ogDir, `${tool.id}.png`))
    }

    console.log('\n✅ All SIMPLE MASSIVE READABLE font OG images generated!')
    console.log('🔍 Please check the images - text should now be HUGE and readable!')
  } catch (error) {
    console.error('❌ Error generating OG images:', error)
    process.exit(1)
  }
}

main()
