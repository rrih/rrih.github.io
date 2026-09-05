const DATABASE = 'atlas-backgrounds-v1'
const STORE = 'images'
export const MAX_BACKGROUND_INPUT_BYTES = 10 * 1024 * 1024
export const MAX_BACKGROUND_EDGE = 2048
const MAX_STORED_BYTES = 4 * 1024 * 1024
const inputTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const storedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const validId = (id: unknown): id is string =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)

export class BackgroundStoreError extends Error {
  constructor(public readonly code: 'unsupported' | 'too-large' | 'decode' | 'storage') {
    super(`background-${code}`)
    this.name = 'BackgroundStoreError'
  }
}

interface StoredBackground {
  version: 1
  id: string
  blob: Blob
  width: number
  height: number
}

async function rasterType(blob: Blob): Promise<string | null> {
  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg'
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => header[index] === byte))
    return 'image/png'
  if (
    String.fromCharCode(...header.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...header.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp'
  if (['GIF87a', 'GIF89a'].includes(String.fromCharCode(...header.slice(0, 6)))) return 'image/gif'
  if (
    String.fromCharCode(...header.slice(4, 8)) === 'ftyp' &&
    ['avif', 'avis', 'mif1'].includes(String.fromCharCode(...header.slice(8, 12)))
  )
    return 'image/avif'
  return null
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    let settled = false
    const failure = () => {
      if (settled) return
      settled = true
      reject(new BackgroundStoreError('storage'))
    }
    try {
      request = indexedDB.open(DATABASE, 1)
    } catch {
      failure()
      return
    }
    request.onblocked = failure
    request.onerror = failure
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => {
      const database = request.result
      if (settled) {
        database.close()
        return
      }
      settled = true
      database.onversionchange = () => database.close()
      resolve(database)
    }
  })
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode)
      let result: T
      const request = action(transaction.objectStore(STORE))
      request.onsuccess = () => {
        result = request.result
      }
      transaction.oncomplete = () => resolve(result)
      transaction.onabort = transaction.onerror = () => reject(new BackgroundStoreError('storage'))
    })
  } catch {
    throw new BackgroundStoreError('storage')
  } finally {
    database.close()
  }
}

async function decode(
  blob: Blob,
): Promise<{ image: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      // Some browsers decode AVIF through HTMLImageElement before ImageBitmap supports it.
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => {
        image.src = ''
        URL.revokeObjectURL(url)
      },
    }
  } catch {
    URL.revokeObjectURL(url)
    throw new BackgroundStoreError('decode')
  }
}

/** Rasterize locally to discard filenames, metadata and animation; no network request is made. */
export async function saveBackground(file: File): Promise<{ id: string; url: string }> {
  if (!(file instanceof File) || !inputTypes.has(file.type.toLowerCase()))
    throw new BackgroundStoreError('unsupported')
  if (!file.size) throw new BackgroundStoreError('decode')
  if (file.size > MAX_BACKGROUND_INPUT_BYTES) throw new BackgroundStoreError('too-large')
  // Reject SVG/XML content even if its caller supplied an allowed raster MIME label.
  if ((await rasterType(file)) !== file.type.toLowerCase()) throw new BackgroundStoreError('unsupported')
  const decoded = await decode(file)
  let canvas: HTMLCanvasElement | undefined
  try {
    const { width, height } = decoded
    if (!width || !height) throw new BackgroundStoreError('decode')
    if (width > 16384 || height > 16384 || width * height > 40_000_000)
      throw new BackgroundStoreError('too-large')
    const scale = Math.min(1, MAX_BACKGROUND_EDGE / Math.max(width, height))
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new BackgroundStoreError('decode')
    context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas?.toBlob(resolve, 'image/webp', 0.86))
    if (!blob || !storedTypes.has(blob.type)) throw new BackgroundStoreError('decode')
    if (blob.size > MAX_STORED_BYTES) throw new BackgroundStoreError('too-large')
    const id = crypto.randomUUID()
    const record: StoredBackground = { version: 1, id, blob, width: canvas.width, height: canvas.height }
    await transact('readwrite', (store) => store.put(record))
    // The caller owns this object URL and must revoke it when replaced or unmounted.
    return { id, url: URL.createObjectURL(blob) }
  } catch (error) {
    if (error instanceof BackgroundStoreError) throw error
    throw new BackgroundStoreError('decode')
  } finally {
    decoded.close()
    if (canvas) canvas.width = canvas.height = 0
  }
}

/** Missing or malformed records return null. A denied/unavailable store throws `storage`. */
export async function loadBackground(id: string): Promise<{ id: string; url: string } | null> {
  if (!validId(id)) return null
  const value: unknown = await transact('readonly', (store) => store.get(id))
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<StoredBackground>
  if (
    record.version !== 1 ||
    record.id !== id ||
    !(record.blob instanceof Blob) ||
    !storedTypes.has(record.blob.type) ||
    !record.blob.size ||
    record.blob.size > MAX_STORED_BYTES ||
    !Number.isInteger(record.width) ||
    !Number.isInteger(record.height) ||
    (record.width ?? 0) < 1 ||
    (record.height ?? 0) < 1 ||
    (record.width ?? 0) > MAX_BACKGROUND_EDGE ||
    (record.height ?? 0) > MAX_BACKGROUND_EDGE
  )
    return null
  try {
    if ((await rasterType(record.blob)) !== record.blob.type) return null
    const decoded = await decode(record.blob)
    const valid = decoded.width === record.width && decoded.height === record.height
    decoded.close()
    if (!valid) return null
  } catch {
    return null
  }
  return { id, url: URL.createObjectURL(record.blob) }
}

export async function deleteBackground(id: string): Promise<void> {
  if (!validId(id)) return
  await transact('readwrite', (store) => store.delete(id))
}
