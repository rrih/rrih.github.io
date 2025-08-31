import { getAllBlogPosts, getBlogPostsByTag } from '@/lib/blog'
import { ArrowLeft, Calendar, Clock, Tag } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface TagPageProps {
  params: Promise<{ tag: string }>
}

export async function generateStaticParams() {
  const allPosts = await getAllBlogPosts()
  const allTags = new Set<string>()

  allPosts.forEach((post) => {
    post.tags.forEach((tag) => allTags.add(tag))
  })

  return Array.from(allTags).map((tag) => ({
    tag: encodeURIComponent(tag),
  }))
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params
  const decodedTag = decodeURIComponent(tag)

  return {
    title: `${decodedTag} Articles | Poodware Hub`,
    description: `Browse all articles tagged with "${decodedTag}" in our Web Solutions Hub. Practical guides and expert insights.`,
    openGraph: {
      title: `${decodedTag} Articles | Poodware Hub`,
      description: `Browse all articles tagged with "${decodedTag}" in our Web Solutions Hub. Practical guides and expert insights.`,
      url: `https://rrih.github.io/blog/tag/${tag}`,
      type: 'website',
    },
    alternates: {
      canonical: `https://rrih.github.io/blog/tag/${tag}`,
    },
  }
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params
  const decodedTag = decodeURIComponent(tag)
  const posts = await getBlogPostsByTag(decodedTag)

  if (posts.length === 0) {
    notFound()
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${decodedTag} Articles | Poodware Hub`,
    description: `Articles tagged with "${decodedTag}"`,
    url: `https://rrih.github.io/blog/tag/${tag}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: posts.length,
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          url: `https://rrih.github.io/blog/${post.slug}`,
          datePublished: post.publishedAt,
          author: {
            '@type': 'Organization',
            name: post.author || 'Poodware Team',
          },
        },
      })),
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://rrih.github.io',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Hub',
          item: 'https://rrih.github.io/blog',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: `Tag: ${decodedTag}`,
          item: `https://rrih.github.io/blog/tag/${tag}`,
        },
      ],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="max-w-6xl mx-auto">
        {/* Back Navigation */}
        <nav className="mb-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Hub
          </Link>
        </nav>

        {/* Tag Header */}
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
              <Tag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground-light dark:text-foreground-dark">
                {decodedTag}
              </h1>
              <p className="text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                Articles and guides tagged with "{decodedTag}"
              </p>
            </div>
          </div>

          <div className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
            {posts.length} {posts.length === 1 ? 'article' : 'articles'} found
          </div>
        </header>

        {/* Posts Grid */}
        <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="group relative overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark transition-all hover:shadow-lg"
            >
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
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

                <h2 className="text-xl font-semibold mb-3 text-foreground-light dark:text-foreground-dark group-hover:text-accent transition-colors">
                  <Link href={`/blog/${post.slug}`} className="stretched-link">
                    {post.title}
                  </Link>
                </h2>

                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-4 line-clamp-3">
                  {post.excerpt}
                </p>

                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3 text-foreground-light-secondary dark:text-foreground-dark-secondary" />
                  <div className="flex gap-2 flex-wrap">
                    {post.tags.slice(0, 3).map((postTag) => (
                      <Link
                        key={postTag}
                        href={`/blog/tag/${encodeURIComponent(postTag)}`}
                        className={`text-xs transition-colors ${
                          postTag === decodedTag
                            ? 'text-accent font-medium'
                            : 'text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-accent'
                        }`}
                      >
                        #{postTag}
                      </Link>
                    ))}
                    {post.tags.length > 3 && (
                      <span className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary">
                        +{post.tags.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
