'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { AlertCircle, Copy, Heart, Palette, Redo2, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useHistory } from '@/hooks/useHistory'

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
  const {
    state,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
  } = useHistory<ColorPickerState>({
    currentColor: '#0066cc',
    colorFormat: {
      hex: '#0066cc',
      rgb: { r: 0, g: 102, b: 204 },
      hsl: { h: 210, s: 100, l: 40 },
      cmyk: { c: 100, m: 50, y: 0, k: 20 },
    },
  })

  const [copied, setCopied] = useState('')

  const { currentColor, colorFormat } = state

  const setCurrentColor = (newColor: string) => {
    setHistoryState((prev) => ({ ...prev, currentColor: newColor }))
  }

  const setColorFormat = (newFormat: ColorFormat) => {
    setHistoryState((prev) => ({ ...prev, colorFormat: newFormat }))
  }

  useEffect(() => {
    updateColorFormat(currentColor)
  }, [currentColor])

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
