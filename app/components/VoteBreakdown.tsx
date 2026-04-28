'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '@/lib/supabase'

interface Counts {
  Yes: number
  No: number
  Present: number
  'Not Voting': number
}

const COLORS: Record<keyof Counts, string> = {
  Yes: '#16a34a',         // green-600
  No: '#dc2626',          // red-600
  Present: '#ca8a04',     // yellow-600
  'Not Voting': '#6b7280', // gray-500
}

export default function VoteBreakdown({ memberId }: { memberId: string }) {
  const [counts, setCounts] = useState<Counts | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Fetch up to 1000 votes; aggregate client-side
      const { data } = await supabase
        .from('votes')
        .select('vote_position')
        .eq('member_id', memberId)
        .limit(1000)

      const c: Counts = { Yes: 0, No: 0, Present: 0, 'Not Voting': 0 }
      for (const row of (data || []) as { vote_position: keyof Counts }[]) {
        if (row.vote_position in c) c[row.vote_position]++
      }
      if (!cancelled) setCounts(c)
    }
    load()
    return () => { cancelled = true }
  }, [memberId])

  const data = useMemo(() => {
    if (!counts) return []
    return (Object.keys(counts) as (keyof Counts)[]).map((k) => ({ name: k, value: counts[k] }))
  }, [counts])

  const total = data.reduce((sum, row) => sum + row.value, 0)

  if (!counts) {
    return <div className="h-56 animate-pulse rounded-2xl bg-gray-100" />
  }
  if (total === 0) {
    return <p className="text-sm text-gray-500">No vote data to break down yet.</p>
  }

  return (
    <div className="h-56 w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-card">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
          <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name as keyof Counts]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
