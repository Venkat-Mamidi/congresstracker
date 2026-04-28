'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Member } from '@/lib/congress-api'
import MemberCard from './MemberCard'

const STATES = ['', 'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

export default function MemberSearch() {
  const [q, setQ] = useState('')
  const [chamber, setChamber] = useState<'' | 'House' | 'Senate'>('')
  const [state, setState] = useState('')
  const [party, setParty] = useState<'' | 'D' | 'R' | 'I'>('')
  const [results, setResults] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const run = async () => {
      let query = supabase.from('members').select('*').limit(40).order('last_name')
      if (chamber) query = query.eq('chamber', chamber)
      if (state) query = query.eq('state', state)
      if (party) query = query.eq('party_code', party)
      if (q.trim()) query = query.ilike('full_name', `%${q.trim()}%`)

      const { data } = await query
      if (!cancelled) {
        setResults((data as Member[]) || [])
        setLoading(false)
      }
    }

    const t = setTimeout(run, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q, chamber, state, party])

  const baseInput =
    'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-card transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${baseInput} sm:col-span-2`}
        />
        <select
          value={chamber}
          onChange={(e) => setChamber(e.target.value as '' | 'House' | 'Senate')}
          className={baseInput}
        >
          <option value="">Any chamber</option>
          <option value="House">House</option>
          <option value="Senate">Senate</option>
        </select>
        <div className="flex gap-2">
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={`${baseInput} flex-1 px-2`}
          >
            {STATES.map((s) => <option key={s} value={s}>{s || 'Any state'}</option>)}
          </select>
          <select
            value={party}
            onChange={(e) => setParty(e.target.value as '' | 'D' | 'R' | 'I')}
            className={`${baseInput} px-2`}
            aria-label="Filter by political affiliation"
          >
            <option value="">Any political affiliation</option>
            <option value="D">Democrat</option>
            <option value="R">Republican</option>
            <option value="I">Independent</option>
          </select>
        </div>
      </div>

      <div className="mt-5">
        {loading && <p className="text-sm text-gray-500">Searching...</p>}
        {!loading && results.length === 0 && (
          <p className="text-sm text-gray-500">No members match.</p>
        )}
        {!loading && results.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((m) => <MemberCard key={m.id} member={m} />)}
          </div>
        )}
      </div>
    </div>
  )
}
