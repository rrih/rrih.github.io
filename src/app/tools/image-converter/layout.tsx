import { generateToolMetadata } from '@/lib/metadata'

export const metadata = generateToolMetadata('image-converter')

export default function ImageConverterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
