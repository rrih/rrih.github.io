import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { createMetadata, privacyPageMetadata } from '@/config/metadata'
import { siteConfig } from '@/config/site'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = createMetadata(privacyPageMetadata)

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <main>
          <section className="mb-16">
            <h1 className="mb-4 text-4xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-lg text-foreground-light-secondary dark:text-foreground-dark-secondary">
              Last updated:{' '}
              {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </section>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Overview</h2>
              <p className="mb-4">
                This Privacy Policy describes how {siteConfig.name} ("we," "our," or "us") collects,
                uses, and shares information about you when you use our web-based tools and services
                (the "Service").
              </p>
              <p>
                We are committed to protecting your privacy while providing high-quality web tools.
                This policy explains our current practices and may be updated to reflect changes in
                our services or applicable law.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Information Collection</h2>

              <h3 className="mb-4 text-xl font-semibold">Tool Usage Data</h3>
              <p className="mb-4">
                Currently, our tools process data locally in your browser. The content you input
                into our tools (JSON data, text for encoding, etc.) is processed client-side and is
                not transmitted to our servers unless you explicitly choose to do so.
              </p>

              <h3 className="mb-4 text-xl font-semibold">Analytics and Usage Information</h3>
              <p className="mb-4">
                We use Google Analytics to understand how our tools are used and to improve user
                experience. This includes:
              </p>
              <ul className="mb-4 pl-6 space-y-2">
                <li>Pages visited and time spent on our site</li>
                <li>Browser type, operating system, and device information</li>
                <li>General geographic location (country/region level)</li>
                <li>Referral sources and search terms used to find our site</li>
              </ul>

              <h3 className="mb-4 text-xl font-semibold">Advertising</h3>
              <p className="mb-4">
                We may integrate advertising services in the future to support the continued
                development and maintenance of our free tools. Any advertising implementation will
                follow industry standards for privacy protection.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">How We Use Information</h2>
              <p className="mb-4">When implemented, collected information may be used to:</p>
              <ul className="pl-6 space-y-2">
                <li>Improve and optimize our tools and user experience</li>
                <li>Understand usage patterns and popular features</li>
                <li>Detect and prevent technical issues</li>
                <li>Provide relevant content and advertisements</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Data Sharing</h2>
              <p className="mb-4">
                We share information with trusted third-party service providers, including:
              </p>
              <ul className="pl-6 space-y-2">
                <li>With service providers who help us operate and improve our services</li>
                <li>When required by law or to protect our legal rights</li>
                <li>With Google Analytics to understand website usage patterns</li>
                <li>In connection with a business transaction (merger, acquisition, etc.)</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Data Security</h2>
              <p className="mb-4">
                We implement appropriate technical and organizational measures to protect
                information against unauthorized access, alteration, disclosure, or destruction.
                However, no method of transmission over the internet or electronic storage is 100%
                secure.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Your Choices</h2>
              <p className="mb-4">You may:</p>
              <ul className="pl-6 space-y-2">
                <li>Use browser settings to control cookies and local storage</li>
                <li>Use ad blockers to limit advertising (when implemented)</li>
                <li>Contact us to request information about data we may have collected</li>
                <li>Stop using our services at any time</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Third-Party Services</h2>
              <p className="mb-4">
                Our website is hosted on GitHub Pages and uses Google Analytics for usage tracking.
                Please review GitHub's and Google's privacy policies for information about their
                data practices. We may also use other third-party services for advertising or
                additional functionality in the future.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Changes to This Policy</h2>
              <p className="mb-4">
                We may update this Privacy Policy from time to time. We will post the updated policy
                on this page and update the "Last updated" date. Significant changes will be
                highlighted on our website.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Contact Us</h2>
              <p className="mb-4">
                If you have questions about this Privacy Policy, please contact us through our{' '}
                <Link href="/about" className="text-accent hover:underline">
                  about page
                </Link>
                .
              </p>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
