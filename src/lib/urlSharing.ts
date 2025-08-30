/**
 * URL共有機能ライブラリ
 * ツールの状態をURLクエリパラメータで共有する機能
 */

export interface ShareableState {
  tool: string
  version: string
  data: string // base64 encoded JSON
}

export interface URLSharingManager {
  encode<T>(toolName: string, state: T): string
  decode<T>(toolName: string, url: string): T | null
  generateShareUrl<T>(toolName: string, state: T): string
  isSharedUrl(url: string): boolean
  copyShareUrl(url: string): Promise<boolean>
}

class URLSharingService implements URLSharingManager {
  private readonly VERSION = '1.0.0'
  private readonly PARAM_KEY = 's' // short parameter name to save URL length

  /**
   * 状態をBase64エンコードされた文字列に変換
   */
  encode<T>(toolName: string, state: T): string {
    try {
      const shareableState: ShareableState = {
        tool: toolName,
        version: this.VERSION,
        data: btoa(encodeURIComponent(JSON.stringify(state))),
      }

      return btoa(JSON.stringify(shareableState))
    } catch (error) {
      console.warn(`Failed to encode state for ${toolName}:`, error)
      return ''
    }
  }

  /**
   * Base64エンコードされた文字列から状態を復元
   */
  decode<T>(toolName: string, encodedState: string): T | null {
    try {
      const shareableState: ShareableState = JSON.parse(atob(encodedState))

      if (shareableState.tool !== toolName) {
        console.warn(`Tool name mismatch. Expected: ${toolName}, Got: ${shareableState.tool}`)
        return null
      }

      const decodedData = JSON.parse(decodeURIComponent(atob(shareableState.data)))
      return decodedData as T
    } catch (error) {
      console.warn(`Failed to decode state for ${toolName}:`, error)
      return null
    }
  }

  /**
   * 共有用URLを生成
   */
  generateShareUrl<T>(toolName: string, state: T): string {
    if (typeof window === 'undefined') return ''

    try {
      const encoded = this.encode(toolName, state)
      if (!encoded) return ''

      const url = new URL(window.location.href)
      url.searchParams.set(this.PARAM_KEY, encoded)

      return url.toString()
    } catch (error) {
      console.warn(`Failed to generate share URL for ${toolName}:`, error)
      return window.location.href
    }
  }

  /**
   * URLが共有URLかどうかをチェック
   */
  isSharedUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.searchParams.has(this.PARAM_KEY)
    } catch (_error) {
      return false
    }
  }

  /**
   * URLからクエリパラメータの共有状態を取得
   */
  getSharedStateFromUrl<T>(toolName: string, url?: string): T | null {
    if (typeof window === 'undefined') return null

    try {
      const urlObj = new URL(url || window.location.href)
      const encoded = urlObj.searchParams.get(this.PARAM_KEY)

      if (!encoded) return null

      return this.decode<T>(toolName, encoded)
    } catch (error) {
      console.warn('Failed to get shared state from URL:', error)
      return null
    }
  }

  /**
   * 共有URLをクリップボードにコピー
   */
  async copyShareUrl(url: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
        return true
      }

      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'absolute'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      return successful
    } catch (error) {
      console.warn('Failed to copy URL:', error)
      return false
    }
  }

  /**
   * URLの長さをチェック（ブラウザ制限対応）
   */
  isUrlTooLong(url: string): boolean {
    // Most browsers support ~2000 characters, but we'll be conservative
    return url.length > 1800
  }

  /**
   * 状態を圧縮してURL長を短縮
   */
  compressState<T>(state: T): T {
    // 簡単な圧縮ロジック（空の値や不要なプロパティを除去）
    if (typeof state !== 'object' || state === null) {
      return state
    }

    const compressed = {} as T
    Object.entries(state).forEach(([key, value]) => {
      // 空文字列、null、undefinedを除外
      if (value !== '' && value !== null && value !== undefined) {
        compressed[key as keyof T] = value
      }
    })

    return compressed
  }

  /**
   * SNS用の短縮メッセージを生成
   */
  generateSocialMessage(toolName: string, description?: string): string {
    const baseMessage = `Check out this ${toolName} result!`
    if (description) {
      return `${baseMessage} ${description}`
    }
    return baseMessage
  }

  /**
   * 各種SNSの共有URLを生成
   */
  generateSocialShareUrls(shareUrl: string, message: string) {
    const encodedUrl = encodeURIComponent(shareUrl)
    const encodedMessage = encodeURIComponent(message)

    return {
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedMessage}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
      reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedMessage}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`,
    }
  }

  /**
   * URLクエリパラメータをクリーンアップ（共有パラメータを除去）
   */
  cleanUrl(url?: string): string {
    if (typeof window === 'undefined') return url || ''

    try {
      const urlObj = new URL(url || window.location.href)
      urlObj.searchParams.delete(this.PARAM_KEY)

      // 履歴を更新（ページリロードなし）
      if (!url && window.history.replaceState) {
        window.history.replaceState({}, document.title, urlObj.toString())
      }

      return urlObj.toString()
    } catch (error) {
      console.warn('Failed to clean URL:', error)
      return url || window.location.href
    }
  }
}

// シングルトンインスタンス
export const urlSharingManager = new URLSharingService()

/**
 * React Hook: URL共有機能
 */
export function useUrlSharing<T>(toolName: string) {
  const [isGeneratingShareUrl, setIsGeneratingShareUrl] = React.useState(false)
  const [lastShareUrl, setLastShareUrl] = React.useState<string>('')

  // 初期化時にURLから共有状態を取得
  const getInitialStateFromUrl = (): T | null => {
    return urlSharingManager.getSharedStateFromUrl<T>(toolName)
  }

  // 共有URL生成
  const generateShareUrl = async (state: T): Promise<string> => {
    setIsGeneratingShareUrl(true)
    try {
      const shareUrl = urlSharingManager.generateShareUrl(toolName, state)
      setLastShareUrl(shareUrl)
      return shareUrl
    } finally {
      setIsGeneratingShareUrl(false)
    }
  }

  // 共有URL生成 + クリップボードコピー
  const shareToClipboard = async (state: T, message?: string): Promise<boolean> => {
    try {
      const shareUrl = await generateShareUrl(state)
      const success = await urlSharingManager.copyShareUrl(shareUrl)

      if (success && message) {
        // 成功通知を表示（実装は各ツールで）
        console.log(message)
      }

      return success
    } catch (error) {
      console.warn('Failed to share to clipboard:', error)
      return false
    }
  }

  // SNS共有URLs生成
  const generateSocialShareUrls = (state: T, description?: string) => {
    const shareUrl = urlSharingManager.generateShareUrl(toolName, state)
    const message = urlSharingManager.generateSocialMessage(toolName, description)
    return urlSharingManager.generateSocialShareUrls(shareUrl, message)
  }

  // URLクリーンアップ
  const cleanCurrentUrl = () => {
    return urlSharingManager.cleanUrl()
  }

  return {
    getInitialStateFromUrl,
    generateShareUrl,
    shareToClipboard,
    generateSocialShareUrls,
    cleanCurrentUrl,
    isGeneratingShareUrl,
    lastShareUrl,
    isSharedUrl: urlSharingManager.isSharedUrl(window.location.href),
  }
}

// React import for hook
import React from 'react'
