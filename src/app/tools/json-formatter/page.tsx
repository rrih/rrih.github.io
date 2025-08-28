'use client'

import { useState } from 'react'
import { CheckCircle, FileText, Zap, Copy, AlertCircle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

export default function JsonFormatterPage() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [indentSize, setIndentSize] = useState(2)
  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState(false)

  const formatJson = async () => {
    if (!input.trim()) return
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 200))
    
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
    await new Promise(resolve => setTimeout(resolve, 200))
    
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
    await new Promise(resolve => setTimeout(resolve, 200))
    
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

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 py-6 xs:py-8 sm:py-12">
        <Header />

        <main>
          {/* Hero Section */}
          <section className="mb-16 sm:mb-20 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-4 xs:mb-6 text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                JSON Formatter & Validator
              </h1>
              <p className="mb-6 xs:mb-8 text-base xs:text-lg sm:text-xl text-foreground-light-secondary dark:text-foreground-dark-secondary px-2 xs:px-0">
                Format, validate, and beautify JSON data with syntax highlighting.
              </p>
            </div>
          </section>

          {/* Controls */}
          <section className="mb-8">
            <div className="rounded-lg border border-border-light bg-card-light p-3 xs:p-4 sm:p-6 dark:border-border-dark dark:bg-card-dark">
              <div className="flex flex-col xs:flex-row flex-wrap gap-3 xs:gap-4 items-start xs:items-center justify-between">
                <div className="flex gap-1 xs:gap-2 flex-wrap w-full xs:w-auto">
                  <button
                    onClick={formatJson}
                    disabled={isProcessing}
                    className="rounded-lg bg-accent px-3 xs:px-4 sm:px-6 py-3 xs:py-4 min-h-[44px] text-white font-medium text-sm xs:text-base transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    {isProcessing ? 'Processing...' : 'Format'}
                  </button>
                  <button
                    onClick={minifyJson}
                    disabled={isProcessing}
                    className="rounded-lg bg-accent px-3 xs:px-4 sm:px-6 py-3 xs:py-4 min-h-[44px] text-white font-medium text-sm xs:text-base transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    {isProcessing ? 'Processing...' : 'Minify'}
                  </button>
                  <button
                    onClick={validateJson}
                    disabled={isProcessing}
                    className="rounded-lg bg-accent px-3 xs:px-4 sm:px-6 py-3 xs:py-4 min-h-[44px] text-white font-medium text-sm xs:text-base transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    {isProcessing ? 'Processing...' : 'Validate'}
                  </button>
                  <button
                    onClick={clearAll}
                    className="rounded-lg border border-border-light px-3 xs:px-4 sm:px-6 py-3 xs:py-4 min-h-[44px] font-medium text-sm xs:text-base transition-all hover:border-red-500 hover:text-red-500 dark:border-border-dark hover:shadow-lg active:scale-95 flex-1 xs:flex-none"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center gap-2 xs:gap-3 w-full xs:w-auto justify-between xs:justify-start">
                  <label htmlFor="indent" className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary font-medium">
                    Indent:
                  </label>
                  <select
                    id="indent"
                    value={indentSize}
                    onChange={(e) => setIndentSize(Number(e.target.value))}
                    className="bg-white dark:bg-background-dark text-foreground-light dark:text-foreground-dark px-2 xs:px-3 py-2 text-sm rounded-lg border border-border-light dark:border-border-dark transition-all focus:ring-2 focus:ring-accent focus:border-accent">
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
          <section className="mb-16 sm:mb-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 xs:gap-6">
              {/* Input Panel */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-3 xs:p-4 sm:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-base xs:text-lg font-semibold text-foreground-light dark:text-foreground-dark">Input JSON</h3>
                  <p className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    Paste your JSON data here
                  </p>
                </div>
                <div className="p-3 xs:p-4 sm:p-6">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Paste your JSON here..."
                    className="w-full h-64 xs:h-80 sm:h-96 bg-white dark:bg-background-dark text-foreground-light dark:text-foreground-dark font-mono text-xs xs:text-sm sm:text-base p-3 xs:p-4 border border-border-light dark:border-border-dark rounded-lg resize-none transition-all focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>
              </div>

              {/* Output Panel */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-3 xs:p-4 sm:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark flex justify-between items-center">
                  <div>
                    <h3 className="text-base xs:text-lg font-semibold text-foreground-light dark:text-foreground-dark">Output</h3>
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
                <div className="p-3 xs:p-4 sm:p-6">
                  {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3 xs:p-4 transition-all">
                      <div className="flex items-center gap-1 xs:gap-2 text-red-600 dark:text-red-400 font-medium mb-2">
                        <AlertCircle className="w-3 h-3 xs:w-4 xs:h-4" />
                        Error:
                      </div>
                      <p className="text-red-700 dark:text-red-300 font-mono text-xs xs:text-sm">{error}</p>
                    </div>
                  ) : (
                    <textarea
                      value={output}
                      readOnly
                      placeholder="Formatted JSON will appear here..."
                      className="w-full h-64 xs:h-80 sm:h-96 bg-white dark:bg-background-dark text-foreground-light dark:text-foreground-dark font-mono text-xs xs:text-sm sm:text-base p-3 xs:p-4 border border-border-light dark:border-border-dark rounded-lg resize-none transition-all"
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="mb-16 sm:mb-20">
            <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">Why Choose Our JSON Formatter?</h2>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: CheckCircle,
                  title: 'JSON Validation',
                  description: 'Instantly validate your JSON syntax and identify errors with detailed error messages.'
                },
                {
                  icon: FileText,
                  title: 'Beautiful Formatting',
                  description: 'Format JSON with customizable indentation for better readability and debugging.'
                },
                {
                  icon: Zap,
                  title: 'Minify & Optimize',
                  description: 'Compress JSON by removing whitespace to reduce file size for production use.'
                }
              ].map((feature, index) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-border-light bg-card-light p-6 text-center dark:border-border-dark dark:bg-card-dark transition-all hover:-translate-y-1 hover:shadow-lg"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.6s ease-out forwards'
                  }}
                >
                  <div className="mb-4 flex justify-center">
                    <feature.icon className="h-10 w-10 text-accent transition-transform hover:scale-110" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground-light dark:text-foreground-dark">{feature.title}</h3>
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