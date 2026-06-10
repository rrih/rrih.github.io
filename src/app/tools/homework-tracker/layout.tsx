import { generateToolMetadata } from '@/lib/metadata'

export const metadata = generateToolMetadata('homework-tracker')

export default function HomeworkTrackerLayout({ children }: { children: React.ReactNode }) {
  return children
}
