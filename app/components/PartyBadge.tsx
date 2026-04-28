import { PartyCode } from '@/lib/congress-api'

const STYLES: Record<PartyCode, string> = {
  D: 'bg-blue-50 text-blue-700 ring-blue-200',
  R: 'bg-red-50 text-red-700 ring-red-200',
  I: 'bg-purple-50 text-purple-700 ring-purple-200',
}

export default function PartyBadge({ party }: { party: PartyCode }) {
  return (
    <span
      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${STYLES[party] || STYLES.I}`}
    >
      {party}
    </span>
  )
}
