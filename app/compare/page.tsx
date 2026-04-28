import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Member } from '@/lib/congress-api'
import CompareClient from './CompareClient'

export const dynamic = 'force-dynamic'

async function getMember(id: string): Promise<Member | null> {
  const h = headers()
  const host = h.get('host')
  const proto = h.get('x-forwarded-proto') || 'http'
  const base = `${proto}://${host}`
  const res = await fetch(`${base}/api/member?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return (data.member as Member) || null
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { a?: string; b?: string; c?: string; d?: string; id?: string | string[] }
}): Promise<Metadata> {
  const ids = [
    ...(Array.isArray(searchParams.id) ? searchParams.id : searchParams.id ? [searchParams.id] : []),
    searchParams.a,
    searchParams.b,
    searchParams.c,
    searchParams.d,
  ].filter(Boolean) as string[]

  if (ids.length < 2) {
    return {
      title: 'Compare members',
      description: 'See how often two members of Congress vote the same way.',
    }
  }

  const members = await Promise.all(ids.slice(0, 4).map((id) => getMember(id)))
  const named = members.filter((m): m is Member => Boolean(m))
  if (named.length < 2) {
    return {
      title: 'Compare members',
      description: 'See how often two members of Congress vote the same way.',
    }
  }

  const label = named.map((m) => `${m.full_name} (${m.party_code}-${m.state})`).join(' vs. ')
  const title = `${label} â€” compare voting records`
  const description = `Side-by-side comparison of voting records, attendance, and party loyalty.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default function ComparePage() {
  return <CompareClient />
}
