'use client'

import { AlertCircle, CheckCircle, X, XCircle } from 'lucide-react'
import type React from 'react'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning'
  title: string
  message?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const newToast: Toast = {
      id,
      ...toast,
      duration: toast.duration ?? 3000,
    }

    setToasts((prev) => [...prev, newToast])

    // Auto remove after duration
    setTimeout(() => {
      removeToast(id)
    }, newToast.duration)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }, [])

  const handleRemove = () => {
    setIsRemoving(true)
    setTimeout(() => {
      onRemove(toast.id)
    }, 200) // Match exit animation duration
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-400" />
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-400" />
    }
  }

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
    }
  }

  return (
    <div
      className={`
        rounded-lg border p-4 shadow-lg backdrop-blur-sm transition-all duration-200 transform pointer-events-auto
        ${getBgColor()}
        ${
          isVisible && !isRemoving
            ? 'translate-x-0 opacity-100 scale-100'
            : 'translate-x-full opacity-0 scale-95'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground-light dark:text-foreground-dark">
            {toast.title}
          </p>
          {toast.message && (
            <p className="mt-1 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
              {toast.message}
            </p>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="flex-shrink-0 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Convenience hooks
export function useSuccessToast() {
  const { addToast } = useToast()
  return useCallback(
    (title: string, message?: string, duration?: number) => {
      addToast({ type: 'success', title, message, duration })
    },
    [addToast]
  )
}

export function useErrorToast() {
  const { addToast } = useToast()
  return useCallback(
    (title: string, message?: string, duration?: number) => {
      addToast({ type: 'error', title, message, duration })
    },
    [addToast]
  )
}

export function useWarningToast() {
  const { addToast } = useToast()
  return useCallback(
    (title: string, message?: string, duration?: number) => {
      addToast({ type: 'warning', title, message, duration })
    },
    [addToast]
  )
}
