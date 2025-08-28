import { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

interface FeatureGridProps {
  features: Feature[]
}

export function FeatureGrid({ features }: FeatureGridProps) {
  return (
    <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
      {features.map((feature, index) => (
        <div key={index} className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <div className="text-accent dark:text-accent mb-4">
            <feature.icon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
            {feature.title}
          </h3>
          <p className="text-slate-600 dark:text-slate-300">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  )
}