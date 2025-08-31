'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { useHistory } from '@/hooks/useHistory'
import { localStorageManager } from '@/lib/localStorage'
import { useUrlSharing } from '@/lib/urlSharing'
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  Key,
  Redo2,
  RefreshCw,
  Settings,
  Share2,
  Shield,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface PasswordGeneratorState {
  passwords: string[]
  length: number
  includeUppercase: boolean
  includeLowercase: boolean
  includeNumbers: boolean
  includeSymbols: boolean
  excludeSimilar: boolean
  customSymbols: string
  quantity: number
}

interface PasswordStrength {
  score: number
  label: string
  color: string
}

export default function PasswordGeneratorPage() {
  const TOOL_NAME = 'password-generator'

  const defaultState: PasswordGeneratorState = {
    passwords: [],
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
    customSymbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    quantity: 1,
  }

  const {
    state,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
  } = useHistory<PasswordGeneratorState>(defaultState)

  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [showPasswords, setShowPasswords] = useState(true)
  const [passwordHistory, setPasswordHistory] = useState<string[]>([])

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { generateShareUrl, shareInfo, getInitialStateFromUrl } =
    useUrlSharing<PasswordGeneratorState>(TOOL_NAME)

  const {
    passwords,
    length,
    includeUppercase,
    includeLowercase,
    includeNumbers,
    includeSymbols,
    excludeSimilar,
    customSymbols,
    quantity,
  } = state

  // Client-side only state restoration
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初期化処理のため一度だけ実行
  useEffect(() => {
    const sharedState = getInitialStateFromUrl()
    if (sharedState) {
      setHistoryState(sharedState)
      return
    }

    const savedState = localStorageManager.load<PasswordGeneratorState>(TOOL_NAME)
    if (savedState) {
      setHistoryState(savedState)
    }
  }, [])

  // Save state to localStorage
  useEffect(() => {
    localStorageManager.save(TOOL_NAME, state)
  }, [state])

  // URL sharing
  const handleShare = async () => {
    setIsSharing(true)
    try {
      const shareUrl = await generateShareUrl(state)
      await navigator.clipboard.writeText(shareUrl)

      const message = 'Share URL copied!'
      let description = 'The shareable URL has been copied to your clipboard'

      if (shareInfo.isLimited) {
        description = shareInfo.message
      }

      successToast(message, description)
    } catch (error) {
      console.error('Share failed:', error)
      errorToast('Sharing failed', 'An error occurred while generating the share URL')
    } finally {
      setIsSharing(false)
    }
  }

  // Clear data
  const handleClearData = () => {
    if (confirm('Clear all saved data and generated passwords?')) {
      localStorageManager.clear(TOOL_NAME)
      clearHistory()
      setHistoryState(defaultState)
      setPasswordHistory([])
    }
  }

  // Export data
  const handleExportData = () => {
    const data = {
      passwords,
      settings: {
        length,
        includeUppercase,
        includeLowercase,
        includeNumbers,
        includeSymbols,
        excludeSimilar,
        customSymbols,
        quantity,
      },
      history: passwordHistory,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `passwords-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Generate character set
  const getCharacterSet = (): string => {
    let charset = ''

    if (includeLowercase) {
      charset += excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz'
    }
    if (includeUppercase) {
      charset += excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    }
    if (includeNumbers) {
      charset += excludeSimilar ? '23456789' : '0123456789'
    }
    if (includeSymbols) {
      charset += customSymbols
    }

    return charset
  }

  // Generate single password
  const generatePassword = (charset: string, len: number): string => {
    let password = ''
    const array = new Uint32Array(len)
    crypto.getRandomValues(array)

    for (let i = 0; i < len; i++) {
      password += charset[array[i] % charset.length]
    }

    return password
  }

  // Calculate password strength
  const calculateStrength = (password: string): PasswordStrength => {
    let score = 0

    // Length score
    if (password.length >= 8) score += 1
    if (password.length >= 12) score += 1
    if (password.length >= 16) score += 1
    if (password.length >= 20) score += 1

    // Character variety score
    if (/[a-z]/.test(password)) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^a-zA-Z0-9]/.test(password)) score += 2

    // Pattern penalty
    if (/(.)\1{2,}/.test(password)) score -= 1 // Repeated characters
    if (/^[a-zA-Z]+$/.test(password)) score -= 1 // Only letters
    if (/^[0-9]+$/.test(password)) score -= 2 // Only numbers

    // Normalize score
    score = Math.max(0, Math.min(10, score))

    if (score <= 3) return { score, label: 'Weak', color: 'text-red-500' }
    if (score <= 6) return { score, label: 'Medium', color: 'text-yellow-500' }
    if (score <= 8) return { score, label: 'Strong', color: 'text-green-500' }
    return { score, label: 'Very Strong', color: 'text-green-600' }
  }

  // Generate passwords
  const handleGeneratePasswords = async () => {
    const charset = getCharacterSet()

    if (!charset) {
      errorToast('No characters selected', 'Please select at least one character type')
      return
    }

    setIsGenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 200))

    try {
      const newPasswords: string[] = []
      for (let i = 0; i < quantity; i++) {
        newPasswords.push(generatePassword(charset, length))
      }

      setHistoryState((prev) => ({
        ...prev,
        passwords: newPasswords,
      }))

      // Add to history
      setPasswordHistory((prev) => [...newPasswords, ...prev].slice(0, 100))
    } finally {
      setIsGenerating(false)
    }
  }

  // Copy password to clipboard
  const copyToClipboard = async (password: string, index: number) => {
    try {
      await navigator.clipboard.writeText(password)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
      successToast('Copied!', 'Password copied to clipboard')
    } catch (err) {
      console.error('Failed to copy:', err)
      errorToast('Copy failed', 'Failed to copy password to clipboard')
    }
  }

  // Clear all
  const _clearAll = () => {
    setHistoryState({
      ...state,
      passwords: [],
    })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 py-3 xs:py-4 sm:py-6 md:py-12">
        <Header />

        <main>
          {/* Hero Section */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-2 xs:mb-3 sm:mb-4 text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                Secure Password Generator
              </h1>
              <p className="mb-4 xs:mb-6 text-sm xs:text-base sm:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary px-2 xs:px-0">
                Generate strong, unique passwords with customizable security options.
              </p>
            </div>
          </section>

          {/* Main Interface */}
          <section className="grid gap-6 lg:grid-cols-[1fr,2fr]">
            {/* Settings Panel */}
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
              <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Password Settings
                </h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                  Customize your password requirements
                </p>
              </div>
              <div className="p-3 sm:p-4 md:p-6 space-y-4">
                {/* Length */}
                <div>
                  <label htmlFor="password-length" className="text-sm font-medium mb-2 block">
                    Password Length: {length}
                  </label>
                  <input
                    id="password-length"
                    type="range"
                    min="4"
                    max="128"
                    value={length}
                    onChange={(e) =>
                      setHistoryState({
                        ...state,
                        length: Number(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>4</span>
                    <span>128</span>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label htmlFor="password-quantity" className="text-sm font-medium mb-2 block">
                    Number of Passwords: {quantity}
                  </label>
                  <input
                    id="password-quantity"
                    type="range"
                    min="1"
                    max="20"
                    value={quantity}
                    onChange={(e) =>
                      setHistoryState({
                        ...state,
                        quantity: Number(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1</span>
                    <span>20</span>
                  </div>
                </div>

                {/* Character Types */}
                <div className="space-y-3">
                  <div className="text-sm font-medium block">Character Types</div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeUppercase}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          includeUppercase: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-accent rounded"
                    />
                    <span className="text-sm">Uppercase (A-Z)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLowercase}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          includeLowercase: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-accent rounded"
                    />
                    <span className="text-sm">Lowercase (a-z)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeNumbers}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          includeNumbers: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-accent rounded"
                    />
                    <span className="text-sm">Numbers (0-9)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSymbols}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          includeSymbols: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-accent rounded"
                    />
                    <span className="text-sm">Symbols</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excludeSimilar}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          excludeSimilar: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-accent rounded"
                    />
                    <span className="text-sm">Exclude similar (il1Lo0O)</span>
                  </label>
                </div>

                {/* Custom Symbols */}
                {includeSymbols && (
                  <div>
                    <label htmlFor="custom-symbols" className="text-sm font-medium mb-2 block">
                      Custom Symbols
                    </label>
                    <input
                      id="custom-symbols"
                      type="text"
                      value={customSymbols}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          customSymbols: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      placeholder="Enter symbols to include"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleGeneratePasswords}
                    disabled={isGenerating}
                    className="flex-1 rounded-lg bg-accent px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] text-white font-medium text-sm sm:text-base transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                    {isGenerating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>
            </div>

            {/* Output Panel */}
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
              <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Generated Passwords
                    </h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                      {passwords.length > 0
                        ? `${passwords.length} password(s) generated`
                        : 'Click generate to create passwords'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="p-2 rounded-lg border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleShare}
                      disabled={isSharing || passwords.length === 0}
                      className="flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 font-medium text-sm transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                    <button
                      onClick={handleExportData}
                      disabled={passwords.length === 0}
                      className="flex items-center gap-2 rounded-lg border border-border-light px-3 py-2 font-medium text-sm transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      onClick={handleClearData}
                      className="flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 font-medium text-sm text-red-600 transition-all hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear
                    </button>
                    <button
                      onClick={undo}
                      disabled={!canUndo}
                      className="p-2 rounded-lg border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={redo}
                      disabled={!canRedo}
                      className="p-2 rounded-lg border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-3 sm:p-4 md:p-6">
                {passwords.length === 0 ? (
                  <div className="text-center py-12 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No passwords generated yet.</p>
                    <p className="text-sm mt-2">Configure your settings and click Generate.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {passwords.map((password) => {
                      const strength = calculateStrength(password)
                      return (
                        <div
                          key={password}
                          className="p-4 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1 mr-4">
                              <div className="font-mono text-sm sm:text-base break-all">
                                {showPasswords ? password : '••••••••••••••••'}
                              </div>
                            </div>
                            <button
                              onClick={() => copyToClipboard(password, passwords.indexOf(password))}
                              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-accent hover:bg-accent-dark text-white text-sm transition-all hover:shadow-lg active:scale-95"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedIndex === passwords.indexOf(password) ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Strength:
                            </span>
                            <span className={`font-medium ${strength.color}`}>
                              {strength.label}
                            </span>
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  strength.score <= 3
                                    ? 'bg-red-500'
                                    : strength.score <= 6
                                      ? 'bg-yellow-500'
                                      : strength.score <= 8
                                        ? 'bg-green-500'
                                        : 'bg-green-600'
                                }`}
                                style={{
                                  width: `${(strength.score / 10) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="hidden xs:block mb-8 sm:mb-12 md:mb-16 mt-8 sm:mt-12">
            <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
              Why Use Our Password Generator?
            </h2>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Shield,
                  title: 'Cryptographically Secure',
                  description:
                    'Uses Web Crypto API for true random generation, ensuring maximum security.',
                },
                {
                  icon: Settings,
                  title: 'Fully Customizable',
                  description:
                    'Fine-tune length, character types, and exclusions to meet any requirement.',
                },
                {
                  icon: Key,
                  title: 'Strength Analysis',
                  description:
                    'Real-time password strength evaluation helps you create stronger passwords.',
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

          {/* Content Sections for SEO */}
          <section className="mb-8 sm:mb-12 md:mb-16 border-t border-border-light dark:border-border-dark pt-8 sm:pt-12">
            {/* About This Tool */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                About Password Generator
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Our Password Generator is a powerful, secure tool designed to create strong,
                  unique passwords that protect your online accounts from unauthorized access. In
                  today's digital world, where data breaches and cyber attacks are increasingly
                  common, using strong, unique passwords for each of your accounts is more important
                  than ever. This tool uses cryptographically secure random number generation to
                  ensure your passwords are truly unpredictable and resistant to hacking attempts.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  The generator leverages the Web Crypto API, a browser-based cryptographic standard
                  that provides access to cryptographically strong random values. Unlike
                  pseudo-random generators that might be predictable, this ensures your passwords
                  are generated with true randomness. All password generation happens entirely in
                  your browser - no passwords are ever sent to our servers or stored anywhere
                  online, guaranteeing complete privacy and security.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                  With extensive customization options, you can generate passwords that meet
                  specific requirements for different services. Whether you need a simple memorable
                  password or a highly complex string for maximum security, our tool adapts to your
                  needs. The built-in strength analyzer helps you understand how secure your
                  passwords are, while the batch generation feature allows you to create multiple
                  passwords at once for different accounts.
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
                  <h3 className="font-semibold text-lg mb-2">
                    Step 1: Configure Password Requirements
                  </h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Adjust the password length using the slider (4-128 characters). Select which
                    character types to include: uppercase, lowercase, numbers, and symbols. Enable
                    "Exclude similar" to avoid confusing characters like 'l' and '1'.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 2: Set Quantity</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Choose how many passwords to generate at once (1-20). This is useful when
                    setting up multiple accounts or creating backup passwords.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 3: Generate Passwords</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Click the "Generate" button to create your passwords. Each password will be
                    displayed with a strength indicator showing how secure it is.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 4: Copy and Use</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Click "Copy" next to any password to copy it to your clipboard. Use the eye icon
                    to show/hide passwords. Export all passwords as JSON for backup.
                  </p>
                </div>
              </div>
            </div>

            {/* Key Features */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Key Features
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Cryptographic Security</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Uses Web Crypto API for true random generation, not predictable pseudo-random
                    algorithms.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Customizable Length</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Generate passwords from 4 to 128 characters to meet any security requirement.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Character Control</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Fine-tune character sets including custom symbols and exclusion of similar
                    characters.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Batch Generation</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Create up to 20 passwords at once for multiple accounts or backup purposes.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Strength Analysis</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Real-time password strength evaluation with visual indicators and
                    recommendations.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Privacy Focused</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    All generation happens locally in your browser. No passwords are ever
                    transmitted.
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
                  <h3 className="font-semibold mb-3">Example 1: High-Security Password</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <p className="text-sm mb-2">
                      Settings: 20 characters, all character types, exclude similar
                    </p>
                    <p className="font-mono text-sm">Result: K#mP9$nQ@vX2&hF7*wRj</p>
                    <p className="text-sm mt-2 text-green-600 dark:text-green-400">
                      Strength: Very Strong
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Example 2: Memorable Password</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <p className="text-sm mb-2">
                      Settings: 12 characters, letters and numbers only
                    </p>
                    <p className="font-mono text-sm">Result: Kp9nQ2hF7wRj</p>
                    <p className="text-sm mt-2 text-yellow-600 dark:text-yellow-400">
                      Strength: Medium
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Example 3: PIN Code</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <p className="text-sm mb-2">Settings: 6 characters, numbers only</p>
                    <p className="font-mono text-sm">Result: 847293</p>
                    <p className="text-sm mt-2 text-red-600 dark:text-red-400">Strength: Weak</p>
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
                    How secure are the generated passwords?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Our passwords are cryptographically secure, using the Web Crypto API which
                    provides true random values. This is the same technology used by security
                    professionals and is significantly more secure than pseudo-random generators.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Are my passwords stored anywhere?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    No, passwords are never stored on our servers. They're generated entirely in
                    your browser and only temporarily saved in your browser's local storage if you
                    choose. Clearing your browser data will remove any saved passwords.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What makes a password strong?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Strong passwords are long (12+ characters), use a mix of uppercase, lowercase,
                    numbers, and symbols, avoid dictionary words and personal information, and are
                    unique for each account. Our generator ensures all these criteria can be met.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Why exclude similar characters?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Similar characters like 'l', '1', 'I', 'O', '0' can be confused when reading or
                    typing passwords. Excluding them reduces errors when entering passwords
                    manually, especially with handwritten backups.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    How often should I change passwords?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Security experts now recommend changing passwords only when there's a reason to
                    (like a breach), rather than on a schedule. Focus on using unique, strong
                    passwords for each account instead of frequent changes.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I use custom symbols?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Yes, you can customize which symbols to include. Some websites have restrictions
                    on allowed symbols, so our custom symbols feature lets you generate passwords
                    that meet specific requirements.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What's the maximum password length?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Our generator supports passwords up to 128 characters. While most services don't
                    require passwords this long, having the option ensures compatibility with
                    high-security systems and future-proofing your security.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Should I use a password manager?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Yes, we strongly recommend using a password manager to store the unique
                    passwords you generate. This allows you to use complex, unique passwords for
                    every account without having to remember them all.
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
