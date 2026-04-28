'use client'

import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '@/lib/supabase'

export default function AttendanceChart({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<{ vote_date: string; vote_position: string }[] | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('votes')
        .select('vote_date, vote_position')
        .eq('member_id', memberId)
        .order('vote_date', { ascending: true })
        .limit(2000)
      if (!cancelled) setRows((data as { vote_date: string; vote_position: string }[]) || [])
    }
    load()
    return () => { cancelled = true }
  }, [memberId])

  // Bin by year-month: attendance % = (votes != 'Not Voting') / total
  const monthly = useMemo(() => {
    if (!rows) return []
    const buckets = new Map<string, { total: number; attended: number }>()
    for (const r of rows) {
      if (!r.vote_date) continue
      const ym = r.vote_date.slice(0, 7) // YYYY-MM
      const b = buckets.get(ym) || { total: 0, attended: 0 }
      b.total++
      if (r.vote_position !== 'Not Voting') b.attended++
      buckets.set(ym, b)
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([ym, b]) => ({
        month: ym,
        label: new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        attendance: b.total > 0 ? Math.round((b.attended / b.total) * 1000) / 10 : 0,
      }))
  }, [rows])

  if (!rows) {
    return <div className="h-56 animate-pulse rounded-2xl bg-gray-100" />
  }
  if (monthly.length === 0) {
    return <p className="text-sm text-gray-500">No attendance trend available yet.</p>
  }

  return (
    <div className="h-56 w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-card">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6b7280" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#6b7280" unit="%" />
          <Tooltip formatter={(value: number) => [`${value}%`, 'Attendance']} />
          <Line
            type="monotone"
            dataKey="attendance"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
