'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useErrorToast, useSuccessToast } from '@/components/ui/toast'
import { useHistory } from '@/hooks/useHistory'
import { localStorageManager } from '@/lib/localStorage'
import { useUrlSharing } from '@/lib/urlSharing'
import {
  Bold,
  Code,
  Copy,
  Download,
  Eye,
  FileText,
  Heading,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Share2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface MarkdownState {
  input: string
  preview: string
}

export default function MarkdownEditorPage() {
  const TOOL_NAME = 'markdown-editor'

  const defaultState: MarkdownState = {
    input: '',
    preview: '',
  }

  const {
    state,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
  } = useHistory<MarkdownState>(defaultState)

  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const { generateShareUrl, shareInfo, getInitialStateFromUrl } =
    useUrlSharing<MarkdownState>(TOOL_NAME)

  const hasInitialized = useRef(false)

  const { input, preview } = state

  const setInput = (newInput: string) => {
    setHistoryState((prev) => ({ ...prev, input: newInput }))
  }

  const setPreview = useCallback(
    (newPreview: string) => {
      setHistoryState((prev) => ({ ...prev, preview: newPreview }))
    },
    [setHistoryState]
  )

  // Client-side only state restoration
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    const sharedState = getInitialStateFromUrl()
    if (sharedState) {
      setHistoryState(sharedState)
      return
    }

    const savedState = localStorageManager.load<MarkdownState>(TOOL_NAME)
    if (savedState) {
      setHistoryState(savedState)
    }
  })

  // Auto-save to localStorage whenever state changes
  useEffect(() => {
    if (state.input || state.preview) {
      localStorageManager.save(TOOL_NAME, state)
    }
  }, [state])

  // Convert Markdown to HTML
  useEffect(() => {
    const convertMarkdown = () => {
      const html = input
        // Headers
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold mb-3">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mb-4">$1</h1>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" class="text-accent hover:underline">$1</a>'
        )
        // Line breaks
        .replace(/\n/g, '<br />')
        // Code blocks
        .replace(
          /```([^`]+)```/g,
          '<pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto"><code>$1</code></pre>'
        )
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">$1</code>')
        // Lists
        .replace(/^\* (.+)$/gim, '<li class="ml-4">• $1</li>')
        .replace(/^\d+\. (.+)$/gim, '<li class="ml-4">$1</li>')
        // Blockquotes
        .replace(
          /^> (.+)$/gim,
          '<blockquote class="border-l-4 border-accent pl-4 italic">$1</blockquote>'
        )

      setPreview(html)
    }

    convertMarkdown()
  }, [input, setPreview])

  const insertMarkdown = (before: string, after = '') => {
    const textarea = document.querySelector('textarea')
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = input.substring(start, end)
    const replacement = `${before}${selectedText}${after}`
    const newText = input.substring(0, start) + replacement + input.substring(end)

    setInput(newText)

    // Reset cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
    }, 0)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const downloadMarkdown = () => {
    const blob = new Blob([input], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearAll = () => {
    clearHistory()
  }

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const shareUrl = await generateShareUrl(state)
      await navigator.clipboard.writeText(shareUrl)
      const success = true

      if (success) {
        const message = 'Share URL copied!'
        let description = 'The shareable URL has been copied to your clipboard'

        if (shareInfo.isLimited) {
          description = shareInfo.message
        }

        successToast(message, description)
      } else {
        errorToast('Failed to copy URL', 'Please try again or copy the URL manually')
      }
    } catch (error) {
      console.error('Share failed:', error)
      errorToast('Sharing failed', 'An error occurred while generating the share URL')
    } finally {
      setIsSharing(false)
    }
  }

  const handleClearData = () => {
    if (confirm('Clear all saved data and current content?')) {
      localStorageManager.clear(TOOL_NAME)
      clearAll()
    }
  }

  const toolbarButtons = [
    { icon: Bold, title: 'Bold', action: () => insertMarkdown('**', '**') },
    { icon: Italic, title: 'Italic', action: () => insertMarkdown('*', '*') },
    { icon: Heading, title: 'Heading', action: () => insertMarkdown('# ', '') },
    { icon: Link2, title: 'Link', action: () => insertMarkdown('[', '](url)') },
    { icon: Code, title: 'Code', action: () => insertMarkdown('`', '`') },
    { icon: Quote, title: 'Quote', action: () => insertMarkdown('> ', '') },
    { icon: List, title: 'Bullet List', action: () => insertMarkdown('* ', '') },
    { icon: ListOrdered, title: 'Numbered List', action: () => insertMarkdown('1. ', '') },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 py-3 xs:py-4 sm:py-6 md:py-12">
        <Header />

        <main>
          {/* Hero Section */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16 text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-2 xs:mb-3 sm:mb-4 text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground-light dark:text-foreground-dark">
                Markdown Editor
              </h1>
              <p className="mb-4 xs:mb-6 text-sm xs:text-base sm:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary px-2 xs:px-0">
                Write and preview Markdown with live rendering and export options.
              </p>
            </div>
          </section>

          {/* Toolbar */}
          <section className="mb-4 xs:mb-6">
            <div className="rounded-lg border border-border-light bg-card-light p-2 xs:p-3 sm:p-4 dark:border-border-dark dark:bg-card-dark">
              <div className="flex flex-wrap gap-2 xs:gap-3 items-center justify-between">
                <div className="flex flex-wrap gap-1 xs:gap-2">
                  {toolbarButtons.map((button) => (
                    <button
                      key={button.title}
                      onClick={button.action}
                      title={button.title}
                      className="p-2 xs:p-2.5 rounded-lg border border-border-light dark:border-border-dark hover:bg-accent hover:text-white transition-all"
                    >
                      <button.icon className="w-4 h-4 xs:w-5 xs:h-5" />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className="flex items-center gap-2 px-3 xs:px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-dark transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden xs:inline">{isPreviewMode ? 'Edit' : 'Preview'}</span>
                  </button>
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="p-2 rounded-lg border border-border-light dark:border-border-dark hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="p-2 rounded-lg border border-border-light dark:border-border-dark hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Editor/Preview Area */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 xs:gap-6">
              {/* Editor Panel */}
              <div
                className={`rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg ${isPreviewMode ? 'hidden lg:block' : ''}`}
              >
                <div className="p-2 xs:p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark flex justify-between items-center">
                  <div>
                    <h3 className="text-base xs:text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                      Markdown Input
                    </h3>
                    <p className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                      Write your Markdown here
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(input)}
                      className="flex items-center gap-1 xs:gap-2 bg-accent hover:bg-accent-dark text-white px-2 xs:px-3 py-1.5 rounded-lg text-xs xs:text-sm transition-all"
                    >
                      <Copy className="w-3 h-3 xs:w-4 xs:h-4" />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={downloadMarkdown}
                      className="flex items-center gap-1 xs:gap-2 bg-accent hover:bg-accent-dark text-white px-2 xs:px-3 py-1.5 rounded-lg text-xs xs:text-sm transition-all"
                    >
                      <Download className="w-3 h-3 xs:w-4 xs:h-4" />
                      <span className="hidden xs:inline">Download</span>
                    </button>
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className="flex items-center gap-1 xs:gap-2 bg-accent hover:bg-accent-dark text-white px-2 xs:px-3 py-1.5 rounded-lg text-xs xs:text-sm transition-all disabled:opacity-50"
                    >
                      <Share2 className="w-3 h-3 xs:w-4 xs:h-4" />
                      {isSharing ? 'Sharing...' : 'Share'}
                    </button>
                  </div>
                </div>
                <div className="p-2 xs:p-3 sm:p-4 md:p-6">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="# Welcome to Markdown Editor

Start typing your Markdown here...

## Features
* **Bold** text
* *Italic* text
* [Links](https://example.com)
* `Inline code`

> Blockquotes

```
Code blocks
```"
                    className="w-full h-80 xs:h-96 sm:h-[500px] bg-white dark:bg-background-dark text-foreground-light dark:text-foreground-dark font-mono text-xs xs:text-sm sm:text-base p-2 xs:p-3 sm:p-4 border border-border-light dark:border-border-dark rounded-lg resize-none transition-all focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>
              </div>

              {/* Preview Panel */}
              <div
                className={`rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg ${!isPreviewMode ? 'hidden lg:block' : ''}`}
              >
                <div className="p-2 xs:p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
                  <h3 className="text-base xs:text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                    Preview
                  </h3>
                  <p className="text-xs xs:text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
                    Live preview of your Markdown
                  </p>
                </div>
                <div className="p-2 xs:p-3 sm:p-4 md:p-6">
                  <div
                    className="prose prose-slate dark:prose-invert max-w-none min-h-[20rem] xs:min-h-[24rem] sm:min-h-[500px]"
                    /* biome-ignore lint/security/noDangerouslySetInnerHtml: Required for markdown preview functionality */
                    dangerouslySetInnerHTML={{
                      __html:
                        preview || '<p class="text-gray-400">Start typing to see preview...</p>',
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="mb-6 xs:mb-8 sm:mb-12 md:mb-16 flex justify-center gap-4">
            <button
              onClick={handleClearData}
              className="flex items-center gap-2 px-6 py-3 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:border-red-600 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </section>

          {/* Features */}
          <section className="hidden xs:block mb-8 sm:mb-12 md:mb-16">
            <h2 className="mb-8 sm:mb-12 text-center text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
              Why Choose Our Markdown Editor?
            </h2>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: FileText,
                  title: 'Live Preview',
                  description: 'See your formatted text in real-time as you type.',
                },
                {
                  icon: Code,
                  title: 'Syntax Support',
                  description: 'Full Markdown syntax support with toolbar shortcuts.',
                },
                {
                  icon: Download,
                  title: 'Export Options',
                  description: 'Download your Markdown files or copy formatted HTML.',
                },
              ].map((feature, index) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-border-light bg-card-light p-6 text-center dark:border-border-dark dark:bg-card-dark transition-all hover:-translate-y-1 hover:shadow-lg"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.6s ease-out forwards',
                  }}
                >
                  <div className="mb-4 flex justify-center">
                    <feature.icon className="h-10 w-10 text-accent transition-transform hover:scale-110" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground-light dark:text-foreground-dark">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Content Sections for AdSense */}
          <section className="mb-8 sm:mb-12 md:mb-16 border-t border-border-light dark:border-border-dark pt-8 sm:pt-12">
            {/* About This Tool */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                About Markdown Editor
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Our Markdown Editor is a powerful, browser-based tool designed for writers,
                  developers, and content creators who work with Markdown syntax. Markdown is a
                  lightweight markup language that allows you to format text using simple, readable
                  syntax that can be converted to HTML and other formats. This tool provides a
                  seamless writing experience with live preview, syntax highlighting, and export
                  capabilities.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed mb-4">
                  Whether you're writing documentation, blog posts, README files, or taking notes,
                  our editor makes it easy to create well-formatted content without dealing with
                  complex HTML or word processor formatting. The split-pane interface lets you see
                  your formatted output in real-time, helping you perfect your content as you write.
                </p>
                <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
                  With features like toolbar shortcuts, undo/redo functionality, and instant
                  download capabilities, this editor streamlines your Markdown workflow. All
                  processing happens locally in your browser, ensuring your content remains private
                  and secure while providing lightning-fast performance.
                </p>
              </div>
            </div>

            {/* How to Use */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                How to Use
              </h2>
              <div className="space-y-4">
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 1: Write Your Markdown</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Type or paste your Markdown content in the left editor pane. Use standard
                    Markdown syntax for formatting.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 2: Use Toolbar Shortcuts</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Click toolbar buttons to quickly insert formatting like bold, italic, headers,
                    links, and lists.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 3: Preview Your Content</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    View the formatted output in real-time in the right preview pane, or toggle
                    full-screen preview mode.
                  </p>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold text-lg mb-2">Step 4: Export Your Work</h3>
                  <p className="text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Download your Markdown file or copy the content to use in other applications.
                  </p>
                </div>
              </div>
            </div>

            {/* Markdown Syntax Guide */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Markdown Syntax Guide
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold mb-2">Headers</h3>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs">
                    {`# H1 Header
## H2 Header
### H3 Header`}
                  </pre>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold mb-2">Emphasis</h3>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs">
                    {`**Bold text**
*Italic text*
***Bold and italic***`}
                  </pre>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold mb-2">Lists</h3>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs">
                    {`* Unordered item
* Another item

1. Ordered item
2. Another item`}
                  </pre>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold mb-2">Links & Images</h3>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs">
                    {`[Link text](https://url.com)
![Alt text](image.jpg)`}
                  </pre>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold mb-2">Code</h3>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs">
                    {`\`inline code\`

\`\`\`
code block
\`\`\``}
                  </pre>
                </div>
                <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <h3 className="font-semibold mb-2">Blockquote</h3>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs">
                    {`> This is a quote
> Multiple lines`}
                  </pre>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="mb-12">
              <h2 className="mb-6 text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">What is Markdown?</summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Markdown is a lightweight markup language created by John Gruber. It allows you
                    to write using an easy-to-read, easy-to-write plain text format that can be
                    converted to structurally valid HTML. It's widely used for documentation, README
                    files, blog posts, and comments.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">Is my content saved?</summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Your content is temporarily stored in your browser's session while you work. For
                    permanent storage, use the download feature to save your Markdown files locally.
                    The editor maintains undo/redo history during your session.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I use extended Markdown syntax?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    This editor supports core Markdown syntax. For extended features like tables,
                    footnotes, or task lists, the preview may not render them fully. However, your
                    Markdown text will remain valid for use in applications that support extended
                    syntax.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">
                    Can I import existing Markdown files?
                  </summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    You can paste existing Markdown content directly into the editor. Simply copy
                    your Markdown text from any source and paste it into the input area to continue
                    editing.
                  </p>
                </details>
                <details className="rounded-lg border border-border-light dark:border-border-dark p-4">
                  <summary className="font-semibold cursor-pointer">Does it work offline?</summary>
                  <p className="mt-3 text-foreground-light-secondary dark:text-foreground-dark-secondary">
                    Once loaded, the editor works entirely offline. All processing happens in your
                    browser using JavaScript, so you can continue writing even without an internet
                    connection.
                  </p>
                </details>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
