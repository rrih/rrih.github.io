import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '320px',
      },
      colors: {
        accent: {
          DEFAULT: '#0066cc',
          light: '#4d94ff',
          lighter: '#e6f2ff',
          dark: '#004499',
        },
        background: {
          light: '#ffffff',
          dark: '#0a0a0a',
        },
        foreground: {
          light: '#1a1a1a',
          'light-secondary': '#666666',
          dark: '#f0f0f0',
          'dark-secondary': '#999999',
        },
        border: {
          light: '#e5e5e5',
          dark: '#222222',
        },
        card: {
          light: '#fafafa',
          dark: '#141414',
        },
      },
      spacing: {
        '15': '3.75rem',
        '18': '4.5rem',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Inter',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
export default config
