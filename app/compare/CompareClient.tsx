'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Member } from '@/lib/congress-api'
import PartyBadge from '@/app/components/PartyBadge'
import MemberAutocomplete from '@/app/components/MemberAutocomplete'
import StatsBlock from '@/app/components/StatsBlock'

interface ComparePair {
  a: string
  b: string
  total: number
  agreed: number
  agreement_pct: number
  by_category: { category: string; total: number; agreed: number; agreement_pct: number }[]
}

interface CompareResponse {
  members: Member[]
  pairs: ComparePair[]
}

function idsFromSearch(searchParams: URLSearchParams) {
  const ordered = [
    ...searchParams.getAll('id'),
    searchParams.get('a'),
    searchParams.get('b'),
    searchParams.get('c'),
    searchParams.get('d'),
  ].filter(Boolean) as string[]

  return Array.from(new Set(ordered)).slice(0, 4)
}

function buildCompareParams(ids: string[]) {
  const params = new URLSearchParams()
  const keys = ['a', 'b', 'c', 'd']
  ids.slice(0, 4).forEach((id, index) => params.set(keys[index], id))
  return params
}

function MemberColumn({ member }: { member: Member }) {
  const role = member.chamber === 'Senate' ? 'U.S. Senator' : 'U.S. Representative'
  const districtTag =
    member.chamber === 'Senate'
      ? member.state
      : `${member.state}${member.district ? `-${member.district}` : ''}`

  // Soft party tint as the column background
  const tint =
    member.party_code === 'D'
      ? 'from-blue-50 to-transparent'
      : member.party_code === 'R'
      ? 'from-red-50 to-transparent'
      : 'from-purple-50 to-transparent'

  return (
    <div
      className={`flex flex-col items-center rounded-2xl bg-gradient-to-b ${tint} p-6 text-center ring-1 ring-inset ring-slate-200/60`}
    >
      <Link href={`/rep/${member.id}`} className="block transition hover:opacity-90">
        {member.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.photo_url}
            alt={member.full_name}
            className="h-24 w-24 rounded-full object-cover ring-4 ring-white shadow-md"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-xl font-bold text-slate-500 ring-4 ring-white shadow-md">
            {(member.first_name?.[0] || '') + (member.last_name?.[0] || '')}
          </div>
        )}
      </Link>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {role} <span className="text-slate-300">&middot;</span> {districtTag}
      </div>
      <Link
        href={`/rep/${member.id}`}
        className="mt-1 text-lg font-bold tracking-display text-slate-900 transition hover:text-slate-700"
      >
        {member.full_name}
      </Link>
      <div className="mt-1.5">
        <PartyBadge party={member.party_code} />
      </div>
      <div className="mt-5 w-full">
        <StatsBlock member={member} />
      </div>
      <Link
        href={`/rep/${member.id}`}
        className="mt-5 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-card transition hover:bg-slate-50"
      >
        View full profile <span aria-hidden>&rarr;</span>
      </Link>
    </div>
  )
}

function CompareClientInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const [a, setA] = useState<Member | null>(null)
  const [b, setB] = useState<Member | null>(null)
  const [result, setResult] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If URL contains member ids, run compare on mount and any URL change
  useEffect(() => {
    const ids = idsFromSearch(new URLSearchParams(queryString))
    if (ids.length < 2) return
    runCompare(ids, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  async function runCompare(inputIds?: string[], updateUrl = true) {
    const ids = inputIds
      ? Array.from(new Set(inputIds.filter(Boolean))).slice(0, 4)
      : [a?.id, b?.id].filter(Boolean) as string[]

    if (ids.length < 2) {
      setError('Pick two members.')
      return
    }
    if (ids[0] === ids[1]) {
      setError('Pick two different members.')
      return
    }

    setError(null)
    setLoading(true)

    if (updateUrl) {
      const params = buildCompareParams(ids)
      router.push(`/compare?${params.toString()}`)
    }

    try {
      const params = buildCompareParams(ids)
      const res = await fetch(`/api/compare?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Compare failed.')
        setResult(null)
      } else {
        setResult(data)
        // Sync local picker state with the first two returned members
        if (data.members?.[0]) setA(data.members[0])
        if (data.members?.[1]) setB(data.members[1])
      }
    } catch {
      setError('Compare failed.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const memberById = Object.fromEntries((result?.members || []).map((m) => [m.id, m]))

  function reset() {
    setA(null)
    setB(null)
    setResult(null)
    setError(null)
    router.push('/compare')
  }

  return (
    <div className="space-y-10 animate-fade-in">
      <div>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-card transition hover:-translate-x-0.5 hover:bg-slate-50"
        >
          <span aria-hidden>&larr;</span>
          <span>Back to home</span>
        </a>
      </div>

      <header>
        <h1 className="font-display text-3xl font-semibold tracking-display text-slate-900 sm:text-5xl">
          Compare members
        </h1>
        <p className="mt-2 text-base text-slate-600">
          See how often two members vote the same way on shared roll calls.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <MemberAutocomplete
            label="Member 1"
            value={a}
            onChange={setA}
            excludeIds={b ? [b.id] : []}
          />
          <MemberAutocomplete
            label="Member 2"
            value={b}
            onChange={setB}
            excludeIds={a ? [a.id] : []}
          />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => runCompare()}
            disabled={loading || !a || !b}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {loading ? 'Comparing...' : 'Compare'}
          </button>
          {(result || a || b) && (
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-card transition hover:bg-slate-50"
            >
              Start over
            </button>
          )}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </section>

      {result && result.pairs.map((pair) => {
        const ma = memberById[pair.a]
        const mb = memberById[pair.b]
        if (!ma || !mb) return null

        // Color the agreement score based on bucket + map to a verdict label
        const pct = pair.agreement_pct
        let scoreColor = 'text-slate-900'
        let scoreGradient = 'from-slate-100 to-slate-50'
        let verdictLabel = 'No data'
        let verdictStyle = 'bg-slate-100 text-slate-700 ring-slate-200'
        if (pair.total > 0) {
          if (pct >= 90) {
            scoreColor = 'text-emerald-700'
            scoreGradient = 'from-emerald-100 to-emerald-50'
            verdictLabel = 'Strongly aligned'
            verdictStyle = 'bg-emerald-100 text-emerald-800 ring-emerald-200'
          } else if (pct >= 70) {
            scoreColor = 'text-emerald-700'
            scoreGradient = 'from-emerald-50 to-emerald-100/40'
            verdictLabel = 'Often agree'
            verdictStyle = 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          } else if (pct >= 40) {
            scoreColor = 'text-amber-700'
            scoreGradient = 'from-amber-50 to-amber-100/40'
            verdictLabel = 'Mixed record'
            verdictStyle = 'bg-amber-50 text-amber-800 ring-amber-200'
          } else if (pct >= 15) {
            scoreColor = 'text-orange-700'
            scoreGradient = 'from-orange-50 to-orange-100/40'
            verdictLabel = 'Often disagree'
            verdictStyle = 'bg-orange-50 text-orange-800 ring-orange-200'
          } else {
            scoreColor = 'text-red-700'
            scoreGradient = 'from-red-50 to-red-100/40'
            verdictLabel = 'Strongly opposed'
            verdictStyle = 'bg-red-50 text-red-800 ring-red-200'
          }
        }

        return (
          <div
            key={`${pair.a}-${pair.b}`}
            className="animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
          >
            {/* Header strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:px-8">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Voting overlap
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${verdictStyle}`}
              >
                {verdictLabel}
              </span>
            </div>

            {/* Two-column layout with centered overlap score */}
            <div className="grid items-stretch gap-8 p-6 sm:p-8 md:grid-cols-[1fr_auto_1fr] md:gap-10 md:p-10">
              <MemberColumn member={ma} />

              <div
                className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br ${scoreGradient} px-8 py-8 ring-1 ring-inset ring-white/60 md:min-w-[200px]`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Agreement
                </div>
                <div className={`tabular-stats font-display text-6xl font-semibold tracking-display sm:text-7xl ${scoreColor}`}>
                  {pct}
                  <span className="text-3xl font-semibold opacity-70 sm:text-4xl">%</span>
                </div>
                <div className="text-xs text-slate-600">
                  {pair.agreed.toLocaleString()} of {pair.total.toLocaleString()} shared votes
                </div>
                {pair.total === 0 && (
                  <p className="mt-1 max-w-[14rem] text-center text-xs text-slate-500">
                    No shared roll-call votes found for this pair.
                  </p>
                )}
              </div>

              <MemberColumn member={mb} />
            </div>

            {pair.by_category.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-6 sm:p-8 md:p-10">
                <div className="mb-5 flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Agreement by category</h3>
                  <span className="text-xs text-slate-500">
                    {pair.by_category.length} categor{pair.by_category.length === 1 ? 'y' : 'ies'}
                  </span>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {pair.by_category.map((category) => {
                    const cpct = category.agreement_pct
                    let bar = 'bg-slate-300'
                    let pillBg = 'bg-slate-50 text-slate-700'
                    if (cpct >= 75) {
                      bar = 'bg-emerald-500'
                      pillBg = 'bg-emerald-50 text-emerald-700'
                    } else if (cpct >= 40) {
                      bar = 'bg-amber-500'
                      pillBg = 'bg-amber-50 text-amber-800'
                    } else {
                      bar = 'bg-red-400'
                      pillBg = 'bg-red-50 text-red-700'
                    }
                    return (
                      <li
                        key={category.category}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-card"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-800">{category.category}</span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${pillBg}`}
                          >
                            {cpct}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full ${bar} transition-all`}
                            style={{ width: `${Math.min(100, Math.max(0, cpct))}%` }}
                          />
                        </div>
                        <div className="mt-1.5 text-[11px] text-slate-500">
                          {category.agreed.toLocaleString()} of {category.total.toLocaleString()} shared votes
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function CompareClient() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading compareâ€¦</div>}>
      <CompareClientInner />
    </Suspense>
  )
}
