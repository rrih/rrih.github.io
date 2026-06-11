import AnimationGeneratorPage from '@/app/tools/animation-generator/page'
import Base64Page from '@/app/tools/base64/page'
import BoxShadowGeneratorPage from '@/app/tools/box-shadow-generator/page'
import ColorPickerPage from '@/app/tools/color-picker/page'
import ElectricityCostCalculatorPage from '@/app/tools/electricity-cost-calculator/page'
import GradientGeneratorPage from '@/app/tools/gradient-generator/page'
import HomeworkTrackerPage from '@/app/tools/homework-tracker/page'
import ImageConverterPage from '@/app/tools/image-converter/page'
import InvestmentCalculatorPage from '@/app/tools/investment-calculator/page'
import JsonFormatterPage from '@/app/tools/json-formatter/page'
import MarkdownEditorPage from '@/app/tools/markdown-editor/page'
import PasswordGeneratorPage from '@/app/tools/password-generator/page'
import QrGeneratorPage from '@/app/tools/qr-generator/page'
import TimetablePage from '@/app/tools/timetable/page'
import UuidGeneratorPage from '@/app/tools/uuid-generator/page'
import { generateToolMetadata } from '@/config/metadata'
import { tools } from '@/config/tools'
import { type Locale, isLocale, localizeMetadata } from '@/lib/i18n'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const toolPages = {
  'animation-generator': AnimationGeneratorPage,
  base64: Base64Page,
  'box-shadow-generator': BoxShadowGeneratorPage,
  'color-picker': ColorPickerPage,
  'electricity-cost-calculator': ElectricityCostCalculatorPage,
  'gradient-generator': GradientGeneratorPage,
  'homework-tracker': HomeworkTrackerPage,
  'image-converter': ImageConverterPage,
  'investment-calculator': InvestmentCalculatorPage,
  'json-formatter': JsonFormatterPage,
  'markdown-editor': MarkdownEditorPage,
  'password-generator': PasswordGeneratorPage,
  'qr-generator': QrGeneratorPage,
  timetable: TimetablePage,
  'uuid-generator': UuidGeneratorPage,
} as const

type ToolId = keyof typeof toolPages

export const dynamicParams = false

export function generateStaticParams() {
  return tools.map((tool) => ({ tool: tool.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; tool: string }>
}): Promise<Metadata> {
  const { locale, tool } = await params
  const resolvedLocale: Locale = isLocale(locale) ? locale : 'ja'

  if (!(tool in toolPages)) {
    return localizeMetadata({ title: 'Tool Not Found' }, resolvedLocale, `/tools/${tool}`)
  }

  const baseMetadata =
    tool === 'timetable'
      ? {
          ...generateToolMetadata(tool),
          applicationName: 'Timetable Share',
          manifest: '/tools/timetable/manifest.webmanifest',
          appleWebApp: {
            capable: true,
            statusBarStyle: 'default' as const,
            title: 'Timetable Share',
          },
          other: {
            'apple-mobile-web-app-capable': 'yes',
          },
        }
      : generateToolMetadata(tool)

  return localizeMetadata(baseMetadata, resolvedLocale, `/tools/${tool}`)
}

export default async function LocalizedToolPage({
  params,
}: {
  params: Promise<{ tool: string }>
}) {
  const { tool } = await params

  if (!(tool in toolPages)) {
    notFound()
  }

  const ToolPage = toolPages[tool as ToolId]
  return <ToolPage />
}
