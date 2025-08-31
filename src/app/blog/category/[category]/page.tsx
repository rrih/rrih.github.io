import { BreadcrumbNav } from '@/components/blog/breadcrumb-nav'
import { getBlogPostsByCategory } from '@/lib/blog'
import { BookOpen, Calendar, Clock, Lightbulb, Tag, Target, Wrench } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface CategoryPageProps {
  params: Promise<{ category: string }>
}

export async function generateStaticParams() {
  return [
    { category: 'tutorials' },
    { category: 'guides' },
    { category: 'insights' },
    { category: 'tools' },
  ]
}

const categoryInfo = {
  tutorials: {
    title: 'Tutorials',
    description: 'Step-by-step guides and practical implementations for modern web development',
    color: 'bg-blue-500',
    icon: BookOpen,
  },
  guides: {
    title: 'Guides',
    description: 'Comprehensive deep-dives into complex topics and best practices',
    color: 'bg-green-500',
    icon: Target,
  },
  insights: {
    title: 'Insights',
    description: 'Industry analysis, technical perspectives, and thought leadership',
    color: 'bg-purple-500',
    icon: Lightbulb,
  },
  tools: {
    title: 'Tools',
    description: 'Developer productivity, workflow optimization, and tool reviews',
    color: 'bg-orange-500',
    icon: Wrench,
  },
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params
  const categoryData = categoryInfo[category as keyof typeof categoryInfo]

  if (!categoryData) {
    return {
      title: 'Category Not Found',
    }
  }

  return {
    title: `${categoryData.title} | Poodware Blog`,
    description: `${categoryData.description}. Browse all ${categoryData.title.toLowerCase()} articles on the Poodware developer blog.`,
    openGraph: {
      title: `${categoryData.title} | Poodware Blog`,
      description: `${categoryData.description}. Browse all ${categoryData.title.toLowerCase()} articles on the Poodware developer blog.`,
      url: `https://rrih.github.io/blog/category/${category}`,
      type: 'website',
    },
    alternates: {
      canonical: `https://rrih.github.io/blog/category/${category}`,
    },
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params
  const categoryData = categoryInfo[category as keyof typeof categoryInfo]

  if (!categoryData) {
    notFound()
  }

  const posts = await getBlogPostsByCategory(category)

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${categoryData.title} | Poodware Blog`,
    description: categoryData.description,
    url: `https://rrih.github.io/blog/category/${category}`,
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
          name: 'Blog',
          item: 'https://rrih.github.io/blog',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: categoryData.title,
          item: `https://rrih.github.io/blog/category/${category}`,
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
        <BreadcrumbNav
          items={[{ label: 'Web Solutions Hub', href: '/blog' }, { label: categoryData.title }]}
        />

        {/* Category Header */}
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div
              className={`w-12 h-12 rounded-lg ${categoryData.color} flex items-center justify-center`}
            >
              <categoryData.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground-light dark:text-foreground-dark">
                {categoryData.title}
              </h1>
              <p className="text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary mt-2">
                {categoryData.description}
              </p>
            </div>
          </div>

          <div className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
            {posts.length} {posts.length === 1 ? 'article' : 'articles'} in this category
          </div>
        </header>

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold mb-4 text-foreground-light dark:text-foreground-dark">
              No articles yet
            </h2>
            <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-6">
              We're working on adding more content to this category. Check back soon!
            </p>
            <Link
              href="/blog"
              className="inline-flex items-center rounded-lg bg-accent px-6 py-3 text-white transition-colors hover:bg-accent-dark"
            >
              Browse All Articles
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group relative overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark transition-all hover:shadow-lg"
              >
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    {post.featured && (
                      <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
                        Featured
                      </span>
                    )}
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
                      {post.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary"
                        >
                          #{tag}
                        </span>
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
        )}

        {/* Related Categories */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold mb-6 text-foreground-light dark:text-foreground-dark">
            Explore Other Categories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(categoryInfo)
              .filter(([key]) => key !== category)
              .map(([key, category]) => (
                <Link
                  key={key}
                  href={`/blog/category/${key}`}
                  className="group relative overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6 transition-all hover:shadow-lg"
                >
                  <div
                    className={`w-10 h-10 rounded-lg ${category.color} mb-4 flex items-center justify-center`}
                  >
                    <category.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2 text-foreground-light dark:text-foreground-dark group-hover:text-accent transition-colors">
                    {category.title}
                  </h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    {category.description}
                  </p>
                </Link>
              ))}
          </div>
        </section>
      </div>
    </>
  )
}
