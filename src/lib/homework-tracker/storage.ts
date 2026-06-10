import { localStorageManager } from '@/lib/localStorage'
import { createHomeworkTrackerPersonalState, createHomeworkTrackerState } from './templates'
import type {
  HomeworkTrackerPersistedState,
  HomeworkTrackerPersonalState,
  HomeworkTrackerSharedState,
} from './types'
import { sanitizeHomeworkTrackerPersonalState, sanitizeHomeworkTrackerState } from './utils'

const TOOL_NAME = 'homework-tracker'

export function loadHomeworkTrackerState(): HomeworkTrackerPersistedState {
  const fallbackShared = createHomeworkTrackerState()
  const saved = localStorageManager.load<HomeworkTrackerPersistedState>(TOOL_NAME)

  if (!saved) {
    return {
      shared: fallbackShared,
      personal: createHomeworkTrackerPersonalState(),
    }
  }

  const shared = sanitizeHomeworkTrackerState(saved.shared)
  const personal = sanitizeHomeworkTrackerPersonalState(saved.personal, shared)

  return { shared, personal }
}

export function saveHomeworkTrackerState(
  shared: HomeworkTrackerSharedState,
  personal: HomeworkTrackerPersonalState
) {
  localStorageManager.save<HomeworkTrackerPersistedState>(TOOL_NAME, {
    shared,
    personal,
  })
}

export function clearHomeworkTrackerState() {
  localStorageManager.clear(TOOL_NAME)
}
