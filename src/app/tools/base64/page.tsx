'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { useHistory } from '@/hooks/useHistory'
import { localStorageManager } from '@/lib/localStorage'
import { useUrlSharing } from '@/lib/urlSharing'
import {
  AlertCircle,
  ArrowLeftRight,
  Copy,
  Download,
  Redo2,
  Share2,
  Shield,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface Base64State {
  input: string
  output: string
  mode: 'encode' | 'decode'
  error: string
}

export default function Base64Page() {
  const TOOL_NAME = 'base64'

  const defaultState: Base64State = {
    input: '',
    output: '',
    mode: 'encode',
    error: '',
  }

  const {
    state,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
  } = useHistory<Base64State>(defaultState)

  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { generateShareUrl, shareInfo, getInitialStateFromUrl } =
    useUrlSharing<Base64State>(TOOL_NAME)

  const { input, output, mode, error } = state

  const setInput = (newInput: string) => {
    setHistoryState((prev) => ({ ...prev, input: newInput }))
  }

  const setOutput = (newOutput: string) => {
    setHistoryState((prev) => ({ ...prev, output: newOutput }))
  }

  const setMode = (newMode: 'encode' | 'decode') => {
    setHistoryState((prev) => ({ ...prev, mode: newMode }))
  }

  const setError = (newError: string) => {
    setHistoryState((prev) => ({ ...prev, error: newError }))
  }

  // クライアントサイドでのみ初期状態を復元
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初期化処理のため一度だけ実行
  useEffect(() => {
    const sharedState = getInitialStateFromUrl()
    if (sharedState) {
      setHistoryState(sharedState)
      return
    }

    const savedState = localStorageManager.load<Base64State>(TOOL_NAME)
    if (savedState) {
      setHistoryState(savedState)
    }
  }, [])

  // 状態が変更されるたびにローカルストレージに保存
  useEffect(() => {
    // 初期状態は保存しない（空の場合）
    if (state.input || state.output) {
      localStorageManager.save(TOOL_NAME, state)
    }
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
    if (confirm('Clear all saved data and current input?')) {
      localStorageManager.clear(TOOL_NAME)
      clearHistory()
      setHistoryState({
        input: '',
        output: '',
        mode: 'encode',
        error: '',
      })
    }
  }

  // データエクスポート機能
  const handleExportData = () => {
    const data = {
      input,
      output,
      mode,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `base64-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleEncode = async () => {
    if (!input.trim()) return
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 200))

    try {
      setError('')
      const encoded = btoa(encodeURIComponent(input))
      setOutput(encoded)
    } catch (_err) {
      setError('Failed to encode. Please check your input.')
      setOutput('')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDecode = async () => {
    if (!input.trim()) return
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 200))

    try {
      setError('')
      const decoded = decodeURIComponent(atob(input))
      setOutput(decoded)
    } catch (_err) {
      setError('Invalid Base64 string. Please check your input.')
      setOutput('')
    } finally {
      setIsProcessing(false)
    }
  }

  const processInput = () => {
    if (mode === 'encode') {
      handleEncode()
    } else {
      handleDecode()
    }
  }

  const switchMode = (newMode: 'encode' | 'decode') => {
    setHistoryState((prev) => ({
      ...prev,
      mode: newMode,
      input: '',
      output: '',
      error: '',
    }))
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

  const swapInputOutput = () => {
    if (output) {
      setInput(output)
      setOutput('')
      setError('')
      setMode(mode === 'encode' ? 'decode' : 'encode')
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 py-3 xs:py-4 py-5">
        <Header />

        <main>
          {/* Hero Section */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-2 xs:mb-3 sm:mb-4 text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                Base64 Encoder & Decoder
              </h1>
              <p className="mb-4 xs:mb-6 text-sm xs:text-base sm:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary px-2 xs:px-0">
                Fast and secure Base64 encoding and decoding.
              </p>
            </div>
          </section>

          {/* Mode Toggle */}
          <section className="mb-4 xs:mb-6 flex justify-center">
            <div className="rounded-lg border border-border-light bg-card-light p-1 dark:border-border-dark dark:bg-card-dark mx-2 xs:mx-0">
              <div className="flex gap-1">
                <button
                  onClick={() => switchMode('encode')}
                  className={`px-3 xs:px-6 py-3 min-h-[44px] rounded-lg font-medium text-sm xs:text-base transition-all ${
                    mode === 'encode'
                      ? 'bg-accent text-white shadow-lg'
                      : 'text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-foreground-light hover:bg-white dark:hover:text-foreground-dark dark:hover:bg-background-dark'
                  }`}
                >
                  Encode
                </button>
                <button
                  onClick={() => switchMode('decode')}
                  className={`px-3 xs:px-6 py-3 min-h-[44px] rounded-lg font-medium text-sm xs:text-base transition-all ${
                    mode === 'decode'
                      ? 'bg-accent text-white shadow-lg'
                      : 'text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-foreground-light hover:bg-white dark:hover:text-foreground-dark dark:hover:bg-background-dark'
                  }`}
                >
                  Decode
                </button>
              </div>
            </div>
          </section>

          {/* Controls */}
          <section className="mb-4 xs:mb-6">
            <div className="rounded-lg border border-border-light bg-card-light p-2 xs:p-3 sm:p-4 md:p-6 dark:border-border-dark dark:bg-card-dark">
              <div className="flex flex-col xs:flex-row flex-wrap gap-3 xs:gap-4 items-start xs:items-center justify-between">
                <div className="flex gap-1 xs:gap-2 flex-wrap w-full xs:w-auto">
                  <button
                    onClick={processInput}
                    disabled={isProcessing}
                    className="rounded-lg bg-accent px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] text-white font-medium text-xs xs:text-sm sm:text-base transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    {isProcessing
                      ? 'Processing...'
                      : mode === 'encode'
                        ? 'Encode to Base64'
                        : 'Decode from Base64'}
                  </button>
                  {output && (
                    <button
                      onClick={swapInputOutput}
                      className="flex items-center gap-1 xs:gap-2 rounded-lg border border-border-light px-3 xs:px-4 sm:px-6 py-3 xs:py-4 min-h-[44px] font-medium text-sm xs:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                    >
                      <ArrowLeftRight className="w-3 h-3 xs:w-4 xs:h-4" />
                      Swap
                    </button>
                  )}
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="flex items-center gap-1 xs:gap-2 rounded-lg border border-border-light px-3 xs:px-4 sm:px-6 py-3 xs:py-4 min-h-[44px] font-medium text-sm xs:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95 flex-1 xs:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Undo2 className="w-3 h-3 xs:w-4 xs:h-4" />
                    <span className="hidden xs:inline">Undo</span>
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="flex items-center gap-1 xs:gap-2 rounded-lg border border-border-light px-3 xs:px-4 sm:px-6 py-3 xs:py-4 min-h-[44px] font-medium text-sm xs:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95 flex-1 xs:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Redo2 className="w-3 h-3 xs:w-4 xs:h-4" />
                    <span className="hidden xs:inline">Redo</span>
                  </button>
                  <button
                    onClick={clearAll}
                    className="rounded-lg border border-border-light px-3 xs:px-4 sm:px-6 py-3 xs:py-4 min-h-[44px] font-medium text-sm xs:text-base transition-all hover:border-red-500 hover:text-red-500 dark:border-border-dark hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    Clear
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
                    Clear All
                  </button>
                </div>
                <div className="flex items-center gap-2 xs:gap-3 w-full xs:w-auto justify-between xs:justify-start">
                  <span className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary font-medium hidden sm:block">
                    {mode === 'encode' ? 'Text → Base64' : 'Base64 → Text'}
                  </span>
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
                    {mode === 'encode' ? 'Text Input' : 'Base64 Input'}
                  </h3>
                  <p className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    {mode === 'encode'
                      ? 'Enter plain text to encode'
                      : 'Enter Base64 string to decode'}
                  </p>
                </div>
                <div className="p-2 xs:p-3 sm:p-4 md:p-6">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      mode === 'encode'
                        ? 'Enter text to encode...'
                        : 'Enter Base64 string to decode...'
                    }
                    className="w-full h-40 xs:h-48 sm:h-64 md:h-80 bg-white dark:bg-background-dark text-foreground-light dark:text-foreground-dark font-mono text-xs xs:text-sm sm:text-base p-2 xs:p-3 sm:p-4 border border-border-light dark:border-border-dark rounded-lg resize-none transition-all focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>
              </div>

              {/* Output Panel */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-3 xs:p-4 sm:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark flex justify-between items-center">
                  <div>
                    <h3 className="text-base xs:text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                      {mode === 'encode' ? 'Base64 Output' : 'Text Output'}
                    </h3>
                    <p className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                      {mode === 'encode'
                        ? 'Encoded result appears here'
                        : 'Decoded result appears here'}
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
                <div className="p-3 xs:p-4 sm:p-6">
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
                      placeholder={
                        mode === 'encode'
                          ? 'Base64 encoded result will appear here...'
                          : 'Decoded text will appear here...'
                      }
                      className="w-full h-64 xs:h-80 sm:h-96 bg-white dark:bg-background-dark text-foreground-light dark:text-foreground-dark font-mono text-xs xs:text-sm sm:text-base p-3 xs:p-4 border border-border-light dark:border-border-dark rounded-lg resize-none transition-all"
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="hidden xs:block mb-6 xs:mb-8 sm:mb-12 md:mb-16">
            <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
              Why Choose Our Base64 Tool?
            </h2>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Shield,
                  title: 'Secure Processing',
                  description:
                    'All encoding and decoding happens locally in your browser. No data is sent to servers.',
                },
                {
                  icon: Zap,
                  title: 'Fast & Efficient',
                  description:
                    'Instant encoding and decoding with support for large text files and binary data.',
                },
                {
                  icon: ArrowLeftRight,
                  title: 'Bidirectional',
                  description:
                    'Switch between encode and decode modes instantly. Swap input/output with one click.',
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

          {/* Usage Examples */}
          <section className="hidden sm:block mb-8 sm:mb-12 md:mb-16">
            <div className="rounded-lg border border-border-light bg-card-light p-6 dark:border-border-dark dark:bg-card-dark">
              <h3 className="text-2xl font-semibold text-foreground-light dark:text-foreground-dark mb-6 text-center">
                Common Use Cases
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="rounded-lg border border-border-light bg-white dark:border-border-dark dark:bg-background-dark p-4 transition-all hover:shadow-lg">
                  <h4 className="font-medium text-foreground-light dark:text-foreground-dark mb-2">
                    API Development
                  </h4>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-3">
                    Encode credentials, tokens, and data for HTTP headers and API requests.
                  </p>
                  <div className="bg-card-light dark:bg-card-dark p-3 rounded font-mono text-xs overflow-x-auto">
                    Authorization: Basic {'<base64-encoded-credentials>'}
                  </div>
                </div>
                <div className="rounded-lg border border-border-light bg-white dark:border-border-dark dark:bg-background-dark p-4 transition-all hover:shadow-lg">
                  <h4 className="font-medium text-foreground-light dark:text-foreground-dark mb-2">
                    Data URLs
                  </h4>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-3">
                    Embed images and files directly in HTML, CSS, or JavaScript.
                  </p>
                  <div className="bg-card-light dark:bg-card-dark p-3 rounded font-mono text-xs overflow-x-auto">
                    data:image/png;base64,{'<encoded-image-data>'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Content Sections for AdSense */}
          <section className="mb-8 sm:mb-12 md:mb-16 border-t border-border-light dark:border-border-dark pt-8 sm:pt-12">
            {/* About This Tool */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                About Base64 Encoder & Decoder
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Base64 is a binary-to-text encoding scheme that represents binary data in an ASCII
                  string format. It's widely used in various applications including email
                  attachments, data URLs, API authentication, and storing complex data in systems
                  that only support text. Our Base64 Encoder & Decoder provides a fast, secure, and
                  reliable way to convert between plain text and Base64 format.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  This tool handles all encoding and decoding operations directly in your browser,
                  ensuring complete privacy and security for sensitive data. Whether you're working
                  with API credentials, embedding images in HTML, or transmitting binary data over
                  text-based protocols, our tool makes the process simple and efficient.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                  With support for Unicode text, large data sets, and instant conversion, this tool
                  is designed for developers, system administrators, and anyone who needs reliable
                  Base64 encoding and decoding capabilities. The intuitive interface allows you to
                  quickly switch between encoding and decoding modes, making it perfect for
                  debugging and development workflows.
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
                  <h3 className="font-semibold text-lg mb-2">Step 1: Choose Your Mode</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Select "Encode" to convert plain text to Base64, or "Decode" to convert Base64
                    back to plain text using the toggle buttons at the top.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 2: Enter Your Data</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Paste or type your text (for encoding) or Base64 string (for decoding) into the
                    input field on the left side.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 3: Process the Data</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Click the "Encode to Base64" or "Decode from Base64" button to process your
                    input. The result will appear instantly in the output field.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 4: Use the Result</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Click the "Copy" button to copy the result to your clipboard, or use the "Swap"
                    button to move the output to input for further processing.
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
                  <h3 className="font-semibold mb-2">Unicode Support</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Full support for Unicode characters, emojis, and international text encoding.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Privacy-First</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    All processing happens locally in your browser. No data is ever sent to servers.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Instant Conversion</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Lightning-fast encoding and decoding with no network delays or processing
                    queues.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Bidirectional Flow</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Easily switch between encoding and decoding modes with one-click swap
                    functionality.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">History Support</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Full undo/redo functionality to navigate through your encoding history.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Mobile Responsive</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Optimized for all devices with touch-friendly controls and adaptive layout.
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
                  <h3 className="font-semibold mb-3">Example 1: Basic Authentication</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        Input (Plain Text):
                      </p>
                      <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                        {'username:password123'}
                      </pre>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        Output (Base64 Encoded):
                      </p>
                      <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                        {'dXNlcm5hbWU6cGFzc3dvcmQxMjM='}
                      </pre>
                    </div>
                  </div>
                  <p className="text-sm mt-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Used in HTTP headers:{' '}
                    <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                      Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQxMjM=
                    </code>
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Example 2: Data URL for Small Image</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        Input (SVG Image):
                      </p>
                      <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                        {`<svg width="16" height="16">
  <circle cx="8" cy="8" r="8" fill="red"/>
</svg>`}
                      </pre>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        Output (Base64 Data URL):
                      </p>
                      <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                        {
                          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiPgogIDxjaXJjbGUgY3g9IjgiIGN5PSI4IiByPSI4IiBmaWxsPSJyZWQiLz4KPC9zdmc+'
                        }
                      </pre>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Example 3: JSON Configuration</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        Input (JSON):
                      </p>
                      <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                        {`{"api_key":"sk-1234567890","model":"gpt-4"}`}
                      </pre>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        Output (Base64):
                      </p>
                      <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                        {'eyJhcGlfa2V5Ijoic2stMTIzNDU2Nzg5MCIsIm1vZGVsIjoiZ3B0LTQifQ=='}
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
                  <summary className="font-semibold cursor-pointer">
                    What is Base64 encoding?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Base64 is a method of encoding binary data using a set of 64 characters (A-Z,
                    a-z, 0-9, +, /) that are safe for transmission over text-based protocols. It's
                    commonly used when you need to store or transfer binary data through systems
                    designed to handle text.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">Is Base64 encryption?</summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    No, Base64 is NOT encryption. It's an encoding scheme that can be easily
                    reversed. Never use Base64 alone for securing sensitive data. It should only be
                    used for data transmission and storage compatibility, not security.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Why does Base64 increase data size?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Base64 encoding increases the data size by approximately 33% because it
                    represents every 3 bytes of binary data as 4 ASCII characters. This overhead is
                    the trade-off for being able to safely transmit binary data through text-only
                    channels.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I encode binary files?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    This tool is optimized for text data. For binary files like images or documents,
                    you would need to first convert them to a text representation or use specialized
                    file encoding tools that can handle binary input directly.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What's the maximum size I can encode?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Since processing happens in your browser, the practical limit depends on your
                    device's memory. Most modern browsers can handle several megabytes of text
                    without issues. For very large files, consider using command-line tools or
                    programming libraries.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Does this tool support URL-safe Base64?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    This tool uses standard Base64 encoding (with + and / characters). For URL-safe
                    Base64 (which uses - and _ instead), you would need to manually replace these
                    characters or use a specialized URL-safe Base64 encoder.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I use this offline?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Once the page is loaded, all encoding and decoding operations work offline since
                    they're performed entirely in your browser using JavaScript. You only need an
                    internet connection to initially load the tool.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    How do I encode special characters and emojis?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    This tool fully supports Unicode, including special characters and emojis. They
                    are first converted to UTF-8 bytes and then encoded to Base64, ensuring proper
                    encoding and decoding of all Unicode characters.
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
