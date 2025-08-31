'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useToolState } from '@/lib/localStorage'
import { useUrlSharing } from '@/lib/urlSharing'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Download,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Share2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface AnimationKeyframe {
  id: string
  percentage: number
  transform: string
  opacity: number
  backgroundColor: string
  borderRadius: number
  scale: number
  rotate: number
  translateX: number
  translateY: number
}

interface AnimationState {
  name: string
  duration: number
  timingFunction: string
  delay: number
  iterationCount: string
  direction: string
  fillMode: string
  keyframes: AnimationKeyframe[]
  previewShape: 'square' | 'circle' | 'rounded'
  previewSize: number
  isPlaying: boolean
}

const TOOL_NAME = 'animation-generator'

const defaultKeyframe: Omit<AnimationKeyframe, 'id' | 'percentage'> = {
  transform: '',
  opacity: 1,
  backgroundColor: '#3b82f6',
  borderRadius: 0,
  scale: 1,
  rotate: 0,
  translateX: 0,
  translateY: 0,
}

const initialState: AnimationState = {
  name: 'custom-animation',
  duration: 2,
  timingFunction: 'ease-in-out',
  delay: 0,
  iterationCount: 'infinite',
  direction: 'normal',
  fillMode: 'both',
  keyframes: [
    { id: '1', percentage: 0, ...defaultKeyframe },
    { id: '2', percentage: 100, ...defaultKeyframe, scale: 1.2, rotate: 360 },
  ],
  previewShape: 'square',
  previewSize: 100,
  isPlaying: true,
}

const presetAnimations = [
  {
    name: 'Bounce',
    keyframes: [
      { percentage: 0, scale: 1, translateY: 0 },
      { percentage: 50, scale: 1.1, translateY: -20 },
      { percentage: 100, scale: 1, translateY: 0 },
    ],
  },
  {
    name: 'Fade In',
    keyframes: [
      { percentage: 0, opacity: 0 },
      { percentage: 100, opacity: 1 },
    ],
  },
  {
    name: 'Slide In Right',
    keyframes: [
      { percentage: 0, translateX: 100, opacity: 0 },
      { percentage: 100, translateX: 0, opacity: 1 },
    ],
  },
  {
    name: 'Rotate',
    keyframes: [
      { percentage: 0, rotate: 0 },
      { percentage: 100, rotate: 360 },
    ],
  },
  {
    name: 'Pulse',
    keyframes: [
      { percentage: 0, scale: 1 },
      { percentage: 50, scale: 1.2 },
      { percentage: 100, scale: 1 },
    ],
  },
  {
    name: 'Shake',
    keyframes: [
      { percentage: 0, translateX: 0 },
      { percentage: 25, translateX: -10 },
      { percentage: 50, translateX: 10 },
      { percentage: 75, translateX: -10 },
      { percentage: 100, translateX: 0 },
    ],
  },
]

const timingFunctions = [
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'cubic-bezier(0.25, 0.1, 0.25, 1)',
  'cubic-bezier(0.42, 0, 0.58, 1)',
  'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
]

const iterationCounts = ['1', '2', '3', '5', '10', 'infinite']
const directions = ['normal', 'reverse', 'alternate', 'alternate-reverse']
const fillModes = ['none', 'forwards', 'backwards', 'both']

export default function AnimationGeneratorPage() {
  const [state, setState] = useState<AnimationState>(initialState)
  const [copied, setCopied] = useState(false)
  const [showToast, setShowToast] = useState(false)

  const [savedState, setSavedState, clearSavedState] = useToolState<AnimationState>(
    TOOL_NAME,
    initialState
  )
  const { generateShareUrl, shareInfo, getInitialStateFromUrl } =
    useUrlSharing<AnimationState>(TOOL_NAME)

  useEffect(() => {
    const urlState = getInitialStateFromUrl()
    if (urlState) {
      setState(urlState)
    } else if (savedState !== initialState) {
      setState(savedState)
    }
  }, [getInitialStateFromUrl, savedState])

  useEffect(() => {
    setSavedState(state)
  }, [state, setSavedState])

  const generateKeyframes = useCallback(() => {
    return state.keyframes
      .sort((a, b) => a.percentage - b.percentage)
      .map((keyframe) => {
        const transforms = []
        if (keyframe.translateX !== 0) transforms.push(`translateX(${keyframe.translateX}px)`)
        if (keyframe.translateY !== 0) transforms.push(`translateY(${keyframe.translateY}px)`)
        if (keyframe.scale !== 1) transforms.push(`scale(${keyframe.scale})`)
        if (keyframe.rotate !== 0) transforms.push(`rotate(${keyframe.rotate}deg)`)

        const properties = []
        if (transforms.length > 0) properties.push(`transform: ${transforms.join(' ')}`)
        if (keyframe.opacity !== 1) properties.push(`opacity: ${keyframe.opacity}`)
        if (keyframe.backgroundColor !== '#3b82f6')
          properties.push(`background-color: ${keyframe.backgroundColor}`)
        if (keyframe.borderRadius !== 0)
          properties.push(`border-radius: ${keyframe.borderRadius}px`)

        return `  ${keyframe.percentage}% {
    ${properties.join(';\n    ')}${properties.length > 0 ? ';' : ''}
  }`
      })
      .join('\n')
  }, [state.keyframes])

  const generateCSS = useCallback(() => {
    const keyframesCSS = generateKeyframes()

    return `@keyframes ${state.name} {
${keyframesCSS}
}

.animated-element {
  animation: ${state.name} ${state.duration}s ${state.timingFunction} ${state.delay}s ${state.iterationCount} ${state.direction} ${state.fillMode};
}`
  }, [state, generateKeyframes])

  const addKeyframe = useCallback(() => {
    const newId = Date.now().toString()
    const existingPercentages = state.keyframes.map((k) => k.percentage)
    const maxPercentage = Math.max(...existingPercentages)
    const newPercentage = Math.min(100, maxPercentage + 25)

    setState((prev) => ({
      ...prev,
      keyframes: [
        ...prev.keyframes,
        {
          id: newId,
          percentage: newPercentage,
          ...defaultKeyframe,
        },
      ],
    }))
  }, [state.keyframes])

  const removeKeyframe = useCallback(
    (id: string) => {
      if (state.keyframes.length <= 2) return
      setState((prev) => ({
        ...prev,
        keyframes: prev.keyframes.filter((k) => k.id !== id),
      }))
    },
    [state.keyframes.length]
  )

  const updateKeyframe = useCallback((id: string, updates: Partial<AnimationKeyframe>) => {
    setState((prev) => ({
      ...prev,
      keyframes: prev.keyframes.map((k) => (k.id === id ? { ...k, ...updates } : k)),
    }))
  }, [])

  const applyPreset = useCallback((preset: (typeof presetAnimations)[0]) => {
    const newKeyframes = preset.keyframes.map((kf, index) => ({
      id: (index + 1).toString(),
      ...defaultKeyframe,
      ...kf,
      percentage: kf.percentage,
    }))

    setState((prev) => ({
      ...prev,
      keyframes: newKeyframes,
    }))
  }, [])

  const copyToClipboard = useCallback(async () => {
    const css = generateCSS()
    await navigator.clipboard.writeText(css)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generateCSS])

  const downloadCSS = useCallback(() => {
    const css = generateCSS()
    const blob = new Blob([css], { type: 'text/css' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${state.name}.css`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [generateCSS, state.name])

  const shareAnimation = useCallback(async () => {
    const url = await generateShareUrl(state)
    await navigator.clipboard.writeText(url)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }, [generateShareUrl, state])

  const resetAnimation = useCallback(() => {
    if (
      window.confirm('Reset animation to default settings? This will clear all current keyframes.')
    ) {
      setState(initialState)
      clearSavedState()
    }
  }, [clearSavedState])

  const togglePreview = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))
  }, [])

  const previewStyle = {
    width: `${state.previewSize}px`,
    height: `${state.previewSize}px`,
    backgroundColor: state.keyframes[0]?.backgroundColor || '#3b82f6',
    borderRadius:
      state.previewShape === 'circle' ? '50%' : state.previewShape === 'rounded' ? '8px' : '0px',
    animation: state.isPlaying
      ? `preview-animation ${state.duration}s ${state.timingFunction} ${state.delay}s ${state.iterationCount} ${state.direction} ${state.fillMode}`
      : 'none',
  }

  const previewKeyframes = generateKeyframes()

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 py-6 xs:py-8 sm:py-12">
        <Header />

        <style jsx>{`
          @keyframes preview-animation {
            ${previewKeyframes}
          }
        `}</style>

        {/* Hero Section */}
        <section className="mb-8 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
              CSS Animation Generator
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-foreground-light-secondary dark:text-foreground-dark-secondary mb-6 sm:mb-8">
              Create smooth CSS animations with custom keyframes, timing functions, and real-time
              preview
            </p>
          </div>
        </section>

        {/* Main Interface */}
        <section className="grid gap-4 xs:gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-2 mb-8 sm:mb-12 overflow-hidden">
          {/* Controls Section */}
          <div className="space-y-4 xs:space-y-6 min-w-0">
            {/* Animation Properties */}
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg min-w-0">
              <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                <h3 className="text-lg font-semibold">Animation Properties</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                  Configure animation timing and behavior
                </p>
              </div>
              <div className="p-3 xs:p-4 sm:p-4 md:p-6 space-y-4">
                <div>
                  <label htmlFor="animation-name" className="block text-sm font-medium mb-2">
                    Animation Name
                  </label>
                  <input
                    id="animation-name"
                    type="text"
                    value={state.name}
                    onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-lg border border-border-light px-3 py-2 text-sm bg-white dark:border-border-dark dark:bg-background-dark focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="custom-animation"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium mb-2">
                      Duration (s)
                    </label>
                    <input
                      id="duration"
                      type="number"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={state.duration}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          duration: Number.parseFloat(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-border-light px-3 py-2 text-sm bg-white dark:border-border-dark dark:bg-background-dark focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="delay" className="block text-sm font-medium mb-2">
                      Delay (s)
                    </label>
                    <input
                      id="delay"
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={state.delay}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          delay: Number.parseFloat(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-border-light px-3 py-2 text-sm bg-white dark:border-border-dark dark:bg-background-dark focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="timing-function" className="block text-sm font-medium mb-2">
                    Timing Function
                  </label>
                  <select
                    id="timing-function"
                    value={state.timingFunction}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        timingFunction: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-border-light px-3 py-2 text-sm bg-white dark:border-border-dark dark:bg-background-dark focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    {timingFunctions.map((func) => (
                      <option key={func} value={func}>
                        {func}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="iteration-count" className="block text-sm font-medium mb-2">
                      Iterations
                    </label>
                    <select
                      id="iteration-count"
                      value={state.iterationCount}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          iterationCount: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-border-light px-3 py-2 text-sm bg-white dark:border-border-dark dark:bg-background-dark focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      {iterationCounts.map((count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="direction" className="block text-sm font-medium mb-2">
                      Direction
                    </label>
                    <select
                      id="direction"
                      value={state.direction}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          direction: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-border-light px-3 py-2 text-sm bg-white dark:border-border-dark dark:bg-background-dark focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      {directions.map((dir) => (
                        <option key={dir} value={dir}>
                          {dir}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="fill-mode" className="block text-sm font-medium mb-2">
                      Fill Mode
                    </label>
                    <select
                      id="fill-mode"
                      value={state.fillMode}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          fillMode: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-border-light px-3 py-2 text-sm bg-white dark:border-border-dark dark:bg-background-dark focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      {fillModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Presets */}
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg min-w-0">
              <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                <h3 className="text-lg font-semibold">Animation Presets</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                  Quick start with common animation patterns
                </p>
              </div>
              <div className="p-3 sm:p-4 md:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {presetAnimations.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className="rounded-lg border border-border-light px-3 py-2 text-sm font-medium transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="space-y-4 xs:space-y-6 min-w-0">
            {/* Animation Preview */}
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg min-w-0">
              <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Animation Preview</h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                      Live preview of your animation
                    </p>
                  </div>
                  <button
                    onClick={togglePreview}
                    className="rounded-lg border border-border-light px-3 py-2 text-sm font-medium transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95"
                  >
                    {state.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-4 md:p-6">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8 mb-4 flex items-center justify-center min-h-[200px]">
                  <div style={previewStyle} className="transition-all" />
                </div>

                {/* Preview Controls */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label htmlFor="shape-selector" className="text-sm font-medium">
                      Shape:
                    </label>
                    <div className="flex gap-2">
                      {(['square', 'rounded', 'circle'] as const).map((shape) => (
                        <button
                          key={shape}
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              previewShape: shape,
                            }))
                          }
                          className={`px-3 py-1 text-sm rounded-lg transition-all ${
                            state.previewShape === shape
                              ? 'bg-accent text-white'
                              : 'border border-border-light dark:border-border-dark hover:border-accent'
                          }`}
                        >
                          {shape}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="preview-size" className="block text-sm font-medium mb-2">
                      Size: {state.previewSize}px
                    </label>
                    <input
                      id="preview-size"
                      type="range"
                      min="50"
                      max="200"
                      value={state.previewSize}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          previewSize: Number.parseInt(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CSS Output */}
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg min-w-0">
              <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Generated CSS</h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                      Copy or download the CSS code
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="rounded-lg border border-border-light px-3 py-2 text-sm font-medium transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={downloadCSS}
                      className="rounded-lg border border-border-light px-3 py-2 text-sm font-medium transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-3 sm:p-4 md:p-6">
                <pre className="text-xs xs:text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 xs:p-4 overflow-x-auto max-w-full">
                  <code>{generateCSS()}</code>
                </pre>
                {copied && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    CSS copied to clipboard!
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Keyframes Editor */}
        <section className="mb-8 sm:mb-12">
          <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
            <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Keyframes Editor</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    Define keyframes and transform properties
                  </p>
                </div>
                <button
                  onClick={addKeyframe}
                  className="rounded-lg bg-accent px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] text-white font-medium text-sm sm:text-base transition-all hover:bg-accent-dark hover:shadow-lg active:scale-95"
                >
                  Add Keyframe
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-4 md:p-6">
              <div className="space-y-4">
                {state.keyframes
                  .sort((a, b) => a.percentage - b.percentage)
                  .map((keyframe) => (
                    <div
                      key={keyframe.id}
                      className="border border-border-light dark:border-border-dark rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">{keyframe.percentage}% Keyframe</h4>
                        {state.keyframes.length > 2 && (
                          <button
                            onClick={() => removeKeyframe(keyframe.id)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div>
                          <label
                            htmlFor={`percentage-${keyframe.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Percentage
                          </label>
                          <input
                            id={`percentage-${keyframe.id}`}
                            type="number"
                            min="0"
                            max="100"
                            value={keyframe.percentage}
                            onChange={(e) =>
                              updateKeyframe(keyframe.id, {
                                percentage: Number.parseInt(e.target.value),
                              })
                            }
                            className="w-full rounded-lg border border-border-light px-3 py-2 text-sm bg-white dark:border-border-dark dark:bg-background-dark focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`opacity-${keyframe.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Opacity
                          </label>
                          <input
                            id={`opacity-${keyframe.id}`}
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={keyframe.opacity}
                            onChange={(e) =>
                              updateKeyframe(keyframe.id, {
                                opacity: Number.parseFloat(e.target.value),
                              })
                            }
                            className="w-full"
                          />
                          <span className="text-xs text-gray-500">{keyframe.opacity}</span>
                        </div>

                        <div>
                          <label
                            htmlFor={`scale-${keyframe.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Scale
                          </label>
                          <input
                            id={`scale-${keyframe.id}`}
                            type="range"
                            min="0.1"
                            max="3"
                            step="0.1"
                            value={keyframe.scale}
                            onChange={(e) =>
                              updateKeyframe(keyframe.id, {
                                scale: Number.parseFloat(e.target.value),
                              })
                            }
                            className="w-full"
                          />
                          <span className="text-xs text-gray-500">{keyframe.scale}x</span>
                        </div>

                        <div>
                          <label
                            htmlFor={`rotate-${keyframe.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Rotate
                          </label>
                          <input
                            id={`rotate-${keyframe.id}`}
                            type="range"
                            min="-360"
                            max="360"
                            value={keyframe.rotate}
                            onChange={(e) =>
                              updateKeyframe(keyframe.id, {
                                rotate: Number.parseInt(e.target.value),
                              })
                            }
                            className="w-full"
                          />
                          <span className="text-xs text-gray-500">{keyframe.rotate}°</span>
                        </div>

                        <div>
                          <label
                            htmlFor={`translateX-${keyframe.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Translate X
                          </label>
                          <input
                            id={`translateX-${keyframe.id}`}
                            type="range"
                            min="-200"
                            max="200"
                            value={keyframe.translateX}
                            onChange={(e) =>
                              updateKeyframe(keyframe.id, {
                                translateX: Number.parseInt(e.target.value),
                              })
                            }
                            className="w-full"
                          />
                          <span className="text-xs text-gray-500">{keyframe.translateX}px</span>
                        </div>

                        <div>
                          <label
                            htmlFor={`translateY-${keyframe.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Translate Y
                          </label>
                          <input
                            id={`translateY-${keyframe.id}`}
                            type="range"
                            min="-200"
                            max="200"
                            value={keyframe.translateY}
                            onChange={(e) =>
                              updateKeyframe(keyframe.id, {
                                translateY: Number.parseInt(e.target.value),
                              })
                            }
                            className="w-full"
                          />
                          <span className="text-xs text-gray-500">{keyframe.translateY}px</span>
                        </div>

                        <div>
                          <label
                            htmlFor={`backgroundColor-${keyframe.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Color
                          </label>
                          <input
                            id={`backgroundColor-${keyframe.id}`}
                            type="color"
                            value={keyframe.backgroundColor}
                            onChange={(e) =>
                              updateKeyframe(keyframe.id, {
                                backgroundColor: e.target.value,
                              })
                            }
                            className="w-full h-9 rounded-lg border border-border-light dark:border-border-dark"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`borderRadius-${keyframe.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Border Radius
                          </label>
                          <input
                            id={`borderRadius-${keyframe.id}`}
                            type="range"
                            min="0"
                            max="50"
                            value={keyframe.borderRadius}
                            onChange={(e) =>
                              updateKeyframe(keyframe.id, {
                                borderRadius: Number.parseInt(e.target.value),
                              })
                            }
                            className="w-full"
                          />
                          <span className="text-xs text-gray-500">{keyframe.borderRadius}px</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="mb-8 sm:mb-12">
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <button
              onClick={shareAnimation}
              className="rounded-lg bg-accent px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] text-white font-medium text-sm sm:text-base transition-all hover:bg-accent-dark hover:shadow-lg active:scale-95"
            >
              <Share2 className="h-4 w-4 mr-2 inline" />
              Share Animation
            </button>
            <button
              onClick={downloadCSS}
              className="rounded-lg border border-border-light px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95"
            >
              <Download className="h-4 w-4 mr-2 inline" />
              Download CSS
            </button>
            <button
              onClick={resetAnimation}
              className="rounded-lg border border-red-300 px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base text-red-600 transition-all hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 hover:shadow-lg active:scale-95"
            >
              <RotateCcw className="h-4 w-4 mr-2 inline" />
              Reset Animation
            </button>
          </div>

          {shareInfo && typeof shareInfo === 'object' && 'message' in shareInfo && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">{shareInfo.message}</p>
            </div>
          )}
        </section>

        {/* Features Section */}
        <section className="hidden xs:block mb-8 sm:mb-12 md:mb-16">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Key Features</h2>
            <p className="text-base sm:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary max-w-2xl mx-auto">
              Professional animation tools for creating smooth, performant CSS animations
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border-light bg-card-light p-6 dark:border-border-dark dark:bg-card-dark transition-all hover:shadow-lg">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/20 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <Play className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-time Preview</h3>
              <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                See your animations come to life instantly as you adjust keyframes and timing
                properties.
              </p>
            </div>
            <div className="rounded-lg border border-border-light bg-card-light p-6 dark:border-border-dark dark:bg-card-dark transition-all hover:shadow-lg">
              <div className="rounded-lg bg-green-100 dark:bg-green-900/20 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <RotateCw className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Custom Keyframes</h3>
              <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Define precise keyframes with transform properties, opacity, colors, and timing
                control.
              </p>
            </div>
            <div className="rounded-lg border border-border-light bg-card-light p-6 dark:border-border-dark dark:bg-card-dark transition-all hover:shadow-lg">
              <div className="rounded-lg bg-purple-100 dark:bg-purple-900/20 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <Upload className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Animation Presets</h3>
              <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Start quickly with popular animation patterns like bounce, fade, slide, and rotate.
              </p>
            </div>
            <div className="rounded-lg border border-border-light bg-card-light p-6 dark:border-border-dark dark:bg-card-dark transition-all hover:shadow-lg">
              <div className="rounded-lg bg-orange-100 dark:bg-orange-900/20 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <Copy className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Export Options</h3>
              <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Copy CSS code to clipboard or download as a file for easy integration into your
                projects.
              </p>
            </div>
            <div className="rounded-lg border border-border-light bg-card-light p-6 dark:border-border-dark dark:bg-card-dark transition-all hover:shadow-lg">
              <div className="rounded-lg bg-red-100 dark:bg-red-900/20 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <Share2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">URL Sharing</h3>
              <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Share your animations with team members via URL with all settings preserved.
              </p>
            </div>
            <div className="rounded-lg border border-border-light bg-card-light p-6 dark:border-border-dark dark:bg-card-dark transition-all hover:shadow-lg">
              <div className="rounded-lg bg-teal-100 dark:bg-teal-900/20 p-3 w-12 h-12 flex items-center justify-center mb-4">
                <ZoomIn className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Visual Controls</h3>
              <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Intuitive sliders and controls for transforms, opacity, colors, and animation
                properties.
              </p>
            </div>
          </div>
        </section>

        {/* Content Sections */}
        <section className="mb-8 sm:mb-12 md:mb-16 border-t border-border-light dark:border-border-dark pt-8 sm:pt-12">
          {/* About This Tool */}
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">About CSS Animation Generator</h2>
            <div className="prose prose-gray dark:prose-invert max-w-none space-y-4">
              <p className="text-base sm:text-lg leading-relaxed">
                Our CSS Animation Generator is a comprehensive tool for creating smooth,
                professional animations using pure CSS keyframes. Whether you're building
                interactive web interfaces, adding micro-interactions, or creating engaging visual
                effects, this tool provides all the controls you need to craft perfect animations
                without writing code manually.
              </p>
              <p className="text-base sm:text-lg leading-relaxed">
                Built with performance in mind, the generator creates optimized CSS animations that
                work seamlessly across all modern browsers. All animations are processed
                client-side, ensuring your creative work remains private and secure. The tool
                supports advanced features like custom timing functions, multiple keyframes, and
                complex transform combinations.
              </p>
              <p className="text-base sm:text-lg leading-relaxed">
                Perfect for web designers, frontend developers, and anyone working on user interface
                animations. From simple fade effects to complex multi-step animations, create
                professional-quality CSS animations that enhance user experience without
                compromising performance.
              </p>
            </div>
          </div>

          {/* How to Use */}
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">
              How to Use the Animation Generator
            </h2>
            <div className="grid gap-4 md:gap-6">
              <div className="border border-border-light dark:border-border-dark rounded-lg p-4 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-blue-100 dark:bg-blue-900/20 p-2 flex items-center justify-center min-w-[40px] h-10">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Configure Animation Properties</h3>
                    <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Set your animation name, duration, timing function, delay, and iteration
                      count. Choose from preset timing functions or use custom cubic-bezier curves
                      for precise control over animation easing.
                    </p>
                  </div>
                </div>
              </div>
              <div className="border border-border-light dark:border-border-dark rounded-lg p-4 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-green-100 dark:bg-green-900/20 p-2 flex items-center justify-center min-w-[40px] h-10">
                    <span className="text-green-600 dark:text-green-400 font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Design Keyframes</h3>
                    <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Add and customize keyframes using the visual editor. Adjust transform
                      properties like scale, rotation, translation, opacity, background colors, and
                      border radius for each keyframe percentage.
                    </p>
                  </div>
                </div>
              </div>
              <div className="border border-border-light dark:border-border-dark rounded-lg p-4 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-purple-100 dark:bg-purple-900/20 p-2 flex items-center justify-center min-w-[40px] h-10">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Preview and Adjust</h3>
                    <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Watch your animation play in real-time in the preview area. Customize the
                      preview element shape and size, pause/play the animation, and make adjustments
                      until you achieve the perfect effect.
                    </p>
                  </div>
                </div>
              </div>
              <div className="border border-border-light dark:border-border-dark rounded-lg p-4 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-orange-100 dark:bg-orange-900/20 p-2 flex items-center justify-center min-w-[40px] h-10">
                    <span className="text-orange-600 dark:text-orange-400 font-bold">4</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Export and Share</h3>
                    <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Copy the generated CSS code to your clipboard or download it as a file. Share
                      your animation via URL with colleagues, or save different variations for later
                      use.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">Animation Generator Features</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border border-border-light dark:border-border-dark rounded-lg p-4">
                <h3 className="font-semibold mb-2">Visual Keyframe Editor</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Intuitive interface for creating and editing keyframes with real-time visual
                  feedback and property controls.
                </p>
              </div>
              <div className="border border-border-light dark:border-border-dark rounded-lg p-4">
                <h3 className="font-semibold mb-2">Transform Properties</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Complete control over CSS transforms including translate, scale, rotate, and skew
                  operations.
                </p>
              </div>
              <div className="border border-border-light dark:border-border-dark rounded-lg p-4">
                <h3 className="font-semibold mb-2">Advanced Timing Control</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Precise timing functions, delays, iteration counts, and animation direction
                  controls.
                </p>
              </div>
              <div className="border border-border-light dark:border-border-dark rounded-lg p-4">
                <h3 className="font-semibold mb-2">Animation Presets</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Pre-built animation patterns for common effects like bounce, fade, slide, rotate,
                  pulse, and shake.
                </p>
              </div>
              <div className="border border-border-light dark:border-border-dark rounded-lg p-4">
                <h3 className="font-semibold mb-2">Real-time Preview</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Live animation preview with customizable preview element shape, size, and playback
                  controls.
                </p>
              </div>
              <div className="border border-border-light dark:border-border-dark rounded-lg p-4">
                <h3 className="font-semibold mb-2">Export Options</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Copy to clipboard or download CSS files with clean, optimized code ready for
                  production use.
                </p>
              </div>
            </div>
          </div>

          {/* Examples */}
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">Animation Examples</h2>
            <div className="space-y-6">
              <div className="border border-border-light dark:border-border-dark rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3">Button Hover Animation</h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-4">
                  Create smooth scale and color transitions for interactive buttons. Perfect for
                  call-to-action elements that need subtle feedback on user interaction.
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <code className="text-sm">
                    0%: scale(1) opacity(1)
                    <br />
                    100%: scale(1.05) opacity(0.9)
                  </code>
                </div>
              </div>
              <div className="border border-border-light dark:border-border-dark rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3">Loading Spinner</h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-4">
                  Infinite rotation animation for loading indicators. Use continuous rotation with
                  consistent timing for smooth, professional loading states.
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <code className="text-sm">
                    0%: rotate(0deg)
                    <br />
                    100%: rotate(360deg)
                  </code>
                </div>
              </div>
              <div className="border border-border-light dark:border-border-dark rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3">Page Transition Effect</h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-4">
                  Slide and fade animations for smooth page transitions. Combine translate and
                  opacity changes for elegant content switching effects.
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <code className="text-sm">
                    0%: translateX(-100px) opacity(0)
                    <br />
                    100%: translateX(0) opacity(1)
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <details className="border border-border-light dark:border-border-dark rounded-lg">
                <summary className="p-4 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  What CSS properties can I animate with this generator?
                </summary>
                <div className="p-4 pt-0 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  The generator supports all major CSS transform properties (translate, scale,
                  rotate), opacity, background-color, and border-radius. These properties provide
                  smooth, hardware-accelerated animations that work efficiently across all devices
                  and browsers.
                </div>
              </details>
              <details className="border border-border-light dark:border-border-dark rounded-lg">
                <summary className="p-4 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  How do I add custom timing functions?
                </summary>
                <div className="p-4 pt-0 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  The tool includes several preset timing functions including cubic-bezier curves.
                  You can select from options like ease-in-out, or use custom cubic-bezier functions
                  for precise easing control. Each timing function affects how the animation
                  progresses between keyframes.
                </div>
              </details>
              <details className="border border-border-light dark:border-border-dark rounded-lg">
                <summary className="p-4 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  Can I create multi-step animations with multiple keyframes?
                </summary>
                <div className="p-4 pt-0 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Yes! You can add unlimited keyframes at any percentage point from 0% to 100%. Each
                  keyframe can have different property values, allowing you to create complex
                  multi-step animations with precise timing control.
                </div>
              </details>
              <details className="border border-border-light dark:border-border-dark rounded-lg">
                <summary className="p-4 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  Are the generated animations browser compatible?
                </summary>
                <div className="p-4 pt-0 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  The generated CSS uses standard @keyframes syntax supported by all modern
                  browsers. The animations work in Chrome, Firefox, Safari, and Edge without
                  requiring vendor prefixes or polyfills.
                </div>
              </details>
              <details className="border border-border-light dark:border-border-dark rounded-lg">
                <summary className="p-4 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  How do I apply the generated animation to my HTML elements?
                </summary>
                <div className="p-4 pt-0 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Copy the generated CSS and add it to your stylesheet. Apply the animation to any
                  element by adding the class name (e.g., "animated-element") to your HTML element.
                  You can also modify the animation properties directly in the CSS as needed.
                </div>
              </details>
              <details className="border border-border-light dark:border-border-dark rounded-lg">
                <summary className="p-4 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  Can I control when animations start and repeat?
                </summary>
                <div className="p-4 pt-0 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Yes! The generator includes controls for animation delay (when it starts),
                  iteration count (how many times it repeats), direction (normal, reverse,
                  alternate), and fill mode (what happens before and after animation).
                </div>
              </details>
              <details className="border border-border-light dark:border-border-dark rounded-lg">
                <summary className="p-4 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  What's the difference between the animation presets?
                </summary>
                <div className="p-4 pt-0 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Each preset represents a common animation pattern: Bounce adds scale and vertical
                  movement, Fade In changes opacity, Slide In combines translation with opacity,
                  Rotate spins the element, Pulse scales up and down, and Shake creates horizontal
                  movement. Use them as starting points for custom animations.
                </div>
              </details>
              <details className="border border-border-light dark:border-border-dark rounded-lg">
                <summary className="p-4 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  How can I optimize animation performance?
                </summary>
                <div className="p-4 pt-0 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  The tool generates animations using transform and opacity properties, which are
                  hardware-accelerated for smooth performance. Avoid animating layout properties
                  like width/height, and prefer shorter durations for frequently triggered
                  animations. Use 'will-change: transform' in CSS for complex animations.
                </div>
              </details>
            </div>
          </div>
        </section>

        <Footer />
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg transition-all z-50">
          Animation URL copied to clipboard!
        </div>
      )}
    </div>
  )
}
