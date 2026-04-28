'use client'

import { useEffect, useState } from 'react'
import { Bill, BillStatus } from '@/lib/congress-api'

const ROLES: ('All' | 'sponsor' | 'cosponsor')[] = ['All', 'sponsor', 'cosponsor']
const STATUSES: ('All' | BillStatus)[] = ['All', 'Introduced', 'In Committee', 'Passed House', 'Became Law']

const STATUS_STYLES: Record<BillStatus, string> = {
  Introduced: 'bg-gray-50 text-gray-700 ring-gray-200',
  'In Committee': 'bg-blue-50 text-blue-700 ring-blue-200',
  'Passed House': 'bg-purple-50 text-purple-700 ring-purple-200',
  'Became Law': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

function formatDate(value?: string) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default function BillList({ memberId }: { memberId: string }) {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'All' | 'sponsor' | 'cosponsor'>('All')
  const [status, setStatus] = useState<'All' | BillStatus>('All')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ id: memberId, limit: '50' })
    if (role !== 'All') params.set('role', role)
    if (status !== 'All') params.set('status', status)

    fetch(`/api/bills?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setBills(d.bills || []))
      .catch(() => setBills([]))
      .finally(() => setLoading(false))
  }, [memberId, role, status])

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'All' | 'sponsor' | 'cosponsor')}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm capitalize shadow-card focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'All' | BillStatus)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-card focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && <div className="py-10 text-center text-sm text-gray-500">Loading bills...</div>}
      {!loading && bills.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/40 py-10 text-center text-sm text-gray-500">
          No bills match this filter.
        </div>
      )}
      {bills.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card">
          {bills.map((b) => (
            <li key={`${b.bill_id}-${b.role}`} className="group flex items-start gap-3 px-4 py-3.5 transition hover:bg-gray-50/60">
              <span
                className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[b.status as BillStatus] || STATUS_STYLES.Introduced}`}
              >
                {b.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-gray-900">{b.title || b.bill_id}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="capitalize">{b.role}</span>
                  {b.bill_id && (
                    <>
                      <span className="text-gray-300">&middot;</span>
                      <span className="font-mono text-[11px] text-gray-400">{b.bill_id}</span>
                    </>
                  )}
                  {b.introduced_date && (
                    <>
                      <span className="text-gray-300">&middot;</span>
                      <span>{formatDate(b.introduced_date)}</span>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
