import { Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { BackgroundStoreError, saveBackground } from './backgroundStore'
import { useLocale } from './i18n'

export default function BackgroundPicker({
  selected,
  onSelect,
  onRemove,
  onError,
}: {
  selected: boolean
  onSelect: (id: string) => void
  onRemove: () => void
  onError: (message: string) => void
}) {
  const { t } = useLocale()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  async function upload(file: File) {
    setBusy(true)
    try {
      const image = await saveBackground(file)
      URL.revokeObjectURL(image.url)
      onSelect(image.id)
    } catch (error) {
      onError(
        error instanceof BackgroundStoreError && error.code === 'too-large'
          ? 'Choose an image smaller than 10 MB.'
          : error instanceof BackgroundStoreError && error.code === 'storage'
            ? 'The background could not be saved on this device.'
            : 'This image could not be opened. Use JPEG, PNG, WebP, GIF or AVIF.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="background-picker">
      <button className="scene-button" disabled={busy} onClick={() => input.current?.click()}>
        <Upload size={15} />
        {t(busy ? 'Opening image…' : selected ? 'Change background image' : 'Upload background image')}
      </button>
      {selected && (
        <button className="scene-button" onClick={onRemove}>
          <X size={15} />
          {t('Remove background image')}
        </button>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void upload(file)
        }}
      />
      <small>{t('Images stay on this device. Maximum 10 MB.')}</small>
    </div>
  )
}
