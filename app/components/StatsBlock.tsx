import { Member } from '@/lib/congress-api'

function StatTile({
  label,
  value,
  suffix,
  valueClass,
}: {
  label: string
  value: string | number
  suffix?: string
  valueClass?: string
}) {
  const hasValue = value !== 'N/A'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card transition hover:shadow-card-hover">
      <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`tabular-stats mt-1.5 text-3xl font-bold tracking-display ${valueClass || 'text-gray-900'}`}>
        {value}
        {suffix && hasValue && (
          <span className="ml-0.5 text-lg font-medium text-gray-400">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function attendanceColor(pct: number | undefined | null): string {
  if (pct == null) return 'text-gray-900'
  if (pct > 95) return 'text-emerald-600'
  if (pct >= 85) return 'text-amber-600'
  return 'text-red-600'
}

export default function StatsBlock({ member }: { member: Member }) {
  const totalVotes = member.total_votes && member.total_votes > 0 ? member.total_votes.toLocaleString() : 'N/A'
  const billsSponsored = member.bills_sponsored && member.bills_sponsored > 0 ? member.bills_sponsored.toLocaleString() : 'N/A'

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Attendance"
        value={member.attendance_pct != null ? member.attendance_pct.toFixed(1) : 'N/A'}
        suffix="%"
        valueClass={attendanceColor(member.attendance_pct)}
      />
      <StatTile
        label="Party loyalty"
        value={member.party_loyalty_pct != null ? member.party_loyalty_pct.toFixed(1) : 'N/A'}
        suffix="%"
      />
      <StatTile label="Total votes" value={totalVotes} />
      <StatTile label="Bills sponsored" value={billsSponsored} />
    </div>
  )
}
