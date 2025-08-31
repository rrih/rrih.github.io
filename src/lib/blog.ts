import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import rehypeStringify from 'rehype-stringify'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  content: string
  publishedAt: string
  updatedAt?: string
  author?: string
  category: string
  tags: string[]
  readTime: string
  featured?: boolean
  relatedTools?: {
    title: string
    href: string
    description: string
  }[]
}

const postsDirectory = path.join(process.cwd(), 'content/blog')

// Ensure posts directory exists
async function ensurePostsDirectory() {
  try {
    await fs.access(postsDirectory)
  } catch {
    await fs.mkdir(postsDirectory, { recursive: true })
  }
}

export async function getAllBlogSlugs(): Promise<string[]> {
  await ensurePostsDirectory()

  try {
    const filenames = await fs.readdir(postsDirectory)
    return filenames
      .filter((name) => name.endsWith('.md') || name.endsWith('.mdx'))
      .map((name) => name.replace(/\.(md|mdx)$/, ''))
  } catch {
    return []
  }
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  await ensurePostsDirectory()

  try {
    // Try both .md and .mdx extensions
    let filePath: string
    let fileContent: string

    try {
      filePath = path.join(postsDirectory, `${slug}.mdx`)
      fileContent = await fs.readFile(filePath, 'utf8')
    } catch {
      filePath = path.join(postsDirectory, `${slug}.md`)
      fileContent = await fs.readFile(filePath, 'utf8')
    }

    const { data, content } = matter(fileContent)

    // Process markdown to HTML
    const processedContent = await remark()
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(content)

    const htmlContent = processedContent.toString()

    // Calculate read time (average 200 words per minute)
    const wordCount = content.split(/\s+/).length
    const readTime = Math.ceil(wordCount / 200)

    return {
      slug,
      title: data.title || 'Untitled',
      excerpt: data.excerpt || '',
      content: htmlContent,
      publishedAt: data.publishedAt || new Date().toISOString(),
      updatedAt: data.updatedAt,
      author: data.author,
      category: data.category || 'general',
      tags: data.tags || [],
      readTime: `${readTime} min read`,
      featured: data.featured || false,
      relatedTools: data.relatedTools || [],
    }
  } catch {
    return null
  }
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const slugs = await getAllBlogSlugs()
  const posts = await Promise.all(slugs.map((slug) => getBlogPost(slug)))

  return posts
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

export async function getBlogPostsByCategory(category: string): Promise<BlogPost[]> {
  const allPosts = await getAllBlogPosts()
  return allPosts.filter((post) => post.category === category)
}

export async function getBlogPostsByTag(tag: string): Promise<BlogPost[]> {
  const allPosts = await getAllBlogPosts()
  return allPosts.filter((post) => post.tags.includes(tag))
}

export async function getFeaturedBlogPosts(): Promise<BlogPost[]> {
  const allPosts = await getAllBlogPosts()
  return allPosts.filter((post) => post.featured)
}

export async function getRelatedBlogPosts(
  currentSlug: string,
  tags: string[],
  limit = 3
): Promise<BlogPost[]> {
  const allPosts = await getAllBlogPosts()

  // Filter out current post and score by tag overlap
  const relatedPosts = allPosts
    .filter((post) => post.slug !== currentSlug)
    .map((post) => ({
      ...post,
      relevanceScore: post.tags.filter((tag) => tags.includes(tag)).length,
    }))
    .filter((post) => post.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)

  return relatedPosts
}

// Utility function to generate blog OG images
export function getBlogOGImagePath(slug: string): string {
  return `/og/blog-${slug}.png`
}

// Generate sitemap entries for blog posts
export async function getBlogSitemapEntries() {
  const posts = await getAllBlogPosts()
  const baseUrl = 'https://rrih.github.io'

  return posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt || post.publishedAt,
    changeFrequency: 'weekly' as const,
    priority: post.featured ? 0.9 : 0.7,
  }))
}
