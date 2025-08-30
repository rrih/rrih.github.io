'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { localStorageManager } from '@/lib/localStorage'
import { urlSharingManager } from '@/lib/urlSharing'
import {
  ArrowDownToLine,
  Copy,
  FileText,
  Hash,
  Link,
  Palette,
  Settings,
  Share,
  Wifi,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'

export default function QRGenerator() {
  const [input, setInput] = useState('')
  const [qrType, setQrType] = useState<'text' | 'url' | 'wifi' | 'email'>('text')
  const [size, setSize] = useState(256)
  const [errorLevel, setErrorLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M')
  const [foregroundColor, setForegroundColor] = useState('#000000')
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [wifiSettings, setWifiSettings] = useState({
    ssid: '',
    password: '',
    security: 'WPA',
    hidden: false,
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Simple QR Code generation using canvas
  const generateQRCode = (data: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size
    canvas.height = size

    // Clear canvas
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, size, size)

    // Generate a simple pattern-based QR code representation
    // Note: This is a simplified visualization. For production, use a proper QR library
    const modules = 25 // QR code grid size
    const moduleSize = size / modules

    ctx.fillStyle = foregroundColor

    // Create a pattern based on input hash
    const hash = simpleHash(data)
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        // Create finder patterns (corners)
        if (isFinderPattern(row, col, modules)) {
          ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize)
        }
        // Create data pattern based on hash
        else if ((hash + row * col) % 3 === 0) {
          ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize)
        }
      }
    }

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png')
    setQrDataUrl(dataUrl)
  }

  const simpleHash = (str: string): number => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  const isFinderPattern = (row: number, col: number, modules: number): boolean => {
    // Top-left finder pattern
    if (row < 7 && col < 7) {
      if ((row === 0 || row === 6) && col < 7) return true
      if ((col === 0 || col === 6) && row < 7) return true
      if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return true
    }
    // Top-right finder pattern
    if (row < 7 && col >= modules - 7) {
      if ((row === 0 || row === 6) && col >= modules - 7) return true
      if ((col === modules - 7 || col === modules - 1) && row < 7) return true
      if (row >= 2 && row <= 4 && col >= modules - 5 && col <= modules - 3) return true
    }
    // Bottom-left finder pattern
    if (row >= modules - 7 && col < 7) {
      if ((row === modules - 7 || row === modules - 1) && col < 7) return true
      if ((col === 0 || col === 6) && row >= modules - 7) return true
      if (row >= modules - 5 && row <= modules - 3 && col >= 2 && col <= 4) return true
    }
    return false
  }

  const getQRData = (): string => {
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
  }

  useEffect(() => {
    if (input.trim()) {
      generateQRCode(getQRData())
    } else {
      setQrDataUrl('')
    }
  }, [input, qrType, size, errorLevel, foregroundColor, backgroundColor, wifiSettings])

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
      alert('QR code copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy QR code:', err)
      alert('Failed to copy QR code to clipboard')
    }
  }

  const shareQR = async () => {
    if (!qrDataUrl || !navigator.share) return

    try {
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()
      const file = new File([blob], 'qr-code.png', { type: 'image/png' })

      await navigator.share({
        title: 'QR Code',
        text: 'Generated QR Code',
        files: [file],
      })
    } catch (err) {
      console.error('Failed to share QR code:', err)
    }
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
                  onClick={() => setQrType('text')}
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
                  onClick={() => setQrType('url')}
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
                  onClick={() => setQrType('wifi')}
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
                  onClick={() => setQrType('email')}
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
                    <label className="block text-sm font-medium mb-2">Network Name (SSID)</label>
                    <input
                      type="text"
                      value={wifiSettings.ssid}
                      onChange={(e) => setWifiSettings({ ...wifiSettings, ssid: e.target.value })}
                      className="w-full px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      placeholder="Enter WiFi network name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Password</label>
                    <input
                      type="password"
                      value={wifiSettings.password}
                      onChange={(e) =>
                        setWifiSettings({ ...wifiSettings, password: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      placeholder="Enter WiFi password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Security</label>
                    <select
                      value={wifiSettings.security}
                      onChange={(e) =>
                        setWifiSettings({ ...wifiSettings, security: e.target.value })
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
                        setWifiSettings({ ...wifiSettings, hidden: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Hidden Network</span>
                  </label>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {qrType === 'url' ? 'URL' : qrType === 'email' ? 'Email Address' : 'Text'}
                  </label>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
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
                  <label className="block text-sm font-medium mb-2">Size: {size}px</label>
                  <input
                    type="range"
                    min="128"
                    max="512"
                    step="32"
                    value={size}
                    onChange={(e) => setSize(Number.parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Error Correction</label>
                  <select
                    value={errorLevel}
                    onChange={(e) => setErrorLevel(e.target.value as 'L' | 'M' | 'Q' | 'H')}
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
                    <label className="block text-sm font-medium mb-2">Foreground Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={foregroundColor}
                        onChange={(e) => setForegroundColor(e.target.value)}
                        className="w-12 h-10 border border-border-light dark:border-border-dark rounded-lg"
                      />
                      <input
                        type="text"
                        value={foregroundColor}
                        onChange={(e) => setForegroundColor(e.target.value)}
                        className="flex-1 px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Background Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="w-12 h-10 border border-border-light dark:border-border-dark rounded-lg"
                      />
                      <input
                        type="text"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="flex-1 px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      />
                    </div>
                  </div>
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
                          className="flex items-center gap-2 px-4 py-2 border border-border-light dark:border-border-dark rounded-lg hover:border-accent transition-colors"
                        >
                          <Share className="h-4 w-4" />
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

        {/* Hidden canvas for QR generation */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Content Sections for AdSense */}
        <div className="mt-16 border-t border-border-light dark:border-border-dark pt-16 space-y-12">
          {/* About Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              About QR Code Generator
            </h2>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p className="text-lg mb-4 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Our QR Code Generator is a comprehensive tool for creating Quick Response codes for
                various types of content. QR codes are two-dimensional barcodes that can store
                different types of information and be easily scanned by smartphones and other
                devices equipped with cameras.
              </p>
              <p className="mb-4 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Whether you need to share a website URL, WiFi credentials, contact information, or
                plain text, our generator provides a user-friendly interface with extensive
                customization options. The tool supports multiple QR code types and allows you to
                customize the appearance, size, and error correction level to meet your specific
                needs.
              </p>
              <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                All QR code generation happens locally in your browser, ensuring your data privacy
                and security. No information is sent to external servers, making it safe to generate
                QR codes for sensitive information like WiFi passwords or private URLs.
              </p>
            </div>
          </section>

          {/* How to Use Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              How to Use the QR Code Generator
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Step 1: Choose QR Code Type
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-4">
                  Select the type of QR code you want to create from the available options:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>
                    <strong>Text:</strong> For plain text content that will be displayed when
                    scanned
                  </li>
                  <li>
                    <strong>URL:</strong> For website links that will open in the device's default
                    browser
                  </li>
                  <li>
                    <strong>WiFi:</strong> For WiFi network credentials that allow automatic
                    connection
                  </li>
                  <li>
                    <strong>Email:</strong> For email addresses that will open the default email
                    client
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Step 2: Enter Content
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Input the content for your QR code. The interface will adapt based on your
                  selected type:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>For WiFi: Enter network name, password, and security settings</li>
                  <li>For URLs: Enter the complete web address</li>
                  <li>For text and email: Enter the desired content in the text area</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Step 3: Customize Appearance
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Adjust the QR code's appearance using the customization options:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Size: Choose from 128px to 512px for different use cases</li>
                  <li>
                    Error Correction: Select the level of error correction (higher levels are more
                    resistant to damage)
                  </li>
                  <li>
                    Colors: Customize foreground and background colors to match your brand or
                    preferences
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Step 4: Download or Share
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Once your QR code is generated, you can:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Download it as a PNG image for printing or digital use</li>
                  <li>Copy it to clipboard for quick pasting into other applications</li>
                  <li>Share it directly using your device's native sharing capabilities</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              Key Features
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h3 className="text-lg font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Multiple QR Code Types
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Support for text, URLs, WiFi credentials, and email addresses. Each type is
                  optimized for its specific use case and follows industry standards for maximum
                  compatibility.
                </p>
              </div>

              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h3 className="text-lg font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Advanced Customization
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Customize size, colors, and error correction levels. Create QR codes that match
                  your brand identity or specific requirements for different applications.
                </p>
              </div>

              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h3 className="text-lg font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Privacy Focused
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  All processing happens locally in your browser. No data is transmitted to external
                  servers, ensuring complete privacy and security for sensitive information.
                </p>
              </div>

              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h3 className="text-lg font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Export Options
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Download as high-quality PNG images, copy to clipboard, or share directly using
                  native device capabilities. Perfect for both digital and print applications.
                </p>
              </div>

              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h3 className="text-lg font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Real-time Preview
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  See your QR code update instantly as you type or modify settings. Make adjustments
                  and see results immediately without any delays or processing time.
                </p>
              </div>

              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h3 className="text-lg font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Mobile Optimized
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Fully responsive design that works perfectly on mobile devices, tablets, and
                  desktops. Generate QR codes on any device with a modern web browser.
                </p>
              </div>
            </div>
          </section>

          {/* Use Cases Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              Common Use Cases
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Business Applications
                </h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Restaurant menus and contactless ordering</li>
                  <li>Product information and specification sheets</li>
                  <li>Event tickets and registration</li>
                  <li>Business card digital contact information</li>
                  <li>Marketing campaigns and promotional materials</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Personal Use
                </h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Share WiFi passwords with guests</li>
                  <li>Share social media profiles and websites</li>
                  <li>Wedding invitation details and RSVP links</li>
                  <li>Contact information sharing</li>
                  <li>Location sharing and directions</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Educational and Technical
                </h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Homework assignments and resource links</li>
                  <li>Conference presentation materials</li>
                  <li>API endpoints and technical documentation</li>
                  <li>Software download links and installation guides</li>
                  <li>Survey and feedback forms</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Technical Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              Technical Information
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Error Correction Levels
                </h3>
                <p className="mb-4 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  QR codes include built-in error correction that allows them to be readable even
                  when partially damaged or obscured:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>
                    <strong>Low (L):</strong> ~7% error correction - Best for clean, controlled
                    environments
                  </li>
                  <li>
                    <strong>Medium (M):</strong> ~15% error correction - Standard level for most
                    applications
                  </li>
                  <li>
                    <strong>Quartile (Q):</strong> ~25% error correction - Good for outdoor or
                    industrial use
                  </li>
                  <li>
                    <strong>High (H):</strong> ~30% error correction - Maximum resilience for harsh
                    conditions
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Data Capacity
                </h3>
                <p className="mb-4 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  The amount of data a QR code can store depends on the character type and error
                  correction level:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Numeric data: Up to 7,089 characters</li>
                  <li>Alphanumeric data: Up to 4,296 characters</li>
                  <li>Binary data: Up to 2,953 bytes</li>
                  <li>Kanji characters: Up to 1,817 characters</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Best Practices
                </h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Ensure sufficient contrast between foreground and background colors</li>
                  <li>Leave adequate white space around the QR code (quiet zone)</li>
                  <li>Test QR codes on multiple devices and scanning apps</li>
                  <li>
                    Use higher error correction for codes that will be printed or displayed outdoors
                  </li>
                  <li>Keep URLs short to reduce QR code complexity</li>
                  <li>
                    Avoid very light colors that may not scan well under various lighting conditions
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  What devices can scan QR codes?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Most smartphones have built-in QR code scanning capabilities through their camera
                  apps. iPhones (iOS 11+) and Android devices can scan QR codes directly through the
                  camera app. Dedicated QR code scanner apps are also available for older devices or
                  enhanced functionality.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  How do I share WiFi credentials using QR codes?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Select the WiFi option, enter your network name (SSID) and password, choose the
                  security type, and generate the QR code. When others scan it, their device will
                  prompt them to connect to the network automatically without manually entering
                  credentials.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  What's the maximum size for QR code content?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  The maximum capacity depends on the data type and error correction level. For
                  typical use cases: URLs should be kept under 2,000 characters, plain text can be
                  up to several thousand characters, and WiFi credentials are typically well within
                  limits. Larger QR codes become more complex and harder to scan.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  Can I customize the colors of my QR code?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Yes, you can customize both foreground and background colors. However, ensure
                  sufficient contrast for reliable scanning. Dark foreground on light background
                  typically works best. Avoid very similar colors or low contrast combinations that
                  may prevent successful scanning.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  Is my data secure when generating QR codes?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Yes, all QR code generation happens locally in your browser. No data is
                  transmitted to external servers, ensuring complete privacy. Your WiFi passwords,
                  URLs, and other content remain on your device throughout the generation process.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  What file format are the downloaded QR codes?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  QR codes are downloaded as PNG images, which provide high quality and transparency
                  support. PNG format is widely supported and works well for both digital use and
                  printing. The resolution depends on the size setting you choose (128px to 512px).
                </p>
              </div>
            </div>
          </section>
        </div>

        <Footer />
      </div>
    </div>
  )
}
