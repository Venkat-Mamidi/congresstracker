import './globals.css'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  axes: ['opsz'],
})

export const metadata: Metadata = {
  title: {
    default: 'CongressTracker',
    template: '%s | CongressTracker',
  },
  description: 'See how your members of Congress vote and what bills they sponsor.',
  openGraph: {
    title: 'CongressTracker',
    description: 'See how your members of Congress vote and what bills they sponsor.',
    type: 'website',
    siteName: 'CongressTracker',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CongressTracker',
    description: 'See how your members of Congress vote and what bills they sponsor.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#eef0f3]/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link
              href="/"
              className="group flex items-center gap-2 text-base font-semibold tracking-display text-slate-900"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white shadow-sm transition group-hover:bg-slate-800">
                C
              </span>
              <span>CongressTracker</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-200/60 hover:text-slate-900"
              >
                Home
              </Link>
              <Link
                href="/compare"
                className="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-200/60 hover:text-slate-900"
              >
                Compare
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-16 py-10 sm:px-24 sm:py-14 lg:px-40">{children}</main>
        <footer className="mt-16 border-t border-slate-200/70">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>
              Data from{' '}
              <a
                href="https://api.congress.gov/"
                className="underline-offset-2 hover:text-gray-900 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Congress.gov
              </a>
              ,{' '}
              <a
                href="https://voteview.com"
                className="underline-offset-2 hover:text-gray-900 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Voteview
              </a>
              , and the U.S. Census geocoder.
            </span>
            <span className="text-gray-400">Non-partisan. Free. Open data.</span>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  )
}
