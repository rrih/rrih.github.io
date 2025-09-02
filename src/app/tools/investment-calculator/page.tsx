'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { useHistory } from '@/hooks/useHistory'
import { localStorageManager } from '@/lib/localStorage'
import { useUrlSharing } from '@/lib/urlSharing'
import {
  Calculator,
  ChartLine,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Globe,
  HelpCircle,
  Image,
  Redo2,
  RefreshCw,
  Save,
  Share2,
  Target,
  Trash2,
  TrendingUp,
  Undo2,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type CalculationMode =
  | 'future-value'
  | 'monthly-savings'
  | 'investment-period'
  | 'withdrawal'
  | 'advanced'

type Currency = 'USD' | 'JPY' | 'EUR' | 'GBP' | 'CNY' | 'KRW' | 'AUD' | 'CAD'

type PhaseAction = 'invest' | 'withdraw' | 'hold'

interface InvestmentPortfolio {
  id: string
  name: string
  annualReturn: number
  color: string
  allocation: number
}

interface InvestmentPhase {
  id: string
  startYear: number
  duration: number
  action: PhaseAction
  monthlyAmount: number
  portfolios: InvestmentPortfolio[]
  description?: string
}

interface InvestmentCalculatorState {
  mode: CalculationMode
  currency: Currency
  initialAmount: number
  monthlyAmount: number
  annualReturn: number
  investmentPeriod: number
  targetAmount: number
  withdrawalPeriod: number
  inflationRate: number
  compoundFrequency: 'monthly' | 'quarterly' | 'annually'
  // Advanced mode properties
  phases?: InvestmentPhase[]
  defaultPortfolios?: InvestmentPortfolio[]
  totalSimulationYears?: number
}

interface SavedPattern {
  id: string
  name: string
  state: InvestmentCalculatorState
  savedAt: string
}

interface CalculationResult {
  futureValue?: number
  totalContributions?: number
  totalReturns?: number
  monthlyPayment?: number
  requiredPeriod?: number
  withdrawalAmount?: number
  totalWithdrawn?: number
  phases?: InvestmentPhase[]
  chartData?: Array<{
    year: number
    principal: number
    value: number
    returns: number
    totalInvested?: number
    totalWithdrawn?: number
    phases?: string
  }>
}

export default function InvestmentCalculatorPage() {
  const TOOL_NAME = 'investment-calculator'

  const defaultPortfolios: InvestmentPortfolio[] = [
    {
      id: 'conservative',
      name: 'Conservative Portfolio',
      annualReturn: 5,
      color: '#10b981',
      allocation: 100,
    },
    {
      id: 'balanced',
      name: 'Balanced Portfolio',
      annualReturn: 7,
      color: '#3b82f6',
      allocation: 0,
    },
    {
      id: 'aggressive',
      name: 'Aggressive Portfolio',
      annualReturn: 10,
      color: '#ef4444',
      allocation: 0,
    },
  ]

  const defaultPhases: InvestmentPhase[] = [
    {
      id: 'phase1',
      startYear: 0,
      duration: 20,
      action: 'invest',
      monthlyAmount: 500,
      portfolios: [...defaultPortfolios],
      description: 'Initial investment phase',
    },
  ]

  const getDefaultState = (): InvestmentCalculatorState => ({
    mode: 'future-value',
    currency: 'USD',
    initialAmount: 10000,
    monthlyAmount: 500,
    annualReturn: 7,
    investmentPeriod: 20,
    targetAmount: 500000,
    withdrawalPeriod: 30,
    inflationRate: 2,
    compoundFrequency: 'monthly',
    phases: defaultPhases,
    defaultPortfolios: defaultPortfolios,
    totalSimulationYears: 40,
  })

  const currencyInfo: Record<
    Currency,
    {
      symbol: string
      code: string
      locale: string
      decimals: number
      maxInitial: number
      maxMonthly: number
      maxTarget: number
    }
  > = {
    USD: {
      symbol: '$',
      code: 'USD',
      locale: 'en-US',
      decimals: 0,
      maxInitial: 100000000,
      maxMonthly: 1000000,
      maxTarget: 1000000000,
    },
    JPY: {
      symbol: '¥',
      code: 'JPY',
      locale: 'ja-JP',
      decimals: 0,
      maxInitial: 10000000000,
      maxMonthly: 100000000,
      maxTarget: 100000000000,
    },
    EUR: {
      symbol: '€',
      code: 'EUR',
      locale: 'de-DE',
      decimals: 0,
      maxInitial: 100000000,
      maxMonthly: 1000000,
      maxTarget: 1000000000,
    },
    GBP: {
      symbol: '£',
      code: 'GBP',
      locale: 'en-GB',
      decimals: 0,
      maxInitial: 100000000,
      maxMonthly: 1000000,
      maxTarget: 1000000000,
    },
    CNY: {
      symbol: '¥',
      code: 'CNY',
      locale: 'zh-CN',
      decimals: 0,
      maxInitial: 700000000,
      maxMonthly: 7000000,
      maxTarget: 7000000000,
    },
    KRW: {
      symbol: '₩',
      code: 'KRW',
      locale: 'ko-KR',
      decimals: 0,
      maxInitial: 130000000000,
      maxMonthly: 1300000000,
      maxTarget: 1300000000000,
    },
    AUD: {
      symbol: 'A$',
      code: 'AUD',
      locale: 'en-AU',
      decimals: 0,
      maxInitial: 150000000,
      maxMonthly: 1500000,
      maxTarget: 1500000000,
    },
    CAD: {
      symbol: 'C$',
      code: 'CAD',
      locale: 'en-CA',
      decimals: 0,
      maxInitial: 130000000,
      maxMonthly: 1300000,
      maxTarget: 1300000000,
    },
  }

  // Convert full-width numbers to half-width and validate
  const normalizeNumber = (value: string): number => {
    // Convert full-width numbers to half-width
    const halfWidth = value.replace(/[０-９]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) - 0xfee0)
    })

    // Remove non-numeric characters except decimal point and minus
    const cleaned = halfWidth.replace(/[^0-9.-]/g, '')

    // Parse as float and return 0 if invalid
    const parsed = Number.parseFloat(cleaned)
    return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
  }

  const {
    state,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
  } = useHistory<InvestmentCalculatorState>(getDefaultState())

  const [isSharing, setIsSharing] = useState(false)
  const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>([])
  const [showPatternModal, setShowPatternModal] = useState(false)
  const [showMobileWizard, setShowMobileWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [patternName, setPatternName] = useState('')

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { getInitialStateFromUrl } = useUrlSharing<InvestmentCalculatorState>(TOOL_NAME)

  // Calculate advanced simulation
  const calculateAdvancedSimulation = useMemo(() => {
    if (state.mode !== 'advanced' || !state.phases || state.phases.length === 0) {
      return null
    }

    const simulationYears = state.totalSimulationYears || 40
    const chartData = []
    let currentBalance = state.initialAmount
    let totalInvested = state.initialAmount
    let totalWithdrawn = 0

    // Sort phases by start year
    const sortedPhases = [...state.phases].sort((a, b) => a.startYear - b.startYear)

    for (let year = 0; year <= simulationYears; year++) {
      // Find active phases for this year
      const activePhases = sortedPhases.filter(
        (phase) => year >= phase.startYear && year < phase.startYear + phase.duration
      )

      let yearlyContribution = 0
      let yearlyWithdrawal = 0
      let weightedReturn = 0

      // Calculate contributions/withdrawals and weighted returns for active phases
      if (activePhases.length === 0) {
        // No active phases, use default return rate but no contributions/withdrawals
        weightedReturn = state.annualReturn
      } else {
        let totalPhaseWeight = 0
        let _totalContributionWeight = 0

        for (const phase of activePhases) {
          if (phase.action === 'invest') {
            yearlyContribution += phase.monthlyAmount * 12
            _totalContributionWeight += phase.monthlyAmount * 12
          } else if (phase.action === 'withdraw') {
            yearlyWithdrawal += phase.monthlyAmount * 12
          }

          // Calculate weighted return based on portfolio allocation for this phase
          const phaseReturn = phase.portfolios.reduce(
            (sum, portfolio) => sum + (portfolio.annualReturn * portfolio.allocation) / 100,
            0
          )

          // Weight the return by the contribution amount for invest phases, or treat equally for other phases
          const phaseWeight = phase.action === 'invest' ? phase.monthlyAmount * 12 : 1
          weightedReturn += phaseReturn * phaseWeight
          totalPhaseWeight += phaseWeight
        }

        // Calculate weighted average return
        if (totalPhaseWeight > 0) {
          weightedReturn = weightedReturn / totalPhaseWeight
        } else {
          weightedReturn = state.annualReturn // Fallback
        }
      }

      // Apply monthly compounding
      const monthlyRate = weightedReturn / 100 / 12
      for (let month = 0; month < 12; month++) {
        // Add monthly contribution
        if (yearlyContribution > 0) {
          currentBalance += yearlyContribution / 12
          totalInvested += yearlyContribution / 12
        }

        // Subtract monthly withdrawal
        if (yearlyWithdrawal > 0) {
          const monthlyWithdrawal = Math.min(yearlyWithdrawal / 12, currentBalance)
          currentBalance -= monthlyWithdrawal
          totalWithdrawn += monthlyWithdrawal
        }

        // Apply compound growth
        currentBalance *= 1 + monthlyRate
      }

      chartData.push({
        year,
        principal: Math.round(totalInvested - totalWithdrawn),
        value: Math.round(Math.max(0, currentBalance)),
        returns: Math.round(Math.max(0, currentBalance - (totalInvested - totalWithdrawn))),
        totalInvested: Math.round(totalInvested),
        totalWithdrawn: Math.round(totalWithdrawn),
        phases: activePhases
          .map((p) => p.description || `Phase ${sortedPhases.indexOf(p) + 1}`)
          .join(', '),
      })
    }

    return {
      futureValue: currentBalance,
      totalContributions: totalInvested,
      totalWithdrawn,
      totalReturns: currentBalance - (totalInvested - totalWithdrawn),
      chartData,
      phases: sortedPhases,
    }
  }, [state])

  // Calculate compound interest with different modes
  const calculateInvestment = useMemo((): CalculationResult => {
    // Return advanced simulation results if in advanced mode
    if (state.mode === 'advanced') {
      return calculateAdvancedSimulation || {}
    }

    const {
      mode,
      initialAmount,
      monthlyAmount,
      annualReturn,
      investmentPeriod,
      targetAmount,
      withdrawalPeriod,
    } = state

    const monthlyRate = annualReturn / 100 / 12
    const months = investmentPeriod * 12

    switch (mode) {
      case 'future-value': {
        // FV = P(1 + r)^n + PMT × ((1 + r)^n - 1) / r
        const futureValue =
          initialAmount * (1 + monthlyRate) ** months +
          monthlyAmount * (((1 + monthlyRate) ** months - 1) / monthlyRate)

        const totalContributions = initialAmount + monthlyAmount * months
        const totalReturns = futureValue - totalContributions

        // Generate chart data
        const chartData = []
        for (let year = 0; year <= investmentPeriod; year++) {
          const m = year * 12
          const value =
            initialAmount * (1 + monthlyRate) ** m +
            monthlyAmount * (((1 + monthlyRate) ** m - 1) / monthlyRate)
          const principal = initialAmount + monthlyAmount * m

          chartData.push({
            year,
            principal: Math.round(principal),
            value: Math.round(value),
            returns: Math.round(value - principal),
          })
        }

        return {
          futureValue,
          totalContributions,
          totalReturns,
          chartData,
        }
      }

      case 'monthly-savings': {
        // PMT = FV × r / ((1 + r)^n - 1) - P × r × (1 + r)^n / ((1 + r)^n - 1)
        const futureValueFromInitial = initialAmount * (1 + monthlyRate) ** months
        const remainingTarget = targetAmount - futureValueFromInitial

        const monthlyPayment =
          remainingTarget > 0
            ? (remainingTarget * monthlyRate) / ((1 + monthlyRate) ** months - 1)
            : 0

        // Generate chart data
        const chartData = []
        for (let year = 0; year <= investmentPeriod; year++) {
          const m = year * 12
          const value =
            initialAmount * (1 + monthlyRate) ** m +
            monthlyPayment * (((1 + monthlyRate) ** m - 1) / monthlyRate)
          const principal = initialAmount + monthlyPayment * m

          chartData.push({
            year,
            principal: Math.round(principal),
            value: Math.round(value),
            returns: Math.round(value - principal),
          })
        }

        return {
          monthlyPayment,
          futureValue: targetAmount,
          totalContributions: initialAmount + monthlyPayment * months,
          totalReturns: targetAmount - (initialAmount + monthlyPayment * months),
          chartData,
        }
      }

      case 'investment-period': {
        // Calculate required period to reach target
        if (monthlyRate === 0) {
          const requiredMonths = (targetAmount - initialAmount) / monthlyAmount
          return {
            requiredPeriod: requiredMonths / 12,
            futureValue: targetAmount,
          }
        }

        // Using logarithmic formula to solve for n
        const numerator = Math.log(
          (targetAmount * monthlyRate + monthlyAmount) /
            (initialAmount * monthlyRate + monthlyAmount)
        )
        const denominator = Math.log(1 + monthlyRate)
        const requiredMonths = numerator / denominator
        const requiredYears = requiredMonths / 12

        // Generate chart data
        const chartData = []
        const periods = Math.ceil(requiredYears)
        for (let year = 0; year <= periods; year++) {
          const m = year * 12
          const value =
            initialAmount * (1 + monthlyRate) ** m +
            monthlyAmount * (((1 + monthlyRate) ** m - 1) / monthlyRate)
          const principal = initialAmount + monthlyAmount * m

          chartData.push({
            year,
            principal: Math.round(principal),
            value: Math.round(value),
            returns: Math.round(value - principal),
          })
        }

        return {
          requiredPeriod: requiredYears,
          futureValue: targetAmount,
          chartData,
        }
      }

      case 'withdrawal': {
        // Calculate safe withdrawal amount
        const withdrawalMonths = withdrawalPeriod * 12
        const currentValue =
          initialAmount * (1 + monthlyRate) ** months +
          monthlyAmount * (((1 + monthlyRate) ** months - 1) / monthlyRate)

        // PMT = PV × r × (1 + r)^n / ((1 + r)^n - 1)
        const withdrawalAmount =
          (currentValue * monthlyRate * (1 + monthlyRate) ** withdrawalMonths) /
          ((1 + monthlyRate) ** withdrawalMonths - 1)

        // Generate chart data showing balance during withdrawal
        const chartData = []
        let balance = currentValue
        for (let year = 0; year <= withdrawalPeriod; year++) {
          const principal = currentValue - withdrawalAmount * year * 12

          chartData.push({
            year,
            principal: Math.round(Math.max(0, principal)),
            value: Math.round(Math.max(0, balance)),
            returns: 0,
          })

          // Update balance for next year
          for (let month = 0; month < 12 && balance > 0; month++) {
            balance = balance * (1 + monthlyRate) - withdrawalAmount
          }
        }

        return {
          withdrawalAmount,
          futureValue: currentValue,
          chartData,
        }
      }

      default:
        return {}
    }
  }, [state, calculateAdvancedSimulation])

  // Format currency
  const formatCurrency = (value: number): string => {
    const info = currencyInfo[state.currency]
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    }).format(value)
  }

  // Format percentage
  // const _formatPercentage = (value: number): string => {
  //   return `${value.toFixed(2)}%`
  // }

  // Custom tooltip for charts
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{ name: string; value: number; color: string }>
    label?: string
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border-light bg-white p-3 shadow-lg dark:border-border-dark dark:bg-background-dark">
          <p className="text-sm font-semibold">Year {label}</p>
          {payload.map((entry, index) => (
            <p key={`${entry.name}-${index}`} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Load from URL or localStorage on mount
  useEffect(() => {
    const sharedState = getInitialStateFromUrl()
    if (sharedState) {
      setHistoryState(sharedState)
      return
    }

    const saved = localStorageManager.load<InvestmentCalculatorState>(TOOL_NAME)
    if (saved) {
      setHistoryState(saved)
    }

    // Load saved patterns
    const patterns = localStorageManager.load<SavedPattern[]>(`${TOOL_NAME}-patterns`)
    if (patterns) {
      setSavedPatterns(patterns)
    }

    // Check if mobile and show wizard
    if (window.innerWidth < 640 && !sessionStorage.getItem('wizard-dismissed')) {
      setShowMobileWizard(true)
    }
  }, [getInitialStateFromUrl, setHistoryState])

  // Save to localStorage and update URL on state change
  useEffect(() => {
    localStorageManager.save(TOOL_NAME, state)

    // Update URL params immediately
    const params = new URLSearchParams()
    Object.entries(state).forEach(([key, value]) => {
      // Special handling for complex objects in advanced mode
      if (key === 'phases' || key === 'defaultPortfolios') {
        if (value && Array.isArray(value)) {
          params.set(key, JSON.stringify(value))
        }
      } else if (typeof value === 'object' && value !== null) {
        params.set(key, JSON.stringify(value))
      } else {
        params.set(key, String(value))
      }
    })
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', newUrl)
  }, [state])

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const shareUrl = window.location.href
      await navigator.clipboard.writeText(shareUrl)
      successToast('Share link copied to clipboard!')
    } catch (_error) {
      errorToast('Failed to copy share link')
    } finally {
      setIsSharing(false)
    }
  }

  const savePattern = () => {
    if (!patternName.trim()) {
      errorToast('Please enter a name for this pattern')
      return
    }

    const newPattern: SavedPattern = {
      id: Date.now().toString(),
      name: patternName,
      state: { ...state },
      savedAt: new Date().toISOString(),
    }

    const updatedPatterns = [...savedPatterns, newPattern]
    setSavedPatterns(updatedPatterns)
    localStorageManager.save(`${TOOL_NAME}-patterns`, updatedPatterns)
    setPatternName('')
    setShowPatternModal(false)
    successToast('Pattern saved successfully!')
  }

  const loadPattern = (pattern: SavedPattern) => {
    setHistoryState(pattern.state)
    successToast(`Loaded pattern: ${pattern.name}`)
  }

  const deletePattern = (id: string) => {
    const updatedPatterns = savedPatterns.filter((p) => p.id !== id)
    setSavedPatterns(updatedPatterns)
    localStorageManager.save(`${TOOL_NAME}-patterns`, updatedPatterns)
    successToast('Pattern deleted')
  }

  const exportChartAsImage = async () => {
    const chartElement = document.querySelector('.recharts-wrapper')
    if (!chartElement) {
      errorToast('Chart not found')
      return
    }

    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(chartElement as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
      })

      // Convert to blob for download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `investment-chart-${Date.now()}.png`
          a.click()
          URL.revokeObjectURL(url)

          // Also create img element for mobile long-press
          const img = document.createElement('img')
          img.src = canvas.toDataURL('image/png')
          img.style.maxWidth = '100%'

          // Show in modal for mobile
          const modal = document.createElement('div')
          modal.style.cssText =
            'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;'
          modal.onclick = () => modal.remove()

          const imgContainer = document.createElement('div')
          imgContainer.style.cssText =
            'background:white;padding:20px;border-radius:8px;max-width:90%;max-height:90%;overflow:auto;'
          imgContainer.appendChild(img)

          const closeBtn = document.createElement('button')
          closeBtn.textContent = 'Close'
          closeBtn.style.cssText =
            'margin-top:10px;padding:8px 16px;background:#0066cc;color:white;border:none;border-radius:4px;cursor:pointer;'
          closeBtn.onclick = () => modal.remove()

          imgContainer.appendChild(closeBtn)
          modal.appendChild(imgContainer)
          document.body.appendChild(modal)

          successToast('Chart exported! Long-press to save on mobile.')
        }
      })
    } catch (_error) {
      errorToast('Failed to export chart')
    }
  }

  const handleExport = () => {
    const exportData = {
      ...state,
      results: calculateInvestment,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `investment-calculation-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    successToast('Calculation exported successfully!')
  }

  const handleClear = () => {
    if (confirm('Clear all inputs and reset to defaults?')) {
      clearHistory()
      localStorageManager.clear(TOOL_NAME)
      successToast('Calculator reset to defaults')
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <Header />
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        {/* Hero Section */}
        <section className="mb-8 text-center">
          <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground-light dark:text-foreground-dark mb-4">
            Investment Calculator
          </h1>
          <p className="mx-auto max-w-3xl text-sm sm:text-base md:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary">
            Plan your financial future with our comprehensive investment calculator. Calculate
            returns, set goals, and visualize your wealth growth over time.
          </p>
        </section>

        {/* Calculation Mode Tabs */}
        <section className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setHistoryState({ ...state, mode: 'future-value' })}
              className={`rounded-lg px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all ${
                state.mode === 'future-value'
                  ? 'bg-accent text-white shadow-lg'
                  : 'border border-border-light dark:border-border-dark hover:border-accent hover:text-accent'
              }`}
            >
              <TrendingUp className="inline-block w-4 h-4 mr-2" />
              Future Value
            </button>
            <button
              onClick={() => setHistoryState({ ...state, mode: 'monthly-savings' })}
              className={`rounded-lg px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all ${
                state.mode === 'monthly-savings'
                  ? 'bg-accent text-white shadow-lg'
                  : 'border border-border-light dark:border-border-dark hover:border-accent hover:text-accent'
              }`}
            >
              <Wallet className="inline-block w-4 h-4 mr-2" />
              Monthly Savings
            </button>
            <button
              onClick={() => setHistoryState({ ...state, mode: 'investment-period' })}
              className={`rounded-lg px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all ${
                state.mode === 'investment-period'
                  ? 'bg-accent text-white shadow-lg'
                  : 'border border-border-light dark:border-border-dark hover:border-accent hover:text-accent'
              }`}
            >
              <Target className="inline-block w-4 h-4 mr-2" />
              Time to Goal
            </button>
            <button
              onClick={() => setHistoryState({ ...state, mode: 'withdrawal' })}
              className={`rounded-lg px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all ${
                state.mode === 'withdrawal'
                  ? 'bg-accent text-white shadow-lg'
                  : 'border border-border-light dark:border-border-dark hover:border-accent hover:text-accent'
              }`}
            >
              <Calculator className="inline-block w-4 h-4 mr-2" />
              Withdrawal
            </button>
            <button
              onClick={() =>
                setHistoryState({
                  ...state,
                  mode: 'advanced',
                  phases: state.phases || defaultPhases,
                  defaultPortfolios: state.defaultPortfolios || defaultPortfolios,
                  totalSimulationYears: state.totalSimulationYears || 40,
                })
              }
              className={`rounded-lg px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all ${
                state.mode === 'advanced'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                  : 'border border-purple-300 text-purple-600 hover:border-purple-500 hover:text-purple-700 dark:border-purple-700 dark:text-purple-400'
              }`}
            >
              <ChartLine className="inline-block w-4 h-4 mr-2" />
              Advanced Simulation
            </button>
          </div>
        </section>

        {/* Main Calculator Interface */}
        {state.mode !== 'advanced' ? (
          <section className="grid gap-8 lg:grid-cols-[1fr,1.5fr]">
            {/* Input Controls */}
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
              <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                <h3 className="text-lg font-semibold">Investment Parameters</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                  Adjust your investment scenario
                </p>
              </div>

              <div className="p-3 sm:p-4 md:p-6 space-y-4">
                {/* Currency Selector */}
                <div>
                  <label htmlFor="currency-select" className="block text-sm font-medium mb-2">
                    <Globe className="inline-block w-4 h-4 mr-1" />
                    Currency
                  </label>
                  <select
                    id="currency-select"
                    value={state.currency}
                    onChange={(e) =>
                      setHistoryState({
                        ...state,
                        currency: e.target.value as Currency,
                      })
                    }
                    className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="CNY">CNY - Chinese Yuan</option>
                    <option value="KRW">KRW - Korean Won</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                  </select>
                </div>
                {/* Initial Investment */}
                <div>
                  <label htmlFor="initial-investment" className="block text-sm font-medium mb-2">
                    Initial Investment
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-semibold">
                      {currencyInfo[state.currency].symbol}
                    </span>
                    <input
                      id="initial-investment"
                      type="number"
                      value={state.initialAmount}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          initialAmount: normalizeNumber(e.target.value),
                        })
                      }
                      className="flex-1 rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                      min="0"
                      max={currencyInfo[state.currency].maxInitial}
                      step="1000"
                    />
                  </div>
                  <input
                    type="range"
                    value={Math.min(state.initialAmount, currencyInfo[state.currency].maxInitial)}
                    onChange={(e) =>
                      setHistoryState({
                        ...state,
                        initialAmount: Number.parseFloat(e.target.value),
                      })
                    }
                    className="w-full mt-2"
                    min="0"
                    max={currencyInfo[state.currency].maxInitial}
                    step="1000"
                  />
                </div>

                {/* Monthly Contribution */}
                {(state.mode === 'future-value' || state.mode === 'investment-period') && (
                  <div>
                    <label
                      htmlFor="monthly-contribution"
                      className="block text-sm font-medium mb-2"
                    >
                      Monthly Contribution
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-semibold">
                        {currencyInfo[state.currency].symbol}
                      </span>
                      <input
                        id="monthly-contribution"
                        type="number"
                        value={state.monthlyAmount}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            monthlyAmount: normalizeNumber(e.target.value),
                          })
                        }
                        className="flex-1 rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                        min="0"
                        max={currencyInfo[state.currency].maxMonthly}
                        step="100"
                      />
                    </div>
                    <input
                      type="range"
                      value={Math.min(state.monthlyAmount, currencyInfo[state.currency].maxMonthly)}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          monthlyAmount: Number.parseFloat(e.target.value),
                        })
                      }
                      className="w-full mt-2"
                      min="0"
                      max={currencyInfo[state.currency].maxMonthly}
                      step="50"
                    />
                  </div>
                )}

                {/* Annual Return */}
                <div>
                  <label htmlFor="annual-return" className="block text-sm font-medium mb-2">
                    Expected Annual Return
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="annual-return"
                      type="number"
                      value={state.annualReturn}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          annualReturn: normalizeNumber(e.target.value),
                        })
                      }
                      className="flex-1 rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                      min="0"
                      max="50"
                      step="0.1"
                    />
                    <span className="text-lg font-semibold">%</span>
                  </div>
                  <input
                    type="range"
                    value={state.annualReturn}
                    onChange={(e) =>
                      setHistoryState({
                        ...state,
                        annualReturn: Number.parseFloat(e.target.value),
                      })
                    }
                    className="w-full mt-2"
                    min="0"
                    max="50"
                    step="0.5"
                  />
                </div>

                {/* Investment Period */}
                {(state.mode === 'future-value' || state.mode === 'monthly-savings') && (
                  <div>
                    <label htmlFor="investment-period" className="block text-sm font-medium mb-2">
                      Investment Period
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        id="investment-period"
                        type="number"
                        value={state.investmentPeriod}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            investmentPeriod: normalizeNumber(e.target.value),
                          })
                        }
                        className="flex-1 rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                        min="1"
                        max="100"
                        step="1"
                      />
                      <span className="text-lg font-semibold">years</span>
                    </div>
                    <input
                      type="range"
                      value={state.investmentPeriod}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          investmentPeriod: Number.parseFloat(e.target.value),
                        })
                      }
                      className="w-full mt-2"
                      min="1"
                      max="100"
                      step="1"
                    />
                  </div>
                )}

                {/* Target Amount */}
                {(state.mode === 'monthly-savings' || state.mode === 'investment-period') && (
                  <div>
                    <label htmlFor="target-amount" className="block text-sm font-medium mb-2">
                      Target Amount
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-semibold">
                        {currencyInfo[state.currency].symbol}
                      </span>
                      <input
                        id="target-amount"
                        type="number"
                        value={state.targetAmount}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            targetAmount: normalizeNumber(e.target.value),
                          })
                        }
                        className="flex-1 rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                        min="0"
                        max={currencyInfo[state.currency].maxTarget}
                        step="10000"
                      />
                    </div>
                    <input
                      type="range"
                      value={state.targetAmount}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          targetAmount: Number.parseFloat(e.target.value),
                        })
                      }
                      className="w-full mt-2"
                      min="10000"
                      max={currencyInfo[state.currency].maxTarget}
                      step="10000"
                    />
                  </div>
                )}

                {/* Withdrawal Period */}
                {state.mode === 'withdrawal' && (
                  <div>
                    <label htmlFor="withdrawal-period" className="block text-sm font-medium mb-2">
                      Withdrawal Period
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        id="withdrawal-period"
                        type="number"
                        value={state.withdrawalPeriod}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            withdrawalPeriod: normalizeNumber(e.target.value),
                          })
                        }
                        className="flex-1 rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                        min="1"
                        max="100"
                        step="1"
                      />
                      <span className="text-lg font-semibold">years</span>
                    </div>
                    <input
                      type="range"
                      value={state.withdrawalPeriod}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          withdrawalPeriod: Number.parseFloat(e.target.value),
                        })
                      }
                      className="w-full mt-2"
                      min="1"
                      max="100"
                      step="1"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-4">
                  <button
                    onClick={() => setShowPatternModal(true)}
                    className="rounded-lg border border-border-light px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95"
                  >
                    <Save className="inline-block w-4 h-4 mr-2" />
                    Save Pattern
                  </button>
                  <button
                    onClick={() => {
                      const modal = document.createElement('div')
                      modal.style.cssText =
                        'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;'
                      modal.onclick = (e) => {
                        if (e.target === modal) modal.remove()
                      }

                      const content = document.createElement('div')
                      content.style.cssText =
                        'background:white;border-radius:8px;max-width:500px;width:100%;max-height:80vh;overflow:auto;'
                      content.innerHTML = `
                      <div style="padding:20px;border-bottom:1px solid #e5e7eb;">
                        <h3 style="font-size:18px;font-weight:600;">Saved Patterns</h3>
                      </div>
                      <div style="padding:20px;">
                        ${
                          savedPatterns.length === 0
                            ? '<p style="color:#6b7280;">No saved patterns yet</p>'
                            : savedPatterns
                                .map(
                                  (p) => `
                            <div style="border:1px solid #e5e7eb;border-radius:4px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                              <div>
                                <strong>${p.name}</strong><br>
                                <small style="color:#6b7280;">${new Date(p.savedAt).toLocaleString()}</small>
                              </div>
                              <div style="display:flex;gap:8px;">
                                <button onclick="window.loadPatternFromId('${p.id}')" style="padding:6px 12px;background:#0066cc;color:white;border:none;border-radius:4px;cursor:pointer;">Load</button>
                                <button onclick="window.deletePatternById('${p.id}')" style="padding:6px 12px;background:#dc2626;color:white;border:none;border-radius:4px;cursor:pointer;">Delete</button>
                              </div>
                            </div>
                          `
                                )
                                .join('')
                        }
                      </div>
                    `
                      modal.appendChild(content)
                      document.body.appendChild(modal)

                      // Add global functions temporarily
                      ;(
                        window as unknown as { loadPatternFromId?: (id: string) => void }
                      ).loadPatternFromId = (id: string) => {
                        const pattern = savedPatterns.find((p) => p.id === id)
                        if (pattern) {
                          loadPattern(pattern)
                          modal.remove()
                        }
                      }
                      ;(
                        window as unknown as { deletePatternById?: (id: string) => void }
                      ).deletePatternById = (id: string) => {
                        deletePattern(id)
                        modal.remove()
                      }
                    }}
                    className="rounded-lg border border-border-light px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95"
                  >
                    <FolderOpen className="inline-block w-4 h-4 mr-2" />
                    Load Pattern
                  </button>
                  <button
                    onClick={handleShare}
                    disabled={isSharing}
                    className="rounded-lg border border-border-light px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    <Share2 className="inline-block w-4 h-4 mr-2" />
                    Share
                  </button>
                  <button
                    onClick={handleExport}
                    className="rounded-lg border border-border-light px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95"
                  >
                    <Download className="inline-block w-4 h-4 mr-2" />
                    Export
                  </button>
                  <button
                    onClick={exportChartAsImage}
                    className="rounded-lg border border-border-light px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95"
                  >
                    <Image className="inline-block w-4 h-4 mr-2" />
                    Export Chart
                  </button>
                  <button
                    onClick={handleClear}
                    className="rounded-lg border border-red-300 px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base text-red-600 transition-all hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    <RefreshCw className="inline-block w-4 h-4 mr-2" />
                    Reset
                  </button>
                </div>

                {/* Undo/Redo */}
                <div className="flex gap-2">
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="rounded-lg border border-border-light px-3 py-2 min-h-[44px] transition-all hover:border-accent hover:text-accent dark:border-border-dark disabled:opacity-50"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="rounded-lg border border-border-light px-3 py-2 min-h-[44px] transition-all hover:border-accent hover:text-accent dark:border-border-dark disabled:opacity-50"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results & Visualization */}
            <div className="space-y-6">
              {/* Results Summary */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-lg font-semibold">Calculation Results</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    Your projected investment outcome
                  </p>
                </div>

                <div className="p-3 sm:p-4 md:p-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {state.mode === 'future-value' && calculateInvestment.futureValue && (
                      <>
                        <div className="rounded-lg bg-accent/10 p-4">
                          <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                            Future Value
                          </p>
                          <p className="text-2xl font-bold text-accent">
                            {formatCurrency(calculateInvestment.futureValue)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-green-500/10 p-4">
                          <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                            Total Returns
                          </p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(calculateInvestment.totalReturns || 0)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-500/10 p-4">
                          <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                            Total Invested
                          </p>
                          <p className="text-2xl font-bold">
                            {formatCurrency(calculateInvestment.totalContributions || 0)}
                          </p>
                        </div>
                      </>
                    )}

                    {state.mode === 'monthly-savings' &&
                      calculateInvestment.monthlyPayment !== undefined && (
                        <>
                          <div className="rounded-lg bg-accent/10 p-4">
                            <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Required Monthly
                            </p>
                            <p className="text-2xl font-bold text-accent">
                              {formatCurrency(calculateInvestment.monthlyPayment)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-green-500/10 p-4">
                            <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Target Amount
                            </p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(state.targetAmount)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-500/10 p-4">
                            <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Total Investment
                            </p>
                            <p className="text-2xl font-bold">
                              {formatCurrency(calculateInvestment.totalContributions || 0)}
                            </p>
                          </div>
                        </>
                      )}

                    {state.mode === 'investment-period' &&
                      calculateInvestment.requiredPeriod !== undefined && (
                        <>
                          <div className="rounded-lg bg-accent/10 p-4">
                            <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Time Required
                            </p>
                            <p className="text-2xl font-bold text-accent">
                              {calculateInvestment.requiredPeriod.toFixed(1)} years
                            </p>
                          </div>
                          <div className="rounded-lg bg-green-500/10 p-4">
                            <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Target Amount
                            </p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(state.targetAmount)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-500/10 p-4">
                            <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Monthly Contribution
                            </p>
                            <p className="text-2xl font-bold">
                              {formatCurrency(state.monthlyAmount)}
                            </p>
                          </div>
                        </>
                      )}

                    {state.mode === 'withdrawal' &&
                      calculateInvestment.withdrawalAmount !== undefined && (
                        <>
                          <div className="rounded-lg bg-accent/10 p-4">
                            <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Monthly Withdrawal
                            </p>
                            <p className="text-2xl font-bold text-accent">
                              {formatCurrency(calculateInvestment.withdrawalAmount)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-green-500/10 p-4">
                            <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Portfolio Value
                            </p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(calculateInvestment.futureValue || 0)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-500/10 p-4">
                            <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Withdrawal Period
                            </p>
                            <p className="text-2xl font-bold">{state.withdrawalPeriod} years</p>
                          </div>
                        </>
                      )}
                  </div>
                </div>
              </div>

              {/* Chart Visualization */}
              {calculateInvestment.chartData && (
                <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                  <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                    <h3 className="text-lg font-semibold">
                      <ChartLine className="inline-block w-5 h-5 mr-2" />
                      Investment Growth Projection
                    </h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                      Visualize your investment journey over time
                    </p>
                  </div>

                  <div className="p-3 sm:p-4 md:p-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={calculateInvestment.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="year"
                          label={{
                            value: 'Years',
                            position: 'insideBottom',
                            offset: -5,
                          }}
                          stroke="#6b7280"
                        />
                        <YAxis
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          stroke="#6b7280"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="principal"
                          stackId="1"
                          stroke="#94a3b8"
                          fill="#cbd5e1"
                          name="Principal"
                        />
                        <Area
                          type="monotone"
                          dataKey="returns"
                          stackId="1"
                          stroke="#0066cc"
                          fill="#3385d6"
                          name="Returns"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          /* Advanced Investment Simulation Interface */
          <section className="space-y-6">
            <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 dark:border-purple-800 dark:from-purple-900/20 dark:to-blue-900/20 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
                  <ChartLine className="w-6 h-6 text-purple-600 dark:text-purple-300" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    Advanced Investment Simulation
                  </h2>
                  <p className="text-purple-700 dark:text-purple-300">
                    Create complex multi-phase investment strategies with varying contributions and
                    multiple portfolios
                  </p>
                </div>
              </div>
            </div>

            {/* Investment Phases Management */}
            <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
              {/* Phases Configuration */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-4 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Investment Phases</h3>
                      <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                        Define different investment periods with varying strategies
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const newPhase: InvestmentPhase = {
                          id: `phase${Date.now()}`,
                          startYear: (state.phases?.length || 0) * 10,
                          duration: 10,
                          action: 'invest',
                          monthlyAmount: 500,
                          portfolios: [...defaultPortfolios],
                          description: `Phase ${(state.phases?.length || 0) + 1}`,
                        }
                        setHistoryState({
                          ...state,
                          phases: [...(state.phases || []), newPhase],
                        })
                      }}
                      className="rounded-lg bg-accent px-3 py-2 text-white font-medium text-sm transition-all hover:bg-accent-dark"
                    >
                      Add Phase
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {state.phases?.map((phase, phaseIndex) => (
                    <div
                      key={phase.id}
                      className="rounded-lg border border-border-light dark:border-border-dark p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-semibold">Phase {phaseIndex + 1}</h4>
                          <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                            Years {phase.startYear} - {phase.startYear + phase.duration}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const updatedPhases =
                                state.phases?.filter((p) => p.id !== phase.id) || []
                              setHistoryState({ ...state, phases: updatedPhases })
                            }}
                            className="rounded-lg border border-red-300 px-2 py-1 text-red-600 text-sm hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Start Year */}
                        <div>
                          <label
                            htmlFor={`start-year-${phase.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Start Year
                          </label>
                          <input
                            id={`start-year-${phase.id}`}
                            type="number"
                            value={phase.startYear}
                            onChange={(e) => {
                              const updatedPhases =
                                state.phases?.map((p) =>
                                  p.id === phase.id
                                    ? {
                                        ...p,
                                        startYear: Math.max(
                                          0,
                                          Number.parseInt(e.target.value) || 0
                                        ),
                                      }
                                    : p
                                ) || []
                              setHistoryState({ ...state, phases: updatedPhases })
                            }}
                            className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                            min="0"
                            max="100"
                          />
                        </div>

                        {/* Duration */}
                        <div>
                          <label
                            htmlFor={`duration-${phase.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Duration (years)
                          </label>
                          <input
                            id={`duration-${phase.id}`}
                            type="number"
                            value={phase.duration}
                            onChange={(e) => {
                              const updatedPhases =
                                state.phases?.map((p) =>
                                  p.id === phase.id
                                    ? {
                                        ...p,
                                        duration: Math.max(1, Number.parseInt(e.target.value) || 1),
                                      }
                                    : p
                                ) || []
                              setHistoryState({ ...state, phases: updatedPhases })
                            }}
                            className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                            min="1"
                            max="50"
                          />
                        </div>

                        {/* Action */}
                        <div>
                          <label
                            htmlFor={`action-${phase.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Action
                          </label>
                          <select
                            id={`action-${phase.id}`}
                            value={phase.action}
                            onChange={(e) => {
                              const updatedPhases =
                                state.phases?.map((p) =>
                                  p.id === phase.id
                                    ? { ...p, action: e.target.value as PhaseAction }
                                    : p
                                ) || []
                              setHistoryState({ ...state, phases: updatedPhases })
                            }}
                            className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                          >
                            <option value="invest">Invest</option>
                            <option value="withdraw">Withdraw</option>
                            <option value="hold">Hold</option>
                          </select>
                        </div>

                        {/* Monthly Amount */}
                        {phase.action !== 'hold' && (
                          <div className="sm:col-span-2">
                            <label
                              htmlFor={`monthly-amount-${phase.id}`}
                              className="block text-sm font-medium mb-1"
                            >
                              Monthly {phase.action === 'invest' ? 'Investment' : 'Withdrawal'} (
                              {currencyInfo[state.currency].symbol})
                            </label>
                            <input
                              id={`monthly-amount-${phase.id}`}
                              type="number"
                              value={phase.monthlyAmount}
                              onChange={(e) => {
                                const updatedPhases =
                                  state.phases?.map((p) =>
                                    p.id === phase.id
                                      ? {
                                          ...p,
                                          monthlyAmount: Math.max(
                                            0,
                                            Number.parseFloat(e.target.value) || 0
                                          ),
                                        }
                                      : p
                                  ) || []
                                setHistoryState({ ...state, phases: updatedPhases })
                              }}
                              className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                              min="0"
                              step="100"
                            />
                          </div>
                        )}

                        {/* Description */}
                        <div className="sm:col-span-3">
                          <label
                            htmlFor={`description-${phase.id}`}
                            className="block text-sm font-medium mb-1"
                          >
                            Description
                          </label>
                          <input
                            id={`description-${phase.id}`}
                            type="text"
                            value={phase.description || ''}
                            onChange={(e) => {
                              const updatedPhases =
                                state.phases?.map((p) =>
                                  p.id === phase.id ? { ...p, description: e.target.value } : p
                                ) || []
                              setHistoryState({ ...state, phases: updatedPhases })
                            }}
                            className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                            placeholder="Optional phase description"
                          />
                        </div>
                      </div>

                      {/* Portfolio Allocation */}
                      <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark">
                        <h5 className="font-medium mb-3">Portfolio Allocation</h5>
                        <div className="space-y-3">
                          {phase.portfolios.map((portfolio, portfolioIndex) => (
                            <div key={portfolio.id} className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: portfolio.color }}
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">{portfolio.name}</span>
                                  <span className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                                    {portfolio.allocation}% ({portfolio.annualReturn}% return)
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={portfolio.allocation}
                                  onChange={(e) => {
                                    const newAllocation = Number.parseInt(e.target.value)
                                    const updatedPhases =
                                      state.phases?.map((p) => {
                                        if (p.id !== phase.id) return p
                                        const updatedPortfolios = [...p.portfolios]
                                        updatedPortfolios[portfolioIndex] = {
                                          ...portfolio,
                                          allocation: newAllocation,
                                        }
                                        // Auto-adjust other portfolios to maintain 100% total
                                        const totalOthers = updatedPortfolios
                                          .filter((_, i) => i !== portfolioIndex)
                                          .reduce((sum, p) => sum + p.allocation, 0)
                                        const remaining = 100 - newAllocation
                                        if (totalOthers > 0) {
                                          updatedPortfolios.forEach((p, i) => {
                                            if (i !== portfolioIndex) {
                                              p.allocation = Math.round(
                                                (p.allocation / totalOthers) * remaining
                                              )
                                            }
                                          })
                                        }
                                        return { ...p, portfolios: updatedPortfolios }
                                      }) || []
                                    setHistoryState({ ...state, phases: updatedPhases })
                                  }}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                          Total: {phase.portfolios.reduce((sum, p) => sum + p.allocation, 0)}%
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!state.phases || state.phases.length === 0) && (
                    <div className="text-center py-8 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      <ChartLine className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No investment phases defined yet.</p>
                      <p className="text-sm">
                        Click "Add Phase" to create your first investment phase.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Simulation Summary */}
              <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                <div className="p-4 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-lg font-semibold">Simulation Summary</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    Overview of your investment strategy
                  </p>
                </div>

                <div className="p-4 space-y-4">
                  <div className="rounded-lg bg-accent/10 p-3">
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Total Simulation Period
                    </p>
                    <p className="text-lg font-bold text-accent">
                      {state.totalSimulationYears || 40} years
                    </p>
                  </div>

                  <div className="rounded-lg bg-green-500/10 p-3">
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Number of Phases
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {state.phases?.length || 0}
                    </p>
                  </div>

                  <div className="rounded-lg bg-blue-500/10 p-3">
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                      Initial Investment
                    </p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(state.initialAmount)}
                    </p>
                  </div>

                  {state.phases && state.phases.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Phase Overview:</h4>
                      {state.phases.map((phase, index) => (
                        <div
                          key={phase.id}
                          className="text-sm p-2 rounded bg-slate-50 dark:bg-slate-800"
                        >
                          <div className="flex justify-between">
                            <span className="font-medium">Phase {index + 1}</span>
                            <span className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                              Y{phase.startYear}-{phase.startYear + phase.duration}
                            </span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="capitalize">{phase.action}</span>
                            {phase.action !== 'hold' && (
                              <span>{formatCurrency(phase.monthlyAmount)}/mo</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t border-border-light dark:border-border-dark">
                    <label
                      htmlFor="total-simulation-years"
                      className="block text-sm font-medium mb-2"
                    >
                      Total Simulation Years
                    </label>
                    <input
                      id="total-simulation-years"
                      type="number"
                      value={state.totalSimulationYears || 40}
                      onChange={(e) => {
                        setHistoryState({
                          ...state,
                          totalSimulationYears: Math.max(10, Number.parseInt(e.target.value) || 40),
                        })
                      }}
                      className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                      min="10"
                      max="100"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Results & Charts */}
            {calculateAdvancedSimulation && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Advanced Results Summary */}
                <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                  <div className="p-4 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                    <h3 className="text-lg font-semibold">Advanced Simulation Results</h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                      Multi-phase investment analysis
                    </p>
                  </div>

                  <div className="p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg bg-accent/10 p-4">
                        <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                          Final Portfolio Value
                        </p>
                        <p className="text-2xl font-bold text-accent">
                          {formatCurrency(calculateAdvancedSimulation.futureValue || 0)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-green-500/10 p-4">
                        <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                          Total Returns
                        </p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(calculateAdvancedSimulation.totalReturns || 0)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-blue-500/10 p-4">
                        <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                          Total Invested
                        </p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(calculateAdvancedSimulation.totalContributions || 0)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-orange-500/10 p-4">
                        <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                          Total Withdrawn
                        </p>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {formatCurrency(calculateAdvancedSimulation.totalWithdrawn || 0)}
                        </p>
                      </div>
                    </div>

                    {/* Phase Timeline */}
                    {calculateAdvancedSimulation.phases &&
                      calculateAdvancedSimulation.phases.length > 0 && (
                        <div className="mt-6">
                          <h4 className="font-medium mb-3">Investment Timeline</h4>
                          <div className="space-y-2">
                            {calculateAdvancedSimulation.phases.map((phase, index) => (
                              <div
                                key={phase.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                      backgroundColor:
                                        phase.action === 'invest'
                                          ? '#10b981'
                                          : phase.action === 'withdraw'
                                            ? '#ef4444'
                                            : '#6b7280',
                                    }}
                                  />
                                  <div>
                                    <div className="font-medium text-sm">
                                      {phase.description || `Phase ${index + 1}`}
                                    </div>
                                    <div className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
                                      Years {phase.startYear} - {phase.startYear + phase.duration} •{' '}
                                      {phase.action === 'invest'
                                        ? 'Investing'
                                        : phase.action === 'withdraw'
                                          ? 'Withdrawing'
                                          : 'Holding'}
                                      {phase.action !== 'hold' &&
                                        ` ${formatCurrency(phase.monthlyAmount)}/month`}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {phase.portfolios.find((p) => p.allocation > 0)?.name ||
                                      'Mixed Portfolio'}
                                  </div>
                                  <div className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
                                    {phase.portfolios
                                      .reduce(
                                        (sum, p) => sum + (p.annualReturn * p.allocation) / 100,
                                        0
                                      )
                                      .toFixed(1)}
                                    % avg return
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {/* Advanced Chart */}
                {calculateAdvancedSimulation.chartData && (
                  <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
                    <div className="p-4 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                      <h3 className="text-lg font-semibold">
                        <ChartLine className="inline-block w-5 h-5 mr-2" />
                        Advanced Portfolio Growth
                      </h3>
                      <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                        Multi-phase investment projection with phase transitions
                      </p>
                    </div>

                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={calculateAdvancedSimulation.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="year"
                            label={{
                              value: 'Years',
                              position: 'insideBottom',
                              offset: -5,
                            }}
                            stroke="#6b7280"
                          />
                          <YAxis
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            stroke="#6b7280"
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload
                                const currentYear = Number(label)

                                // Find active phases for this year
                                const activePhases =
                                  calculateAdvancedSimulation.phases?.filter(
                                    (phase) =>
                                      currentYear >= phase.startYear &&
                                      currentYear < phase.startYear + phase.duration
                                  ) || []

                                return (
                                  <div className="rounded-lg border border-border-light bg-white p-4 shadow-lg dark:border-border-dark dark:bg-background-dark max-w-sm">
                                    <p className="font-semibold mb-3 text-base">Year {label}</p>

                                    {/* Portfolio Values */}
                                    <div className="space-y-2 mb-3">
                                      <p className="text-sm font-medium text-foreground-light dark:text-foreground-dark">
                                        Portfolio Value
                                      </p>
                                      {payload.map((entry, index) => (
                                        <div
                                          key={`${entry.name}-${index}`}
                                          className="flex justify-between items-center"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-3 h-3 rounded-sm"
                                              style={{ backgroundColor: entry.color }}
                                            />
                                            <span className="text-sm">{entry.name}</span>
                                          </div>
                                          <span
                                            className="text-sm font-medium"
                                            style={{ color: entry.color }}
                                          >
                                            {formatCurrency(entry.value)}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="flex justify-between items-center pt-2 border-t border-border-light dark:border-border-dark">
                                        <span className="text-sm font-medium">Total Value</span>
                                        <span className="text-sm font-bold text-accent">
                                          {formatCurrency(data.value)}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Active phases info */}
                                    {activePhases.length > 0 && (
                                      <div className="mb-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                                        <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
                                          Active Investment Phases
                                        </p>
                                        <div className="space-y-2">
                                          {activePhases.map((phase) => {
                                            const phaseNumber =
                                              calculateAdvancedSimulation.phases?.indexOf(phase) + 1
                                            return (
                                              <div
                                                key={phase.id}
                                                className="flex items-center justify-between text-xs"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{
                                                      backgroundColor:
                                                        phase.action === 'invest'
                                                          ? '#10b981'
                                                          : phase.action === 'withdraw'
                                                            ? '#ef4444'
                                                            : '#6b7280',
                                                    }}
                                                  />
                                                  <span className="font-medium text-purple-600 dark:text-purple-400">
                                                    Phase {phaseNumber}:
                                                  </span>
                                                  <span className="capitalize text-purple-700 dark:text-purple-300">
                                                    {phase.action}
                                                  </span>
                                                </div>
                                                {phase.action !== 'hold' && (
                                                  <span className="font-medium text-purple-700 dark:text-purple-300">
                                                    {formatCurrency(phase.monthlyAmount)}/mo
                                                  </span>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Summary Statistics */}
                                    {data.totalInvested !== undefined && (
                                      <div className="space-y-1 text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
                                        <div className="flex justify-between">
                                          <span>Total Invested:</span>
                                          <span className="font-medium">
                                            {formatCurrency(data.totalInvested)}
                                          </span>
                                        </div>
                                        {data.totalWithdrawn > 0 && (
                                          <div className="flex justify-between">
                                            <span>Total Withdrawn:</span>
                                            <span className="font-medium">
                                              {formatCurrency(data.totalWithdrawn)}
                                            </span>
                                          </div>
                                        )}
                                        <div className="flex justify-between">
                                          <span>Net Principal:</span>
                                          <span className="font-medium">
                                            {formatCurrency(data.principal)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Total Returns:</span>
                                          <span className="font-medium text-green-600 dark:text-green-400">
                                            {formatCurrency(data.returns)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between pt-1 border-t border-border-light dark:border-border-dark">
                                          <span>Return Rate:</span>
                                          <span className="font-medium text-green-600 dark:text-green-400">
                                            {data.principal > 0
                                              ? ((data.returns / data.principal) * 100).toFixed(1)
                                              : '0.0'}
                                            %
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="principal"
                            stackId="1"
                            stroke="#94a3b8"
                            fill="#cbd5e1"
                            name="Net Principal"
                          />
                          <Area
                            type="monotone"
                            dataKey="returns"
                            stackId="1"
                            stroke="#8b5cf6"
                            fill="#a78bfa"
                            name="Returns"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Features Section */}
        <section className="hidden xs:block mb-8 sm:mb-12 md:mb-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark p-4 transition-all hover:shadow-lg">
              <TrendingUp className="w-8 h-8 text-accent mb-3" />
              <h3 className="font-semibold mb-2">Compound Growth</h3>
              <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Visualize the power of compound interest over time
              </p>
            </div>
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark p-4 transition-all hover:shadow-lg">
              <Target className="w-8 h-8 text-accent mb-3" />
              <h3 className="font-semibold mb-2">Goal Planning</h3>
              <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Calculate exactly what you need to reach your financial goals
              </p>
            </div>
            <div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark p-4 transition-all hover:shadow-lg">
              <ChartLine className="w-8 h-8 text-accent mb-3" />
              <h3 className="font-semibold mb-2">Interactive Charts</h3>
              <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Dynamic visualizations update as you adjust parameters
              </p>
            </div>
          </div>
        </section>

        {/* SEO Content Sections */}
        <section className="mb-8 sm:mb-12 md:mb-16 border-t border-border-light dark:border-border-dark pt-8 sm:pt-12">
          {/* About This Tool */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">About Our Investment Calculator</h2>
            <div className="space-y-4 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              <p>
                Our Investment Calculator is a comprehensive financial planning tool designed to
                help you visualize and plan your wealth-building journey. Whether you're saving for
                retirement, planning a major purchase, or simply wanting to understand how your
                money can grow over time, this calculator provides accurate projections based on
                compound interest calculations and your specific financial parameters.
              </p>
              <p>
                The calculator features multiple calculation modes to address different financial
                planning scenarios. You can calculate future values of investments, determine
                required monthly savings to reach specific goals, estimate how long it will take to
                achieve financial targets, or plan sustainable withdrawal strategies for retirement.
                All calculations are performed instantly in your browser, ensuring complete privacy
                and security of your financial data.
              </p>
              <p>
                Built for investors, financial planners, and anyone interested in long-term wealth
                building, our calculator combines sophisticated financial mathematics with an
                intuitive interface. The interactive charts and real-time calculations make it easy
                to experiment with different scenarios and understand how changes in contribution
                amounts, return rates, or time horizons affect your financial outcomes.
              </p>
            </div>
          </div>

          {/* How to Use */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">How to Use the Investment Calculator</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <h3 className="font-semibold mb-2">Step 1: Choose Calculation Mode</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Select from Future Value, Monthly Savings, Time to Goal, or Withdrawal mode based
                  on what you want to calculate.
                </p>
              </div>
              <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <h3 className="font-semibold mb-2">Step 2: Enter Parameters</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Input your initial investment, monthly contributions, expected returns, and time
                  period using sliders or text inputs.
                </p>
              </div>
              <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <h3 className="font-semibold mb-2">Step 3: View Results</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  See instant calculations including future values, required savings, and total
                  returns displayed in clear summary cards.
                </p>
              </div>
              <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <h3 className="font-semibold mb-2">Step 4: Analyze Charts</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Explore interactive charts showing investment growth over time, with separate
                  visualization of principal and returns.
                </p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Key Features</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-2">Multiple Calculation Modes</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Four distinct modes for different financial planning scenarios: future value,
                  required savings, time to goal, and withdrawal planning.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Real-Time Calculations</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Instant updates as you adjust parameters, allowing quick comparison of different
                  investment scenarios.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Interactive Visualizations</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Dynamic charts show investment growth over time with clear separation of principal
                  and returns.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Compound Interest Modeling</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Accurate compound interest calculations with monthly compounding for realistic
                  projections.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Privacy-Focused</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  All calculations performed locally in your browser with no data sent to servers.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Export & Sharing</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Save calculations as JSON files or share scenarios via URL for collaboration.
                </p>
              </div>
            </div>
          </div>

          {/* Examples */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Common Use Cases</h2>
            <div className="space-y-4">
              <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <h3 className="font-semibold mb-2">Retirement Planning</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mb-2">
                  Calculate how much your retirement savings will grow with regular contributions
                  over 30 years.
                </p>
                <p className="text-xs font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded">
                  Initial: $50,000 | Monthly: $1,000 | Return: 7% | Period: 30 years → Future Value:
                  $1,566,262
                </p>
              </div>
              <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <h3 className="font-semibold mb-2">College Savings</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mb-2">
                  Determine monthly savings needed to accumulate $200,000 for college in 18 years.
                </p>
                <p className="text-xs font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded">
                  Target: $200,000 | Initial: $10,000 | Return: 6% | Period: 18 years → Monthly
                  Required: $456
                </p>
              </div>
              <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <h3 className="font-semibold mb-2">Early Retirement</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mb-2">
                  Calculate safe withdrawal amount from a $1,000,000 portfolio over 40 years.
                </p>
                <p className="text-xs font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded">
                  Portfolio: $1,000,000 | Return: 5% | Period: 40 years → Monthly Withdrawal: $4,821
                </p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  How accurate are the investment projections?
                </summary>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                  Our calculator uses standard compound interest formulas for accurate mathematical
                  projections. However, actual investment returns vary based on market conditions
                  and cannot be guaranteed.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  What return rate should I use for stock market investments?
                </summary>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                  Historical average returns for the S&P 500 are around 10% annually. However, many
                  financial planners recommend using 6-8% for conservative long-term projections.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  Does the calculator account for taxes?
                </summary>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                  No, this calculator provides pre-tax projections. You should consider the tax
                  implications of your investments separately based on your specific situation and
                  account types.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  Can I save my calculations for later?
                </summary>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                  Yes! Your calculations are automatically saved locally. You can also export them
                  as JSON files or share them via URL to access from any device.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  What's the difference between the calculation modes?
                </summary>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                  Future Value calculates final amount, Monthly Savings determines required
                  contributions, Time to Goal finds investment period needed, and Withdrawal
                  calculates sustainable withdrawal amounts.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  How does compound interest work in the calculator?
                </summary>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                  The calculator compounds returns monthly, meaning your earnings generate their own
                  earnings. This exponential growth effect becomes more powerful over longer time
                  periods.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  Is my financial data secure?
                </summary>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                  Absolutely. All calculations happen directly in your browser. No financial data is
                  sent to any server, ensuring complete privacy and security of your information.
                </p>
              </details>
              <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                <summary className="font-semibold cursor-pointer">
                  Can I use this for retirement planning?
                </summary>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                  Yes! Use Future Value mode for accumulation phase planning and Withdrawal mode to
                  calculate sustainable retirement income from your portfolio.
                </p>
              </details>
            </div>
          </div>
        </section>

        <Footer />
      </div>

      {/* Pattern Save Modal */}
      {showPatternModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-background-dark rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Save Investment Pattern</h3>
            <input
              type="text"
              placeholder="Enter pattern name..."
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowPatternModal(false)
                  setPatternName('')
                }}
                className="rounded-lg border border-border-light px-4 py-2 font-medium text-sm transition-all hover:border-accent hover:text-accent dark:border-border-dark"
              >
                Cancel
              </button>
              <button
                onClick={savePattern}
                className="rounded-lg bg-accent px-4 py-2 text-white font-medium text-sm transition-all hover:bg-accent-dark"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Wizard */}
      {showMobileWizard && window.innerWidth < 640 && (
        <div className="fixed inset-0 bg-white dark:bg-background-dark z-50 overflow-auto">
          <div className="min-h-screen flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark">
              <h2 className="text-lg font-semibold">Investment Calculator Setup</h2>
              <button
                onClick={() => {
                  setShowMobileWizard(false)
                  sessionStorage.setItem('wizard-dismissed', 'true')
                }}
                className="p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4">
              {/* Step indicator */}
              <div className="flex items-center justify-center mb-8">
                {[0, 1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        wizardStep >= step ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {step + 1}
                    </div>
                    {step < 4 && (
                      <div
                        className={`w-12 h-1 ${wizardStep > step ? 'bg-accent' : 'bg-gray-200'}`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Step content */}
              <div className="max-w-sm mx-auto">
                {wizardStep === 0 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Select Currency</h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mb-6">
                      Choose your preferred currency for calculations
                    </p>
                    <select
                      value={state.currency}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          currency: e.target.value as Currency,
                        })
                      }
                      className="w-full rounded-lg border border-border-light bg-white px-3 py-3 text-base outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="JPY">JPY - Japanese Yen</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="CNY">CNY - Chinese Yuan</option>
                      <option value="KRW">KRW - Korean Won</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                    </select>
                  </div>
                )}

                {wizardStep === 1 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Initial Investment</h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mb-6">
                      How much will you invest initially?
                    </p>
                    <div className="flex items-center space-x-2 mb-4">
                      <span className="text-2xl font-semibold">
                        {currencyInfo[state.currency].symbol}
                      </span>
                      <input
                        type="number"
                        value={state.initialAmount}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            initialAmount: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                        className="flex-1 rounded-lg border border-border-light bg-white px-3 py-3 text-lg outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                        min="0"
                        step="1000"
                      />
                    </div>
                    <input
                      type="range"
                      value={state.initialAmount}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          initialAmount: Number.parseFloat(e.target.value),
                        })
                      }
                      className="w-full"
                      min="0"
                      max="100000"
                      step="1000"
                    />
                  </div>
                )}

                {wizardStep === 2 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Monthly Contribution</h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mb-6">
                      How much will you contribute monthly?
                    </p>
                    <div className="flex items-center space-x-2 mb-4">
                      <span className="text-2xl font-semibold">
                        {currencyInfo[state.currency].symbol}
                      </span>
                      <input
                        type="number"
                        value={state.monthlyAmount}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            monthlyAmount: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                        className="flex-1 rounded-lg border border-border-light bg-white px-3 py-3 text-lg outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                        min="0"
                        step="100"
                      />
                    </div>
                    <input
                      type="range"
                      value={state.monthlyAmount}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          monthlyAmount: Number.parseFloat(e.target.value),
                        })
                      }
                      className="w-full"
                      min="0"
                      max="5000"
                      step="50"
                    />
                  </div>
                )}

                {wizardStep === 3 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Expected Return</h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mb-6">
                      What annual return do you expect?
                    </p>
                    <div className="flex items-center space-x-2 mb-4">
                      <input
                        type="number"
                        value={state.annualReturn}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            annualReturn: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                        className="flex-1 rounded-lg border border-border-light bg-white px-3 py-3 text-lg outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                        min="0"
                        max="30"
                        step="0.1"
                      />
                      <span className="text-2xl font-semibold">%</span>
                    </div>
                    <input
                      type="range"
                      value={state.annualReturn}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          annualReturn: Number.parseFloat(e.target.value),
                        })
                      }
                      className="w-full"
                      min="0"
                      max="30"
                      step="0.5"
                    />
                  </div>
                )}

                {wizardStep === 4 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Investment Period</h3>
                    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mb-6">
                      How long will you invest?
                    </p>
                    <div className="flex items-center space-x-2 mb-4">
                      <input
                        type="number"
                        value={state.investmentPeriod}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            investmentPeriod: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                        className="flex-1 rounded-lg border border-border-light bg-white px-3 py-3 text-lg outline-none focus:border-accent dark:border-border-dark dark:bg-background-dark"
                        min="1"
                        max="50"
                        step="1"
                      />
                      <span className="text-2xl font-semibold">years</span>
                    </div>
                    <input
                      type="range"
                      value={state.investmentPeriod}
                      onChange={(e) =>
                        setHistoryState({
                          ...state,
                          investmentPeriod: Number.parseFloat(e.target.value),
                        })
                      }
                      className="w-full"
                      min="1"
                      max="50"
                      step="1"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border-light dark:border-border-dark">
              <div className="flex gap-2">
                {wizardStep > 0 && (
                  <button
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="flex-1 rounded-lg border border-border-light px-4 py-3 font-medium transition-all hover:border-accent hover:text-accent dark:border-border-dark"
                  >
                    <ChevronLeft className="inline-block w-4 h-4 mr-2" />
                    Previous
                  </button>
                )}
                {wizardStep < 4 ? (
                  <button
                    onClick={() => setWizardStep(wizardStep + 1)}
                    className="flex-1 rounded-lg bg-accent px-4 py-3 text-white font-medium transition-all hover:bg-accent-dark"
                  >
                    Next
                    <ChevronRight className="inline-block w-4 h-4 ml-2" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowMobileWizard(false)
                      sessionStorage.setItem('wizard-dismissed', 'true')
                    }}
                    className="flex-1 rounded-lg bg-accent px-4 py-3 text-white font-medium transition-all hover:bg-accent-dark"
                  >
                    View Results
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
