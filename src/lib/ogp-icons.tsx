import React from 'react'

// Icon mapping for OGP image generation (simplified SVG components)
export const OGPIcons = {
  'json-formatter': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" />
      <path d="M14,2 L14,8 L20,8" fill="white" />
      <path d="M12 18v-6l3 3" stroke="#0066cc" strokeWidth="2" fill="none" />
      <path d="M9 9v6l-3-3" stroke="#0066cc" strokeWidth="2" fill="none" />
    </svg>
  ),

  base64: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        stroke="white"
        strokeWidth="2"
        fill="none"
      />
      <polyline points="7.5,4.21 12,6.81 16.5,4.21" stroke="white" strokeWidth="2" />
      <polyline points="7.5,19.79 7.5,14.6 3,12" stroke="white" strokeWidth="2" />
      <polyline points="21,12 16.5,14.6 16.5,19.79" stroke="white" strokeWidth="2" />
      <polyline points="3.27,6.96 12,12.01 20.73,6.96" stroke="white" strokeWidth="2" />
      <line x1="12" y1="22.08" x2="12" y2="12" stroke="white" strokeWidth="2" />
    </svg>
  ),

  'color-picker': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <circle cx="13.5" cy="6.5" r=".5" fill="white" />
      <circle cx="17.5" cy="10.5" r=".5" fill="white" />
      <circle cx="8.5" cy="7.5" r=".5" fill="white" />
      <circle cx="6.5" cy="12.5" r=".5" fill="white" />
      <path
        d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
        fill="white"
      />
    </svg>
  ),

  'markdown-editor': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" />
      <path d="M14,2 L14,8 L20,8" fill="white" />
      <path d="M9 13v-2l2 2 4-4" stroke="#0066cc" strokeWidth="2" fill="none" />
    </svg>
  ),

  'qr-generator': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <rect width="5" height="5" x="3" y="3" rx="1" fill="white" />
      <rect width="5" height="5" x="16" y="3" rx="1" fill="white" />
      <rect width="5" height="5" x="3" y="16" rx="1" fill="white" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" stroke="white" strokeWidth="2" fill="none" />
      <path d="M21 21v.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" stroke="white" strokeWidth="2" fill="none" />
      <path d="M3 12h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 3h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 16v.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 12h1" stroke="white" strokeWidth="2" />
      <path d="M21 12v.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 21v-1" stroke="white" strokeWidth="2" />
    </svg>
  ),

  'uuid-generator': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12l4 6-10 13L2 9l4-6z" fill="white" />
      <path d="M11 3 8 9l4 13 4-13-3-6" stroke="#0066cc" strokeWidth="2" fill="none" />
      <path d="M2 9h20" stroke="#0066cc" strokeWidth="2" />
    </svg>
  ),

  'password-generator': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" fill="white" />
      <circle cx="12" cy="16" r="1" fill="#0066cc" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" fill="none" />
    </svg>
  ),

  'image-converter': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" fill="white" />
      <circle cx="9" cy="9" r="2" fill="#0066cc" />
      <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" stroke="#0066cc" strokeWidth="2" />
    </svg>
  ),

  'gradient-generator': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="white" />
      <path d="M8 12h8" stroke="#0066cc" strokeWidth="2" />
      <path d="M12 8v8" stroke="#0066cc" strokeWidth="2" />
      <path d="M16 8l-8 8" stroke="#0066cc" strokeWidth="2" />
      <path d="M8 8l8 8" stroke="#0066cc" strokeWidth="2" />
    </svg>
  ),

  'box-shadow-generator': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" fill="white" />
      <rect
        width="12"
        height="12"
        x="6"
        y="6"
        rx="1"
        ry="1"
        stroke="#0066cc"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  ),

  'animation-generator': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l3.09 6.26L22 9l-5.09 3.74L18 19l-6-4.5L6 19l1.09-6.26L2 9l6.91-.74L12 2z"
        fill="white"
      />
      <path d="M12 2v20" stroke="#0066cc" strokeWidth="2" />
      <path d="M2 9h20" stroke="#0066cc" strokeWidth="2" />
    </svg>
  ),
}

// Category icons for OGP
export const CategoryIcons = {
  developer: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path
        d="M16 18l6-6-6-6"
        stroke="#0066cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6l-6 6 6 6"
        stroke="#0066cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  design: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <circle cx="13.5" cy="6.5" r=".5" fill="#0066cc" />
      <circle cx="17.5" cy="10.5" r=".5" fill="#0066cc" />
      <circle cx="8.5" cy="7.5" r=".5" fill="#0066cc" />
      <circle cx="6.5" cy="12.5" r=".5" fill="#0066cc" />
      <path
        d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
        fill="#0066cc"
      />
    </svg>
  ),
  utility: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        fill="#0066cc"
      />
    </svg>
  ),
  converter: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <polyline
        points="16,3 21,3 21,8"
        stroke="#0066cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="4"
        y1="20"
        x2="21"
        y2="3"
        stroke="#0066cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="21,16 21,21 16,21"
        stroke="#0066cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="15"
        y1="10"
        x2="21"
        y2="16"
        stroke="#0066cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="8,21 3,21 3,16"
        stroke="#0066cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="20"
        y1="4"
        x2="3"
        y2="21"
        stroke="#0066cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="3,8 3,3 8,3"
        stroke="#0066cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="9"
        y1="14"
        x2="3"
        y2="8"
        stroke="#0066cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}
