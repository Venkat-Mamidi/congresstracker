'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Member } from '@/lib/congress-api'
import MemberAutocomplete from './MemberAutocomplete'

export default function QuickCompare() {
  const router = useRouter()
  const [a, setA] = useState<Member | null>(null)
  const [b, setB] = useState<Member | null>(null)
  const [error, setError] = useState<string | null>(null)

  function go() {
    if (!a || !b) {
      setError('Pick two members.')
      return
    }
    if (a.id === b.id) {
      setError('Pick two different members.')
      return
    }
    setError(null)
    const params = new URLSearchParams({ a: a.id, b: b.id })
    router.push(`/compare?${params.toString()}`)
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-display text-slate-900">Compare two members</h2>
        <p className="mt-1 text-sm text-gray-600">
          Search for any two members to see how often they vote the same way.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <MemberAutocomplete
            label="Member 1"
            placeholder="Search for member 1..."
            value={a}
            onChange={setA}
            excludeIds={b ? [b.id] : []}
          />
          <MemberAutocomplete
            label="Member 2"
            placeholder="Search for member 2..."
            value={b}
            onChange={setB}
            excludeIds={a ? [a.id] : []}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={go}
            disabled={!a || !b}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            Compare &rarr;
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </section>
  )
}
