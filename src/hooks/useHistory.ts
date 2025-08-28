import { useCallback, useEffect, useRef, useState } from 'react'

interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

interface UseHistoryReturn<T> {
  state: T
  setState: (newState: T | ((prevState: T) => T)) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clear: () => void
}

export function useHistory<T>(initialState: T, maxHistorySize = 50): UseHistoryReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  })

  const isUpdatingRef = useRef(false)

  const setState = useCallback((newState: T | ((prevState: T) => T)) => {
    if (isUpdatingRef.current) return

    setHistory((currentHistory) => {
      const resolvedState = typeof newState === 'function' 
        ? (newState as (prevState: T) => T)(currentHistory.present)
        : newState

      // Skip if state hasn't changed
      if (JSON.stringify(resolvedState) === JSON.stringify(currentHistory.present)) {
        return currentHistory
      }

      const newPast = [...currentHistory.past, currentHistory.present]
      
      // Limit history size
      if (newPast.length > maxHistorySize) {
        newPast.shift()
      }

      return {
        past: newPast,
        present: resolvedState,
        future: [],
      }
    })
  }, [maxHistorySize])

  const undo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.past.length === 0) return currentHistory

      const previous = currentHistory.past[currentHistory.past.length - 1]
      const newPast = currentHistory.past.slice(0, currentHistory.past.length - 1)

      return {
        past: newPast,
        present: previous,
        future: [currentHistory.present, ...currentHistory.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.future.length === 0) return currentHistory

      const next = currentHistory.future[0]
      const newFuture = currentHistory.future.slice(1)

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: next,
        future: newFuture,
      }
    })
  }, [])

  const clear = useCallback(() => {
    setHistory({
      past: [],
      present: initialState,
      future: [],
    })
  }, [initialState])

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey)) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault()
          undo()
        } else if ((event.key === 'y') || (event.key === 'z' && event.shiftKey)) {
          event.preventDefault()
          redo()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
  }
}