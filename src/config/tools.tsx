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
    id: 'timetable',
    title: 'URL Timetable',
    description:
      'Create and share fully restorable timetables with URL-only sync, filters, merges, and charts',
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
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M16 2v4" />
        <path d="M8 2v4" />
        <path d="M3 10h18" />
        <path d="M8 14h3" />
        <path d="M13 14h3" />
        <path d="M8 18h3" />
      </svg>
    ),
    href: '/tools/timetable',
    category: 'utility',
    status: 'available',
    featured: true,
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
  {
    id: 'password-generator',
    title: 'Password Generator',
    description: 'Generate strong, secure passwords with customizable options',
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
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <circle cx="12" cy="16" r="1" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    href: '/tools/password-generator',
    category: 'utility',
    status: 'available',
    featured: true,
  },
  {
    id: 'image-converter',
    title: 'Image Converter',
    description: 'Convert images to WebP, AVIF and other formats with compression',
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
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    ),
    href: '/tools/image-converter',
    category: 'converter',
    status: 'available',
    featured: true,
  },
  {
    id: 'gradient-generator',
    title: 'CSS Gradient Generator',
    description: 'Create beautiful CSS gradients with live preview and customization',
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
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8" />
        <path d="M12 8v8" />
        <path d="M16 8l-8 8" />
        <path d="M8 8l8 8" />
      </svg>
    ),
    href: '/tools/gradient-generator',
    category: 'design',
    status: 'available',
    featured: false,
  },
  {
    id: 'box-shadow-generator',
    title: 'Box Shadow Generator',
    description: 'Generate CSS box shadows with multiple layers and live preview',
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
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <rect width="12" height="12" x="6" y="6" rx="1" ry="1" />
      </svg>
    ),
    href: '/tools/box-shadow-generator',
    category: 'design',
    status: 'available',
    featured: false,
  },
  {
    id: 'animation-generator',
    title: 'CSS Animation Generator',
    description: 'Create smooth CSS animations with custom keyframes and timing',
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
        <path d="M12 2v20" />
        <path d="M2 9h20" />
      </svg>
    ),
    href: '/tools/animation-generator',
    category: 'design',
    status: 'available',
    featured: false,
  },
  {
    id: 'investment-calculator',
    title: 'Investment Calculator',
    description: 'Plan your financial future with compound interest calculations and goal tracking',
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
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
    href: '/tools/investment-calculator',
    category: 'utility',
    status: 'available',
    featured: true,
  },
]

export const categories = [
  { id: 'developer', name: 'Developer Tools', color: 'bg-blue-500' },
  { id: 'design', name: 'Design Tools', color: 'bg-purple-500' },
  { id: 'utility', name: 'Utilities', color: 'bg-green-500' },
  { id: 'converter', name: 'Converters', color: 'bg-orange-500' },
] as const
