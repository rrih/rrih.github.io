import { Eye, Palette, Share2, Shield } from 'lucide-react'

export const siteConfig = {
  name: 'ToolForge',
  tagline: 'Craft. Share. Create.',
  url: 'https://rrih.github.io',
  ogImage: '/og/home.png',
  description:
    'Privacy-first web tools with instant URL sharing. Client-side processing meets beautiful UI/UX design. No servers, no tracking, just pure efficiency.',
  keywords: [
    'privacy-first tools',
    'client-side processing',
    'URL sharing tools',
    'web development tools',
    'browser tools',
    'real-time preview',
    'beautiful UI tools',
    'json formatter',
    'base64 encoder',
    'gradient generator',
    'animation tools',
    'password generator',
    'image converter',
    'modern web tools',
    'developer utilities',
  ],
  author: {
    name: 'rrih',
    github: 'https://github.com/rrih',
    email: 'origabird0911@gmail.com',
  },
  links: {
    github: 'https://github.com/rrih/rrih.github.io',
    repository: 'https://github.com/rrih/rrih.github.io',
  },
  features: [
    {
      title: 'Zero-Server Privacy',
      description: 'All processing happens in your browser. Your data never leaves your device.',
      icon: Shield,
    },
    {
      title: 'Instant URL Sharing',
      description: 'Share your work instantly with auto-generated URLs. No accounts needed.',
      icon: Share2,
    },
    {
      title: 'Crafted UI/UX',
      description: 'Every pixel perfected. Real-time previews with intuitive, beautiful design.',
      icon: Palette,
    },
    {
      title: 'Live Previews',
      description: 'See changes instantly as you type. No refresh needed, pure efficiency.',
      icon: Eye,
    },
  ],
}
