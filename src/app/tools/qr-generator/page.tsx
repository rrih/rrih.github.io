'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { localStorageManager } from '@/lib/localStorage'
import { urlSharingManager } from '@/lib/urlSharing'
import {
  ArrowDownToLine,
  Copy,
  Download,
  FileText,
  Hash,
  Link,
  Settings,
  Share2,
  Trash2,
  Wifi,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useCallback, useEffect, useState } from 'react'

interface QRGeneratorState {
  input: string
  qrType: 'text' | 'url' | 'wifi' | 'email'
  size: number
  errorLevel: 'L' | 'M' | 'Q' | 'H'
  foregroundColor: string
  backgroundColor: string
  wifiSettings: {
    ssid: string
    password: string
    security: string
    hidden: boolean
  }
}

export default function QRGenerator() {
  const TOOL_NAME = 'qr-generator'

  const defaultState: QRGeneratorState = {
    input: '',
    qrType: 'text',
    size: 256,
    errorLevel: 'M',
    foregroundColor: '#000000',
    backgroundColor: '#ffffff',
    wifiSettings: {
      ssid: '',
      password: '',
      security: 'WPA',
      hidden: false,
    },
  }

  const [state, setState] = useState<QRGeneratorState>(defaultState)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [isSharing, setIsSharing] = useState(false)

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { input, qrType, size, errorLevel, foregroundColor, backgroundColor, wifiSettings } = state

  // クライアントサイドでのみ初期状態を復元
  useEffect(() => {
    const sharedState = urlSharingManager.getSharedStateFromUrl<QRGeneratorState>(TOOL_NAME)
    if (sharedState) {
      setState(sharedState)
      return
    }

    const savedState = localStorageManager.load<QRGeneratorState>(TOOL_NAME)
    if (savedState) {
      setState(savedState)
    }
  }, [])

  // 状態が変更されるたびにローカルストレージに保存
  useEffect(() => {
    if (input || wifiSettings.ssid) {
      localStorageManager.save(TOOL_NAME, state)
    }
  }, [state, input, wifiSettings.ssid])

  // Real QR Code generation using qrcode library
  const generateQRCode = useCallback(
    async (data: string) => {
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(data, {
          width: size,
          margin: 2,
          color: {
            dark: foregroundColor,
            light: backgroundColor,
          },
          errorCorrectionLevel: errorLevel,
        })
        setQrDataUrl(qrCodeDataUrl)
      } catch (error) {
        console.error('Error generating QR code:', error)
        setQrDataUrl('')
      }
    },
    [size, errorLevel, foregroundColor, backgroundColor]
  )

  const getQRData = useCallback((): string => {
    switch (qrType) {
      case 'wifi':
        return `WIFI:T:${wifiSettings.security};S:${wifiSettings.ssid};P:${wifiSettings.password};H:${wifiSettings.hidden};`
      case 'email':
        return `mailto:${input}`
      case 'url':
        return input.startsWith('http') ? input : `https://${input}`
      default:
        return input
    }
  }, [qrType, wifiSettings, input])

  useEffect(() => {
    if (input.trim() || (qrType === 'wifi' && wifiSettings.ssid.trim())) {
      generateQRCode(getQRData())
    } else {
      setQrDataUrl('')
    }
  }, [input, qrType, wifiSettings, generateQRCode, getQRData])

  const downloadQR = () => {
    if (!qrDataUrl) return

    const link = document.createElement('a')
    link.download = 'qr-code.png'
    link.href = qrDataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyQRImage = async () => {
    if (!qrDataUrl) return

    try {
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ])
      successToast('QR code copied!', 'QR code image has been copied to clipboard')
    } catch (err) {
      console.error('Failed to copy QR code:', err)
      errorToast('Copy failed', 'Failed to copy QR code to clipboard')
    }
  }

  const [isNativeSharing, setIsNativeSharing] = useState(false)

  const shareQR = async () => {
    if (!qrDataUrl || !navigator.share || isNativeSharing) return

    setIsNativeSharing(true)
    try {
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()
      const file = new File([blob], 'qr-code.png', { type: 'image/png' })

      await navigator.share({
        title: 'QR Code',
        text: 'Generated QR Code',
        files: [file],
      })
    } catch (err: unknown) {
      // Don't show error for user cancellation
      if ((err as Error).name !== 'AbortError') {
        console.error('Failed to share QR code:', err)
        errorToast('Share failed', 'Failed to share QR code')
      }
    } finally {
      setIsNativeSharing(false)
    }
  }

  // URL共有機能
  const handleShare = async () => {
    setIsSharing(true)
    try {
      const shareUrl = urlSharingManager.generateShareUrl(TOOL_NAME, state)
      const success = await urlSharingManager.copyShareUrl(shareUrl)

      if (success) {
        successToast('Share URL copied!', 'The shareable URL has been copied to your clipboard')
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
      urlSharingManager.cleanUrl()
      setState(defaultState)
      setQrDataUrl('')
    }
  }

  // データエクスポート機能
  const handleExportData = () => {
    const data = {
      ...state,
      qrDataUrl,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-generator-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Header />

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground-light dark:text-foreground-dark mb-4">
            QR Code Generator
          </h1>
          <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
            Generate QR codes for URLs, text, WiFi credentials, and more with customization options
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Input Section */}
          <div className="space-y-6">
            {/* QR Type Selection */}
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Hash className="h-5 w-5" />
                QR Code Type
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setState((prev) => ({ ...prev, qrType: 'text' }))}
                  className={`p-3 rounded-lg border transition-colors ${
                    qrType === 'text'
                      ? 'bg-accent text-white border-accent'
                      : 'border-border-light dark:border-border-dark hover:border-accent'
                  }`}
                >
                  <FileText className="h-5 w-5 mx-auto mb-1" />
                  Text
                </button>
                <button
                  onClick={() => setState((prev) => ({ ...prev, qrType: 'url' }))}
                  className={`p-3 rounded-lg border transition-colors ${
                    qrType === 'url'
                      ? 'bg-accent text-white border-accent'
                      : 'border-border-light dark:border-border-dark hover:border-accent'
                  }`}
                >
                  <Link className="h-5 w-5 mx-auto mb-1" />
                  URL
                </button>
                <button
                  onClick={() => setState((prev) => ({ ...prev, qrType: 'wifi' }))}
                  className={`p-3 rounded-lg border transition-colors ${
                    qrType === 'wifi'
                      ? 'bg-accent text-white border-accent'
                      : 'border-border-light dark:border-border-dark hover:border-accent'
                  }`}
                >
                  <Wifi className="h-5 w-5 mx-auto mb-1" />
                  WiFi
                </button>
                <button
                  onClick={() => setState((prev) => ({ ...prev, qrType: 'email' }))}
                  className={`p-3 rounded-lg border transition-colors ${
                    qrType === 'email'
                      ? 'bg-accent text-white border-accent'
                      : 'border-border-light dark:border-border-dark hover:border-accent'
                  }`}
                >
                  <span className="text-lg mx-auto mb-1 block">@</span>
                  Email
                </button>
              </div>
            </div>

            {/* Input Fields */}
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
              <h2 className="text-xl font-semibold mb-4">Content</h2>

              {qrType === 'wifi' ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="wifi-ssid" className="block text-sm font-medium mb-2">
                      Network Name (SSID)
                    </label>
                    <input
                      id="wifi-ssid"
                      type="text"
                      value={wifiSettings.ssid}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          wifiSettings: { ...prev.wifiSettings, ssid: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      placeholder="Enter WiFi network name"
                    />
                  </div>
                  <div>
                    <label htmlFor="wifi-password" className="block text-sm font-medium mb-2">
                      Password
                    </label>
                    <input
                      id="wifi-password"
                      type="password"
                      value={wifiSettings.password}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          wifiSettings: { ...prev.wifiSettings, password: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      placeholder="Enter WiFi password"
                    />
                  </div>
                  <div>
                    <label htmlFor="wifi-security" className="block text-sm font-medium mb-2">
                      Security
                    </label>
                    <select
                      id="wifi-security"
                      value={wifiSettings.security}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          wifiSettings: { ...prev.wifiSettings, security: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                    >
                      <option value="WPA">WPA/WPA2</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">None</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={wifiSettings.hidden}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          wifiSettings: { ...prev.wifiSettings, hidden: e.target.checked },
                        }))
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Hidden Network</span>
                  </label>
                </div>
              ) : (
                <div>
                  <label htmlFor="qr-input" className="block text-sm font-medium mb-2">
                    {qrType === 'url' ? 'URL' : qrType === 'email' ? 'Email Address' : 'Text'}
                  </label>
                  <textarea
                    id="qr-input"
                    value={input}
                    onChange={(e) => setState((prev) => ({ ...prev, input: e.target.value }))}
                    className="w-full h-32 px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark resize-none"
                    placeholder={
                      qrType === 'url'
                        ? 'https://example.com'
                        : qrType === 'email'
                          ? 'user@example.com'
                          : 'Enter your text here'
                    }
                  />
                </div>
              )}
            </div>

            {/* Customization */}
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Customization
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="qr-size" className="block text-sm font-medium mb-2">
                    Size: {size}px
                  </label>
                  <input
                    id="qr-size"
                    type="range"
                    min="128"
                    max="512"
                    step="32"
                    value={size}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, size: Number.parseInt(e.target.value) }))
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label htmlFor="error-level" className="block text-sm font-medium mb-2">
                    Error Correction
                  </label>
                  <select
                    id="error-level"
                    value={errorLevel}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        errorLevel: e.target.value as 'L' | 'M' | 'Q' | 'H',
                      }))
                    }
                    className="w-full px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                  >
                    <option value="L">Low (7%)</option>
                    <option value="M">Medium (15%)</option>
                    <option value="Q">Quartile (25%)</option>
                    <option value="H">High (30%)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fg-color" className="block text-sm font-medium mb-2">
                      Foreground Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="fg-color"
                        type="color"
                        value={foregroundColor}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, foregroundColor: e.target.value }))
                        }
                        className="w-12 h-10 border border-border-light dark:border-border-dark rounded-lg"
                      />
                      <input
                        type="text"
                        value={foregroundColor}
                        aria-label="Foreground color hex value"
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, foregroundColor: e.target.value }))
                        }
                        className="flex-1 px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="bg-color" className="block text-sm font-medium mb-2">
                      Background Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="bg-color"
                        type="color"
                        value={backgroundColor}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, backgroundColor: e.target.value }))
                        }
                        className="w-12 h-10 border border-border-light dark:border-border-dark rounded-lg"
                      />
                      <input
                        type="text"
                        value={backgroundColor}
                        aria-label="Background color hex value"
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, backgroundColor: e.target.value }))
                        }
                        className="flex-1 px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleShare}
                    disabled={isSharing}
                    className="flex items-center gap-2 px-3 py-2 border border-border-light dark:border-border-dark rounded-lg hover:border-accent transition-colors disabled:opacity-50"
                  >
                    <Share2 className="h-4 w-4" />
                    {isSharing ? 'Sharing...' : 'Share'}
                  </button>

                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-2 px-3 py-2 border border-border-light dark:border-border-dark rounded-lg hover:border-accent transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>

                  <button
                    onClick={handleClearData}
                    className="flex items-center gap-2 px-3 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors dark:border-red-700 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
              <h2 className="text-xl font-semibold mb-4">Generated QR Code</h2>

              <div className="text-center">
                {qrDataUrl ? (
                  <div className="space-y-4">
                    <div className="inline-block p-4 bg-white rounded-lg border">
                      <img
                        src={qrDataUrl}
                        alt="Generated QR Code"
                        className="max-w-full h-auto"
                        style={{ maxWidth: size, maxHeight: size }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-3 justify-center">
                      <button
                        onClick={downloadQR}
                        className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
                      >
                        <ArrowDownToLine className="h-4 w-4" />
                        Download
                      </button>

                      <button
                        onClick={copyQRImage}
                        className="flex items-center gap-2 px-4 py-2 border border-border-light dark:border-border-dark rounded-lg hover:border-accent transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>

                      {'share' in navigator && (
                        <button
                          onClick={shareQR}
                          disabled={isNativeSharing}
                          className="flex items-center gap-2 px-4 py-2 border border-border-light dark:border-border-dark rounded-lg hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Share2 className="h-4 w-4" />
                          Share
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    <Hash className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Enter content to generate a QR code</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}
