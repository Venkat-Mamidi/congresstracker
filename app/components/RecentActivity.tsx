'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Vote, VotePosition } from '@/lib/congress-api'
import PartyBadge from './PartyBadge'

interface ActivityMember {
  id: string
  full_name: string
  party_code: 'D' | 'R' | 'I'
  state: string
  chamber: 'House' | 'Senate'
  district?: string | null
}

interface ActivityVote extends Vote {
  member?: ActivityMember | null
}

const CACHE_KEY = 'ct:recent-activity:v2'

const POSITION_STYLES: Record<VotePosition, string> = {
  Yes: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  No: 'bg-red-50 text-red-700 ring-red-200',
  Present: 'bg-amber-50 text-amber-700 ring-amber-200',
  'Not Voting': 'bg-gray-50 text-gray-600 ring-gray-200',
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function readCache(): ActivityVote[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts: number; votes: ActivityVote[] }
    return parsed?.votes || null
  } catch {
    return null
  }
}

function writeCache(votes: ActivityVote[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), votes }))
  } catch {
    // localStorage may be full or disabled
  }
}

export default function RecentActivity() {
  const [votes, setVotes] = useState<ActivityVote[]>([])
  const [hydratedFromCache, setHydratedFromCache] = useState(false)
  const [loading, setLoading] = useState(true)

  // Layer 1: hydrate from localStorage on mount
  useEffect(() => {
    const cached = readCache()
    if (cached && cached.length > 0) {
      setVotes(cached)
      setHydratedFromCache(true)
      setLoading(false)
    }
  }, [])

  // Layer 2 + 3: fetch from server-side API route. Never clears existing state on failure.
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/recent-activity', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return

        const fresh: ActivityVote[] = data.votes || []
        if (fresh.length > 0) {
          setVotes(fresh)
          writeCache(fresh)
        }
        setLoading(false)
      } catch (err) {
        console.warn('RecentActivity: fetch failed, keeping cached state', err)
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const showSkeleton = loading && !hydratedFromCache && votes.length === 0
  const showEmpty = !loading && votes.length === 0

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-display text-slate-900">Recent activity</h2>
        <p className="mt-1 text-sm text-slate-600">The 10 most recent recorded votes across Congress.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {showSkeleton && (
          <div className="divide-y divide-slate-100">
            {[0, 1, 2].map((item) => (
              <div key={item} className="animate-pulse p-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-5/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {showEmpty && (
          <p className="p-6 text-center text-sm text-slate-500">
            No recent vote activity is available yet.
          </p>
        )}

        {votes.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {votes.map((vote) => {
              const member = vote.member
              return (
                <li
                  key={`${vote.member_id}-${vote.congress}-${vote.session}-${vote.roll_call}`}
                  className="px-4 py-3.5 transition hover:bg-slate-50/60 sm:px-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${POSITION_STYLES[vote.vote_position] || POSITION_STYLES['Not Voting']}`}
                    >
                      {vote.vote_position}
                    </span>
                    {member ? (
                      <Link
                        href={`/rep/${member.id}`}
                        className="font-medium text-slate-900 transition hover:text-slate-700"
                      >
                        {member.full_name}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-900">{vote.member_id}</span>
                    )}
                    {member && <PartyBadge party={member.party_code} />}
                    <span className="ml-auto text-xs text-slate-500">{formatDate(vote.vote_date)}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-slate-700">
                    {vote.bill_title_plain || vote.bill_title_raw || vote.bill_id || 'Untitled vote'}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
