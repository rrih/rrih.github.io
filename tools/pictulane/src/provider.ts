import type { Album } from './model'
export class SourceError extends Error {
  constructor(public code: 'unavailable' | 'network' | 'offline') {
    super(code)
  }
}
// No unverified parser, token, proxy, API or demo fallback is used in production.
export async function loadAlbum(_account: string, signal: AbortSignal): Promise<Album> {
  void _account
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  throw new SourceError(navigator.onLine ? 'unavailable' : 'offline')
}
export const capabilities = { pagination: false, individualResolution: false, verifiedSource: false } as const
