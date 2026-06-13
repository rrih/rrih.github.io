import { generateToolMetadata } from '@/lib/metadata'

export const metadata = generateToolMetadata('overtime-pay-calculator')

export default function OvertimePayCalculatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
