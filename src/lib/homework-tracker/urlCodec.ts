import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { createHomeworkTrackerState } from './templates'
import type { HomeworkTrackerCodecResult, HomeworkTrackerSharedState, SchoolType } from './types'
import { sanitizeHomeworkTrackerState } from './utils'

const URL_VERSION = '1'
const URL_VERSION_PARAM = 'v'
const URL_DATA_PARAM = 'h'

export function encodeHomeworkTrackerQuery(state: HomeworkTrackerSharedState): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(sanitizeHomeworkTrackerState(state)))

  return `?${URL_VERSION_PARAM}=${URL_VERSION}&${URL_DATA_PARAM}=${payload}`
}

export function decodeHomeworkTrackerFromSearch(
  search: string,
  fallbackSchoolType: SchoolType = 'high-school'
): HomeworkTrackerCodecResult {
  const fallbackState = createHomeworkTrackerState(fallbackSchoolType)

  try {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    const version = params.get(URL_VERSION_PARAM)
    const encoded = params.get(URL_DATA_PARAM)

    if (!version || !encoded) {
      return {
        state: fallbackState,
        error: null,
      }
    }

    if (version !== URL_VERSION) {
      return {
        state: fallbackState,
        error: 'URLのバージョンが古いため復元できませんでした。',
      }
    }

    const decoded = decompressFromEncodedURIComponent(encoded)

    if (!decoded) {
      throw new Error('payload decode failed')
    }

    return {
      state: sanitizeHomeworkTrackerState(JSON.parse(decoded)),
      error: null,
    }
  } catch {
    return {
      state: fallbackState,
      error: '共有URLの内容を読み取れませんでした。',
    }
  }
}

export function buildHomeworkTrackerUrl(state: HomeworkTrackerSharedState, currentUrl: string) {
  const query = encodeHomeworkTrackerQuery(state)
  const url = new URL(currentUrl)
  url.search = query

  return {
    query,
    url: url.toString(),
  }
}
