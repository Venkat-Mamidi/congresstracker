'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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
  member?: ActivityMember
}

const CACHE_KEY = 'ct:recent-activity:v1'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

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
    if (!parsed?.votes) return null
    // Cache never strictly "expires" — we still show it on failure, but we'll prefer fresh data after TTL
    return parsed.votes
  } catch {
    return null
  }
}

function writeCache(votes: ActivityVote[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), votes }))
  } catch {
    // localStorage may be full or disabled — fail quietly
  }
}

export default function RecentActivity() {
  const [votes, setVotes] = useState<ActivityVote[]>([])
  const [hydratedFromCache, setHydratedFromCache] = useState(false)
  const [loading, setLoading] = useState(true)

  // Layer 1: hydrate from localStorage immediately so users see the section instantly
  useEffect(() => {
    const cached = readCache()
    if (cached && cached.length > 0) {
      setVotes(cached)
      setHydratedFromCache(true)
      setLoading(false)
    }
  }, [])

  // Layer 2 + 3: fetch fresh data, fall back to all-time if last-7-days is empty.
  // Never clears existing state on failure — stale data is better than empty.
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const cutoff = sevenDaysAgo.toISOString().slice(0, 10)

        let { data: voteRows } = await supabase
          .from('votes')
          .select('member_id, vote_date, vote_position, bill_title_plain, bill_title_raw, bill_id, congress, session, roll_call, bill_category')
          .gte('vote_date', cutoff)
          .neq('vote_position', 'Not Voting')
          .order('vote_date', { ascending: false })
          .limit(10)

        if (!voteRows || voteRows.length === 0) {
          const { data: fallback } = await supabase
            .from('votes')
            .select('member_id, vote_date, vote_position, bill_title_plain, bill_title_raw, bill_id, congress, session, roll_call, bill_category')
            .neq('vote_position', 'Not Voting')
            .order('vote_date', { ascending: false })
            .limit(10)
          voteRows = fallback || []
        }

        if (cancelled || !voteRows || voteRows.length === 0) {
          setLoading(false)
          return
        }

        const memberIds = Array.from(new Set(voteRows.map((v) => v.member_id)))
        const { data: memberRows } = await supabase
          .from('members')
          .select('id, full_name, party_code, state, chamber, district')
          .in('id', memberIds)

        if (cancelled) return

        const byId: Record<string, ActivityMember> = {}
        for (const m of (memberRows || []) as ActivityMember[]) byId[m.id] = m

        const merged: ActivityVote[] = voteRows.map((v) => ({
          ...(v as Vote),
          member: byId[v.member_id],
        }))

        setVotes(merged)
        writeCache(merged)
        setLoading(false)
      } catch (err) {
        // Network failure, Supabase outage, etc. — keep whatever we already have on screen.
        console.warn('RecentActivity: fetch failed, keeping cached state', err)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Show the skeleton only when we have NO data at all (first visit ever, no cache, still loading)
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
