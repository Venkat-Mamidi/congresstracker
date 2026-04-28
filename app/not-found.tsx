import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        404
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-display text-slate-900 sm:text-5xl">
        Not found
      </h1>
      <p className="mt-3 text-base text-slate-600">
        We couldn&apos;t find that member, page, or resource. They may have left office, or the link may be wrong.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-card transition hover:bg-slate-50"
        >
          <span aria-hidden>&larr;</span>
          <span>Back to home</span>
        </Link>
      </div>
    </div>
  )
}
