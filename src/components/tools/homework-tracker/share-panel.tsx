'use client'

import { BottomSheet } from '@/components/tools/timetable/bottom-sheet'
import { Copy, Download, Printer, QrCode, Share2 } from 'lucide-react'

interface SharePanelProps {
  open: boolean
  shareUrl: string
  qrCodeDataUrl: string
  urlLength: number
  onClose: () => void
  onCopy: () => void
  onNativeShare: () => void
  onExportImage: () => void
  onPrint: () => void
}

function getUrlMeterTone(urlLength: number) {
  if (urlLength > 1800) {
    return 'bg-rose-500'
  }

  if (urlLength > 1200) {
    return 'bg-amber-500'
  }

  return 'bg-emerald-500'
}

export function SharePanel({
  open,
  shareUrl,
  qrCodeDataUrl,
  urlLength,
  onClose,
  onCopy,
  onNativeShare,
  onExportImage,
  onPrint,
}: SharePanelProps) {
  return (
    <BottomSheet
      open={open}
      title="共有と出力"
      subtitle="課題一覧はURLだけで共有できます。"
      onClose={onClose}
    >
      <div className="space-y-4 pb-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
            <span>共有URLの長さ</span>
            <span>{urlLength} 文字</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-200">
            <div
              className={`h-2 rounded-full ${getUrlMeterTone(urlLength)}`}
              style={{ width: `${Math.min(100, (urlLength / 1800) * 100)}%` }}
            />
          </div>
          <p className="mt-3 break-all text-xs text-slate-500">{shareUrl}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-dark"
          >
            <Copy className="h-4 w-4" />
            URLをコピー
          </button>
          <button
            type="button"
            onClick={onNativeShare}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent"
          >
            <Share2 className="h-4 w-4" />
            共有する
          </button>
          <button
            type="button"
            onClick={onExportImage}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent"
          >
            <Download className="h-4 w-4" />
            画像で保存
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent"
          >
            <Printer className="h-4 w-4" />
            印刷する
          </button>
        </div>

        {qrCodeDataUrl && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
              <QrCode className="h-4 w-4" />
              QRコード
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCodeDataUrl}
              alt="共有用QRコード"
              className="mx-auto h-44 w-44 rounded-2xl border border-slate-100 bg-white p-2"
            />
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
