'use client'

import { useState } from 'react'
import { Shield, Zap, ArrowLeftRight } from 'lucide-react'

export default function Base64Page() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [error, setError] = useState('')

  const handleEncode = () => {
    try {
      setError('')
      const encoded = btoa(unescape(encodeURIComponent(input)))
      setOutput(encoded)
    } catch (err) {
      setError('Failed to encode. Please check your input.')
      setOutput('')
    }
  }

  const handleDecode = () => {
    try {
      setError('')
      const decoded = decodeURIComponent(escape(atob(input)))
      setOutput(decoded)
    } catch (err) {
      setError('Invalid Base64 string. Please check your input.')
      setOutput('')
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 dark:text-white mb-4">
            Base64 Encoder & Decoder
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto px-4">
            Encode and decode Base64 strings quickly and securely. Perfect for data transmission,
            API integration, and web development.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-1">
            <div className="flex gap-1">
              <button
                onClick={() => switchMode('encode')}
                className={`px-4 sm:px-6 py-3 min-h-[44px] rounded-md font-medium transition-all ${
                  mode === 'encode'
                    ? 'bg-accent text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Encode
              </button>
              <button
                onClick={() => switchMode('decode')}
                className={`px-4 sm:px-6 py-3 min-h-[44px] rounded-md font-medium transition-all ${
                  mode === 'decode'
                    ? 'bg-accent text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Decode
              </button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg mb-6 p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={processInput}
                className="bg-accent hover:bg-accent-dark text-white px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors"
              >
                {mode === 'encode' ? 'Encode to Base64' : 'Decode from Base64'}
              </button>
              {output && (
                <button
                  onClick={swapInputOutput}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors"
                >
                  ↕ Swap
                </button>
              )}
              <button
                onClick={clearAll}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="hidden sm:block">
                {mode === 'encode' ? 'Text → Base64' : 'Base64 → Text'}
              </span>
            </div>
          </div>
        </div>

        {/* Input/Output Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                {mode === 'encode' ? 'Text Input' : 'Base64 Input'}
              </h3>
            </div>
            <div className="p-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  mode === 'encode' ? 'Enter text to encode...' : 'Enter Base64 string to decode...'
                }
                className="w-full h-48 sm:h-64 lg:h-96 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-sm sm:text-base p-4 border border-slate-200 dark:border-slate-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Output Panel */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                {mode === 'encode' ? 'Base64 Output' : 'Text Output'}
              </h3>
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
                  placeholder={
                    mode === 'encode'
                      ? 'Base64 encoded result will appear here...'
                      : 'Decoded text will appear here...'
                  }
                  className="w-full h-48 sm:h-64 lg:h-96 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-sm sm:text-base p-4 border border-slate-200 dark:border-slate-700 rounded-lg resize-none focus:outline-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="text-accent dark:text-accent mb-4">
              <Shield className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Secure Processing
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              All encoding and decoding happens locally in your browser. No data is sent to servers.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="text-accent dark:text-accent mb-4">
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Fast & Efficient
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Instant encoding and decoding with support for large text files and binary data.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="text-accent dark:text-accent mb-4">
              <ArrowLeftRight className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Bidirectional
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Switch between encode and decode modes instantly. Swap input/output with one click.
            </p>
          </div>
        </div>

        {/* Usage Examples */}
        <div className="mt-12 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">
            Common Use Cases
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">
                API Development
              </h4>
              <p className="text-slate-600 dark:text-slate-400 mb-3">
                Encode credentials, tokens, and data for HTTP headers and API requests.
              </p>
              <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded font-mono text-xs">
                Authorization: Basic {'{base64-encoded-credentials}'}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Data URLs</h4>
              <p className="text-slate-600 dark:text-slate-400 mb-3">
                Embed images and files directly in HTML, CSS, or JavaScript.
              </p>
              <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded font-mono text-xs">
                data:image/png;base64,{'{encoded-image-data}'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
