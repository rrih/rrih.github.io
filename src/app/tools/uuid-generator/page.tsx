'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { localStorageManager } from '@/lib/localStorage'
import { useUrlSharing } from '@/lib/urlSharing'
import {
  Clock,
  Copy,
  Download,
  Hash,
  RefreshCw,
  Settings,
  Share2,
  Shield,
  Trash2,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface UUIDState {
  uuids: string[]
  version: 'v1' | 'v4'
  count: number
  format: 'standard' | 'uppercase' | 'no-hyphens' | 'braces'
}

const TOOL_NAME = 'uuid-generator'

export default function UUIDGenerator() {
  const defaultState: UUIDState = {
    uuids: [],
    version: 'v4',
    count: 1,
    format: 'standard',
  }

  const [state, setState] = useState<UUIDState>(defaultState)
  const [copyStatus, setCopyStatus] = useState<{ [key: string]: boolean }>({})
  const [isSharing, setIsSharing] = useState(false)
  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { generateShareUrl, shareInfo, getInitialStateFromUrl } =
    useUrlSharing<UUIDState>(TOOL_NAME)

  const { uuids, version, count, format } = state

  const generateUUID = useCallback(() => {
    const newUuids: string[] = []

    for (let i = 0; i < count; i++) {
      let uuid: string

      if (version === 'v1') {
        uuid = generateUUIDv1()
      } else {
        uuid = generateUUIDv4()
      }

      // Apply formatting
      switch (format) {
        case 'uppercase':
          uuid = uuid.toUpperCase()
          break
        case 'no-hyphens':
          uuid = uuid.replace(/-/g, '')
          break
        case 'braces':
          uuid = `{${uuid}}`
          break
        default:
          // standard format
          break
      }

      newUuids.push(uuid)
    }

    setState((prevState) => {
      const newState = { ...prevState, uuids: newUuids }
      localStorageManager.save(TOOL_NAME, newState)
      return newState
    })
  }, [version, count, format])

  const generateUUIDv4 = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const generateUUIDv1 = (): string => {
    const timestamp = Date.now()
    const timeHex = timestamp.toString(16).padStart(12, '0')

    // Simulate MAC address (6 bytes)
    const mac = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0')
    ).join('')

    // Generate clock sequence (14 bits)
    const clockSeq = Math.floor(Math.random() * 16384)
      .toString(16)
      .padStart(4, '0')

    // Construct UUID v1 format
    const timeLow = timeHex.slice(-8)
    const timeMid = timeHex.slice(-12, -8)
    const timeHigh = `1${timeHex.slice(-15, -12)}`

    return `${timeLow}-${timeMid}-${timeHigh}-${clockSeq.slice(0, 1)}${clockSeq.slice(1, 4)}-${mac}`
  }

  const copyUUID = async (uuid: string) => {
    try {
      await navigator.clipboard.writeText(uuid)
      setCopyStatus({ ...copyStatus, [uuid]: true })
      setTimeout(() => {
        setCopyStatus((prev) => ({ ...prev, [uuid]: false }))
      }, 2000)
    } catch (err) {
      console.error('Failed to copy UUID:', err)
    }
  }

  const copyAllUUIDs = async () => {
    try {
      const allUuids = uuids.join('\n')
      await navigator.clipboard.writeText(allUuids)
      setCopyStatus({ all: true })
      setTimeout(() => {
        setCopyStatus((prev) => ({ ...prev, all: false }))
      }, 2000)
    } catch (err) {
      console.error('Failed to copy UUIDs:', err)
    }
  }

  const downloadUUIDs = () => {
    const content = uuids.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `uuids-${version}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

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

  const handleClearData = () => {
    if (confirm('Clear all saved data and current state?')) {
      localStorageManager.clear(TOOL_NAME)
      setState(defaultState)
      setCopyStatus({})
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: 初期化処理のため一度だけ実行
  useEffect(() => {
    const sharedState = getInitialStateFromUrl()
    if (sharedState) {
      setState(sharedState)
      return
    }

    const savedState = localStorageManager.load<UUIDState>(TOOL_NAME)
    if (savedState) {
      setState(savedState)
    }
  }, [])

  useEffect(() => {
    generateUUID()
  }, [generateUUID])

  // Remove this useEffect as we're saving directly in generateUUID and other functions

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground-light dark:text-foreground-dark mb-4">
            UUID Generator
          </h1>
          <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
            Generate UUID/GUID v1, v4, and other versions for development and unique identification
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Settings Section */}
          <div className="lg:col-span-1 space-y-6">
            {/* UUID Version */}
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                UUID Version
              </h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="version"
                    value="v4"
                    checked={version === 'v4'}
                    onChange={(e) => {
                      const newState = {
                        ...state,
                        version: e.target.value as 'v1' | 'v4',
                      }
                      setState(newState)
                    }}
                    className="w-4 h-4 text-accent"
                  />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Version 4 (Random)
                    </div>
                    <div className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Randomly generated, most common
                    </div>
                  </div>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="version"
                    value="v1"
                    checked={version === 'v1'}
                    onChange={(e) => {
                      const newState = {
                        ...state,
                        version: e.target.value as 'v1' | 'v4',
                      }
                      setState(newState)
                    }}
                    className="w-4 h-4 text-accent"
                  />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Version 1 (Time-based)
                    </div>
                    <div className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Based on timestamp and MAC
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Generation Settings */}
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
              <h2 className="text-xl font-semibold mb-4">Generation Settings</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="uuid-count" className="block text-sm font-medium mb-2">
                    Count: {count}
                  </label>
                  <input
                    id="uuid-count"
                    type="range"
                    min="1"
                    max="100"
                    value={count}
                    onChange={(e) => {
                      const newState = {
                        ...state,
                        count: Number.parseInt(e.target.value),
                      }
                      setState(newState)
                    }}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    <span>1</span>
                    <span>100</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="uuid-format" className="block text-sm font-medium mb-2">
                    Format
                  </label>
                  <select
                    id="uuid-format"
                    value={format}
                    onChange={(e) => {
                      const newState = {
                        ...state,
                        format: e.target.value as
                          | 'standard'
                          | 'uppercase'
                          | 'no-hyphens'
                          | 'braces',
                      }
                      setState(newState)
                    }}
                    className="w-full px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                  >
                    <option value="standard">Standard (lowercase)</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="no-hyphens">No Hyphens</option>
                    <option value="braces">With Braces {}</option>
                  </select>
                </div>

                <button
                  onClick={generateUUID}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate New
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            {uuids.length > 0 && (
              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={copyAllUUIDs}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border-light dark:border-border-dark rounded-lg hover:border-accent transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    {copyStatus.all ? 'Copied!' : 'Copy All'}
                  </button>

                  <button
                    onClick={downloadUUIDs}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border-light dark:border-border-dark rounded-lg hover:border-accent transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download as .txt
                  </button>

                  <button
                    onClick={handleShare}
                    disabled={isSharing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border-light dark:border-border-dark rounded-lg hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Share2 className="h-4 w-4" />
                    {isSharing ? 'Sharing...' : 'Share'}
                  </button>

                  <button
                    onClick={handleClearData}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:border-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Output Section */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Generated UUIDs</h2>
                <span className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  {uuids.length} UUID{uuids.length !== 1 ? 's' : ''}
                </span>
              </div>

              {uuids.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {uuids.map((uuid) => (
                    <div
                      key={uuid}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark"
                    >
                      <code className="flex-1 font-mono text-sm break-all text-foreground-light dark:text-foreground-dark">
                        {uuid}
                      </code>
                      <button
                        onClick={() => copyUUID(uuid)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border-light dark:border-border-dark rounded-lg hover:border-accent transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                        {copyStatus[uuid] ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <Hash className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Click "Generate New" to create UUIDs</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Sections for AdSense */}
        <div className="mt-16 border-t border-border-light dark:border-border-dark pt-16 space-y-12">
          {/* About Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              About UUID Generator
            </h2>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p className="text-lg mb-4 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                UUID (Universally Unique Identifier) or GUID (Globally Unique Identifier) is a
                128-bit identifier used to uniquely identify information in computer systems. Our
                UUID Generator creates standards-compliant UUIDs that are guaranteed to be unique
                across different systems and time periods.
              </p>
              <p className="mb-4 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                UUIDs are essential in distributed systems, databases, software development, and any
                scenario where unique identification is crucial. They eliminate the need for a
                central authority to assign identifiers, making them perfect for distributed
                applications and microservices architectures.
              </p>
              <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Our generator supports the most commonly used UUID versions and provides various
                formatting options to match your specific requirements. All generation happens
                locally in your browser, ensuring privacy and instant results without any external
                dependencies.
              </p>
            </div>
          </section>

          {/* How to Use Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              How to Use the UUID Generator
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Step 1: Choose UUID Version
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-4">
                  Select the UUID version that best fits your use case:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>
                    <strong>Version 4 (Random):</strong> Most commonly used, based on random or
                    pseudo-random numbers
                  </li>
                  <li>
                    <strong>Version 1 (Time-based):</strong> Based on timestamp and MAC address,
                    includes time information
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Step 2: Configure Generation Settings
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Customize the generation parameters:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Set the count (1-100 UUIDs per generation)</li>
                  <li>Choose the format: standard, uppercase, without hyphens, or with braces</li>
                  <li>Click "Generate New" to create fresh UUIDs</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Step 3: Copy or Download
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Use the generated UUIDs in your projects:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Copy individual UUIDs using the copy button next to each one</li>
                  <li>Copy all UUIDs at once using the "Copy All" button</li>
                  <li>Download all UUIDs as a text file for batch processing</li>
                </ul>
              </div>
            </div>
          </section>

          {/* UUID Versions Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              UUID Versions Explained
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h3 className="text-lg font-medium mb-3 text-foreground-light dark:text-foreground-dark flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  UUID Version 4 (Random)
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-3">
                  The most widely used UUID version, generated using random or pseudo-random
                  numbers. Provides excellent uniqueness guarantees with virtually no chance of
                  collision.
                </p>
                <ul className="text-sm space-y-1 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>• Based on random number generation</li>
                  <li>• No information leakage about the generator</li>
                  <li>• Suitable for most applications</li>
                  <li>• Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx</li>
                </ul>
              </div>

              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h3 className="text-lg font-medium mb-3 text-foreground-light dark:text-foreground-dark flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  UUID Version 1 (Time-based)
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-3">
                  Generated using timestamp and MAC address information. Provides temporal ordering
                  and can be useful when you need to know the generation time.
                </p>
                <ul className="text-sm space-y-1 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>• Based on timestamp and MAC address</li>
                  <li>• Contains generation time information</li>
                  <li>• Sortable by generation time</li>
                  <li>• May reveal MAC address information</li>
                </ul>
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
                  Software Development
                </h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Database primary keys and unique identifiers</li>
                  <li>Session IDs and token generation</li>
                  <li>Transaction IDs for financial systems</li>
                  <li>Request correlation IDs in microservices</li>
                  <li>File naming and temporary resource identification</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Web Development
                </h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>API keys and authentication tokens</li>
                  <li>User registration and account creation</li>
                  <li>Order numbers and invoice identifiers</li>
                  <li>Upload file naming and organization</li>
                  <li>Cache keys and temporary storage</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  System Administration
                </h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Container and virtual machine identification</li>
                  <li>Configuration management and deployment tracking</li>
                  <li>Log correlation and debugging</li>
                  <li>Backup and restore operation tracking</li>
                  <li>Network device and service identification</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Business Applications
                </h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>Customer reference numbers</li>
                  <li>Product catalog and inventory management</li>
                  <li>Document management and version control</li>
                  <li>Event ticketing and registration systems</li>
                  <li>Survey and form response tracking</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Technical Details Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              Technical Details
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  UUID Structure
                </h3>
                <p className="mb-4 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  A UUID is a 128-bit (16-byte) value typically represented as 32 hexadecimal
                  characters, displayed in five groups separated by hyphens:
                </p>
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg font-mono text-sm">
                  <div className="mb-2">xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx</div>
                  <div className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    <div>• x = random hex digit</div>
                    <div>• M = UUID version (1, 4, etc.)</div>
                    <div>• N = variant bits (typically 8, 9, A, or B)</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Uniqueness Guarantees
                </h3>
                <p className="mb-4 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  UUIDs provide extremely high probability of uniqueness:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>UUID v4: 2^122 possible values (5.3 × 10^36)</li>
                  <li>Collision probability is negligible for practical purposes</li>
                  <li>
                    Can generate 1 billion UUIDs per second for 85 years before 50% chance of
                    collision
                  </li>
                  <li>Safe for distributed systems without central coordination</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Format Variations
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="font-medium text-foreground-light dark:text-foreground-dark">
                      Standard Format:
                    </div>
                    <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      550e8400-e29b-41d4-a716-446655440000
                    </code>
                  </div>
                  <div>
                    <div className="font-medium text-foreground-light dark:text-foreground-dark">
                      Uppercase:
                    </div>
                    <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      550E8400-E29B-41D4-A716-446655440000
                    </code>
                  </div>
                  <div>
                    <div className="font-medium text-foreground-light dark:text-foreground-dark">
                      No Hyphens:
                    </div>
                    <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      550e8400e29b41d4a716446655440000
                    </code>
                  </div>
                  <div>
                    <div className="font-medium text-foreground-light dark:text-foreground-dark">
                      With Braces:
                    </div>
                    <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      {'{550e8400-e29b-41d4-a716-446655440000}'}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Best Practices Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 text-foreground-light dark:text-foreground-dark">
              Best Practices
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h3 className="text-lg font-medium mb-3 text-foreground-light dark:text-foreground-dark flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Considerations
                </h3>
                <ul className="text-sm space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>• Use UUID v4 for sensitive applications to avoid information leakage</li>
                  <li>• Don't rely on UUIDs for security - they're identifiers, not secrets</li>
                  <li>
                    • Consider cryptographically secure random generators for critical systems
                  </li>
                  <li>• Be aware that UUID v1 reveals MAC address and timestamp</li>
                </ul>
              </div>

              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                <h3 className="text-lg font-medium mb-3 text-foreground-light dark:text-foreground-dark">
                  Performance Tips
                </h3>
                <ul className="text-sm space-y-2 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  <li>• Store UUIDs in binary format in databases when possible</li>
                  <li>• Consider using UUID v1 if temporal ordering is beneficial</li>
                  <li>• Index UUID columns appropriately for query performance</li>
                  <li>• Use consistent format across your entire application</li>
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
                  What's the difference between UUID and GUID?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  UUID (Universally Unique Identifier) and GUID (Globally Unique Identifier) refer
                  to the same concept. GUID is Microsoft's term for the same 128-bit identifier
                  standard. They are functionally identical and can be used interchangeably.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  Can two UUIDs ever be the same?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  While theoretically possible, the probability of generating identical UUID v4s is
                  astronomically small (approximately 1 in 2^122). For practical purposes, UUIDs can
                  be considered unique. The chance of collision is so low that it's safer than many
                  other risks in computing.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  Which UUID version should I use?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  For most applications, UUID v4 (random) is recommended as it provides excellent
                  uniqueness without revealing any information about the generator. Use UUID v1 only
                  if you specifically need the temporal ordering or timestamp information it
                  provides.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  Are UUIDs suitable for database primary keys?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  UUIDs can be used as primary keys, especially in distributed systems where central
                  coordination is difficult. However, they're larger than integer keys and may
                  impact performance. Consider your specific requirements for uniqueness,
                  distribution, and performance when choosing.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  How are UUIDs generated securely?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Our generator uses JavaScript's crypto.getRandomValues() when available, which
                  provides cryptographically secure random numbers. For non-security-critical
                  applications, the standard Math.random() fallback is sufficient for uniqueness
                  guarantees.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground-light dark:text-foreground-dark">
                  Can I use UUIDs in URLs?
                </h3>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Yes, UUIDs are URL-safe when using the standard format with hyphens. They contain
                  only hexadecimal characters (0-9, a-f) and hyphens, which don't require URL
                  encoding. This makes them excellent for use in REST APIs and web applications.
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
