'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { useHistory } from '@/hooks/useHistory'
import { localStorageManager } from '@/lib/localStorage'
import { urlSharingManager } from '@/lib/urlSharing'
import {
  AlertCircle,
  Copy,
  Download,
  Heart,
  Palette,
  Redo2,
  Share2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface ColorFormat {
  hex: string
  rgb: { r: number; g: number; b: number }
  hsl: { h: number; s: number; l: number }
  cmyk: { c: number; m: number; y: number; k: number }
}

interface ColorPickerState {
  currentColor: string
  colorFormat: ColorFormat
}

export default function ColorPickerPage() {
  const TOOL_NAME = 'color-picker'

  const getInitialState = (): ColorPickerState => {
    return {
      currentColor: '#3b82f6',
      colorFormat: {
        hex: '#3b82f6',
        rgb: { r: 59, g: 130, b: 246 },
        hsl: { h: 217, s: 91, l: 60 },
        cmyk: { c: 76, m: 47, y: 0, k: 4 },
      },
    }
  }

  const {
    state,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
  } = useHistory<ColorPickerState>(getInitialState())

  const [copied, setCopied] = useState('')
  const [isSharing, setIsSharing] = useState(false)

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { currentColor, colorFormat } = state

  const setCurrentColor = (newColor: string) => {
    setHistoryState((prev) => ({ ...prev, currentColor: newColor }))
  }

  const setColorFormat = (newFormat: ColorFormat) => {
    setHistoryState((prev) => ({ ...prev, colorFormat: newFormat }))
  }

  // Client-side only state restoration
  useEffect(() => {
    const sharedState = urlSharingManager.getSharedStateFromUrl<ColorPickerState>(TOOL_NAME)
    if (sharedState) {
      setHistoryState(sharedState)
      return
    }

    const savedState = localStorageManager.load<ColorPickerState>(TOOL_NAME)
    if (savedState) {
      setHistoryState(savedState)
    }
  }, [setHistoryState])

  useEffect(() => {
    updateColorFormat(currentColor)
  }, [currentColor])

  // 状態が変更されるたびにローカルストレージに保存
  useEffect(() => {
    localStorageManager.save(TOOL_NAME, state)
  }, [state])

  // URL共有機能
  const handleShare = async () => {
    setIsSharing(true)
    try {
      const shareUrl = urlSharingManager.generateShareUrl(TOOL_NAME, state)
      const success = await urlSharingManager.copyShareUrl(shareUrl)

      if (success) {
        successToast('Share URL copied!', 'The shareable URL has been copied to your clipboard')
      } else {
        errorToast('Failed to copy URL', 'Please try again or copy the URL manually')
      }
    } catch (error) {
      console.error('Share failed:', error)
      errorToast('Sharing failed', 'An error occurred while generating the share URL')
    } finally {
      setIsSharing(false)
    }
  }

  // データ削除機能
  const handleClearData = () => {
    if (confirm('Clear all saved data and current color?')) {
      localStorageManager.clear(TOOL_NAME)
      clearHistory()
      urlSharingManager.cleanUrl()
      setHistoryState({
        currentColor: '#3b82f6',
        colorFormat: {
          hex: '#3b82f6',
          rgb: { r: 59, g: 130, b: 246 },
          hsl: { h: 217, s: 91, l: 60 },
          cmyk: { c: 76, m: 47, y: 0, k: 4 },
        },
      })
    }
  }

  // データエクスポート機能
  const handleExportData = () => {
    const data = {
      currentColor,
      colorFormat,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `color-picker-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const updateColorFormat = (hex: string) => {
    const rgb = hexToRgb(hex)
    if (rgb) {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
      const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b)

      setColorFormat({
        hex,
        rgb,
        hsl,
        cmyk,
      })
    }
  }

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : null
  }

  const rgbToHsl = (r: number, g: number, b: number) => {
    const rNorm = r / 255
    const gNorm = g / 255
    const bNorm = b / 255

    const max = Math.max(rNorm, gNorm, bNorm)
    const min = Math.min(rNorm, gNorm, bNorm)
    let h: number
    let s: number
    const l = (max + min) / 2

    if (max === min) {
      h = s = 0
    } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case rNorm:
          h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
          break
        case gNorm:
          h = (bNorm - rNorm) / d + 2
          break
        case bNorm:
          h = (rNorm - gNorm) / d + 4
          break
        default:
          h = 0
      }
      h /= 6
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    }
  }

  const rgbToCmyk = (r: number, g: number, b: number) => {
    const rNorm = r / 255
    const gNorm = g / 255
    const bNorm = b / 255

    const k = 1 - Math.max(rNorm, gNorm, bNorm)
    const c = k === 1 ? 0 : (1 - rNorm - k) / (1 - k)
    const m = k === 1 ? 0 : (1 - gNorm - k) / (1 - k)
    const y = k === 1 ? 0 : (1 - bNorm - k) / (1 - k)

    return {
      c: Math.round(c * 100),
      m: Math.round(m * 100),
      y: Math.round(y * 100),
      k: Math.round(k * 100),
    }
  }

  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(format)
      setTimeout(() => setCopied(''), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const predefinedColors = [
    '#FF0000',
    '#FF4500',
    '#FFA500',
    '#FFD700',
    '#FFFF00',
    '#ADFF2F',
    '#00FF00',
    '#00FF7F',
    '#00FFFF',
    '#0000FF',
    '#4169E1',
    '#8A2BE2',
    '#FF00FF',
    '#FF1493',
    '#FF69B4',
    '#000000',
    '#808080',
    '#FFFFFF',
  ]

  const formatCopies = [
    { label: 'HEX', value: colorFormat.hex, format: colorFormat.hex },
    {
      label: 'RGB',
      value: `rgb(${colorFormat.rgb.r}, ${colorFormat.rgb.g}, ${colorFormat.rgb.b})`,
      format: `rgb(${colorFormat.rgb.r}, ${colorFormat.rgb.g}, ${colorFormat.rgb.b})`,
    },
    {
      label: 'HSL',
      value: `hsl(${colorFormat.hsl.h}, ${colorFormat.hsl.s}%, ${colorFormat.hsl.l}%)`,
      format: `hsl(${colorFormat.hsl.h}, ${colorFormat.hsl.s}%, ${colorFormat.hsl.l}%)`,
    },
    {
      label: 'CMYK',
      value: `cmyk(${colorFormat.cmyk.c}%, ${colorFormat.cmyk.m}%, ${colorFormat.cmyk.y}%, ${colorFormat.cmyk.k}%)`,
      format: `cmyk(${colorFormat.cmyk.c}%, ${colorFormat.cmyk.m}%, ${colorFormat.cmyk.y}%, ${colorFormat.cmyk.k}%)`,
    },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 py-3 xs:py-4 sm:py-6 md:py-12">
        <Header />

        <main>
          {/* Hero Section */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-2 xs:mb-3 sm:mb-4 text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                Color Picker & Converter
              </h1>
              <p className="mb-4 xs:mb-6 text-sm xs:text-base sm:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary px-2 xs:px-0">
                Pick colors and convert between HEX, RGB, HSL formats.
              </p>
            </div>
          </section>

          {/* Main Color Picker */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 xs:gap-6 lg:gap-8">
              {/* Color Display & Picker */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-2 xs:p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                    Color Selection
                  </h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    Choose your perfect color
                  </p>
                </div>
                <div className="p-3 xs:p-4 sm:p-6">
                  {/* Large Color Display */}
                  <div
                    className="w-full h-32 xs:h-40 sm:h-48 md:h-56 lg:h-64 rounded-lg border-4 border-border-light dark:border-border-dark mb-4 xs:mb-6 shadow-inner transition-all hover:scale-[1.02]"
                    style={{ backgroundColor: currentColor }}
                  />

                  {/* Color Input */}
                  <div className="mb-6">
                    <label
                      htmlFor="color-input"
                      className="block text-sm font-medium text-foreground-light dark:text-foreground-dark mb-3"
                    >
                      Visual Color Picker
                    </label>
                    <input
                      id="color-input"
                      type="color"
                      value={currentColor}
                      onChange={(e) => setCurrentColor(e.target.value)}
                      className="w-full h-16 rounded-lg border border-border-light dark:border-border-dark cursor-pointer transition-all hover:scale-105 active:scale-95"
                    />
                  </div>

                  {/* Manual HEX Input */}
                  <div>
                    <label
                      htmlFor="hex-input"
                      className="block text-sm font-medium text-foreground-light dark:text-foreground-dark mb-3"
                    >
                      HEX Value
                    </label>
                    <input
                      id="hex-input"
                      type="text"
                      value={currentColor}
                      onChange={(e) => {
                        const value = e.target.value
                        if (/^#[0-9A-F]{6}$/i.test(value)) {
                          setCurrentColor(value)
                        }
                      }}
                      placeholder="#0066CC"
                      className="w-full px-4 py-3 bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg transition-all focus:ring-2 focus:ring-accent focus:border-accent text-foreground-light dark:text-foreground-dark font-mono"
                    />
                  </div>

                  {/* History Controls */}
                  <div className="mt-6 flex gap-2">
                    <button
                      onClick={undo}
                      disabled={!canUndo}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                    >
                      <Undo2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Undo</span>
                    </button>
                    <button
                      onClick={redo}
                      disabled={!canRedo}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                    >
                      <Redo2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Redo</span>
                    </button>
                    <button
                      onClick={() => clearHistory()}
                      className="px-4 py-2 bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg transition-all hover:border-red-500 hover:text-red-500 text-sm font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Color Formats */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                    Color Formats
                  </h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    Copy in your preferred format
                  </p>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {formatCopies.map((format) => (
                      <div
                        key={format.label}
                        className="flex items-center justify-between p-4 bg-white dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark transition-all hover:shadow-md"
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground-light dark:text-foreground-dark">
                            {format.label}
                          </div>
                          <div className="font-mono text-foreground-light dark:text-foreground-dark mt-1">
                            {format.value}
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(format.format, format.label)}
                          className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-lg text-sm transition-all hover:shadow-lg active:scale-95"
                        >
                          <Copy className="w-4 h-4" />
                          {copied === format.label ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg text-sm transition-all hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Share2 className="w-4 h-4" />
                      {isSharing ? 'Sharing...' : 'Share'}
                    </button>
                    <button
                      onClick={handleExportData}
                      className="flex items-center gap-2 px-4 py-2 border border-border-light dark:border-border-dark hover:border-accent hover:text-accent rounded-lg text-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      onClick={handleClearData}
                      className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 rounded-lg text-sm transition-all dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:border-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Predefined Colors */}
          <section className="hidden xs:block mb-8 sm:mb-12 md:mb-16">
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark p-6 transition-all hover:shadow-lg">
              <h3 className="text-lg font-semibold text-foreground-light dark:text-foreground-dark mb-6">
                Quick Color Palette
              </h3>
              <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 xl:grid-cols-18 gap-3">
                {predefinedColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setCurrentColor(color)}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 transition-all hover:scale-110 active:scale-95 ${
                      currentColor === color
                        ? 'border-accent shadow-lg ring-2 ring-accent ring-opacity-50'
                        : 'border-border-light dark:border-border-dark hover:border-accent'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Color Harmony & Information */}
          <section className="hidden sm:block mb-8 sm:mb-12 md:mb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Color Harmony */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark p-6 transition-all hover:shadow-lg">
                <h3 className="text-lg font-semibold text-foreground-light dark:text-foreground-dark mb-6">
                  Color Harmony
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Current
                    </span>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded border border-border-light dark:border-border-dark"
                        style={{ backgroundColor: currentColor }}
                      />
                      <span className="font-mono text-sm text-foreground-light dark:text-foreground-dark">
                        {currentColor}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Complementary
                    </span>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded border border-border-light dark:border-border-dark"
                        style={{
                          backgroundColor: `hsl(${
                            (colorFormat.hsl.h + 180) % 360
                          }, ${colorFormat.hsl.s}%, ${colorFormat.hsl.l}%)`,
                        }}
                      />
                      <span className="font-mono text-sm text-foreground-light dark:text-foreground-dark">
                        hsl({(colorFormat.hsl.h + 180) % 360}, {colorFormat.hsl.s}%,{' '}
                        {colorFormat.hsl.l}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Information */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark p-6 transition-all hover:shadow-lg">
                <h3 className="text-lg font-semibold text-foreground-light dark:text-foreground-dark mb-6">
                  Color Information
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Brightness:
                    </span>
                    <span className="font-medium text-foreground-light dark:text-foreground-dark">
                      {Math.round(
                        ((colorFormat.rgb.r * 0.299 +
                          colorFormat.rgb.g * 0.587 +
                          colorFormat.rgb.b * 0.114) /
                          255) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Lightness:
                    </span>
                    <span className="font-medium text-foreground-light dark:text-foreground-dark">
                      {colorFormat.hsl.l}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Saturation:
                    </span>
                    <span className="font-medium text-foreground-light dark:text-foreground-dark">
                      {colorFormat.hsl.s}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="hidden xs:block mb-8 sm:mb-12 md:mb-16">
            <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
              Why Choose Our Color Picker?
            </h2>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Palette,
                  title: 'Multiple Formats',
                  description: 'Convert between HEX, RGB, HSL, and CMYK color formats instantly.',
                },
                {
                  icon: Heart,
                  title: 'Color Harmony',
                  description: 'Discover complementary colors and create beautiful color palettes.',
                },
                {
                  icon: Copy,
                  title: 'Copy & Export',
                  description:
                    'One-click copy for all color formats. Perfect for design workflows.',
                },
              ].map((feature, index) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-border-light bg-card-light p-6 text-center dark:border-border-dark dark:bg-card-dark transition-all hover:-translate-y-1 hover:shadow-lg"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.6s ease-out forwards',
                  }}
                >
                  <div className="mb-4 flex justify-center">
                    <feature.icon className="h-10 w-10 text-accent transition-transform hover:scale-110" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Content Sections for AdSense */}
          <section className="mb-8 sm:mb-12 md:mb-16 border-t border-border-light dark:border-border-dark pt-8 sm:pt-12">
            {/* About This Tool */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                About Color Picker & Converter
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Our Color Picker & Converter is a comprehensive tool designed for designers,
                  developers, and creative professionals who work with colors daily. Whether you're
                  choosing colors for a website, creating a brand palette, or converting between
                  different color formats for various applications, this tool provides all the
                  functionality you need in one intuitive interface.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Color is fundamental to design and visual communication. Understanding and working
                  with different color formats is essential for modern digital work. This tool
                  supports HEX (hexadecimal), RGB (Red, Green, Blue), HSL (Hue, Saturation,
                  Lightness), and CMYK (Cyan, Magenta, Yellow, Key/Black) formats, allowing seamless
                  conversion between formats commonly used in web design, print design, and digital
                  art.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                  With features like visual color selection, predefined color palettes, color
                  harmony suggestions, and instant format conversion, this tool streamlines your
                  color workflow. All processing happens locally in your browser, ensuring fast
                  performance and complete privacy for your design work.
                </p>
              </div>
            </div>

            {/* How to Use */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                How to Use
              </h2>
              <div className="space-y-4">
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 1: Select a Color</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Use the visual color picker to choose your desired color, or click on one of the
                    predefined colors from the quick palette. You can also enter a HEX value
                    directly if you know the specific color code.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 2: View Color Formats</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Once a color is selected, instantly see its values in HEX, RGB, HSL, and CMYK
                    formats in the Color Formats panel on the right side.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 3: Copy Color Values</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Click the "Copy" button next to any format to copy that color value to your
                    clipboard for use in your design software or code.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 4: Explore Color Harmony</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Check the Color Harmony section to see complementary colors that work well with
                    your selected color for creating cohesive color schemes.
                  </p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Key Features
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Visual Color Selection</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Interactive color picker with real-time preview and smooth color transitions.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Multiple Format Support</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Convert between HEX, RGB, HSL, and CMYK formats instantly with accurate
                    calculations.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Quick Palette</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Access commonly used colors instantly from our curated quick color palette.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Color Harmony</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Discover complementary colors and create harmonious color combinations.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">History & Undo</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Navigate through your color selection history with undo/redo functionality.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Color Analysis</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    View brightness, lightness, and saturation values for better color
                    understanding.
                  </p>
                </div>
              </div>
            </div>

            {/* Color Format Guide */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Understanding Color Formats
              </h2>
              <div className="space-y-6">
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">HEX (Hexadecimal)</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-3">
                    The most common format for web colors. Uses a 6-character code with values from
                    0-9 and A-F.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded font-mono text-sm">
                    Example: #FF5733 (Red: FF, Green: 57, Blue: 33)
                  </div>
                </div>

                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">RGB (Red, Green, Blue)</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-3">
                    Defines colors using red, green, and blue components, each ranging from 0 to
                    255.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded font-mono text-sm">
                    Example: rgb(255, 87, 51) - Maximum red, some green, minimal blue
                  </div>
                </div>

                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">HSL (Hue, Saturation, Lightness)</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-3">
                    Represents colors using hue (0-360°), saturation (0-100%), and lightness
                    (0-100%).
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded font-mono text-sm">
                    Example: hsl(9, 100%, 60%) - Orange hue, fully saturated, medium lightness
                  </div>
                </div>

                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">
                    CMYK (Cyan, Magenta, Yellow, Key/Black)
                  </h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-3">
                    Subtractive color model used in printing, with values from 0-100% for each
                    component.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded font-mono text-sm">
                    Example: cmyk(0%, 66%, 80%, 0%) - No cyan, high magenta and yellow, no black
                  </div>
                </div>
              </div>
            </div>

            {/* Use Cases */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Common Use Cases
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Web Development</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Use HEX or RGB values for CSS styling, ensuring consistent colors across your
                    website or application.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Graphic Design</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Convert between RGB (screen) and CMYK (print) to maintain color accuracy across
                    different media.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Brand Guidelines</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Document brand colors in multiple formats for consistent use across all
                    marketing materials.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">UI/UX Design</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Create accessible color palettes by analyzing brightness and contrast values for
                    better readability.
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What's the difference between RGB and HEX?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    RGB and HEX represent the same color information in different formats. RGB uses
                    decimal numbers (0-255) for red, green, and blue components, while HEX uses
                    hexadecimal notation (00-FF). HEX is essentially RGB in a more compact format
                    commonly used in web development.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    When should I use CMYK instead of RGB?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Use CMYK for print design projects like business cards, brochures, or posters.
                    CMYK is a subtractive color model that matches how printers mix inks. Use RGB
                    for digital displays like websites, apps, or digital presentations, as screens
                    emit light using red, green, and blue.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">What is color harmony?</summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Color harmony refers to aesthetically pleasing color combinations. Common
                    harmonies include complementary (opposite colors on the color wheel), analogous
                    (adjacent colors), and triadic (three evenly spaced colors). Our tool shows
                    complementary colors to help you create balanced color schemes.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Why do colors look different on my screen vs print?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Screens use additive color (RGB) with light emission, while printers use
                    subtractive color (CMYK) with ink absorption. Additionally, screen calibration,
                    paper type, and lighting conditions affect color appearance. Always test
                    important colors in their final medium.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What's the benefit of using HSL?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    HSL is intuitive for color adjustments. Hue represents the color itself (0-360°
                    on the color wheel), saturation controls color intensity (gray to vivid), and
                    lightness adjusts brightness (black to white). This makes it easy to create
                    color variations while maintaining the same base hue.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    How accurate is the CMYK conversion?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Our CMYK conversion provides a close approximation, but exact results depend on
                    printing conditions, paper type, and printer calibration. For critical color
                    matching, always consult with your print provider and request color proofs.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I save my color palettes?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Currently, the tool maintains a session history with undo/redo functionality.
                    For permanent storage, copy the color values to your design software or
                    documentation. The tool processes everything locally for privacy.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What are web-safe colors?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Web-safe colors were a palette of 216 colors that displayed consistently on old
                    monitors with limited color support. Modern displays support millions of colors,
                    so web-safe colors are no longer necessary. Use any color that suits your design
                    needs.
                  </p>
                </details>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
