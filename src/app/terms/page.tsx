import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { createMetadata, termsPageMetadata } from '@/config/metadata'
import { siteConfig } from '@/config/site'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = createMetadata(termsPageMetadata)

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <Header />
        <main>
          <section className="mb-16">
            <h1 className="mb-4 text-4xl font-bold tracking-tight">Terms of Service</h1>
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
              <h2 className="mb-6 text-2xl font-semibold">Agreement to Terms</h2>
              <p className="mb-4">
                By accessing and using {siteConfig.name} (the "Service"), you agree to be bound by
                these Terms of Service ("Terms"). If you do not agree to these Terms, please do not
                use the Service.
              </p>
              <p>
                We reserve the right to modify these Terms at any time. Changes will be effective
                immediately upon posting to this page.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Description of Service</h2>
              <p className="mb-4">
                {siteConfig.name} provides free web-based utilities including but not limited to
                JSON formatting, Base64 encoding/decoding, color picking, and other developer and
                designer tools.
              </p>
              <p>
                The Service is provided "as is" and we make no warranties about the availability,
                accuracy, or reliability of our tools.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Acceptable Use</h2>
              <p className="mb-4">You agree not to:</p>
              <ul className="pl-6 space-y-2 mb-4">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Use automated systems to access the Service excessively</li>
                <li>Submit malicious code, viruses, or harmful content</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">User Content</h2>
              <p className="mb-4">
                You are responsible for any content you input into our tools. Currently, most
                processing happens in your browser, but you should not input sensitive or
                confidential information that you do not want processed.
              </p>
              <p>
                You retain ownership of your content, but grant us the right to process it as
                necessary to provide the Service.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Privacy</h2>
              <p className="mb-4">
                Your privacy is important to us. Please review our{' '}
                <Link href="/privacy" className="text-accent hover:underline">
                  Privacy Policy
                </Link>
                , which explains how we collect, use, and protect your information.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Intellectual Property</h2>
              <p className="mb-4">
                The Service and its content are protected by copyright, trademark, and other
                intellectual property laws. The source code is available under open source licenses
                as specified in our repository.
              </p>
              <p>
                You may not copy, modify, distribute, or create derivative works of our proprietary
                content without permission.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Disclaimers</h2>
              <p className="mb-4">
                THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
                WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p>
                We do not warrant that the Service will be uninterrupted, error-free, or free of
                harmful components.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Limitation of Liability</h2>
              <p className="mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM OR RELATED TO
                YOUR USE OF THE SERVICE.
              </p>
              <p>
                Our total liability shall not exceed the amount you paid to use the Service (which
                is currently zero for free tools).
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Indemnification</h2>
              <p className="mb-4">
                You agree to indemnify and hold us harmless from any claims, damages, losses, or
                expenses arising from your use of the Service or violation of these Terms.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Termination</h2>
              <p className="mb-4">
                We may terminate or suspend your access to the Service at any time, with or without
                notice, for any reason including violation of these Terms.
              </p>
              <p>Upon termination, your right to use the Service ceases immediately.</p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Changes to Service</h2>
              <p className="mb-4">
                We reserve the right to modify, suspend, or discontinue the Service (or any part
                thereof) at any time without notice. We may also implement new features, including
                premium services or advertising.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Governing Law</h2>
              <p className="mb-4">
                These Terms are governed by and construed in accordance with applicable laws. Any
                disputes will be resolved through appropriate legal channels.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Contact Information</h2>
              <p className="mb-4">
                If you have questions about these Terms, please contact us through our{' '}
                <Link href="/about" className="text-accent hover:underline">
                  about page
                </Link>
                .
              </p>
            </section>

            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold">Severability</h2>
              <p className="mb-4">
                If any provision of these Terms is found to be unenforceable, the remaining
                provisions will continue in full force and effect.
              </p>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
