import type { Metadata } from 'next'
import ZipSearch from './components/ZipSearch'
import MemberSearch from './components/MemberSearch'
import RecentActivity from './components/RecentActivity'
import QuickCompare from './components/QuickCompare'

export const metadata: Metadata = {
  title: 'Find your members of Congress',
  description:
    'Enter your zip code to see how your senators and House representative actually vote, what bills they sponsor, and how often they break with their party.',
  openGraph: {
    title: 'CongressTracker - find your members of Congress',
    description:
      'Zip code to reps to full voting record. Non-partisan, fast, and free.',
    type: 'website',
  },
}

export default function HomePage() {
  return (
    <div className="space-y-16 animate-fade-in">
      {/* Hero */}
      <section className="relative isolate">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live data from Congress.gov
          </span>
          <h1 className="mt-5 px-1 font-display text-4xl font-semibold tracking-display text-slate-900 sm:text-6xl">
            What has your representative{' '}
            <span className="inline-block bg-gradient-to-br from-amber-600 to-orange-700 bg-clip-text pr-2 italic text-transparent">
              actually done?
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Not what they tweeted. Not what their campaign says. The real votes, the real bills, and how often they show up.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <ZipSearch />
          </div>
        </div>
      </section>

      <QuickCompare />

      <RecentActivity />

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold tracking-display text-slate-900">Browse all members</h2>
          <p className="mt-1 text-sm text-gray-600">
            Search by name, or filter by chamber, state, or party.
          </p>
        </div>
        <MemberSearch />
      </section>
    </div>
  )
}
