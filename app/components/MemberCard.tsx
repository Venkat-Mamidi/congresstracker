import Link from 'next/link'
import { Member } from '@/lib/congress-api'
import PartyBadge from './PartyBadge'

export default function MemberCard({ member }: { member: Member }) {
  const role = member.chamber === 'Senate' ? 'Senator' : 'Representative'
  const districtTag =
    member.chamber === 'Senate'
      ? member.state
      : `${member.state}${member.district ? `-${member.district}` : ''}`

  return (
    <Link
      href={`/rep/${member.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-card-hover"
    >
      {member.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.photo_url}
          alt={member.full_name}
          className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow-sm"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-sm font-semibold text-gray-600 ring-2 ring-white shadow-sm">
          {(member.first_name?.[0] || '') + (member.last_name?.[0] || '')}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold text-gray-900 group-hover:text-blue-700">
            {member.full_name}
          </h3>
          <PartyBadge party={member.party_code} />
        </div>
        <p className="mt-0.5 text-sm text-gray-500">
          {role} <span className="text-gray-300">&middot;</span> {districtTag}
        </p>
      </div>
      <span className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600">
        &rarr;
      </span>
    </Link>
  )
}
