'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Member } from '@/lib/congress-api'
import PartyBadge from './PartyBadge'

interface Props {
  label?: string
  placeholder?: string
  value: Member | null
  onChange: (member: Member | null) => void
  excludeIds?: string[]
}

// Cache the member list across instances so each autocomplete doesn't re-fetch
let MEMBERS_CACHE: Member[] | null = null
let MEMBERS_PROMISE: Promise<Member[]> | null = null

async function loadAllMembers(): Promise<Member[]> {
  if (MEMBERS_CACHE) return MEMBERS_CACHE
  if (MEMBERS_PROMISE) return MEMBERS_PROMISE

  MEMBERS_PROMISE = (async () => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .order('last_name')
      .limit(1000)

      MEMBERS_CACHE = (data as Member[]) || []
      return MEMBERS_CACHE
  })()
  return MEMBERS_PROMISE
}

export default function MemberAutocomplete({
  label,
  placeholder = 'Click to browse, or type to filterâ€¦',
  value,
  onChange,
  excludeIds = [],
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [allMembers, setAllMembers] = useState<Member[]>(MEMBERS_CACHE || [])
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds])

  // Load member list once
  useEffect(() => {
    if (MEMBERS_CACHE) return
    let cancelled = false
    loadAllMembers().then((list) => {
      if (!cancelled) setAllMembers(list)
    })
    return () => { cancelled = true }
  }, [])

  // Filter client-side as the user types
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = allMembers.filter((m) => !excludeSet.has(m.id))
    if (!q) return base
    return base.filter((m) => {
      const hay = `${m.full_name} ${m.state} ${m.party_code}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, allMembers, excludeSet])

  // Reset highlight when results change
  useEffect(() => { setHighlight(0) }, [query, allMembers.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(member: Member) {
    onChange(member)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setQuery('')
    setOpen(true)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && results[highlight]) {
        e.preventDefault()
        pick(results[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const loading = allMembers.length === 0

  return (
    <div ref={wrapRef} className="relative">
      {label && (
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </label>
      )}

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-900">{value.full_name}</span>
            <PartyBadge party={value.party_code} />
            <span className="text-xs text-gray-500">
              {value.chamber === 'Senate' ? 'Sen' : 'Rep'} Â· {value.state}
              {value.district ? `-${value.district}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={clear}
            className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
          >
            Change
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}

      {!value && open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-xs text-gray-500">Loading membersâ€¦</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">No members match.</div>
          )}
          {!loading && results.length > 0 && (
            <ul ref={listRef} className="max-h-72 overflow-y-auto">
              {results.map((m, i) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(m)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                      i === highlight ? 'bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{m.full_name}</span>
                      <PartyBadge party={m.party_code} />
                    </span>
                    <span className="text-xs text-gray-500">
                      {m.chamber === 'Senate' ? 'Sen' : 'Rep'} Â· {m.state}
                      {m.district ? `-${m.district}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
