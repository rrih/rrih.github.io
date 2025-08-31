import { generateToolMetadata } from '@/lib/metadata'

export const metadata = generateToolMetadata('qr-generator')

export default function QRGeneratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
