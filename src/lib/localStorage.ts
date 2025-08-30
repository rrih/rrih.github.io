/**
 * ローカルストレージ管理ライブラリ
 * 全ツールで共通利用する状態保存・復元機能
 */

export interface ToolState {
  toolName: string
  version: string
  timestamp: number
  data: Record<string, unknown>
}

export interface LocalStorageManager {
  save<T>(toolName: string, state: T): void
  load<T>(toolName: string): T | null
  clear(toolName: string): void
  clearAll(): void
  export(): string
  import(data: string): void
  getAllStates(): Record<string, ToolState>
}

class LocalStorageService implements LocalStorageManager {
  private readonly PREFIX = 'tool_state_'
  private readonly VERSION = '1.0.0'

  /**
   * ツールの状態をローカルストレージに保存
   */
  save<T>(toolName: string, state: T): void {
    if (typeof window === 'undefined') return

    try {
      const toolState: ToolState = {
        toolName,
        version: this.VERSION,
        timestamp: Date.now(),
        data: state as Record<string, unknown>,
      }

      const key = this.PREFIX + toolName
      localStorage.setItem(key, JSON.stringify(toolState))
    } catch (error) {
      console.warn(`Failed to save state for ${toolName}:`, error)
    }
  }

  /**
   * ツールの状態をローカルストレージから読み込み
   */
  load<T>(toolName: string): T | null {
    if (typeof window === 'undefined') return null

    try {
      const key = this.PREFIX + toolName
      const stored = localStorage.getItem(key)

      if (!stored) return null

      const toolState: ToolState = JSON.parse(stored)

      // バージョンチェック（将来の拡張用）
      if (toolState.version !== this.VERSION) {
        console.warn(
          `Version mismatch for ${toolName}. Stored: ${toolState.version}, Current: ${this.VERSION}`
        )
      }

      return toolState.data as T
    } catch (error) {
      console.warn(`Failed to load state for ${toolName}:`, error)
      return null
    }
  }

  /**
   * 特定ツールの状態を削除
   */
  clear(toolName: string): void {
    try {
      const key = this.PREFIX + toolName
      localStorage.removeItem(key)
    } catch (error) {
      console.warn(`Failed to clear state for ${toolName}:`, error)
    }
  }

  /**
   * 全ツールの状態を削除
   */
  clearAll(): void {
    try {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.PREFIX))
      keys.forEach((key) => localStorage.removeItem(key))
    } catch (error) {
      console.warn('Failed to clear all states:', error)
    }
  }

  /**
   * 全状態をエクスポート（バックアップ用）
   */
  export(): string {
    try {
      const states = this.getAllStates()
      return JSON.stringify(states, null, 2)
    } catch (error) {
      console.warn('Failed to export states:', error)
      return '{}'
    }
  }

  /**
   * 状態をインポート（バックアップ復元用）
   */
  import(data: string): void {
    try {
      const states: Record<string, ToolState> = JSON.parse(data)

      Object.values(states).forEach((state) => {
        this.save(state.toolName, state.data)
      })
    } catch (error) {
      console.warn('Failed to import states:', error)
    }
  }

  /**
   * 全状態を取得
   */
  getAllStates(): Record<string, ToolState> {
    try {
      const states: Record<string, ToolState> = {}

      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(this.PREFIX)) {
          const toolName = key.replace(this.PREFIX, '')
          const stored = localStorage.getItem(key)

          if (stored) {
            states[toolName] = JSON.parse(stored)
          }
        }
      })

      return states
    } catch (error) {
      console.warn('Failed to get all states:', error)
      return {}
    }
  }

  /**
   * ストレージ使用量を取得（概算）
   */
  getStorageSize(): { used: number; available: number } {
    try {
      let used = 0
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(this.PREFIX)) {
          used += (localStorage.getItem(key) || '').length
        }
      })

      // ローカルストレージの一般的な上限は5MB
      const available = 5 * 1024 * 1024 - used

      return { used, available }
    } catch (error) {
      console.warn('Failed to get storage size:', error)
      return { used: 0, available: 5 * 1024 * 1024 }
    }
  }

  /**
   * ストレージがほぼ満杯かチェック
   */
  isStorageNearFull(): boolean {
    const { available } = this.getStorageSize()
    return available < 500 * 1024 // 500KB未満の場合は警告
  }
}

// シングルトンインスタンス
export const localStorageManager = new LocalStorageService()

/**
 * React Hook: ツール状態の自動保存・復元
 */
export function useToolState<T>(
  toolName: string,
  initialState: T,
  autoSave = true
): [T, (state: T) => void, () => void] {
  // 初期化時にローカルストレージから復元
  const loadInitialState = (): T => {
    const saved = localStorageManager.load<T>(toolName)
    return saved || initialState
  }

  const [state, setState] = React.useState<T>(loadInitialState)

  // 状態更新とローカルストレージ保存
  const updateState = (newState: T) => {
    setState(newState)
    if (autoSave) {
      localStorageManager.save(toolName, newState)
    }
  }

  // 状態削除
  const clearState = () => {
    setState(initialState)
    localStorageManager.clear(toolName)
  }

  return [state, updateState, clearState]
}

// React import for hook
import React from 'react'
