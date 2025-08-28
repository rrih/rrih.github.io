'use client'

import { useState } from 'react'
import { CheckCircle, FileText, Zap } from 'lucide-react'

export default function JsonFormatterPage() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [indentSize, setIndentSize] = useState(2)

  const formatJson = () => {
    try {
      setError('')
      const parsed = JSON.parse(input)
      const formatted = JSON.stringify(parsed, null, indentSize)
      setOutput(formatted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format')
      setOutput('')
    }
  }

  const minifyJson = () => {
    try {
      setError('')
      const parsed = JSON.parse(input)
      const minified = JSON.stringify(parsed)
      setOutput(minified)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format')
      setOutput('')
    }
  }

  const validateJson = () => {
    try {
      JSON.parse(input)
      setError('')
      setOutput('✅ Valid JSON')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format')
      setOutput('')
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
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 dark:text-white mb-4">
            JSON Formatter & Validator
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto px-4">
            Format, validate, and beautify JSON data with syntax highlighting. Perfect for
            developers working with APIs and configuration files.
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg mb-6 p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={formatJson}
                className="bg-accent hover:bg-accent-dark text-white px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors"
              >
                Format
              </button>
              <button
                onClick={minifyJson}
                className="bg-accent hover:bg-accent-dark text-white px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors"
              >
                Minify
              </button>
              <button
                onClick={validateJson}
                className="bg-accent hover:bg-accent-dark text-white px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors"
              >
                Validate
              </button>
              <button
                onClick={clearAll}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="indent" className="text-sm text-slate-600 dark:text-slate-300">
                Indent:
              </label>
              <select
                id="indent"
                value={indentSize}
                onChange={(e) => setIndentSize(Number(e.target.value))}
                className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-1 rounded border"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
                <option value={1}>1 tab</option>
              </select>
            </div>
          </div>
        </div>

        {/* Input/Output Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Input JSON</h3>
            </div>
            <div className="p-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your JSON here..."
                className="w-full h-96 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-sm p-4 border border-slate-200 dark:border-slate-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Output Panel */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Output</h3>
              {output && (
                <button
                  onClick={() => copyToClipboard(output)}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  Copy
                </button>
              )}
            </div>
            <div className="p-4">
              {error ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-600 dark:text-red-400 font-medium">Error:</p>
                  <p className="text-red-700 dark:text-red-300 font-mono text-sm mt-1">{error}</p>
                </div>
              ) : (
                <textarea
                  value={output}
                  readOnly
                  placeholder="Formatted JSON will appear here..."
                  className="w-full h-96 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-sm p-4 border border-slate-200 dark:border-slate-700 rounded-lg resize-none focus:outline-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="text-accent dark:text-accent mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              JSON Validation
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Instantly validate your JSON syntax and identify errors with detailed error messages.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="text-accent dark:text-accent mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Beautiful Formatting
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Format JSON with customizable indentation for better readability and debugging.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="text-accent dark:text-accent mb-4">
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Minify & Optimize
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Compress JSON by removing whitespace to reduce file size for production use.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
