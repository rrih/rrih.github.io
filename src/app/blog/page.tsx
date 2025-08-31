import { ArrowRight, BookOpen, Calendar, Clock, Lightbulb, Tag, Target, Wrench } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Web Solutions Hub - Tools, Guides & Digital Insights | Poodware',
  description:
    'Discover practical guides, tool tutorials, and digital solutions for businesses, marketers, and creators. Expert insights for modern web challenges.',
  openGraph: {
    title: 'Web Solutions Hub | Poodware',
    description:
      'Discover practical guides, tool tutorials, and digital solutions for businesses, marketers, and creators. Expert insights for modern web challenges.',
    url: 'https://rrih.github.io/blog',
    images: [
      {
        url: '/og/blog-home.png',
        width: 1200,
        height: 630,
        alt: 'Poodware Web Solutions Hub',
      },
    ],
  },
}

// Temporary mock data - will be replaced with dynamic content
const featuredPosts = [
  {
    slug: 'generate-qr-codes-for-your-business',
    title: 'How to Generate QR Codes for Your Business (Free & Easy Guide)',
    excerpt:
      'Create professional QR codes for your business in seconds. Boost customer engagement with QR menus, contact cards, reviews, and more. No technical skills required.',
    category: 'guides',
    readTime: '8 min read',
    publishedAt: '2025-08-31',
    featured: true,
    tags: ['qr-code', 'business', 'marketing'],
  },
  {
    slug: 'how-to-format-messy-json-data',
    title: 'How to Format Messy JSON Data Like a Pro (2025 Complete Guide)',
    excerpt:
      'Transform unreadable JSON into beautifully formatted, validated data. Learn professional techniques, common errors, and best practices for clean JSON.',
    category: 'tutorials',
    readTime: '7 min read',
    publishedAt: '2025-08-31',
    featured: true,
    tags: ['json', 'formatting', 'data'],
  },
]

const categories = [
  {
    name: 'Tutorials',
    slug: 'tutorials',
    description: 'Step-by-step guides and practical implementations',
    count: 8,
    color: 'bg-blue-500',
    icon: BookOpen,
  },
  {
    name: 'Guides',
    slug: 'guides',
    description: 'Comprehensive solutions for common challenges',
    count: 5,
    color: 'bg-green-500',
    icon: Target,
  },
  {
    name: 'Insights',
    slug: 'insights',
    description: 'Industry trends and expert perspectives',
    count: 3,
    color: 'bg-purple-500',
    icon: Lightbulb,
  },
  {
    name: 'Tools',
    slug: 'tools',
    description: 'Tool guides and productivity solutions',
    count: 6,
    color: 'bg-orange-500',
    icon: Wrench,
  },
]

export default function BlogPage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground-light dark:text-foreground-dark">
          Web Solutions Hub
        </h1>
        <p className="text-lg sm:text-xl text-foreground-light-secondary dark:text-foreground-dark-secondary max-w-3xl mx-auto">
          Practical guides, expert tutorials, and digital solutions for businesses, creators, and
          everyday users. Transform your web challenges into opportunities.
        </p>
      </section>

      {/* Featured Posts */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-foreground-light dark:text-foreground-dark">
          Featured Articles
        </h2>
        <div className="grid gap-8 lg:grid-cols-2">
          {featuredPosts.map((post) => (
            <article
              key={post.slug}
              className="group relative overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark transition-all hover:shadow-lg"
            >
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                    {post.category}
                  </span>
                  <div className="flex items-center gap-4 text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.readTime}
                    </div>
                  </div>
                </div>

                <h4 className="text-xl font-semibold mb-3 text-foreground-light dark:text-foreground-dark group-hover:text-accent transition-colors">
                  <Link href={`/blog/${post.slug}`} className="stretched-link">
                    {post.title}
                  </Link>
                </h4>

                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-4 line-clamp-3">
                  {post.excerpt}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3 h-3 text-foreground-light-secondary dark:text-foreground-dark-secondary" />
                    <div className="flex gap-2">
                      {post.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-accent transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Browse All Articles Link */}
      <section className="text-center mb-8">
        <Link
          href="/blog/articles"
          className="inline-flex items-center gap-2 rounded-lg bg-accent/10 px-6 py-3 text-accent hover:bg-accent/20 transition-colors font-medium"
        >
          View All Articles
        </Link>
      </section>

      {/* Categories */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-foreground-light dark:text-foreground-dark">
          Explore Solutions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/blog/category/${category.slug}`}
              className="group relative overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6 transition-all hover:shadow-lg"
            >
              <div
                className={`w-12 h-12 rounded-lg ${category.color} mb-4 flex items-center justify-center`}
              >
                <category.icon className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold mb-2 text-foreground-light dark:text-foreground-dark group-hover:text-accent transition-colors">
                {category.name}
              </h4>
              <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mb-2">
                {category.description}
              </p>
              <div className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
                {category.count} articles
              </div>
              <ArrowRight className="w-4 h-4 text-accent absolute top-6 right-6 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
