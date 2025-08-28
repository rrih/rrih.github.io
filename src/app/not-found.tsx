'use client'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { ArrowLeft, Home } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8 py-6 xs:py-8 sm:py-12">
        <Header />

        <main className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          {/* 404 Display */}
          <div className="mb-8 xs:mb-12">
            <h1 className="text-6xl xs:text-7xl sm:text-8xl md:text-9xl font-bold text-accent mb-4 xs:mb-6">
              404
            </h1>
            <div className="w-16 xs:w-20 sm:w-24 h-1 bg-accent mx-auto rounded-full" />
          </div>

          {/* Error Message */}
          <div className="mb-8 xs:mb-12 max-w-md mx-auto px-4">
            <h2 className="text-xl xs:text-2xl sm:text-3xl font-semibold text-foreground-light dark:text-foreground-dark mb-4">
              Page Not Found
            </h2>
            <p className="text-base xs:text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary leading-relaxed">
              This page doesn't exist or has been moved.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col xs:flex-row gap-3 xs:gap-4 w-full max-w-sm mx-auto px-4">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white px-6 py-3 rounded-lg font-medium text-sm xs:text-base transition-all hover:shadow-lg active:scale-95 flex-1"
            >
              <Home className="w-4 h-4" />
              Go Home
            </Link>
            <button
              onClick={() => window.history.back()}
              className="flex items-center justify-center gap-2 border border-border-light dark:border-border-dark hover:border-accent hover:text-accent px-6 py-3 rounded-lg font-medium text-sm xs:text-base transition-all hover:shadow-lg active:scale-95 flex-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>

          {/* Popular Tools */}
          <div className="mt-12 xs:mt-16 w-full max-w-2xl mx-auto px-4">
            <h3 className="text-lg xs:text-xl font-semibold text-foreground-light dark:text-foreground-dark mb-6 text-center">
              Popular Tools
            </h3>
            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 xs:gap-4">
              <Link
                href="/tools/json-formatter"
                className="group rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4 transition-all hover:border-accent hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-accent-lighter flex items-center justify-center">
                    <span className="text-accent text-sm font-semibold">{}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground-light dark:text-foreground-dark group-hover:text-accent transition-colors">
                    JSON Formatter
                  </span>
                </div>
              </Link>
              <Link
                href="/tools/base64"
                className="group rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4 transition-all hover:border-accent hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-accent-lighter flex items-center justify-center">
                    <span className="text-accent text-sm font-semibold">B64</span>
                  </div>
                  <span className="text-sm font-medium text-foreground-light dark:text-foreground-dark group-hover:text-accent transition-colors">
                    Base64 Tool
                  </span>
                </div>
              </Link>
              <Link
                href="/tools/color-picker"
                className="group rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4 transition-all hover:border-accent hover:shadow-lg xs:col-span-2 lg:col-span-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-accent-lighter flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground-light dark:text-foreground-dark group-hover:text-accent transition-colors">
                    Color Picker
                  </span>
                </div>
              </Link>
            </div>
          </div>
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

        main {
          animation: fadeInUp 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
