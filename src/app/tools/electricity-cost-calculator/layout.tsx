import { generateToolMetadata } from '@/lib/metadata'

export const metadata = generateToolMetadata('electricity-cost-calculator')

export default function ElectricityCostCalculatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
