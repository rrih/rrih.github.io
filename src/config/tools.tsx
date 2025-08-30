import type React from 'react'

export interface Tool {
  id: string
  title: string
  description: string
  icon: ({ className }: { className?: string }) => React.ReactElement
  href: string
  category: 'developer' | 'design' | 'utility' | 'converter'
  status: 'available' | 'coming_soon'
  featured: boolean
}

export const tools: Tool[] = [
  {
    id: 'json-formatter',
    title: 'JSON Formatter',
    description: 'Format, validate, and beautify JSON data with syntax highlighting',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14,2 L14,8 L20,8" />
        <path d="M12 18v-6l3 3" />
        <path d="M9 9v6l-3-3" />
      </svg>
    ),
    href: '/tools/json-formatter',
    category: 'developer',
    status: 'available',
    featured: true,
  },
  {
    id: 'base64',
    title: 'Base64 Encoder/Decoder',
    description: 'Encode and decode Base64 strings quickly and securely',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="7.5,4.21 12,6.81 16.5,4.21" />
        <polyline points="7.5,19.79 7.5,14.6 3,12" />
        <polyline points="21,12 16.5,14.6 16.5,19.79" />
        <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    href: '/tools/base64',
    category: 'converter',
    status: 'available',
    featured: true,
  },
  {
    id: 'color-picker',
    title: 'Color Picker & Converter',
    description: 'Convert between color formats: HEX, RGB, HSL, and more',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2l3.09 6.26L22 9l-5.09 3.74L18 19l-6-4.5L6 19l1.09-6.26L2 9l6.91-.74L12 2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    href: '/tools/color-picker',
    category: 'design',
    status: 'available',
    featured: true,
  },
  {
    id: 'markdown-editor',
    title: 'Markdown Editor',
    description: 'Write and preview Markdown with live rendering and export options',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14,2 L14,8 L20,8" />
        <path d="M9 13v-2l2 2 4-4" />
      </svg>
    ),
    href: '/tools/markdown-editor',
    category: 'utility',
    status: 'available',
    featured: false,
  },
  {
    id: 'qr-generator',
    title: 'QR Code Generator',
    description: 'Generate QR codes for URLs, text, WiFi, and more with customization',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="5" height="5" x="3" y="3" rx="1" />
        <rect width="5" height="5" x="16" y="3" rx="1" />
        <rect width="5" height="5" x="3" y="16" rx="1" />
        <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
        <path d="M21 21v.01" />
        <path d="M12 7v3a2 2 0 0 1-2 2H7" />
        <path d="M3 12h.01" />
        <path d="M12 3h.01" />
        <path d="M12 16v.01" />
        <path d="M16 12h1" />
        <path d="M21 12v.01" />
        <path d="M12 21v-1" />
      </svg>
    ),
    href: '/tools/qr-generator',
    category: 'utility',
    status: 'available',
    featured: false,
  },
  {
    id: 'uuid-generator',
    title: 'UUID Generator',
    description: 'Generate UUID/GUID v1, v4, and other versions for development',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 3h12l4 6-10 13L2 9l4-6z" />
        <path d="M11 3 8 9l4 13 4-13-3-6" />
        <path d="M2 9h20" />
      </svg>
    ),
    href: '/tools/uuid-generator',
    category: 'developer',
    status: 'available',
    featured: false,
  },
]

export const categories = [
  { id: 'developer', name: 'Developer Tools', color: 'bg-blue-500' },
  { id: 'design', name: 'Design Tools', color: 'bg-purple-500' },
  { id: 'utility', name: 'Utilities', color: 'bg-green-500' },
  { id: 'converter', name: 'Converters', color: 'bg-orange-500' },
] as const
