import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { ToolCard } from '@/components/ui/tool-card'
import { createMetadata, homePageMetadata } from '@/config/metadata'
import { siteConfig } from '@/config/site'
import { tools } from '@/config/tools'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = createMetadata(homePageMetadata)

export default function Home() {
  const featuredTools = tools.filter((tool) => tool.featured)
  const allTools = tools.filter((tool) => !tool.featured)

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Header />

        <main>
          {/* Hero Section */}
          <section className="mb-16 sm:mb-20 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-6 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                {siteConfig.tagline}
              </h1>
              <p className="mb-8 text-lg sm:text-xl text-foreground-light-secondary dark:text-foreground-dark-secondary">
                {siteConfig.description}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="#tools"
                  className="rounded-lg bg-accent px-6 py-4 min-h-[44px] text-white transition-colors hover:bg-accent-dark"
                >
                  Browse Tools
                </Link>
                <Link
                  href="/about"
                  className="rounded-lg border border-border-light px-6 py-4 min-h-[44px] transition-colors hover:border-accent hover:text-accent dark:border-border-dark"
                >
                  About
                </Link>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="mb-16 sm:mb-20">
            <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-semibold">
              Built Different. Built Better.
            </h2>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {siteConfig.features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-border-light bg-card-light p-6 text-center dark:border-border-dark dark:bg-card-dark"
                >
                  <div className="mb-4 flex justify-center">
                    <feature.icon className="h-10 w-10 text-accent" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Featured Tools Section */}
          <section id="tools" className="mb-20">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-3xl font-semibold">Featured Tools</h2>
              <span className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                Most popular
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>

          {/* All Tools Section */}
          {allTools.length > 0 && (
            <section className="mb-20">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-3xl font-semibold">All Tools</h2>
                <span className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  {allTools.length} more tools
                </span>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {allTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          )}

          {/* CTA Section */}
          <section className="rounded-2xl bg-accent/5 p-12 text-center dark:bg-accent/10">
            <h2 className="mb-4 text-3xl font-semibold">Start Creating. Start Sharing.</h2>
            <p className="mb-8 text-foreground-light-secondary dark:text-foreground-dark-secondary">
              Experience the next generation of web tools. Privacy-first, share-ready, beautifully
              designed.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="#tools"
                className="rounded-lg bg-accent px-6 py-3 text-white transition-colors hover:bg-accent-dark"
              >
                Browse All Tools
              </Link>
              <Link
                href={siteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border-light px-6 py-3 transition-colors hover:border-accent hover:text-accent dark:border-border-dark"
              >
                View on GitHub
              </Link>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </div>
  )
}
