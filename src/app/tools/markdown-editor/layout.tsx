import { generateToolMetadata } from '@/lib/metadata'

export const metadata = generateToolMetadata('markdown-editor')

export default function MarkdownEditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
