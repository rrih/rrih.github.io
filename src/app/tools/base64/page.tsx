'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { AlertCircle, ArrowLeftRight, Copy, Shield, Zap } from 'lucide-react'
import { useState } from 'react'

export default function Base64Page() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleEncode = async () => {
    if (!input.trim()) return
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 200))

    try {
      setError('')
      const encoded = btoa(unescape(encodeURIComponent(input)))
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
      const decoded = decodeURIComponent(escape(atob(input)))
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
    setMode(newMode)
    setInput('')
    setOutput('')
    setError('')
  }

  const clearAll = () => {
    setInput('')
    setOutput('')
    setError('')
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
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 py-6 xs:py-8 sm:py-12">
        <Header />

        <main>
          {/* Hero Section */}
          <section className="mb-16 sm:mb-20 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-4 xs:mb-6 text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                Base64 Encoder & Decoder
              </h1>
              <p className="mb-6 xs:mb-8 text-base xs:text-lg sm:text-xl text-foreground-light-secondary dark:text-foreground-dark-secondary px-2 xs:px-0">
                Encode and decode Base64 strings with secure client-side processing.
              </p>
            </div>
          </section>

          {/* Mode Toggle */}
          <section className="mb-8 flex justify-center">
            <div className="rounded-lg border border-border-light bg-card-light p-1 dark:border-border-dark dark:bg-card-dark mx-3 xs:mx-0">
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
          <section className="mb-8">
            <div className="rounded-lg border border-border-light bg-card-light p-3 xs:p-4 sm:p-6 dark:border-border-dark dark:bg-card-dark">
              <div className="flex flex-col xs:flex-row flex-wrap gap-3 xs:gap-4 items-start xs:items-center justify-between">
                <div className="flex gap-1 xs:gap-2 flex-wrap w-full xs:w-auto">
                  <button
                    onClick={processInput}
                    disabled={isProcessing}
                    className="rounded-lg bg-accent px-3 xs:px-4 sm:px-6 py-3 xs:py-4 min-h-[44px] text-white font-medium text-sm xs:text-base transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
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
                    onClick={clearAll}
                    className="rounded-lg border border-border-light px-3 xs:px-4 sm:px-6 py-3 xs:py-4 min-h-[44px] font-medium text-sm xs:text-base transition-all hover:border-red-500 hover:text-red-500 dark:border-border-dark hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    Clear
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
          <section className="mb-16 sm:mb-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 xs:gap-6">
              {/* Input Panel */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-3 xs:p-4 sm:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-base xs:text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                    {mode === 'encode' ? 'Text Input' : 'Base64 Input'}
                  </h3>
                  <p className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    {mode === 'encode'
                      ? 'Enter plain text to encode'
                      : 'Enter Base64 string to decode'}
                  </p>
                </div>
                <div className="p-3 xs:p-4 sm:p-6">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      mode === 'encode'
                        ? 'Enter text to encode...'
                        : 'Enter Base64 string to decode...'
                    }
                    className="w-full h-64 xs:h-80 sm:h-96 bg-white dark:bg-background-dark text-foreground-light dark:text-foreground-dark font-mono text-xs xs:text-sm sm:text-base p-3 xs:p-4 border border-border-light dark:border-border-dark rounded-lg resize-none transition-all focus:ring-2 focus:ring-accent focus:border-accent"
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
          <section className="mb-8">
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
          <section className="mb-16 sm:mb-20">
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
