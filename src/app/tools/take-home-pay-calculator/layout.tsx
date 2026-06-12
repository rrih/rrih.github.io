import { generateToolMetadata } from '@/lib/metadata'

export const metadata = generateToolMetadata('take-home-pay-calculator')

export default function TakeHomePayCalculatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
