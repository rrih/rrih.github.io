'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { useHistory } from '@/hooks/useHistory'
import { localStorageManager } from '@/lib/localStorage'
import { useUrlSharing } from '@/lib/urlSharing'
import {
  Copy,
  Download,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Settings,
  Share2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface ColorStop {
  id: string
  color: string
  position: number
}

interface GradientGeneratorState {
  gradientType: 'linear' | 'radial' | 'conic'
  angle: number
  colorStops: ColorStop[]
  radialShape: 'circle' | 'ellipse'
  radialSize: 'closest-side' | 'closest-corner' | 'farthest-side' | 'farthest-corner'
  radialPosition: string
  presets: string[]
}

export default function GradientGeneratorPage() {
  const TOOL_NAME = 'gradient-generator'

  const defaultState: GradientGeneratorState = {
    gradientType: 'linear',
    angle: 45,
    colorStops: [
      { id: '1', color: '#3b82f6', position: 0 },
      { id: '2', color: '#8b5cf6', position: 100 },
    ],
    radialShape: 'circle',
    radialSize: 'farthest-corner',
    radialPosition: 'center',
    presets: [],
  }

  const {
    state,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
  } = useHistory<GradientGeneratorState>(defaultState)

  const [isSharing, setIsSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { generateShareUrl, shareInfo, getInitialStateFromUrl } =
    useUrlSharing<GradientGeneratorState>(TOOL_NAME)

  const { gradientType, angle, colorStops, radialShape, radialSize, radialPosition, presets } =
    state

  // Client-side only state restoration
  useEffect(() => {
    const sharedState = getInitialStateFromUrl()
    if (sharedState) {
      setHistoryState(sharedState)
      return
    }

    const savedState = localStorageManager.load<GradientGeneratorState>(TOOL_NAME)
    if (savedState) {
      setHistoryState(savedState)
    }
  }, [getInitialStateFromUrl, setHistoryState])

  // Save state to localStorage
  useEffect(() => {
    localStorageManager.save(TOOL_NAME, state)
  }, [state])

  // Generate CSS gradient
  const generateGradientCSS = (): string => {
    const sortedStops = [...colorStops].sort((a, b) => a.position - b.position)
    const stopsString = sortedStops.map((stop) => `${stop.color} ${stop.position}%`).join(', ')

    switch (gradientType) {
      case 'linear':
        return `linear-gradient(${angle}deg, ${stopsString})`
      case 'radial':
        return `radial-gradient(${radialShape} ${radialSize} at ${radialPosition}, ${stopsString})`
      case 'conic':
        return `conic-gradient(from ${angle}deg at ${radialPosition}, ${stopsString})`
      default:
        return `linear-gradient(45deg, ${stopsString})`
    }
  }

  // URL sharing
  const handleShare = async () => {
    setIsSharing(true)
    try {
      const shareUrl = await generateShareUrl(state)
      await navigator.clipboard.writeText(shareUrl)

      const message = 'Share URL copied!'
      let description = 'The shareable URL has been copied to your clipboard'

      if (shareInfo.isLimited) {
        description = shareInfo.message
      }

      successToast(message, description)
    } catch (error) {
      console.error('Share failed:', error)
      errorToast('Sharing failed', 'An error occurred while generating the share URL')
    } finally {
      setIsSharing(false)
    }
  }

  // Clear data
  const handleClearData = () => {
    if (confirm('Clear all data and reset to defaults?')) {
      localStorageManager.clear(TOOL_NAME)
      clearHistory()
      setHistoryState(defaultState)
    }
  }

  // Export CSS
  const handleExportCSS = () => {
    const css = generateGradientCSS()
    const cssCode = `.gradient {
  background: ${css};
}`

    const blob = new Blob([cssCode], { type: 'text/css' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gradient-${Date.now()}.css`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Copy CSS to clipboard
  const copyCSS = async () => {
    try {
      const css = generateGradientCSS()
      await navigator.clipboard.writeText(`background: ${css};`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      successToast('CSS Copied!', 'Gradient CSS has been copied to clipboard')
    } catch (err) {
      console.error('Failed to copy:', err)
      errorToast('Copy failed', 'Failed to copy CSS to clipboard')
    }
  }

  // Add color stop
  const addColorStop = () => {
    const newPosition =
      colorStops.length > 0
        ? Math.min(100, Math.max(...colorStops.map((s) => s.position)) + 20)
        : 50

    const newStop: ColorStop = {
      id: Date.now().toString(),
      color: '#ff0000',
      position: newPosition,
    }

    setHistoryState({
      ...state,
      colorStops: [...colorStops, newStop],
    })
  }

  // Remove color stop
  const removeColorStop = (id: string) => {
    if (colorStops.length <= 2) {
      errorToast('Minimum colors', 'Gradient needs at least 2 colors')
      return
    }

    setHistoryState({
      ...state,
      colorStops: colorStops.filter((stop) => stop.id !== id),
    })
  }

  // Update color stop
  const updateColorStop = (id: string, updates: Partial<ColorStop>) => {
    setHistoryState({
      ...state,
      colorStops: colorStops.map((stop) => (stop.id === id ? { ...stop, ...updates } : stop)),
    })
  }

  // Save as preset
  const saveAsPreset = () => {
    const gradient = generateGradientCSS()
    if (presets.includes(gradient)) {
      errorToast('Already exists', 'This gradient is already saved')
      return
    }

    setHistoryState({
      ...state,
      presets: [...presets, gradient],
    })
    successToast('Preset saved!', 'Gradient saved to presets')
  }

  // Load preset
  const loadPreset = (presetCSS: string) => {
    // Simple parser for basic gradients - in real app would need robust parsing
    try {
      // This is a simplified approach for demo
      const gradient = parseGradientCSS(presetCSS)
      if (gradient) {
        setHistoryState({
          ...state,
          ...gradient,
        })
        successToast('Preset loaded!', 'Gradient preset applied')
      }
    } catch (_error) {
      errorToast('Load failed', 'Failed to load gradient preset')
    }
  }

  // Simple gradient CSS parser (simplified for demo)
  const parseGradientCSS = (css: string): Partial<GradientGeneratorState> | null => {
    // This is a very basic parser - production would need comprehensive parsing
    if (css.includes('linear-gradient')) {
      return { gradientType: 'linear' }
    }
    if (css.includes('radial-gradient')) {
      return { gradientType: 'radial' }
    }
    if (css.includes('conic-gradient')) {
      return { gradientType: 'conic' }
    }
    return null
  }

  // Remove preset
  const removePreset = (preset: string) => {
    setHistoryState({
      ...state,
      presets: presets.filter((p) => p !== preset),
    })
  }

  // Reset gradient
  const resetGradient = () => {
    setHistoryState(defaultState)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 py-3 xs:py-4 sm:py-6 md:py-12">
        <Header />

        <main>
          {/* Hero Section */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-2 xs:mb-3 sm:mb-4 text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                CSS Gradient Generator
              </h1>
              <p className="mb-4 xs:mb-6 text-sm xs:text-base sm:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary px-2 xs:px-0">
                Create beautiful CSS gradients with live preview and custom controls.
              </p>
            </div>
          </section>

          {/* Main Interface */}
          <section className="grid gap-4 xs:gap-6 grid-cols-1 lg:grid-cols-[1fr,2fr] overflow-hidden">
            {/* Controls Panel */}
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg min-w-0">
              <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Gradient Controls
                </h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                  Configure gradient type and properties
                </p>
              </div>
              <div className="p-3 xs:p-4 sm:p-4 md:p-6 space-y-4 xs:space-y-6">
                {/* Gradient Type */}
                <div>
                  <label htmlFor="gradient-type" className="text-sm font-medium mb-3 block">
                    Gradient Type
                  </label>
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                    {(['linear', 'radial', 'conic'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setHistoryState({ ...state, gradientType: type })}
                        className={`px-2 xs:px-3 py-2 rounded-lg text-xs xs:text-sm font-medium transition-all min-h-[44px] ${
                          gradientType === type
                            ? 'bg-accent text-white'
                            : 'border border-border-light dark:border-border-dark hover:border-accent'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Angle/Direction */}
                {(gradientType === 'linear' || gradientType === 'conic') && (
                  <div>
                    <label htmlFor="angle" className="text-sm font-medium mb-2 block">
                      {gradientType === 'linear' ? 'Angle' : 'Start Angle'}: {angle}°
                    </label>
                    <input
                      id="angle"
                      type="range"
                      min="0"
                      max="360"
                      value={angle}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          angle: Number(e.target.value),
                        })
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 min-w-0"
                    />
                  </div>
                )}

                {/* Radial Gradient Options */}
                {gradientType === 'radial' && (
                  <>
                    <div>
                      <label htmlFor="radial-shape" className="text-sm font-medium mb-2 block">
                        Shape
                      </label>
                      <select
                        id="radial-shape"
                        value={radialShape}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            radialShape: e.target.value as 'circle' | 'ellipse',
                          })
                        }
                        className="w-full min-w-0 px-2 xs:px-3 py-2 text-xs xs:text-sm border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      >
                        <option value="circle">Circle</option>
                        <option value="ellipse">Ellipse</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="radial-size" className="text-sm font-medium mb-2 block">
                        Size
                      </label>
                      <select
                        id="radial-size"
                        value={radialSize}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            radialSize: e.target.value as
                              | 'closest-side'
                              | 'closest-corner'
                              | 'farthest-side'
                              | 'farthest-corner',
                          })
                        }
                        className="w-full min-w-0 px-2 xs:px-3 py-2 text-xs xs:text-sm border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      >
                        <option value="closest-side">Closest Side</option>
                        <option value="closest-corner">Closest Corner</option>
                        <option value="farthest-side">Farthest Side</option>
                        <option value="farthest-corner">Farthest Corner</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="radial-position" className="text-sm font-medium mb-2 block">
                        Position
                      </label>
                      <select
                        id="radial-position"
                        value={radialPosition}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            radialPosition: e.target.value,
                          })
                        }
                        className="w-full min-w-0 px-2 xs:px-3 py-2 text-xs xs:text-sm border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      >
                        <option value="center">Center</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="top left">Top Left</option>
                        <option value="top right">Top Right</option>
                        <option value="bottom left">Bottom Left</option>
                        <option value="bottom right">Bottom Right</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Color Stops */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label htmlFor="color-stops" className="text-sm font-medium">
                      Color Stops
                    </label>
                    <button
                      onClick={addColorStop}
                      className="flex items-center gap-1 px-2 py-1 bg-accent text-white rounded text-xs hover:bg-accent-dark transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-3">
                    {colorStops.map((stop) => (
                      <div key={stop.id} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={stop.color}
                          onChange={(e) => updateColorStop(stop.id, { color: e.target.value })}
                          className="w-8 h-8 rounded border border-border-light dark:border-border-dark cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={stop.position}
                          onChange={(e) =>
                            updateColorStop(stop.id, {
                              position: Number(e.target.value),
                            })
                          }
                          className="w-16 px-2 py-1 text-xs border border-border-light dark:border-border-dark rounded bg-white dark:bg-background-dark"
                        />
                        <span className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
                          %
                        </span>
                        <button
                          onClick={() => removeColorStop(stop.id)}
                          disabled={colorStops.length <= 2}
                          className="ml-auto p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-red-950"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-4 border-t border-border-light dark:border-border-dark">
                  <button
                    onClick={copyCSS}
                    className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 min-h-[44px] text-white font-medium text-sm transition-all hover:bg-accent-dark hover:shadow-lg active:scale-95"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Copied!' : 'Copy CSS'}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={saveAsPreset}
                      className="flex items-center justify-center gap-2 rounded-lg border border-border-light px-3 py-2 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent dark:border-border-dark"
                    >
                      <Palette className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={resetGradient}
                      className="flex items-center justify-center gap-2 rounded-lg border border-border-light px-3 py-2 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent dark:border-border-dark"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset
                    </button>
                  </div>

                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className="flex items-center justify-center gap-2 rounded-lg border border-border-light px-3 py-2 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark"
                    >
                      <Share2 className="w-3 h-3" />
                      Share
                    </button>
                    <button
                      onClick={handleExportCSS}
                      className="flex items-center justify-center gap-2 rounded-lg border border-border-light px-3 py-2 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent dark:border-border-dark"
                    >
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                    <button
                      onClick={handleClearData}
                      className="flex items-center justify-center gap-2 rounded-lg border border-red-300 px-3 py-2 min-h-[44px] font-medium text-sm text-red-600 transition-all hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={undo}
                      disabled={!canUndo}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border-light px-3 py-2 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark"
                    >
                      <Undo2 className="w-4 h-4" />
                      Undo
                    </button>
                    <button
                      onClick={redo}
                      disabled={!canRedo}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border-light px-3 py-2 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark"
                    >
                      <Redo2 className="w-4 h-4" />
                      Redo
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview & Output Panel */}
            <div className="space-y-4 xs:space-y-6 min-w-0">
              {/* Live Preview */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg min-w-0">
                <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-lg font-semibold">Live Preview</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    See your gradient in real-time
                  </p>
                </div>
                <div className="p-3 sm:p-4 md:p-6">
                  <div
                    className="w-full h-48 rounded-lg border border-border-light dark:border-border-dark"
                    style={{
                      background: generateGradientCSS(),
                    }}
                  />
                </div>
              </div>

              {/* CSS Output */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg min-w-0">
                <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-lg font-semibold">Generated CSS</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    Copy and use in your projects
                  </p>
                </div>
                <div className="p-3 sm:p-4 md:p-6">
                  <pre className="bg-gray-50 dark:bg-gray-900 p-3 xs:p-4 rounded-lg text-xs xs:text-sm font-mono overflow-x-auto max-w-full">
                    <code>{`background: ${generateGradientCSS()};`}</code>
                  </pre>
                </div>
              </div>

              {/* Saved Presets */}
              {presets.length > 0 && (
                <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg min-w-0">
                  <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                    <h3 className="text-lg font-semibold">Saved Presets</h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                      Your saved gradients
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 md:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {presets.map((preset, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Static preset array order never changes
                        <div key={`preset-${index}`} className="relative group">
                          <div
                            className="w-full h-16 rounded-lg border border-border-light dark:border-border-dark cursor-pointer transition-transform hover:scale-105"
                            style={{ background: preset }}
                            onClick={() => loadPreset(preset)}
                          />
                          <button
                            onClick={() => removePreset(preset)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Features Section */}
          <section className="hidden xs:block mb-8 sm:mb-12 md:mb-16 mt-8 sm:mt-12">
            <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
              Why Use Our Gradient Generator?
            </h2>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Palette,
                  title: 'Live Preview',
                  description:
                    'See your gradient changes instantly with real-time preview and editing.',
                },
                {
                  icon: Copy,
                  title: 'Ready-to-Use CSS',
                  description:
                    'Get clean, optimized CSS code that works across all modern browsers.',
                },
                {
                  icon: Settings,
                  title: 'Full Control',
                  description:
                    'Fine-tune every aspect: colors, positions, angles, and gradient types.',
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

          {/* Content Sections for SEO */}
          <section className="mb-8 sm:mb-12 md:mb-16 border-t border-border-light dark:border-border-dark pt-8 sm:pt-12">
            {/* About This Tool */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                About CSS Gradient Generator
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Our CSS Gradient Generator is a powerful tool for creating beautiful, professional
                  gradients for your web projects. CSS gradients have become an essential part of
                  modern web design, allowing developers to create smooth color transitions without
                  the need for image files. This reduces load times, improves scalability, and
                  provides crisp visuals on all screen densities including high-DPI displays.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  The tool supports all three types of CSS gradients: linear gradients for
                  straight-line color transitions, radial gradients for circular or elliptical
                  patterns, and conic gradients for cone-shaped color wheels. Each gradient type
                  offers unique possibilities for creative design, from subtle background effects to
                  bold graphical elements. The real-time preview ensures you see exactly how your
                  gradient will appear in browsers.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                  With an intuitive color picker interface and precise control over color stops and
                  positions, you can create anything from simple two-color fades to complex
                  multi-color compositions. The generated CSS is optimized for all modern browsers
                  and can be easily integrated into your stylesheets or CSS-in-JS solutions.
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
                  <h3 className="font-semibold text-lg mb-2">Step 1: Choose Gradient Type</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Select between linear, radial, or conic gradient types. Linear creates
                    straight-line transitions, radial creates circular patterns, and conic creates
                    cone-shaped color wheels.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 2: Adjust Direction and Shape</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    For linear gradients, set the angle. For radial gradients, choose shape, size,
                    and position. For conic gradients, adjust the starting angle and center point.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 3: Configure Color Stops</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Add, remove, and adjust color stops. Each stop has a color and position
                    percentage. Click colors to open the color picker and drag positions to
                    fine-tune the gradient.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 4: Copy and Use CSS</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Preview your gradient in real-time, then copy the generated CSS code to use in
                    your projects. Save favorite gradients as presets for quick access later.
                  </p>
                </div>
              </div>
            </div>

            {/* Key Features */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Key Features
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Multiple Gradient Types</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Support for linear, radial, and conic gradients with full customization options.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Real-time Preview</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    See changes instantly as you adjust colors, positions, and gradient properties.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Color Stop Management</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Add unlimited color stops with precise position control and easy color
                    selection.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Preset System</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Save your favorite gradients and quickly load them for future projects.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Clean CSS Output</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Generate optimized CSS code that works across all modern browsers.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Export Options</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Copy to clipboard or download as CSS file for easy integration into projects.
                  </p>
                </div>
              </div>
            </div>

            {/* Examples */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Examples
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Example 1: Hero Background</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <div
                      className="mb-3 h-20 rounded"
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      }}
                    />
                    <p className="text-sm mb-2">
                      Perfect for hero sections and call-to-action buttons
                    </p>
                    <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    </code>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Example 2: Card Hover Effect</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <div
                      className="mb-3 h-20 rounded"
                      style={{
                        background: 'linear-gradient(45deg, #fa709a 0%, #fee140 100%)',
                      }}
                    />
                    <p className="text-sm mb-2">Vibrant gradient for interactive elements</p>
                    <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
                      background: linear-gradient(45deg, #fa709a 0%, #fee140 100%);
                    </code>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Example 3: Radial Spotlight</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <div
                      className="mb-3 h-20 rounded"
                      style={{
                        background:
                          'radial-gradient(circle at center, #ff6b6b 0%, #4ecdc4 50%, #45b7d1 100%)',
                      }}
                    />
                    <p className="text-sm mb-2">Radial gradient for spotlight or focus effects</p>
                    <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
                      background: radial-gradient(circle at center, #ff6b6b 0%, #4ecdc4 50%, #45b7d1
                      100%);
                    </code>
                  </div>
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
                    What's the difference between gradient types?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Linear gradients create straight-line color transitions in any direction. Radial
                    gradients create circular or elliptical patterns radiating from a center point.
                    Conic gradients create cone-shaped color wheels, perfect for pie charts or color
                    wheels.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Are CSS gradients supported in all browsers?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    CSS gradients are well-supported in all modern browsers. Linear and radial
                    gradients work in Internet Explorer 10+ and all versions of Chrome, Firefox,
                    Safari, and Edge. Conic gradients are supported in newer browser versions
                    (Chrome 69+, Firefox 83+, Safari 12.1+).
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    How do I use the generated CSS?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Copy the generated CSS and apply it to any element's background property. You
                    can use it in regular CSS files, inline styles, or CSS-in-JS solutions. The
                    gradient will automatically scale to fit the element's dimensions.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I create transparent gradients?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Yes! Use the color picker to select colors with transparency (alpha channel), or
                    manually edit the CSS to use rgba() or hsla() color values. This is perfect for
                    overlay effects and blending gradients with background content.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    How many color stops can I add?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    You can add as many color stops as needed. However, for performance reasons,
                    it's recommended to keep the number reasonable (typically 2-10 stops). Too many
                    stops might make the gradient appear busy and can impact rendering performance.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What's the best gradient angle for buttons?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    For buttons, subtle gradients work best. Try angles between 0-45 degrees with
                    colors that are close in hue but different in brightness. A slight gradient from
                    lighter at the top to darker at the bottom (180deg) creates a natural,
                    three-dimensional appearance.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I animate CSS gradients?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Yes, but with limitations. You can animate gradient positions and some
                    properties, but you cannot directly animate between different gradient types.
                    For smooth animations, consider animating the background-position of a larger
                    gradient or using CSS transitions with opacity overlays.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    How do gradients affect page performance?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    CSS gradients are generally very efficient since they're rendered by the GPU.
                    They're much faster than loading image files and scale perfectly to any size.
                    Complex gradients with many color stops may have a slight performance impact,
                    but it's typically negligible compared to images.
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
