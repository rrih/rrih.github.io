'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { useHistory } from '@/hooks/useHistory'
import { localStorageManager } from '@/lib/localStorage'
import { useUrlSharing } from '@/lib/urlSharing'
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Download,
  FileText,
  Redo2,
  Share2,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface JsonFormatterState {
  input: string
  output: string
  error: string
  indentSize: number
}

export default function JsonFormatterPage() {
  const TOOL_NAME = 'json-formatter'

  const defaultState: JsonFormatterState = {
    input: '',
    output: '',
    error: '',
    indentSize: 2,
  }

  const {
    state,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
  } = useHistory<JsonFormatterState>(defaultState)

  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { generateShareUrl, shareInfo, getInitialStateFromUrl } =
    useUrlSharing<JsonFormatterState>(TOOL_NAME)

  const { input, output, error, indentSize } = state

  const setInput = (newInput: string) => {
    setHistoryState((prev) => ({ ...prev, input: newInput }))
  }

  const setOutput = (newOutput: string) => {
    setHistoryState((prev) => ({ ...prev, output: newOutput }))
  }

  const setError = (newError: string) => {
    setHistoryState((prev) => ({ ...prev, error: newError }))
  }

  const setIndentSize = (newSize: number) => {
    setHistoryState((prev) => ({ ...prev, indentSize: newSize }))
  }

  // Client-side only state restoration
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初期化処理のため一度だけ実行
  useEffect(() => {
    const sharedState = getInitialStateFromUrl()
    if (sharedState) {
      setHistoryState(sharedState)
      return
    }

    const savedState = localStorageManager.load<JsonFormatterState>(TOOL_NAME)
    if (savedState) {
      setHistoryState(savedState)
    }
  }, [])

  // 状態が変更されるたびにローカルストレージに保存
  useEffect(() => {
    localStorageManager.save(TOOL_NAME, state)
  }, [state])

  // URL共有機能
  const handleShare = async () => {
    setIsSharing(true)
    try {
      const shareUrl = await generateShareUrl(state)
      await navigator.clipboard.writeText(shareUrl)
      const success = true

      if (success) {
        const message = 'Share URL copied!'
        let description = 'The shareable URL has been copied to your clipboard'

        if (shareInfo.isLimited) {
          description = shareInfo.message
        }

        successToast(message, description)
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
    if (confirm('保存されたデータと入力内容をすべて削除しますか？')) {
      localStorageManager.clear(TOOL_NAME)
      clearHistory()
      setHistoryState({
        input: '',
        output: '',
        error: '',
        indentSize: 2,
      })
    }
  }

  // データエクスポート機能
  const handleExportData = () => {
    const data = {
      input,
      output,
      indentSize,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `json-formatter-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatJson = async () => {
    if (!input.trim()) return
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 200))

    try {
      setError('')
      const parsed = JSON.parse(input)
      const formatted = JSON.stringify(parsed, null, indentSize)
      setOutput(formatted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format')
      setOutput('')
    } finally {
      setIsProcessing(false)
    }
  }

  const minifyJson = async () => {
    if (!input.trim()) return
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 200))

    try {
      setError('')
      const parsed = JSON.parse(input)
      const minified = JSON.stringify(parsed)
      setOutput(minified)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format')
      setOutput('')
    } finally {
      setIsProcessing(false)
    }
  }

  const validateJson = async () => {
    if (!input.trim()) return
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 200))

    try {
      JSON.parse(input)
      setError('')
      setOutput('✅ Valid JSON')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format')
      setOutput('')
    } finally {
      setIsProcessing(false)
    }
  }

  const clearAll = () => {
    clearHistory()
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <Header />
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <main>
          {/* Hero Section */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-2 xs:mb-3 sm:mb-4 text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                JSON Formatter & Validator
              </h1>
              <p className="mb-4 xs:mb-6 text-sm xs:text-base sm:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary px-2 xs:px-0">
                Format, validate, and beautify JSON data with syntax highlighting.
              </p>
            </div>
          </section>

          {/* Controls */}
          <section className="mb-4 xs:mb-6">
            <div className="rounded-lg border border-border-light bg-card-light p-2 xs:p-3 sm:p-4 md:p-6 dark:border-border-dark dark:bg-card-dark">
              <div className="flex flex-col xs:flex-row flex-wrap gap-3 xs:gap-4 items-start xs:items-center justify-between">
                <div className="flex gap-1 xs:gap-2 flex-wrap w-full xs:w-auto">
                  <button
                    onClick={formatJson}
                    disabled={isProcessing}
                    className="rounded-lg bg-accent px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] text-white font-medium text-xs xs:text-sm sm:text-base transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    {isProcessing ? 'Processing...' : 'Format'}
                  </button>
                  <button
                    onClick={minifyJson}
                    disabled={isProcessing}
                    className="rounded-lg bg-accent px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] text-white font-medium text-xs xs:text-sm sm:text-base transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    {isProcessing ? 'Processing...' : 'Minify'}
                  </button>
                  <button
                    onClick={validateJson}
                    disabled={isProcessing}
                    className="rounded-lg bg-accent px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] text-white font-medium text-xs xs:text-sm sm:text-base transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    {isProcessing ? 'Processing...' : 'Validate'}
                  </button>
                  <button
                    onClick={handleShare}
                    disabled={isSharing}
                    className="flex items-center gap-1 xs:gap-2 rounded-lg border border-border-light px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] font-medium text-xs xs:text-sm sm:text-base transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark dark:hover:border-accent dark:hover:text-accent flex-1 xs:flex-none"
                  >
                    <Share2 className="h-3 w-3 xs:h-4 xs:w-4" />
                    {isSharing ? 'Sharing...' : 'Share'}
                  </button>
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-1 xs:gap-2 rounded-lg border border-border-light px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] font-medium text-xs xs:text-sm sm:text-base transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark dark:hover:border-accent dark:hover:text-accent flex-1 xs:flex-none"
                  >
                    <Download className="h-3 w-3 xs:h-4 xs:w-4" />
                    Export
                  </button>
                  <button
                    onClick={handleClearData}
                    className="flex items-center gap-1 xs:gap-2 rounded-lg border border-red-300 px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] font-medium text-xs xs:text-sm sm:text-base text-red-600 transition-all hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:border-red-600 flex-1 xs:flex-none"
                  >
                    <Trash2 className="h-3 w-3 xs:h-4 xs:w-4" />
                    Clear
                  </button>
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="flex items-center gap-1 xs:gap-2 rounded-lg border border-border-light px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] font-medium text-xs xs:text-sm sm:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95 flex-1 xs:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Undo2 className="w-3 h-3 xs:w-4 xs:h-4" />
                    <span className="hidden xs:inline">Undo</span>
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="flex items-center gap-1 xs:gap-2 rounded-lg border border-border-light px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] font-medium text-xs xs:text-sm sm:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95 flex-1 xs:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Redo2 className="w-3 h-3 xs:w-4 xs:h-4" />
                    <span className="hidden xs:inline">Redo</span>
                  </button>
                  <button
                    onClick={clearAll}
                    className="rounded-lg border border-border-light px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] font-medium text-xs xs:text-sm sm:text-base transition-all hover:border-red-500 hover:text-red-500 dark:border-border-dark hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center gap-2 xs:gap-3 w-full xs:w-auto justify-between xs:justify-start">
                  <label
                    htmlFor="indent"
                    className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary font-medium"
                  >
                    Indent:
                  </label>
                  <select
                    id="indent"
                    value={indentSize}
                    onChange={(e) => setIndentSize(Number(e.target.value))}
                    className="bg-white dark:bg-background-dark text-foreground-light dark:text-foreground-dark px-2 xs:px-3 py-2 text-sm rounded-lg border border-border-light dark:border-border-dark transition-all focus:ring-2 focus:ring-accent focus:border-accent"
                  >
                    <option value={2}>2 spaces</option>
                    <option value={4}>4 spaces</option>
                    <option value={1}>1 tab</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Input/Output Grid */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 xs:gap-6">
              {/* Input Panel */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-2 xs:p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-base xs:text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                    Input JSON
                  </h3>
                  <p className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    Paste your JSON data here
                  </p>
                </div>
                <div className="p-2 xs:p-3 sm:p-4 md:p-6">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Paste your JSON here..."
                    className="w-full h-40 xs:h-48 sm:h-64 md:h-80 bg-white dark:bg-background-dark text-foreground-light dark:text-foreground-dark font-mono text-xs xs:text-sm sm:text-base p-2 xs:p-3 sm:p-4 border border-border-light dark:border-border-dark rounded-lg resize-none transition-all focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>
              </div>

              {/* Output Panel */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-2 xs:p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark flex justify-between items-center">
                  <div>
                    <h3 className="text-base xs:text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                      Output
                    </h3>
                    <p className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                      Formatted result appears here
                    </p>
                  </div>
                  {output && (
                    <button
                      onClick={() => copyToClipboard(output)}
                      className="flex items-center gap-1 xs:gap-2 bg-accent hover:bg-accent-dark text-white px-2 xs:px-4 py-2 rounded-lg text-xs xs:text-sm transition-all hover:shadow-lg active:scale-95"
                    >
                      <Copy className="w-3 h-3 xs:w-4 xs:h-4" />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
                <div className="p-2 xs:p-3 sm:p-4 md:p-6">
                  {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3 xs:p-4 transition-all">
                      <div className="flex items-center gap-1 xs:gap-2 text-red-600 dark:text-red-400 font-medium mb-2">
                        <AlertCircle className="w-3 h-3 xs:w-4 xs:h-4" />
                        Error:
                      </div>
                      <p className="text-red-700 dark:text-red-300 font-mono text-xs xs:text-sm">
                        {error}
                      </p>
                    </div>
                  ) : (
                    <textarea
                      value={output}
                      readOnly
                      placeholder="Formatted JSON will appear here..."
                      className="w-full h-40 xs:h-48 sm:h-64 md:h-80 bg-white dark:bg-background-dark text-foreground-light dark:text-foreground-dark font-mono text-xs xs:text-sm sm:text-base p-2 xs:p-3 sm:p-4 border border-border-light dark:border-border-dark rounded-lg resize-none transition-all"
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="hidden xs:block mb-8 sm:mb-12 md:mb-16">
            <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
              Why Choose Our JSON Formatter?
            </h2>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: CheckCircle,
                  title: 'JSON Validation',
                  description:
                    'Instantly validate your JSON syntax and identify errors with detailed error messages.',
                },
                {
                  icon: FileText,
                  title: 'Beautiful Formatting',
                  description:
                    'Format JSON with customizable indentation for better readability and debugging.',
                },
                {
                  icon: Zap,
                  title: 'Minify & Optimize',
                  description:
                    'Compress JSON by removing whitespace to reduce file size for production use.',
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
                About JSON Formatter
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Our JSON Formatter is a powerful, free online tool designed to help developers,
                  data analysts, and anyone working with JSON data. JSON (JavaScript Object
                  Notation) is a lightweight data-interchange format that is easy for humans to read
                  and write, and easy for machines to parse and generate. However, raw JSON data can
                  often be difficult to read, especially when it's minified or contains nested
                  structures.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  This tool provides instant JSON formatting, validation, and minification
                  capabilities right in your browser. All processing happens locally on your device,
                  ensuring your data remains private and secure. Whether you're debugging API
                  responses, configuring application settings, or working with complex data
                  structures, our JSON formatter makes it easy to visualize and manipulate JSON data
                  efficiently.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                  With support for custom indentation levels, real-time validation, and one-click
                  copying, this tool is designed to streamline your workflow and save valuable
                  development time. The intuitive interface works seamlessly on desktop and mobile
                  devices, making it accessible whenever and wherever you need it.
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
                  <h3 className="font-semibold text-lg mb-2">Step 1: Input Your JSON</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Paste your JSON data into the input field on the left. The tool accepts any
                    valid JSON structure, including arrays, objects, and nested data.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 2: Choose Your Action</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Click "Format" to beautify your JSON with proper indentation, "Minify" to
                    compress it by removing whitespace, or "Validate" to check for syntax errors.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 3: Customize Indentation</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Select your preferred indentation level (2 spaces, 4 spaces, or tabs) from the
                    dropdown menu to match your coding standards.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 4: Copy the Result</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Once formatted, click the "Copy" button to copy the processed JSON to your
                    clipboard for use in your projects.
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
                  <h3 className="font-semibold mb-2">Real-time Validation</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Instantly identifies syntax errors and provides detailed error messages to help
                    you fix issues quickly.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Custom Formatting</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Choose between 2 spaces, 4 spaces, or tabs for indentation to match your
                    preferred coding style.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Minification</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Remove all unnecessary whitespace to reduce file size for production deployments
                    and API payloads.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Undo/Redo Support</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Navigate through your editing history with full undo and redo functionality for
                    easy corrections.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Privacy-First</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    All processing happens in your browser. Your JSON data never leaves your device.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Mobile Responsive</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Works perfectly on all devices, from smartphones to desktop computers, with an
                    adaptive interface.
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
                  <h3 className="font-semibold mb-3">Example 1: API Response Formatting</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        Input (Minified):
                      </p>
                      <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                        {`{"user":{"id":1,"name":"John Doe","email":"john@example.com"},"posts":[{"id":101,"title":"First Post"},{"id":102,"title":"Second Post"}]}`}
                      </pre>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        Output (Formatted):
                      </p>
                      <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                        {`{
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "posts": [
    {
      "id": 101,
      "title": "First Post"
    },
    {
      "id": 102,
      "title": "Second Post"
    }
  ]
}`}
                      </pre>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Example 2: Configuration File</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        Input (Unformatted):
                      </p>
                      <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                        {`{"database":{"host":"localhost","port":5432,"credentials":{"username":"admin","password":"secret"}},"cache":{"enabled":true,"ttl":3600}}`}
                      </pre>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        Output (Formatted with 4 spaces):
                      </p>
                      <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                        {`{
    "database": {
        "host": "localhost",
        "port": 5432,
        "credentials": {
            "username": "admin",
            "password": "secret"
        }
    },
    "cache": {
        "enabled": true,
        "ttl": 3600
    }
}`}
                      </pre>
                    </div>
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
                  <summary className="font-semibold cursor-pointer">What is JSON?</summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    JSON (JavaScript Object Notation) is a lightweight, text-based data interchange
                    format that's easy for humans to read and write, and easy for machines to parse
                    and generate. It's commonly used for transmitting data between web servers and
                    applications.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">Is my data secure?</summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Yes, absolutely. All JSON processing happens entirely in your browser using
                    JavaScript. Your data is never sent to our servers or any third-party services.
                    This ensures complete privacy and security for sensitive information.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What's the maximum file size supported?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Since processing happens in your browser, the practical limit depends on your
                    device's memory and browser capabilities. Most modern browsers can handle JSON
                    files up to several megabytes without issues. For very large files (&gt;10MB),
                    processing might be slower.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I use this tool offline?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Once the page is loaded, the tool works entirely offline since all processing is
                    done client-side. However, you need an internet connection to initially load the
                    tool.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What's the difference between formatting and minifying?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Formatting adds proper indentation and line breaks to make JSON human-readable,
                    which is useful for debugging and development. Minifying removes all unnecessary
                    whitespace to reduce file size, which is ideal for production use and data
                    transmission.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can this tool fix invalid JSON?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    While the tool can't automatically fix invalid JSON, it provides detailed error
                    messages that help you identify and correct syntax errors. Common issues include
                    missing quotes, trailing commas, and unmatched brackets.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Does it support JSONP or JSON5?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Currently, the tool supports standard JSON format as defined by RFC 7159. JSONP
                    (JSON with Padding) and JSON5 (JSON with extended syntax) are not supported at
                    this time.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I integrate this tool into my workflow?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    While this is a web-based tool, you can bookmark it for quick access. For
                    programmatic JSON processing, consider using command-line tools like jq or
                    programming language libraries specific to your development environment.
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
