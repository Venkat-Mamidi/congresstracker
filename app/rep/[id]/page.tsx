import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Member } from '@/lib/congress-api'
import PartyBadge from '@/app/components/PartyBadge'
import StatsBlock from '@/app/components/StatsBlock'
import VoteList from '@/app/components/VoteList'
import BillList from '@/app/components/BillList'
import VoteBreakdown from '@/app/components/VoteBreakdown'
import AttendanceChart from '@/app/components/AttendanceChart'

export const dynamic = 'force-dynamic'

async function getMember(id: string): Promise<Member | null> {
  const h = headers()
  const host = h.get('host')
  const proto = h.get('x-forwarded-proto') || 'http'
  const base = `${proto}://${host}`

  const res = await fetch(`${base}/api/member?id=${encodeURIComponent(id)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.member as Member) || null
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const member = await getMember(params.id)
  if (!member) return { title: 'Member not found' }

  const role =
    member.chamber === 'Senate'
      ? `U.S. Senator (${member.party_code}-${member.state})`
      : `U.S. Representative (${member.party_code}-${member.state}${member.district ? `-${member.district}` : ''})`

  const title = `${member.full_name} · ${role}`
  const description = `${member.full_name}'s voting record, attendance, party loyalty, and sponsored bills.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: member.photo_url ? [{ url: member.photo_url, width: 450, height: 550, alt: member.full_name }] : [],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: member.photo_url ? [member.photo_url] : [],
    },
  }
}

export default async function MemberProfilePage({ params }: { params: { id: string } }) {
  const member = await getMember(params.id)
  if (!member) notFound()

  const role = member.chamber === 'Senate' ? 'U.S. Senator' : 'U.S. Representative'
  const districtTag =
    member.chamber === 'Senate'
      ? member.state
      : `${member.state}${member.district ? `-${member.district}` : ''}`

  // Tint the hero ring based on party
  const tint =
    member.party_code === 'D'
      ? 'from-blue-500/10 via-transparent to-transparent'
      : member.party_code === 'R'
      ? 'from-red-500/10 via-transparent to-transparent'
      : 'from-purple-500/10 via-transparent to-transparent'

  return (
    <div className="space-y-10 animate-fade-in">
      <div>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-card transition hover:-translate-x-0.5 hover:bg-slate-50"
        >
          <span aria-hidden>&larr;</span>
          <span>Back to search</span>
        </a>
      </div>

      <header
        className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br ${tint} bg-white p-6 shadow-card sm:p-8`}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {member.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.photo_url}
              alt={member.full_name}
              className="h-28 w-28 shrink-0 rounded-full object-cover ring-4 ring-white shadow-md"
            />
          ) : (
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-2xl font-bold text-gray-500 ring-4 ring-white shadow-md">
              {(member.first_name?.[0] || '') + (member.last_name?.[0] || '')}
            </div>
          )}
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              {role} <span className="text-gray-300">&middot;</span> {districtTag}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-display text-slate-900 sm:text-5xl">
                {member.full_name}
              </h1>
              <PartyBadge party={member.party_code} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              {member.years_served != null && member.years_served > 0 && (
                <span>{member.years_served} years served</span>
              )}
              {member.contact_url && (
                <a
                  href={member.contact_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-blue-600 transition hover:text-blue-700"
                >
                  Official site <span aria-hidden>&rarr;</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-display text-slate-900">
          Voting record at a glance
        </h2>
        <StatsBlock member={member} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-semibold tracking-display text-slate-900">Vote breakdown</h2>
          <VoteBreakdown memberId={member.id} />
        </div>
        <div>
          <h2 className="mb-3 text-xl font-semibold tracking-display text-slate-900">Attendance over time</h2>
          <AttendanceChart memberId={member.id} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-display text-slate-900">Recent votes</h2>
        <VoteList memberId={member.id} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-display text-slate-900">Bills</h2>
        <BillList memberId={member.id} />
      </section>
    </div>
  )
}
