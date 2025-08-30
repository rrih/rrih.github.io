import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { EmailReveal } from '@/components/ui/email-reveal'
import { aboutPageMetadata, createMetadata } from '@/config/metadata'
import { siteConfig } from '@/config/site'
import type { Metadata } from 'next'

export const metadata: Metadata = createMetadata(aboutPageMetadata)

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Header />
        <main>
          <section className="mb-15">
            <h1 className="mb-3 text-3xl font-semibold tracking-tight">About</h1>
            <p className="text-base leading-relaxed text-foreground-light-secondary dark:text-foreground-dark-secondary">
              Learn more about this project and the developer behind it.
            </p>
          </section>

          <section className="mb-14">
            <h2 className="mb-5 border-b border-border-light pb-2 text-lg font-semibold dark:border-border-dark">
              Project Mission
            </h2>
            <div className="space-y-4 text-base leading-relaxed">
              <p>
                This project aims to provide high-quality web tools that developers and designers
                can rely on. We strive to create a cleaner, faster alternative to existing online
                tools with better user experience and modern design.
              </p>
              <p>
                All tools are built with modern web technologies for maximum performance and
                currently run entirely in your browser. We focus on user experience and data
                efficiency while maintaining flexibility for future enhancements.
              </p>
            </div>
          </section>

          <section className="mb-14">
            <h2 className="mb-5 border-b border-border-light pb-2 text-lg font-semibold dark:border-border-dark">
              Technology Stack
            </h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {[
                'Next.js 15',
                'TypeScript',
                'Tailwind CSS',
                'Bun',
                'Biome',
                'GitHub Pages',
                'GitHub Actions',
              ].map((tech) => (
                <div
                  key={tech}
                  className="rounded-md border border-border-light bg-card-light px-3 py-2 text-center text-sm transition-all hover:-translate-y-0.5 hover:border-accent dark:border-border-dark dark:bg-card-dark"
                >
                  {tech}
                </div>
              ))}
            </div>
          </section>

          <section className="mb-14">
            <h2 className="mb-5 border-b border-border-light pb-2 text-lg font-semibold dark:border-border-dark">
              Developer
            </h2>
            <div className="rounded-lg border border-border-light bg-card-light p-6 dark:border-border-dark dark:bg-card-dark">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">rrih</h3>
                <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                  Web Developer & Tool Creator
                </p>
              </div>
              <p className="mb-4 text-sm leading-relaxed">
                Passionate about creating efficient web tools and leveraging AI-powered development
                workflows. Focused on building privacy-first, high-performance applications that
                solve real-world problems.
              </p>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Education:</strong> Computer Science and Information Engineering (2021)
                </div>
                <div>
                  <strong>Focus:</strong> Frontend Development, Infrastructure, LLM Technology
                  Integration
                </div>
              </div>
            </div>
          </section>

          <section className="mb-14">
            <h2 className="mb-5 border-b border-border-light pb-2 text-lg font-semibold dark:border-border-dark">
              Development Approach
            </h2>
            <div className="grid gap-4">
              {[
                {
                  title: 'AI-Powered Development',
                  description:
                    'Leveraging tools like Claude Code and Gemini for rapid, high-quality implementation',
                },
                {
                  title: 'Privacy-Conscious Design',
                  description:
                    'Currently all processing happens locally in your browser with minimal data footprint',
                },
                {
                  title: 'Performance Focused',
                  description:
                    'Optimized for speed with modern web technologies and best practices',
                },
                {
                  title: 'Open Source',
                  description:
                    'Transparent development with all code available on GitHub for community contribution',
                },
              ].map((approach) => (
                <div
                  key={approach.title}
                  className="rounded-lg border border-border-light bg-card-light p-4 dark:border-border-dark dark:bg-card-dark"
                >
                  <h3 className="mb-2 font-medium">{approach.title}</h3>
                  <p className="text-sm leading-relaxed text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    {approach.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-5 border-b border-border-light pb-2 text-lg font-semibold dark:border-border-dark">
              Contact
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <a
                href={siteConfig.author.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-border-light bg-card-light p-4 transition-all hover:-translate-y-0.5 hover:border-accent dark:border-border-dark dark:bg-card-dark"
              >
                <div className="text-accent">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                    <path d="M9 18c-4.51 2-5-2-7-2" />
                  </svg>
                </div>
                <div className="text-sm">GitHub</div>
              </a>
              <EmailReveal />
              <a
                href={siteConfig.links.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-border-light bg-card-light p-4 transition-all hover:-translate-y-0.5 hover:border-accent dark:border-border-dark dark:bg-card-dark"
              >
                <div className="text-accent">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m16 18 6-6-6-6" />
                    <path d="m8 6-6 6 6 6" />
                  </svg>
                </div>
                <div className="text-sm">Source Code</div>
              </a>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </div>
  )
}
