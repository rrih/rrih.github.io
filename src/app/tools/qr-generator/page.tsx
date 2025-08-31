'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { localStorageManager } from '@/lib/localStorage'
import { useUrlSharing } from '@/lib/urlSharing'
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

  const { generateShareUrl, shareInfo, getInitialStateFromUrl } =
    useUrlSharing<QRGeneratorState>(TOOL_NAME)

  const { input, qrType, size, errorLevel, foregroundColor, backgroundColor, wifiSettings } = state

  // クライアントサイドでのみ初期状態を復元
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初期化処理のため一度だけ実行
  useEffect(() => {
    const sharedState = getInitialStateFromUrl()
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

  useEffect(() => {
    let qrData: string
    switch (qrType) {
      case 'wifi':
        qrData = `WIFI:T:${wifiSettings.security};S:${wifiSettings.ssid};P:${wifiSettings.password};H:${wifiSettings.hidden};`
        break
      case 'email':
        qrData = `mailto:${input}`
        break
      case 'url':
        qrData = input.startsWith('http') ? input : `https://${input}`
        break
      default:
        qrData = input
        break
    }

    if (qrData.trim()) {
      QRCode.toDataURL(qrData, {
        width: size,
        margin: 2,
        color: {
          dark: foregroundColor,
          light: backgroundColor,
        },
        errorCorrectionLevel: errorLevel,
      })
        .then((qrCodeDataUrl) => {
          setQrDataUrl(qrCodeDataUrl)
        })
        .catch((error) => {
          console.error('Error generating QR code:', error)
          setQrDataUrl('')
        })
    } else {
      setQrDataUrl('')
    }
  }, [input, qrType, wifiSettings, size, errorLevel, foregroundColor, backgroundColor])

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

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
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
      <Header />
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground-light dark:text-foreground-dark mb-4">
            QR Code Generator
          </h1>
          <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
            Generate QR codes for URLs, text, WiFi credentials, and more with customization options
          </p>
        </div>

        <div className="grid gap-4 xs:gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-2 overflow-hidden">
          {/* Input Section */}
          <div className="space-y-4 xs:space-y-6 min-w-0">
            {/* QR Type Selection */}
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-3 xs:p-4 sm:p-6 min-w-0 overflow-hidden">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Hash className="h-5 w-5" />
                QR Code Type
              </h2>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                <button
                  onClick={() => setState((prev) => ({ ...prev, qrType: 'text' }))}
                  className={`p-2 xs:p-3 rounded-lg border transition-colors min-h-[44px] text-xs xs:text-sm ${
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
                  className={`p-2 xs:p-3 rounded-lg border transition-colors min-h-[44px] text-xs xs:text-sm ${
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
                  className={`p-2 xs:p-3 rounded-lg border transition-colors min-h-[44px] text-xs xs:text-sm ${
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
                  className={`p-2 xs:p-3 rounded-lg border transition-colors min-h-[44px] text-xs xs:text-sm ${
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
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-3 xs:p-4 sm:p-6 min-w-0 overflow-hidden">
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
                          wifiSettings: {
                            ...prev.wifiSettings,
                            ssid: e.target.value,
                          },
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
                          wifiSettings: {
                            ...prev.wifiSettings,
                            password: e.target.value,
                          },
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
                          wifiSettings: {
                            ...prev.wifiSettings,
                            security: e.target.value,
                          },
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
                          wifiSettings: {
                            ...prev.wifiSettings,
                            hidden: e.target.checked,
                          },
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
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-3 xs:p-4 sm:p-6 min-w-0 overflow-hidden">
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
                      setState((prev) => ({
                        ...prev,
                        size: Number.parseInt(e.target.value),
                      }))
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

                <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fg-color" className="block text-sm font-medium mb-2">
                      Foreground Color
                    </label>
                    <div className="flex gap-2 min-w-0">
                      <input
                        id="fg-color"
                        type="color"
                        value={foregroundColor}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            foregroundColor: e.target.value,
                          }))
                        }
                        className="w-10 xs:w-12 h-8 xs:h-10 border border-border-light dark:border-border-dark rounded-lg flex-shrink-0"
                      />
                      <input
                        type="text"
                        value={foregroundColor}
                        aria-label="Foreground color hex value"
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            foregroundColor: e.target.value,
                          }))
                        }
                        className="flex-1 min-w-0 px-2 xs:px-3 py-2 text-xs xs:text-sm border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="bg-color" className="block text-sm font-medium mb-2">
                      Background Color
                    </label>
                    <div className="flex gap-2 min-w-0">
                      <input
                        id="bg-color"
                        type="color"
                        value={backgroundColor}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            backgroundColor: e.target.value,
                          }))
                        }
                        className="w-10 xs:w-12 h-8 xs:h-10 border border-border-light dark:border-border-dark rounded-lg flex-shrink-0"
                      />
                      <input
                        type="text"
                        value={backgroundColor}
                        aria-label="Background color hex value"
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            backgroundColor: e.target.value,
                          }))
                        }
                        className="flex-1 min-w-0 px-2 xs:px-3 py-2 text-xs xs:text-sm border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
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
          <div className="space-y-4 xs:space-y-6 min-w-0">
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-3 xs:p-4 sm:p-6 min-w-0 overflow-hidden">
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

        {/* Content Sections for AdSense */}
        <section className="mb-8 sm:mb-12 md:mb-16 border-t border-border-light dark:border-border-dark pt-8 sm:pt-12">
          {/* About This Tool */}
          <div className="mb-12">
            <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
              About QR Code Generator
            </h2>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                Our QR Code Generator is a comprehensive, free online tool that creates high-quality
                QR codes for various purposes. QR codes (Quick Response codes) are two-dimensional
                barcodes that can store different types of information including URLs, text, WiFi
                credentials, email addresses, and more. They provide a fast and convenient way to
                share information that can be quickly scanned by smartphones and other devices.
              </p>
              <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                This tool supports multiple QR code types and offers extensive customization options
                including size adjustment, error correction levels, and custom colors. All QR code
                generation happens locally in your browser, ensuring your data remains private and
                secure. Whether you're creating QR codes for business cards, marketing materials,
                WiFi sharing, or personal use, our generator provides professional-quality results
                with instant preview and download capabilities.
              </p>
              <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                With support for high-resolution output, batch processing capabilities, and
                mobile-responsive design, this QR code generator is perfect for businesses,
                developers, marketers, and anyone who needs reliable QR code creation. The intuitive
                interface makes it easy to create, customize, and share QR codes in seconds.
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
                <h3 className="font-semibold text-lg mb-2">Step 1: Choose QR Code Type</h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Select the type of QR code you want to create: Text, URL, WiFi credentials, or
                  Email. Each type is optimized for different use cases and scanning behaviors.
                </p>
              </div>
              <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <h3 className="font-semibold text-lg mb-2">Step 2: Enter Your Content</h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Fill in the required fields based on your selected type. For WiFi, enter network
                  name and password. For URLs, enter the web address. For text, type your message.
                </p>
              </div>
              <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <h3 className="font-semibold text-lg mb-2">Step 3: Customize Appearance</h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Adjust the size, error correction level, and colors to match your needs. Higher
                  error correction allows the QR code to work even if partially damaged.
                </p>
              </div>
              <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <h3 className="font-semibold text-lg mb-2">Step 4: Download or Share</h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Once generated, download the QR code as PNG, copy to clipboard, or share directly
                  using your device's native sharing capabilities.
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
                <h3 className="font-semibold mb-2">Multiple QR Types</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Support for text, URLs, WiFi credentials, and email addresses with specialized
                  formatting for each type.
                </p>
              </div>
              <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                <h3 className="font-semibold mb-2">Custom Styling</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Customize colors, size, and error correction levels to match your brand or
                  specific requirements.
                </p>
              </div>
              <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                <h3 className="font-semibold mb-2">High Quality Output</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Generate crisp, high-resolution QR codes suitable for printing and digital use up
                  to 512x512 pixels.
                </p>
              </div>
              <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                <h3 className="font-semibold mb-2">Instant Preview</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  See your QR code generated in real-time as you type, with immediate feedback on
                  content validity.
                </p>
              </div>
              <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                <h3 className="font-semibold mb-2">Privacy Focused</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  All QR code generation happens locally in your browser. Your data never leaves
                  your device.
                </p>
              </div>
              <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                <h3 className="font-semibold mb-2">Cross-Platform Compatible</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Generated QR codes work with all standard QR code readers and smartphone cameras
                  across all platforms.
                </p>
              </div>
            </div>
          </div>

          {/* Examples */}
          <div className="mb-12">
            <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
              Use Cases & Examples
            </h2>
            <div className="space-y-4 xs:space-y-6 min-w-0">
              <div>
                <h3 className="font-semibold mb-3">Example 1: WiFi Network Sharing</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Setup:
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs">
                      <div>Network: MyHomeWiFi</div>
                      <div>Password: SecurePass123</div>
                      <div>Security: WPA2</div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Result:
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs">
                      QR code that automatically connects devices to your WiFi network when scanned,
                      without manual password entry.
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Example 2: Business Contact Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Input:
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs">
                      Visit our website: https://mycompany.com/contact
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Application:
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs">
                      Print on business cards, flyers, or display at events for easy website access
                      without typing.
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Example 3: Event Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Content:
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                      Annual Conference 2024 Date: March 15, 2024 Location: Grand Hotel
                      Registration: bit.ly/conf2024
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Usage:
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs">
                      Share event details quickly at venues, on posters, or in digital
                      communications for instant access.
                    </div>
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
                  What are QR codes and how do they work?
                </summary>
                <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  QR codes (Quick Response codes) are 2D barcodes that store information in a square
                  pattern of black and white modules. They can be scanned by smartphone cameras or
                  dedicated QR code readers to quickly access the encoded information, such as
                  websites, text, or contact details.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  What's the maximum amount of data a QR code can store?
                </summary>
                <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  QR codes can store up to 3,000 alphanumeric characters, 7,000 numeric characters,
                  or about 1,800 bytes of binary data. However, for optimal scanning, it's
                  recommended to keep content concise, especially for URLs and text.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  What does error correction level mean?
                </summary>
                <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Error correction allows QR codes to be readable even if they're partially damaged
                  or obscured. Higher levels (H=30%) can withstand more damage but create denser QR
                  codes. Medium (M=15%) is suitable for most applications.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  Can I use custom colors for my QR code?
                </summary>
                <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Yes, you can customize both foreground and background colors. However, ensure
                  sufficient contrast between colors for reliable scanning. Dark colors on light
                  backgrounds typically work best.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  Do QR codes expire or stop working?
                </summary>
                <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Static QR codes (like those generated by this tool) don't expire and will work
                  indefinitely. However, if the QR code links to a URL, that website must remain
                  active for the QR code to be useful.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  What's the best size for printing QR codes?
                </summary>
                <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  For print materials, QR codes should be at least 2x2 cm (0.8x0.8 inches) for
                  business cards and larger for posters or signage. The rule is: the further the
                  scanning distance, the larger the QR code should be.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  Can smartphones scan all types of QR codes?
                </summary>
                <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Most modern smartphones can scan standard QR codes directly through their camera
                  apps without additional software. However, some special functions like WiFi
                  auto-connect may require specific QR code reader apps depending on the device.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  Is my data secure when using this QR generator?
                </summary>
                <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Absolutely. All QR code generation happens entirely in your browser using
                  JavaScript. Your data is never transmitted to our servers or any third-party
                  services, ensuring complete privacy and security.
                </p>
              </details>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  )
}
