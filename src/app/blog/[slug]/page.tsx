import ShareButton from '@/components/blog/ShareButton'
import { BreadcrumbNav } from '@/components/blog/breadcrumb-nav'
import { getAllBlogSlugs, getBlogPost } from '@/lib/blog'
import { Calendar, Clock, Share2, Tag } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllBlogSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author || 'Poodware Team' }],
    keywords: post.tags,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      authors: [post.author || 'Poodware Team'],
      tags: post.tags,
      url: `https://rrih.github.io/blog/${slug}`,
      images: [
        {
          url: `/og/blog-${slug}.png`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [`/og/blog-${slug}.png`],
    },
    alternates: {
      canonical: `https://rrih.github.io/blog/${slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post) {
    notFound()
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: [`https://rrih.github.io/og/blog-${slug}.png`],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      '@type': 'Organization',
      name: post.author || 'Poodware Team',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Poodware',
      logo: {
        '@type': 'ImageObject',
        url: 'https://rrih.github.io/icons/icon-512x512.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://rrih.github.io/blog/${slug}`,
    },
    keywords: post.tags.join(', '),
    articleSection: post.category,
    wordCount: post.content.split(' ').length,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="max-w-4xl mx-auto">
        <BreadcrumbNav
          items={[{ label: 'Web Solutions Hub', href: '/blog' }, { label: post.title }]}
        />

        {/* Article Header */}
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
              {post.category}
            </span>
            <div className="flex items-center gap-4 text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.readTime}
              </div>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-foreground-light dark:text-foreground-dark leading-tight">
            {post.title}
          </h1>

          <p className="text-lg sm:text-xl text-foreground-light-secondary dark:text-foreground-dark-secondary mb-8 leading-relaxed">
            {post.excerpt}
          </p>

          {/* Tags */}
          <div className="flex items-center gap-2 mb-8">
            <Tag className="w-4 h-4 text-foreground-light-secondary dark:text-foreground-dark-secondary" />
            <div className="flex gap-2 flex-wrap">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blog/tag/${tag}`}
                  className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary hover:text-accent transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>

          {/* Share Buttons */}
          <div className="flex items-center gap-4 pt-6 border-t border-border-light dark:border-border-dark">
            <span className="text-sm font-medium text-foreground-light dark:text-foreground-dark">
              Share:
            </span>
            <ShareButton title={post.title} excerpt={post.excerpt} />
          </div>
        </header>

        {/* Article Content */}
        <article className="prose prose-lg dark:prose-invert max-w-none">
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </article>

        {/* Related Tools Section */}
        {post.relatedTools && post.relatedTools.length > 0 && (
          <section className="mt-16 pt-8 border-t border-border-light dark:border-border-dark">
            <h3 className="text-xl font-bold mb-6 text-foreground-light dark:text-foreground-dark">
              Related Tools
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {post.relatedTools.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group block p-4 rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark transition-all hover:shadow-lg"
                >
                  <h4 className="font-semibold mb-2 text-foreground-light dark:text-foreground-dark group-hover:text-accent transition-colors">
                    {tool.title}
                  </h4>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    {tool.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Social Sharing CTA */}
        <section className="mt-16 bg-gradient-to-r from-accent/5 to-accent/10 rounded-lg p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Share2 className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-bold text-foreground-light dark:text-foreground-dark">
              Found this helpful?
            </h3>
          </div>
          <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary mb-6">
            Share it with your network and help others solve their web challenges.
          </p>
          <ShareButton title={post.title} excerpt={post.excerpt} />
        </section>
      </div>
    </>
  )
}
