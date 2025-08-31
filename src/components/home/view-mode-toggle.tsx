'use client'

import { Grid, List } from 'lucide-react'
import { useState } from 'react'

interface ViewModeToggleProps {
  onModeChange: (mode: 'rich' | 'simple') => void
  currentMode: 'rich' | 'simple'
}

export function ViewModeToggle({ onModeChange, currentMode }: ViewModeToggleProps) {
  return (
    <button
      onClick={() => onModeChange(currentMode === 'rich' ? 'simple' : 'rich')}
      className="flex items-center gap-2 rounded-lg border border-border-light dark:border-border-dark px-3 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
      title={currentMode === 'rich' ? 'Switch to Simple View' : 'Switch to Rich View'}
    >
      {currentMode === 'rich' ? (
        <>
          <List className="w-4 h-4" />
          Simple
        </>
      ) : (
        <>
          <Grid className="w-4 h-4" />
          Rich
        </>
      )}
    </button>
  )
}

interface ToolsViewProps {
  tools: any[]
  viewMode: 'rich' | 'simple'
  ToolCard: any
}

export function ToolsView({ tools, viewMode, ToolCard }: ToolsViewProps) {
  if (viewMode === 'rich') {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tools.map((tool) => (
        <a
          key={tool.id}
          href={tool.href}
          className="flex items-center gap-4 p-4 rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark transition-all hover:shadow-lg hover:border-accent"
        >
          <tool.icon className="w-6 h-6 text-accent flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground-light dark:text-foreground-dark">
              {tool.title}
            </h3>
            <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
              {tool.description}
            </p>
          </div>
        </a>
      ))}
    </div>
  )
}
