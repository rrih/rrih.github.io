/**
 * 全ツール共通の拡張機能
 * ローカルストレージ、URL共有、エクスポート、削除機能の統合
 */

import { localStorageManager } from './localStorage'
import { urlSharingManager } from './urlSharing'

export interface ToolEnhancementConfig<T> {
  toolName: string
  state: T
  setState: (state: T) => void
  resetState: () => T
  successToast: (title: string, message?: string) => void
  errorToast: (title: string, message?: string) => void
}

export function createToolEnhancement<T>(config: ToolEnhancementConfig<T>) {
  const { toolName, state, setState, resetState, successToast, errorToast } = config

  // URL共有機能
  const handleShare = async (setIsSharing?: (value: boolean) => void) => {
    if (setIsSharing) setIsSharing(true)
    try {
      const shareUrl = urlSharingManager.generateShareUrl(toolName, state)
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
      if (setIsSharing) setIsSharing(false)
    }
  }

  // データ削除機能
  const handleClearData = (confirmMessage = 'Clear all saved data and current input?') => {
    if (confirm(confirmMessage)) {
      localStorageManager.clear(toolName)
      urlSharingManager.cleanUrl()
      setState(resetState())
    }
  }

  // データエクスポート機能
  const handleExportData = (customData?: Record<string, any>) => {
    const data = {
      ...state,
      ...customData,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${toolName}-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 初期状態取得（URL共有 -> ローカルストレージ -> デフォルト）
  const getInitialState = (): T => {
    const sharedState = urlSharingManager.getSharedStateFromUrl<T>(toolName)
    if (sharedState) return sharedState

    const savedState = localStorageManager.load<T>(toolName)
    if (savedState) return savedState

    return resetState()
  }

  // ローカルストレージ自動保存
  const saveToLocalStorage = () => {
    localStorageManager.save(toolName, state)
  }

  return {
    handleShare,
    handleClearData,
    handleExportData,
    getInitialState,
    saveToLocalStorage,
  }
}

// 共通ボタンコンポーネント用のPropsインターフェース
export interface ToolEnhancementButtonsProps {
  onShare: () => void
  onExport: () => void
  onClearData: () => void
  isSharing?: boolean
  className?: string
}

// 共通ボタンJSX生成
export function generateEnhancementButtons({
  onShare,
  onExport,
  onClearData,
  isSharing = false,
  className = '',
}: ToolEnhancementButtonsProps) {
  return `
    <button
      onClick={onShare}
      disabled={isSharing}
      className="flex items-center gap-1 xs:gap-2 rounded-lg border border-border-light px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] font-medium text-xs xs:text-sm sm:text-base transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark dark:hover:border-accent dark:hover:text-accent flex-1 xs:flex-none ${className}"
    >
      <Share2 className="h-3 w-3 xs:h-4 xs:w-4" />
      {isSharing ? 'Sharing...' : 'Share'}
    </button>
    <button
      onClick={onExport}
      className="flex items-center gap-1 xs:gap-2 rounded-lg border border-border-light px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] font-medium text-xs xs:text-sm sm:text-base transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark dark:hover:border-accent dark:hover:text-accent flex-1 xs:flex-none ${className}"
    >
      <Download className="h-3 w-3 xs:h-4 xs:w-4" />
      Export
    </button>
    <button
      onClick={onClearData}
      className="flex items-center gap-1 xs:gap-2 rounded-lg border border-red-300 px-2 xs:px-3 sm:px-4 py-2 xs:py-3 min-h-[40px] xs:min-h-[44px] font-medium text-xs xs:text-sm sm:text-base text-red-600 transition-all hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:border-red-600 flex-1 xs:flex-none ${className}"
    >
      <Trash2 className="h-3 w-3 xs:h-4 xs:w-4" />
      Clear All
    </button>
  `
}
