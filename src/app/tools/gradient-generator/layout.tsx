import { generateToolMetadata } from '@/lib/metadata'

export const metadata = generateToolMetadata('gradient-generator')

export default function GradientGeneratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
