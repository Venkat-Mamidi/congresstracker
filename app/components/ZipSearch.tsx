'use client'

import { useState } from 'react'
import { Member } from '@/lib/congress-api'
import MemberCard from './MemberCard'

export default function ZipSearch() {
  const [zip, setZip] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [approximate, setApproximate] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{5}$/.test(zip)) {
      setError('Please enter a 5-digit zip code.')
      return
    }
    setError(null)
    setLoading(true)
    setSearched(true)
    setApproximate(false)
    try {
      const res = await fetch(`/api/rep?zip=${zip}`)
      const data = await res.json()
      setMembers(data.members || [])
      setApproximate(Boolean(data.approximate))
      if (!res.ok) setError(data.error || 'Lookup failed.')
    } catch {
      setError('Lookup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-card sm:flex-row"
      >
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="Enter your 5-digit zip code"
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
          className="flex-1 rounded-xl border-0 bg-transparent px-4 py-2.5 text-base outline-none placeholder:text-gray-400 focus:ring-0"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Looking up...' : 'Find my reps'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {loading && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex animate-pulse items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-card"
            >
              <div className="h-14 w-14 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {searched && !loading && members.length === 0 && !error && (
        <p className="mt-6 text-sm text-gray-500">No representatives found for that zip code.</p>
      )}

      {members.length > 0 && !loading && (
        <div className="mt-6 animate-slide-up">
          {approximate && (
            <p className="mb-3 text-xs text-gray-500">
              ZIP lookup uses the ZIP centroid, so House district results can be approximate for ZIP codes that cross district lines.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {members.map((m) => <MemberCard key={m.id} member={m} />)}
          </div>
        </div>
      )}
    </div>
  )
}
