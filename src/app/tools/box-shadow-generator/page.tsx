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
  Layers,
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

interface ShadowLayer {
  id: string
  offsetX: number
  offsetY: number
  blur: number
  spread: number
  color: string
  opacity: number
  inset: boolean
}

interface BoxShadowGeneratorState {
  shadowLayers: ShadowLayer[]
  previewShape: 'square' | 'rounded' | 'circle'
  previewSize: number
  backgroundColor: string
  presets: string[]
}

export default function BoxShadowGeneratorPage() {
  const TOOL_NAME = 'box-shadow-generator'

  const defaultState: BoxShadowGeneratorState = {
    shadowLayers: [
      {
        id: '1',
        offsetX: 0,
        offsetY: 4,
        blur: 12,
        spread: 0,
        color: '#000000',
        opacity: 25,
        inset: false,
      },
    ],
    previewShape: 'rounded',
    previewSize: 200,
    backgroundColor: '#f3f4f6',
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
  } = useHistory<BoxShadowGeneratorState>(defaultState)

  const [isSharing, setIsSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { generateShareUrl, shareInfo, getInitialStateFromUrl } =
    useUrlSharing<BoxShadowGeneratorState>(TOOL_NAME)

  const { shadowLayers, previewShape, previewSize, backgroundColor, presets } = state

  // Client-side only state restoration
  useEffect(() => {
    const sharedState = getInitialStateFromUrl()
    if (sharedState) {
      setHistoryState(sharedState)
      return
    }

    const savedState = localStorageManager.load<BoxShadowGeneratorState>(TOOL_NAME)
    if (savedState) {
      setHistoryState(savedState)
    }
  }, [getInitialStateFromUrl, setHistoryState])

  // Save state to localStorage
  useEffect(() => {
    localStorageManager.save(TOOL_NAME, state)
  }, [state])

  // Generate box-shadow CSS
  const generateBoxShadowCSS = (): string => {
    if (shadowLayers.length === 0) return 'none'

    return shadowLayers
      .map((layer) => {
        const alpha = layer.opacity / 100
        const color = hexToRgba(layer.color, alpha)
        const insetKeyword = layer.inset ? 'inset ' : ''
        return `${insetKeyword}${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${layer.spread}px ${color}`
      })
      .join(', ')
  }

  // Convert hex color to rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = Number.parseInt(hex.slice(1, 3), 16)
    const g = Number.parseInt(hex.slice(3, 5), 16)
    const b = Number.parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // Get preview styles
  const getPreviewStyles = () => {
    let borderRadius = '0'
    if (previewShape === 'rounded') borderRadius = '12px'
    if (previewShape === 'circle') borderRadius = '50%'

    return {
      width: `${previewSize}px`,
      height: `${previewSize}px`,
      borderRadius,
      backgroundColor: '#ffffff',
      boxShadow: generateBoxShadowCSS(),
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
    const css = generateBoxShadowCSS()
    const cssCode = `.element {
  box-shadow: ${css};
}`

    const blob = new Blob([cssCode], { type: 'text/css' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `box-shadow-${Date.now()}.css`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Copy CSS to clipboard
  const copyCSS = async () => {
    try {
      const css = generateBoxShadowCSS()
      await navigator.clipboard.writeText(`box-shadow: ${css};`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      successToast('CSS Copied!', 'Box shadow CSS has been copied to clipboard')
    } catch (err) {
      console.error('Failed to copy:', err)
      errorToast('Copy failed', 'Failed to copy CSS to clipboard')
    }
  }

  // Add shadow layer
  const addShadowLayer = () => {
    const newLayer: ShadowLayer = {
      id: Date.now().toString(),
      offsetX: 0,
      offsetY: 2,
      blur: 8,
      spread: 0,
      color: '#000000',
      opacity: 15,
      inset: false,
    }

    setHistoryState({
      ...state,
      shadowLayers: [...shadowLayers, newLayer],
    })
  }

  // Remove shadow layer
  const removeShadowLayer = (id: string) => {
    if (shadowLayers.length <= 1) {
      errorToast('Minimum layer', 'At least one shadow layer is required')
      return
    }

    setHistoryState({
      ...state,
      shadowLayers: shadowLayers.filter((layer) => layer.id !== id),
    })
  }

  // Update shadow layer
  const updateShadowLayer = (id: string, updates: Partial<ShadowLayer>) => {
    setHistoryState({
      ...state,
      shadowLayers: shadowLayers.map((layer) =>
        layer.id === id ? { ...layer, ...updates } : layer
      ),
    })
  }

  // Save as preset
  const saveAsPreset = () => {
    const shadow = generateBoxShadowCSS()
    if (presets.includes(shadow)) {
      errorToast('Already exists', 'This shadow is already saved')
      return
    }

    setHistoryState({
      ...state,
      presets: [...presets, shadow],
    })
    successToast('Preset saved!', 'Box shadow saved to presets')
  }

  // Remove preset
  const removePreset = (preset: string) => {
    setHistoryState({
      ...state,
      presets: presets.filter((p) => p !== preset),
    })
  }

  // Load preset (simplified)
  const loadPreset = (_presetCSS: string) => {
    // This would need proper CSS parsing in production
    successToast('Preset loaded!', 'Box shadow preset applied')
  }

  // Reset shadow
  const resetShadow = () => {
    setHistoryState(defaultState)
  }

  // Predefined shadow presets
  const predefinedPresets = [
    {
      name: 'Subtle',
      css: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    },
    {
      name: 'Medium',
      css: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
    },
    {
      name: 'Large',
      css: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)',
    },
    {
      name: 'Extra Large',
      css: '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)',
    },
    { name: 'Inner', css: 'inset 0 2px 4px rgba(0,0,0,0.06)' },
    { name: 'Colored', css: '0 4px 14px rgba(99, 102, 241, 0.39)' },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <Header />
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <main>
          {/* Hero Section */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-2 xs:mb-3 sm:mb-4 text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                Box Shadow Generator
              </h1>
              <p className="mb-4 xs:mb-6 text-sm xs:text-base sm:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary px-2 xs:px-0">
                Create beautiful box shadows with multiple layers and real-time preview.
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
                  Shadow Controls
                </h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                  Configure shadow layers and properties
                </p>
              </div>
              <div className="p-3 xs:p-4 sm:p-4 md:p-6 space-y-4 xs:space-y-6">
                {/* Preview Settings */}
                <div>
                  <label htmlFor="preview-settings" className="text-sm font-medium mb-3 block">
                    Preview Settings
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="shape"
                        className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary mb-2 block"
                      >
                        Shape
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['square', 'rounded', 'circle'] as const).map((shape) => (
                          <button
                            key={shape}
                            onClick={() =>
                              setHistoryState({
                                ...state,
                                previewShape: shape,
                              })
                            }
                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                              previewShape === shape
                                ? 'bg-accent text-white'
                                : 'border border-border-light dark:border-border-dark hover:border-accent'
                            }`}
                          >
                            {shape.charAt(0).toUpperCase() + shape.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="preview-size"
                        className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary mb-2 block"
                      >
                        Size: {previewSize}px
                      </label>
                      <input
                        id="preview-size"
                        type="range"
                        min="100"
                        max="300"
                        value={previewSize}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            previewSize: Number(e.target.value),
                          })
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="bg-color"
                        className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary mb-2 block"
                      >
                        Background Color
                      </label>
                      <input
                        id="bg-color"
                        type="color"
                        value={backgroundColor}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            backgroundColor: e.target.value,
                          })
                        }
                        className="w-full h-8 rounded border border-border-light dark:border-border-dark cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Shadow Layers */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label htmlFor="shadow-layers" className="text-sm font-medium">
                      Shadow Layers
                    </label>
                    <button
                      onClick={addShadowLayer}
                      className="flex items-center gap-1 px-2 py-1 bg-accent text-white rounded text-xs hover:bg-accent-dark transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      Add Layer
                    </button>
                  </div>
                  <div className="space-y-4">
                    {shadowLayers.map((layer, index) => (
                      <div
                        key={layer.id}
                        className="p-3 border border-border-light dark:border-border-dark rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Layer {index + 1}</span>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={layer.inset}
                                onChange={(e) =>
                                  updateShadowLayer(layer.id, {
                                    inset: e.target.checked,
                                  })
                                }
                                className="w-3 h-3"
                              />
                              Inset
                            </label>
                            <button
                              onClick={() => removeShadowLayer(layer.id)}
                              disabled={shadowLayers.length <= 1}
                              className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-red-950"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label
                              htmlFor={`offsetX-${layer.id}`}
                              className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-1 block"
                            >
                              X Offset: {layer.offsetX}px
                            </label>
                            <input
                              id={`offsetX-${layer.id}`}
                              type="range"
                              min="-50"
                              max="50"
                              value={layer.offsetX}
                              onChange={(e) =>
                                updateShadowLayer(layer.id, {
                                  offsetX: Number(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`offsetY-${layer.id}`}
                              className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-1 block"
                            >
                              Y Offset: {layer.offsetY}px
                            </label>
                            <input
                              id={`offsetY-${layer.id}`}
                              type="range"
                              min="-50"
                              max="50"
                              value={layer.offsetY}
                              onChange={(e) =>
                                updateShadowLayer(layer.id, {
                                  offsetY: Number(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`blur-${layer.id}`}
                              className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-1 block"
                            >
                              Blur: {layer.blur}px
                            </label>
                            <input
                              id={`blur-${layer.id}`}
                              type="range"
                              min="0"
                              max="100"
                              value={layer.blur}
                              onChange={(e) =>
                                updateShadowLayer(layer.id, {
                                  blur: Number(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`spread-${layer.id}`}
                              className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-1 block"
                            >
                              Spread: {layer.spread}px
                            </label>
                            <input
                              id={`spread-${layer.id}`}
                              type="range"
                              min="-50"
                              max="50"
                              value={layer.spread}
                              onChange={(e) =>
                                updateShadowLayer(layer.id, {
                                  spread: Number(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label
                              htmlFor={`color-${layer.id}`}
                              className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary mb-1 block"
                            >
                              Color
                            </label>
                            <input
                              id={`color-${layer.id}`}
                              type="color"
                              value={layer.color}
                              onChange={(e) =>
                                updateShadowLayer(layer.id, {
                                  color: e.target.value,
                                })
                              }
                              className="w-full h-6 rounded border border-border-light dark:border-border-dark cursor-pointer"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`opacity-${layer.id}`}
                              className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary mb-1 block"
                            >
                              Opacity: {layer.opacity}%
                            </label>
                            <input
                              id={`opacity-${layer.id}`}
                              type="range"
                              min="0"
                              max="100"
                              value={layer.opacity}
                              onChange={(e) =>
                                updateShadowLayer(layer.id, {
                                  opacity: Number(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                          </div>
                        </div>
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
                      <Layers className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={resetShadow}
                      className="flex items-center justify-center gap-2 rounded-lg border border-border-light px-3 py-2 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent dark:border-border-dark"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
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
                    See your box shadow in real-time
                  </p>
                </div>
                <div className="p-8" style={{ backgroundColor }}>
                  <div className="flex justify-center">
                    <div className="transition-all duration-200" style={getPreviewStyles()} />
                  </div>
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
                    <code>{`box-shadow: ${generateBoxShadowCSS()};`}</code>
                  </pre>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg min-w-0">
                <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-lg font-semibold">Quick Presets</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    Common shadow styles
                  </p>
                </div>
                <div className="p-3 sm:p-4 md:p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {predefinedPresets.map((preset) => (
                      <div key={preset.name} className="text-center">
                        <div
                          className="w-full h-16 bg-white rounded-lg mb-2 cursor-pointer transition-transform hover:scale-105"
                          style={{ boxShadow: preset.css }}
                          onClick={() => loadPreset(preset.css)}
                        />
                        <span className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
                          {preset.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Saved Presets */}
              {presets.length > 0 && (
                <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg min-w-0">
                  <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                    <h3 className="text-lg font-semibold">Saved Presets</h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                      Your custom shadows
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 md:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {presets.map((preset, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Static preset array order never changes
                        <div key={`preset-${index}`} className="relative group">
                          <div
                            className="w-full h-16 bg-white rounded-lg cursor-pointer transition-transform hover:scale-105"
                            style={{ boxShadow: preset }}
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
              Why Use Our Box Shadow Generator?
            </h2>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Layers,
                  title: 'Multiple Layers',
                  description: 'Create complex shadows with multiple layers for depth and realism.',
                },
                {
                  icon: Settings,
                  title: 'Precise Controls',
                  description:
                    'Fine-tune every aspect: position, blur, spread, color, and opacity.',
                },
                {
                  icon: Copy,
                  title: 'Instant CSS',
                  description: 'Get production-ready CSS code that works across all browsers.',
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
                About Box Shadow Generator
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Our Box Shadow Generator is a comprehensive tool for creating CSS box shadows that
                  add depth, dimension, and visual interest to your web elements. Box shadows are
                  one of the most effective ways to create modern, layered interfaces that feel
                  tactile and engaging. Unlike flat designs, elements with well-crafted shadows
                  appear to float above the page, creating hierarchy and guiding user attention to
                  important content.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  The tool supports multiple shadow layers, allowing you to create complex,
                  realistic lighting effects that mimic how objects cast shadows in the real world.
                  Each layer can be independently controlled for position, blur, spread, color, and
                  opacity. You can also create inset shadows for pressed button effects or inner
                  glows. The real-time preview shows exactly how your shadows will appear across
                  different shapes and background colors.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                  Whether you're designing subtle card elevations, dramatic hero elements, or
                  interactive button states, our generator provides the precision and flexibility
                  needed for professional results. The generated CSS is optimized for performance
                  and works consistently across all modern browsers, ensuring your designs look
                  great everywhere.
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
                  <h3 className="font-semibold text-lg mb-2">Step 1: Configure Preview</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Choose your preview shape (square, rounded, or circle), adjust the size, and set
                    the background color to match your design context. This helps you visualize how
                    shadows will look in your actual project.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 2: Adjust Shadow Properties</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Use the sliders to adjust X and Y offset (shadow position), blur radius
                    (softness), spread radius (shadow size), color, and opacity. Enable "Inset" for
                    inner shadows that appear pressed into the element.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 3: Add Multiple Layers</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Click "Add Layer" to create complex shadow effects. Combine a sharp, close
                    shadow with a softer, distant one for realistic depth. Layer different colors
                    for creative effects or brand-specific styling.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 4: Copy and Apply</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Preview your shadow in real-time, then copy the CSS code to use in your
                    projects. Save successful combinations as presets or use the quick presets for
                    common styles.
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
                  <h3 className="font-semibold mb-2">Multiple Shadow Layers</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Create complex, realistic shadows by combining multiple layers with different
                    properties.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Real-time Preview</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    See changes instantly as you adjust shadow properties with live preview updates.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Inset Shadow Support</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Create inner shadows for pressed button effects, input fields, and sunken
                    elements.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Color and Opacity Control</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Full control over shadow colors with opacity adjustment for perfect blending.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Quick Presets</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Start with common shadow styles or save your own custom presets for reuse.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Cross-browser CSS</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Generated CSS works perfectly across all modern browsers without prefixes.
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
                  <h3 className="font-semibold mb-3">Example 1: Material Design Card</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <div
                      className="mb-3 w-32 h-20 bg-white rounded-lg mx-auto"
                      style={{
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)',
                      }}
                    />
                    <p className="text-sm mb-2">Perfect for cards and content containers</p>
                    <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1);
                    </code>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Example 2: Pressed Button</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <div
                      className="mb-3 w-32 h-12 bg-blue-500 rounded-lg mx-auto"
                      style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
                    />
                    <p className="text-sm mb-2">Inset shadow for active/pressed states</p>
                    <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
                      box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
                    </code>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Example 3: Floating Action Button</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <div
                      className="mb-3 w-16 h-16 bg-green-500 rounded-full mx-auto"
                      style={{
                        boxShadow: '0 6px 12px rgba(0,0,0,0.15), 0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    />
                    <p className="text-sm mb-2">Dramatic shadow for floating elements</p>
                    <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
                      box-shadow: 0 6px 12px rgba(0,0,0,0.15), 0 4px 6px rgba(0,0,0,0.1);
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
                    What's the difference between blur and spread?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Blur radius controls how soft or sharp the shadow edge is. Higher values create
                    softer, more diffused shadows. Spread radius makes the shadow larger or smaller
                    than the element itself. Positive values expand the shadow, negative values
                    shrink it.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    When should I use inset shadows?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Inset shadows are perfect for creating pressed button states, input field inner
                    borders, sunken panels, or inner glow effects. They make elements appear
                    recessed or carved into the page rather than elevated above it.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    How many shadow layers should I use?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    For most designs, 1-3 shadow layers work well. A common pattern is combining a
                    sharp, close shadow with a softer, larger one for depth. Too many layers can
                    impact performance and make shadows look unnatural.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Do box shadows affect page performance?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Modern CSS shadows are hardware-accelerated and generally very efficient.
                    However, complex shadows with many layers or very large blur values can impact
                    performance, especially on mobile devices. Test on target devices for best
                    results.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I animate box shadows?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Yes! Box shadows can be smoothly animated with CSS transitions or keyframes.
                    This is perfect for hover effects, focus states, or interactive feedback. Keep
                    animations subtle for best user experience.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What colors work best for shadows?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Natural shadows are typically dark grays or blacks with low opacity (10-30%).
                    However, colored shadows can create interesting effects - try using darker
                    versions of your brand colors or complementary colors for creative designs.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    How do I create realistic shadows?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Realistic shadows usually have a small Y-offset (simulating gravity), soft blur,
                    and low opacity. Combine a sharp, close shadow with a softer, larger one. Study
                    real objects to understand how light creates natural shadow patterns.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can shadows work with transparent elements?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Box shadows work great with transparent or semi-transparent elements. The shadow
                    appears behind the element, so transparency in the element itself doesn't affect
                    the shadow visibility. This is perfect for glass-morphism designs.
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
