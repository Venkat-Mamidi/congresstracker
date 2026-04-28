import { Vote, VotePosition, BillCategory } from '@/lib/congress-api'

const POSITION_STYLES: Record<VotePosition, string> = {
  Yes: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  No: 'bg-red-50 text-red-700 ring-red-200',
  Present: 'bg-amber-50 text-amber-700 ring-amber-200',
  'Not Voting': 'bg-gray-50 text-gray-600 ring-gray-200',
}

const CATEGORY_STYLES: Record<BillCategory, string> = {
  Healthcare: 'bg-rose-50 text-rose-700',
  Defense: 'bg-slate-100 text-slate-700',
  Economy: 'bg-emerald-50 text-emerald-700',
  Immigration: 'bg-amber-50 text-amber-800',
  Environment: 'bg-green-50 text-green-700',
  Education: 'bg-indigo-50 text-indigo-700',
  Infrastructure: 'bg-orange-50 text-orange-700',
  Technology: 'bg-cyan-50 text-cyan-700',
  Housing: 'bg-fuchsia-50 text-fuchsia-700',
  Other: 'bg-gray-50 text-gray-600',
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function PartyAlignment({ value }: { value?: boolean }) {
  if (value === true) {
    return (
      <span
        title="Voted with party"
        aria-label="Voted with party"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100"
      >
        &#10003;
      </span>
    )
  }
  if (value === false) {
    return (
      <span
        title="Voted against party"
        aria-label="Voted against party"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-700 ring-1 ring-red-100"
      >
        &#10007;
      </span>
    )
  }
  return (
    <span
      title="Party alignment unknown"
      aria-label="Party alignment unknown"
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-50 text-xs font-bold text-gray-400 ring-1 ring-gray-100"
    >
      &mdash;
    </span>
  )
}

export default function VoteRow({ vote }: { vote: Vote }) {
  const category = (vote.bill_category || 'Other') as BillCategory
  const position = vote.vote_position
  return (
    <li className="group flex items-start gap-3 px-4 py-3.5 transition hover:bg-gray-50/60">
      <span
        className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${POSITION_STYLES[position] || POSITION_STYLES['Not Voting']}`}
      >
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-gray-900">
          {vote.bill_title_plain || vote.bill_title_raw || 'Untitled'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{formatDate(vote.vote_date)}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLES[category] || CATEGORY_STYLES.Other}`}
          >
            {category}
          </span>
          {vote.bill_id && (
            <span className="font-mono text-[11px] text-gray-400">{vote.bill_id}</span>
          )}
        </div>
      </div>
      <PartyAlignment value={vote.voted_with_party} />
    </li>
  )
}
