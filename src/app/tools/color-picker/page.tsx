'use client'

import { useEffect, useState } from 'react'
import { Palette, Heart, Clipboard } from 'lucide-react'

interface ColorFormat {
  hex: string
  rgb: { r: number; g: number; b: number }
  hsl: { h: number; s: number; l: number }
  cmyk: { c: number; m: number; y: number; k: number }
}

export default function ColorPickerPage() {
  const [currentColor, setCurrentColor] = useState('#0066cc')
  const [colorFormat, setColorFormat] = useState<ColorFormat>({
    hex: '#0066cc',
    rgb: { r: 0, g: 102, b: 204 },
    hsl: { h: 210, s: 100, l: 40 },
    cmyk: { c: 100, m: 50, y: 0, k: 20 },
  })

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
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h,
      s,
      l = (max + min) / 2

    if (max === min) {
      h = s = 0
    } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 dark:text-white mb-4">
            Color Picker & Converter
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto px-4">
            Pick colors visually and convert between HEX, RGB, HSL, and CMYK formats. Perfect for
            designers, developers, and digital artists.
          </p>
        </div>

        {/* Main Color Picker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Color Display & Picker */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white mb-4">
              Color Selection
            </h3>

            {/* Large Color Display */}
            <div
              className="w-full h-32 sm:h-40 lg:h-48 rounded-lg border-4 border-slate-200 dark:border-slate-600 mb-4 shadow-inner"
              style={{ backgroundColor: currentColor }}
            />

            {/* Color Input */}
            <div className="mb-4">
              <label
                htmlFor="color-input"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Color Picker
              </label>
              <input
                id="color-input"
                type="color"
                value={currentColor}
                onChange={(e) => setCurrentColor(e.target.value)}
                className="w-full h-12 sm:h-14 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer"
              />
            </div>

            {/* Manual HEX Input */}
            <div>
              <label
                htmlFor="hex-input"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
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
                className="w-full px-3 py-2 sm:py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-slate-800 dark:text-slate-200 text-sm sm:text-base"
              />
            </div>
          </div>

          {/* Color Formats */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white mb-4">
              Color Formats
            </h3>

            <div className="space-y-4">
              {formatCopies.map((format) => (
                <div
                  key={format.label}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {format.label}
                    </div>
                    <div className="font-mono text-slate-800 dark:text-slate-200">
                      {format.value}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(format.format)}
                    className="bg-accent hover:bg-accent-dark text-white px-3 py-2 min-h-[44px] rounded text-sm transition-colors"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Predefined Colors */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">
            Quick Colors
          </h3>
          <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 xl:grid-cols-18 gap-2 sm:gap-3">
            {predefinedColors.map((color) => (
              <button
                key={color}
                onClick={() => setCurrentColor(color)}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                  currentColor === color
                    ? 'border-slate-800 dark:border-white shadow-lg'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Color Harmony & Palettes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Complementary Colors */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white mb-4">
              Color Harmony
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300">Current</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-slate-300 dark:border-slate-600"
                    style={{ backgroundColor: currentColor }}
                  />
                  <span className="font-mono text-sm">{currentColor}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300">Complementary</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-slate-300 dark:border-slate-600"
                    style={{
                      backgroundColor: `hsl(${(colorFormat.hsl.h + 180) % 360}, ${colorFormat.hsl.s}%, ${colorFormat.hsl.l}%)`,
                    }}
                  />
                  <span className="font-mono text-sm">
                    hsl({(colorFormat.hsl.h + 180) % 360}, {colorFormat.hsl.s}%, {colorFormat.hsl.l}
                    %)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Color Information */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white mb-4">
              Color Information
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Brightness:</span>
                <span className="font-medium">
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
                <span className="text-slate-600 dark:text-slate-400">Lightness:</span>
                <span className="font-medium">{colorFormat.hsl.l}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Saturation:</span>
                <span className="font-medium">{colorFormat.hsl.s}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="text-accent dark:text-accent mb-4">
              <Palette className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Multiple Formats
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Convert between HEX, RGB, HSL, and CMYK color formats instantly.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="text-accent dark:text-accent mb-4">
              <Heart className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Color Harmony
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Discover complementary colors and create beautiful color palettes.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="text-accent dark:text-accent mb-4">
              <Clipboard className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Copy & Export
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              One-click copy for all color formats. Perfect for design workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
