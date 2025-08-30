import { generateToolMetadata } from '@/lib/metadata'

export const metadata = generateToolMetadata('animation-generator')

export default function AnimationGeneratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
