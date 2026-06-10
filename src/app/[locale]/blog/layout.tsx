import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

export default function LocalizedBlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <Header />
      <main className="min-h-screen pt-16">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
      <Footer />
    </div>
  )
}
