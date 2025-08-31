import { BackToTop } from '@/components/blog/back-to-top'
import { BreadcrumbNav } from '@/components/blog/breadcrumb-nav'
import { getAllBlogPosts } from '@/lib/blog'
import { Calendar, Clock, Tag } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'All Articles | Poodware Web Solutions Hub',
  description:
    'Browse all articles in our web solutions hub. Find guides, tutorials, and insights for your digital challenges.',
  openGraph: {
    title: 'All Articles | Poodware Web Solutions Hub',
    description:
      'Browse all articles in our web solutions hub. Find guides, tutorials, and insights for your digital challenges.',
    url: 'https://rrih.github.io/blog/articles',
  },
}

export default async function ArticlesPage() {
  const posts = await getAllBlogPosts()

  return (
    <div className="max-w-6xl mx-auto">
      <BreadcrumbNav
        items={[{ label: 'Web Solutions Hub', href: '/blog' }, { label: 'All Articles' }]}
      />

      {/* Header */}
      <header className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground-light dark:text-foreground-dark mb-4">
          All Articles
        </h1>
        <p className="text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary mb-4">
          Complete collection of web solutions, guides, and insights
        </p>
        <div className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
          {posts.length} {posts.length === 1 ? 'article' : 'articles'} available
        </div>
      </header>

      {/* Articles List */}
      <div className="space-y-6">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="border-b border-border-light dark:border-border-dark pb-6 last:border-b-0"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                  {post.category}
                </span>
                {post.featured && (
                  <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    Featured
                  </span>
                )}
              </div>
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

            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground-light dark:text-foreground-dark">
              <Link href={`/blog/${post.slug}`} className="hover:text-accent transition-colors">
                {post.title}
              </Link>
            </h2>

            <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-4 leading-relaxed">
              {post.excerpt}
            </p>

            <div className="flex items-center gap-2">
              <Tag className="w-3 h-3 text-foreground-light-secondary dark:text-foreground-dark-secondary" />
              <div className="flex gap-2 flex-wrap">
                {post.tags.slice(0, 5).map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog/tag/${tag}`}
                    className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-accent transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
                {post.tags.length > 5 && (
                  <span className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    +{post.tags.length - 5} more
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Back to Top */}
      <div className="mt-16 text-center">
        <BackToTop />
      </div>
    </div>
  )
}
