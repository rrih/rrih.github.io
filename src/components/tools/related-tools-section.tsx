'use client'

import { relatedToolIdsByToolId } from '@/config/tool-related-links'
import { type Tool, tools } from '@/config/tools'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function getToolIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null
  const match = pathname.match(/^\/(?:[a-z]{2}\/)?tools\/([^/]+)/)
  return match?.[1] ?? null
}

function isAvailableTool(tool: Tool | undefined): tool is Tool {
  return Boolean(tool && tool.status === 'available')
}

export function RelatedToolsSection() {
  const pathname = usePathname()
  const toolId = getToolIdFromPath(pathname)
  if (!toolId) return null

  const relatedIds = relatedToolIdsByToolId[toolId] ?? []
  if (relatedIds.length === 0) return null

  const relatedTools = relatedIds
    .map((id) => tools.find((tool) => tool.id === id))
    .filter(isAvailableTool)

  if (relatedTools.length === 0) return null

  return (
    <section className="mt-16 border-t border-border-light pt-10 dark:border-border-dark">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground-light dark:text-foreground-dark">
            Related Tools
          </h2>
          <p className="mt-2 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
            Continue the same workflow with tools that solve nearby tasks.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {relatedTools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className="group rounded-lg border border-border-light bg-card-light p-4 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-lg dark:border-border-dark dark:bg-card-dark"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
                <tool.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground-light dark:text-foreground-dark">
                {tool.title}
              </h3>
              <p className="mt-2 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                {tool.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
