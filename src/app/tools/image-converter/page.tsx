'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { useHistory } from '@/hooks/useHistory'
import { localStorageManager } from '@/lib/localStorage'
import { useUrlSharing } from '@/lib/urlSharing'
import {
  Download,
  FileImage,
  ImageIcon,
  Loader2,
  Redo2,
  Settings,
  Share2,
  Trash2,
  Undo2,
  Upload,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface ImageFile {
  id: string
  name: string
  originalFormat: string
  size: number
  dataUrl: string
  convertedDataUrl?: string
  convertedSize?: number
}

interface ImageConverterState {
  images: ImageFile[]
  outputFormat: 'jpeg' | 'png' | 'webp' | 'avif'
  quality: number
  maxWidth: number
  maxHeight: number
  maintainAspectRatio: boolean
  resizeEnabled: boolean
}

export default function ImageConverterPage() {
  const TOOL_NAME = 'image-converter'

  const defaultState: ImageConverterState = {
    images: [],
    outputFormat: 'webp',
    quality: 80,
    maxWidth: 1920,
    maxHeight: 1080,
    maintainAspectRatio: true,
    resizeEnabled: false,
  }

  const {
    state,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
  } = useHistory<ImageConverterState>(defaultState)

  const [isProcessing, setIsProcessing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { generateShareUrl, shareInfo, getInitialStateFromUrl } =
    useUrlSharing<ImageConverterState>(TOOL_NAME)

  const { images, outputFormat, quality, maxWidth, maxHeight, maintainAspectRatio, resizeEnabled } =
    state

  // Client-side only state restoration
  useEffect(() => {
    const sharedState = getInitialStateFromUrl()
    if (sharedState) {
      setHistoryState(sharedState)
      return
    }

    const savedState = localStorageManager.load<ImageConverterState>(TOOL_NAME)
    if (savedState) {
      setHistoryState(savedState)
    }
  }, [getInitialStateFromUrl, setHistoryState])

  // Save state to localStorage
  useEffect(() => {
    localStorageManager.save(TOOL_NAME, state)
  }, [state])

  // URL sharing
  const handleShare = async () => {
    setIsSharing(true)
    try {
      const shareUrl = await generateShareUrl(state)
      await navigator.clipboard.writeText(shareUrl)

      const message = 'Share URL copied!'
      let description = 'The shareable URL has been copied to your clipboard'

      if (shareInfo.isLimited) {
        description = shareInfo.message
      }

      successToast(message, description)
    } catch (error) {
      console.error('Share failed:', error)
      errorToast('Sharing failed', 'An error occurred while generating the share URL')
    } finally {
      setIsSharing(false)
    }
  }

  // Clear data
  const handleClearData = () => {
    if (confirm('Clear all images and settings?')) {
      localStorageManager.clear(TOOL_NAME)
      clearHistory()
      setHistoryState(defaultState)
    }
  }

  // Export data
  const handleExportData = () => {
    if (images.length === 0) {
      errorToast('No images', 'Add images to export')
      return
    }

    const data = {
      images: images.map((img) => ({
        name: img.name,
        originalFormat: img.originalFormat,
        size: img.size,
        convertedSize: img.convertedSize,
      })),
      settings: {
        outputFormat,
        quality,
        maxWidth,
        maxHeight,
        maintainAspectRatio,
        resizeEnabled,
      },
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `image-converter-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      const imageFiles = fileArray.filter((file) => file.type.startsWith('image/'))

      if (imageFiles.length === 0) {
        errorToast('No valid images', 'Please select valid image files')
        return
      }

      const newImages: ImageFile[] = []
      let processedCount = 0

      imageFiles.forEach((file, index) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string
          const newImage: ImageFile = {
            id: `${Date.now()}-${index}`,
            name: file.name,
            originalFormat: file.type.split('/')[1],
            size: file.size,
            dataUrl,
          }
          newImages.push(newImage)
          processedCount++

          if (processedCount === imageFiles.length) {
            setHistoryState((prev) => ({
              ...prev,
              images: [...prev.images, ...newImages],
            }))
          }
        }
        reader.readAsDataURL(file)
      })
    },
    [setHistoryState, errorToast]
  )

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files)
      }
    },
    [handleFileSelect]
  )

  // Convert image
  const convertImage = useCallback(
    async (image: ImageFile): Promise<ImageFile> => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')

            if (!ctx) {
              reject(new Error('Canvas context not available'))
              return
            }

            let { width, height } = img

            // Apply resizing if enabled
            if (resizeEnabled) {
              const aspectRatio = width / height

              if (maintainAspectRatio) {
                if (width > maxWidth) {
                  width = maxWidth
                  height = width / aspectRatio
                }
                if (height > maxHeight) {
                  height = maxHeight
                  width = height * aspectRatio
                }
              } else {
                width = Math.min(width, maxWidth)
                height = Math.min(height, maxHeight)
              }
            }

            canvas.width = width
            canvas.height = height

            // Draw image on canvas
            ctx.drawImage(img, 0, 0, width, height)

            // Convert to desired format
            const mimeType = `image/${outputFormat}`
            const qualityValue = outputFormat === 'png' ? undefined : quality / 100

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const reader = new FileReader()
                  reader.onload = () => {
                    const convertedDataUrl = reader.result as string
                    const convertedImage: ImageFile = {
                      ...image,
                      convertedDataUrl,
                      convertedSize: blob.size,
                    }
                    resolve(convertedImage)
                  }
                  reader.readAsDataURL(blob)
                } else {
                  reject(new Error('Failed to convert image'))
                }
              },
              mimeType,
              qualityValue
            )
          } catch (error) {
            reject(error)
          }
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = image.dataUrl
      })
    },
    [outputFormat, quality, maxWidth, maxHeight, maintainAspectRatio, resizeEnabled]
  )

  // Convert all images
  const handleConvertAll = async () => {
    if (images.length === 0) {
      errorToast('No images', 'Add images to convert')
      return
    }

    setIsProcessing(true)
    setProcessingProgress(0)

    try {
      const convertedImages: ImageFile[] = []

      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        const convertedImage = await convertImage(image)
        convertedImages.push(convertedImage)
        setProcessingProgress(((i + 1) / images.length) * 100)

        // Add small delay for UI feedback
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      setHistoryState((prev) => ({
        ...prev,
        images: convertedImages,
      }))

      successToast(
        'Conversion complete!',
        `${convertedImages.length} images converted successfully`
      )
    } catch (error) {
      console.error('Conversion failed:', error)
      errorToast('Conversion failed', 'An error occurred during image conversion')
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
    }
  }

  // Download single image
  const downloadImage = (image: ImageFile) => {
    if (!image.convertedDataUrl) {
      errorToast('Not converted', 'Convert the image first')
      return
    }

    const link = document.createElement('a')
    link.href = image.convertedDataUrl
    link.download = `${image.name.split('.')[0]}.${outputFormat}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download all images
  const downloadAllImages = async () => {
    const convertedImages = images.filter((img) => img.convertedDataUrl)

    if (convertedImages.length === 0) {
      errorToast('No converted images', 'Convert images first')
      return
    }

    // For multiple images, create a zip (simplified - just download individually)
    convertedImages.forEach((image, index) => {
      setTimeout(() => downloadImage(image), index * 500)
    })

    successToast('Download started', `${convertedImages.length} images downloading`)
  }

  // Remove image
  const removeImage = (imageId: string) => {
    setHistoryState((prev) => ({
      ...prev,
      images: prev.images.filter((img) => img.id !== imageId),
    }))
  }

  // Clear all images
  const clearAllImages = () => {
    setHistoryState((prev) => ({
      ...prev,
      images: [],
    }))
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }

  // Calculate compression ratio
  const getCompressionRatio = (original: number, converted: number): string => {
    if (!converted) return ''
    const ratio = ((original - converted) / original) * 100
    return ratio > 0 ? `-${ratio.toFixed(1)}%` : `+${Math.abs(ratio).toFixed(1)}%`
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 py-3 xs:py-4 py-5">
        <Header />

        <main>
          {/* Hero Section */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-2 xs:mb-3 sm:mb-4 text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                Image Converter & Optimizer
              </h1>
              <p className="mb-4 xs:mb-6 text-sm xs:text-base sm:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary px-2 xs:px-0">
                Convert images to modern formats like WebP and AVIF with compression and resizing.
              </p>
            </div>
          </section>

          {/* Controls */}
          <section className="mb-6">
            <div className="rounded-lg border border-border-light bg-card-light p-3 sm:p-4 md:p-6 dark:border-border-dark dark:bg-card-dark">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Format Settings */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Conversion Settings
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Output Format */}
                    <div>
                      <label htmlFor="output-format" className="text-sm font-medium mb-2 block">
                        Output Format
                      </label>
                      <select
                        id="output-format"
                        value={outputFormat}
                        onChange={(e) =>
                          setHistoryState({
                            ...state,
                            outputFormat: e.target.value as 'jpeg' | 'png' | 'webp' | 'avif',
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                      >
                        <option value="webp">WebP (Recommended)</option>
                        <option value="avif">AVIF (Best compression)</option>
                        <option value="jpeg">JPEG</option>
                        <option value="png">PNG</option>
                      </select>
                    </div>

                    {/* Quality */}
                    {outputFormat !== 'png' && (
                      <div>
                        <label htmlFor="quality" className="text-sm font-medium mb-2 block">
                          Quality: {quality}%
                        </label>
                        <input
                          id="quality"
                          type="range"
                          min="10"
                          max="100"
                          value={quality}
                          onChange={(e) =>
                            setHistoryState({
                              ...state,
                              quality: Number(e.target.value),
                            })
                          }
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                      </div>
                    )}

                    {/* Resize Toggle */}
                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resizeEnabled}
                          onChange={(e) =>
                            setHistoryState({
                              ...state,
                              resizeEnabled: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-accent rounded"
                        />
                        <span className="text-sm font-medium">Enable resizing</span>
                      </label>
                    </div>

                    {/* Resize Settings */}
                    {resizeEnabled && (
                      <>
                        <div>
                          <label htmlFor="max-width" className="text-sm font-medium mb-2 block">
                            Max Width (px)
                          </label>
                          <input
                            id="max-width"
                            type="number"
                            min="1"
                            max="4096"
                            value={maxWidth}
                            onChange={(e) =>
                              setHistoryState({
                                ...state,
                                maxWidth: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                          />
                        </div>

                        <div>
                          <label htmlFor="max-height" className="text-sm font-medium mb-2 block">
                            Max Height (px)
                          </label>
                          <input
                            id="max-height"
                            type="number"
                            min="1"
                            max="4096"
                            value={maxHeight}
                            onChange={(e) =>
                              setHistoryState({
                                ...state,
                                maxHeight: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-background-dark"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={maintainAspectRatio}
                              onChange={(e) =>
                                setHistoryState({
                                  ...state,
                                  maintainAspectRatio: e.target.checked,
                                })
                              }
                              className="w-4 h-4 text-accent rounded"
                            />
                            <span className="text-sm">Maintain aspect ratio</span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 min-w-48">
                  <button
                    onClick={handleConvertAll}
                    disabled={isProcessing || images.length === 0}
                    className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 min-h-[44px] text-white font-medium text-sm transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Converting... {Math.round(processingProgress)}%
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Convert All
                      </>
                    )}
                  </button>

                  <button
                    onClick={downloadAllImages}
                    disabled={images.filter((img) => img.convertedDataUrl).length === 0}
                    className="flex items-center justify-center gap-2 rounded-lg border border-border-light px-4 py-3 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark"
                  >
                    <Download className="w-4 h-4" />
                    Download All
                  </button>

                  <button
                    onClick={handleShare}
                    disabled={isSharing || images.length === 0}
                    className="flex items-center justify-center gap-2 rounded-lg border border-border-light px-4 py-3 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark"
                  >
                    <Share2 className="w-4 h-4" />
                    {isSharing ? 'Sharing...' : 'Share'}
                  </button>

                  <button
                    onClick={handleExportData}
                    disabled={images.length === 0}
                    className="flex items-center justify-center gap-2 rounded-lg border border-border-light px-4 py-3 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark"
                  >
                    <Download className="w-4 h-4" />
                    Export Data
                  </button>

                  <button
                    onClick={handleClearData}
                    className="flex items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-3 min-h-[44px] font-medium text-sm text-red-600 transition-all hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={undo}
                      disabled={!canUndo}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border-light px-3 py-2 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark"
                    >
                      <Undo2 className="w-4 h-4" />
                      Undo
                    </button>
                    <button
                      onClick={redo}
                      disabled={!canRedo}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border-light px-3 py-2 min-h-[44px] font-medium text-sm transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-border-dark"
                    >
                      <Redo2 className="w-4 h-4" />
                      Redo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Upload Area */}
          <section className="mb-6">
            <div
              className={`rounded-lg border-2 border-dashed p-8 text-center transition-all ${
                dragActive
                  ? 'border-accent bg-accent/10'
                  : 'border-border-light dark:border-border-dark hover:border-accent'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-4">
                <Upload className="w-12 h-12 text-gray-400" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Drop images here or click to upload
                  </h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mb-4">
                    Supports JPEG, PNG, WebP, GIF, and other common formats
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg bg-accent px-6 py-2 text-white font-medium text-sm transition-all hover:bg-accent-dark hover:shadow-lg active:scale-95"
                  >
                    Choose Files
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Images Grid */}
          {images.length > 0 && (
            <section className="mb-8 sm:mb-12 md:mb-16">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Images ({images.length})</h2>
                <button
                  onClick={clearAllImages}
                  className="text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  Clear all images
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg"
                  >
                    {/* Image Preview */}
                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                      <img
                        src={image.convertedDataUrl || image.dataUrl}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                      {image.convertedDataUrl && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                          Converted
                        </div>
                      )}
                    </div>

                    {/* Image Info */}
                    <div className="p-4">
                      <h3 className="font-medium mb-2 truncate" title={image.name}>
                        {image.name}
                      </h3>

                      <div className="space-y-1 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        <div className="flex justify-between">
                          <span>Format:</span>
                          <span className="uppercase font-mono">
                            {image.originalFormat} →{' '}
                            {image.convertedDataUrl ? outputFormat : image.originalFormat}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Size:</span>
                          <span className="font-mono">
                            {formatFileSize(image.size)}
                            {image.convertedSize && (
                              <>
                                {' → '}
                                {formatFileSize(image.convertedSize)}
                                <span
                                  className={`ml-1 ${
                                    image.convertedSize < image.size
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {getCompressionRatio(image.size, image.convertedSize)}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => downloadImage(image)}
                          disabled={!image.convertedDataUrl}
                          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-white text-sm font-medium transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </button>
                        <button
                          onClick={() => removeImage(image.id)}
                          className="rounded-lg border border-red-300 px-3 py-2 text-red-600 text-sm font-medium transition-all hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Features Section */}
          <section className="hidden xs:block mb-8 sm:mb-12 md:mb-16">
            <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
              Why Use Our Image Converter?
            </h2>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Zap,
                  title: 'Modern Formats',
                  description:
                    'Convert to WebP and AVIF for up to 80% smaller file sizes with better quality.',
                },
                {
                  icon: ImageIcon,
                  title: 'Batch Processing',
                  description:
                    'Convert multiple images simultaneously with consistent settings and quality.',
                },
                {
                  icon: Settings,
                  title: 'Full Control',
                  description:
                    'Customize quality, resize dimensions, and format options for perfect results.',
                },
              ].map((feature, index) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-border-light bg-card-light p-6 text-center dark:border-border-dark dark:bg-card-dark transition-all hover:-translate-y-1 hover:shadow-lg"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.6s ease-out forwards',
                  }}
                >
                  <div className="mb-4 flex justify-center">
                    <feature.icon className="h-10 w-10 text-accent transition-transform hover:scale-110" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Content Sections for SEO */}
          <section className="mb-8 sm:mb-12 md:mb-16 border-t border-border-light dark:border-border-dark pt-8 sm:pt-12">
            {/* About This Tool */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                About Image Converter
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Our Image Converter is a powerful, browser-based tool that transforms your images
                  into modern, web-optimized formats like WebP and AVIF. These next-generation
                  formats provide significantly better compression than traditional JPEG and PNG,
                  often reducing file sizes by 50-80% while maintaining or even improving visual
                  quality. This makes your websites load faster, reduces bandwidth costs, and
                  improves user experience across all devices.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Built with the latest web technologies, our converter runs entirely in your
                  browser using the HTML5 Canvas API and modern JavaScript. This means your images
                  never leave your device - they're processed locally, ensuring complete privacy and
                  security. The tool supports batch processing, allowing you to convert dozens of
                  images simultaneously with consistent quality settings, saving you valuable time
                  in your workflow.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                  Whether you're a web developer optimizing site performance, a blogger preparing
                  images for publication, or a business owner reducing storage costs, our Image
                  Converter provides professional-grade results with an intuitive interface. The
                  tool also includes intelligent resizing options that maintain aspect ratios and
                  prevent image distortion.
                </p>
              </div>
            </div>

            {/* How to Use */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                How to Use
              </h2>
              <div className="space-y-4">
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 1: Upload Your Images</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Drag and drop images directly onto the upload area, or click "Choose Files" to
                    select multiple images from your computer. Supports all common formats including
                    JPEG, PNG, GIF, WebP, and more.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">
                    Step 2: Configure Conversion Settings
                  </h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Choose your desired output format (WebP recommended for best balance of size and
                    quality, AVIF for maximum compression). Adjust quality settings and enable
                    resizing if needed to fit specific dimensions.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 3: Convert and Preview</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Click "Convert All" to process your images. Preview the results, compare file
                    sizes, and see compression ratios. The tool shows original vs. converted sizes
                    to help you understand the space savings.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 4: Download Results</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Download individual converted images or use "Download All" to get all converted
                    files at once. Share your settings with others using the share feature.
                  </p>
                </div>
              </div>
            </div>

            {/* Key Features */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Key Features
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Modern Format Support</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Convert to WebP, AVIF, and other modern formats that provide superior
                    compression and quality.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Batch Processing</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Convert multiple images simultaneously with progress tracking and consistent
                    quality settings.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Quality Control</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Adjust compression quality from 10% to 100% to find the perfect balance of size
                    and quality.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Smart Resizing</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Resize images with aspect ratio preservation to fit specific dimensions without
                    distortion.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Privacy Protected</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    All processing happens in your browser. Images are never uploaded to servers or
                    stored online.
                  </p>
                </div>
                <div className="rounded-lg bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark">
                  <h3 className="font-semibold mb-2">Real-time Preview</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    See converted images instantly with file size comparisons and compression
                    ratios.
                  </p>
                </div>
              </div>
            </div>

            {/* Examples */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Examples
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Example 1: Website Optimization</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <p className="text-sm mb-2">
                      Scenario: Converting product photos for an e-commerce site
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-semibold mb-1">Before (JPEG):</p>
                        <p>Size: 2.4 MB, 1920×1080px</p>
                        <p>Format: JPEG, Quality: 95%</p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">After (WebP):</p>
                        <p>Size: 486 KB (-80%), 1920×1080px</p>
                        <p>Format: WebP, Quality: 85%</p>
                      </div>
                    </div>
                    <p className="text-sm mt-2 text-green-600 dark:text-green-400">
                      Result: 80% smaller files with nearly identical visual quality
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Example 2: Blog Post Images</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <p className="text-sm mb-2">
                      Scenario: Optimizing blog images for faster loading
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-semibold mb-1">Before (PNG):</p>
                        <p>Size: 1.8 MB, 1200×800px</p>
                        <p>Format: PNG, Lossless</p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">After (AVIF):</p>
                        <p>Size: 280 KB (-84%), 800×533px</p>
                        <p>Format: AVIF, Quality: 80%</p>
                      </div>
                    </div>
                    <p className="text-sm mt-2 text-green-600 dark:text-green-400">
                      Result: 84% size reduction with resizing for perfect blog layout
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Example 3: Social Media Preparation</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <p className="text-sm mb-2">
                      Scenario: Batch converting photos for social media
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-semibold mb-1">Before (Mixed formats):</p>
                        <p>20 images, 45 MB total</p>
                        <p>Formats: JPEG, PNG, various sizes</p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">After (WebP):</p>
                        <p>20 images, 8.2 MB total (-82%)</p>
                        <p>Format: WebP, 1080×1080px square</p>
                      </div>
                    </div>
                    <p className="text-sm mt-2 text-green-600 dark:text-green-400">
                      Result: Consistent format and size, 82% storage savings
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What are WebP and AVIF formats?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    WebP and AVIF are modern image formats that provide superior compression
                    compared to JPEG and PNG. WebP typically reduces file sizes by 25-50% while AVIF
                    can achieve 50-80% smaller files with the same or better visual quality. Both
                    formats are supported by all modern browsers.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Are my images uploaded to your servers?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    No, all image processing happens entirely in your browser using HTML5 Canvas and
                    JavaScript. Your images are never uploaded, transmitted, or stored on our
                    servers. This ensures complete privacy and security for your files.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    What's the maximum file size supported?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    The tool can handle images up to several hundred megabytes, limited primarily by
                    your device's available memory. For optimal performance, we recommend images
                    under 50MB. Very large images may take longer to process.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Which quality setting should I use?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    For most web use, 80-85% quality provides excellent results with significant
                    size savings. For photography or detailed images, try 90-95%. For thumbnails or
                    less critical images, 60-75% can dramatically reduce file sizes with acceptable
                    quality.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I convert images back to JPEG or PNG?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Yes, our tool supports conversion to traditional formats as well. You can
                    convert WebP or AVIF files back to JPEG or PNG if needed for compatibility with
                    older systems or specific use cases.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Does resizing reduce image quality?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Our tool uses high-quality resampling algorithms that preserve as much detail as
                    possible. When downsizing images, quality is generally well-preserved. The
                    "maintain aspect ratio" option prevents distortion by automatically adjusting
                    dimensions proportionally.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Why should I use WebP over JPEG?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    WebP provides 25-50% better compression than JPEG while maintaining similar
                    visual quality. It supports both lossy and lossless compression, transparency
                    (like PNG), and animation (like GIF). All modern browsers support WebP, making
                    it ideal for web optimization.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I process RAW camera files?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Currently, the tool supports standard web image formats (JPEG, PNG, GIF, WebP,
                    etc.) but not RAW camera formats like CR2, NEF, or ARW. You'll need to export
                    RAW files to JPEG or TIFF first using photo editing software.
                  </p>
                </details>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
