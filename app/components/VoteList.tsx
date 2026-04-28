'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Vote, BillCategory, VotePosition } from '@/lib/congress-api'
import VoteRow from './VoteRow'

const CATEGORIES: (BillCategory | 'All')[] = [
  'All', 'Healthcare', 'Defense', 'Economy', 'Immigration', 'Environment',
  'Education', 'Infrastructure', 'Technology', 'Housing', 'Other',
]
const POSITIONS: (VotePosition | 'All')[] = ['All', 'Yes', 'No', 'Not Voting', 'Present']

const PAGE_SIZE = 50

export default function VoteList({ memberId }: { memberId: string }) {
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [done, setDone] = useState(false)
  const [sourceUnavailable, setSourceUnavailable] = useState(false)
  const [category, setCategory] = useState<BillCategory | 'All'>('All')
  const [position, setPosition] = useState<VotePosition | 'All'>('All')
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Reload from scratch whenever filters or member change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setVotes([])
    setDone(false)

    const params = new URLSearchParams({ id: memberId, limit: String(PAGE_SIZE), offset: '0' })
    if (category !== 'All') params.set('category', category)
    if (position !== 'All') params.set('position', position)

    fetch(`/api/votes?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const fresh: Vote[] = d.votes || []
        setVotes(fresh)
        setSourceUnavailable(Boolean(d.source_unavailable))
        if (fresh.length < PAGE_SIZE) setDone(true)
      })
      .catch(() => {
        if (cancelled) return
        setVotes([])
        setSourceUnavailable(false)
        setDone(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [memberId, category, position])

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || done) return
    setLoadingMore(true)
    const params = new URLSearchParams({
      id: memberId,
      limit: String(PAGE_SIZE),
      offset: String(votes.length),
    })
    if (category !== 'All') params.set('category', category)
    if (position !== 'All') params.set('position', position)

    try {
      const res = await fetch(`/api/votes?${params.toString()}`)
      const d = await res.json()
      const next: Vote[] = d.votes || []
      setVotes((prev) => [...prev, ...next])
      if (next.length < PAGE_SIZE) setDone(true)
    } catch {
      setDone(true)
    } finally {
      setLoadingMore(false)
    }
  }, [memberId, category, position, votes.length, loading, loadingMore, done])

  // Infinite scroll: observe the sentinel
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div>
      {/* Category tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              category === c
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Secondary position filter */}
      <div className="mb-4">
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value as VotePosition | 'All')}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-card focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {POSITIONS.map((p) => <option key={p} value={p}>{p === 'All' ? 'All positions' : p}</option>)}
        </select>
      </div>

      {loading && <div className="py-10 text-center text-sm text-gray-500">Loading votes...</div>}

      {!loading && sourceUnavailable && votes.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-card">
          Vote history is not available from Congress.gov&apos;s member API. This app can still show member profiles and legislation; roll-call vote history needs a separate official vote data source.
        </div>
      )}

      {!loading && !sourceUnavailable && votes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/40 py-10 text-center text-sm text-gray-500">
          No votes match this filter.
        </div>
      )}

      {votes.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card">
          {votes.map((v) => (
            <VoteRow
              key={`${v.congress}-${v.session}-${v.roll_call}-${v.member_id}`}
              vote={v}
            />
          ))}
        </ul>
      )}

      {/* Sentinel + status */}
      {!loading && votes.length > 0 && !done && (
        <div ref={sentinelRef} className="py-6 text-center text-xs text-gray-500">
          {loadingMore ? 'Loading more...' : 'Scroll for more'}
        </div>
      )}
      {!loading && votes.length > 0 && done && (
        <div className="py-6 text-center text-xs text-gray-400">End of votes.</div>
      )}
    </div>
  )
}
