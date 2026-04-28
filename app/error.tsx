'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-red-600">
        Something went wrong
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-display text-slate-900 sm:text-5xl">
        Hmm, that didn&apos;t work.
      </h1>
      <p className="mt-3 text-base text-slate-600">
        We hit an unexpected error. It&apos;s likely a temporary upstream issue (Congress.gov, Supabase, or the geocoder). Try again in a moment.
      </p>
      {error?.digest && (
        <p className="mt-2 font-mono text-xs text-slate-400">Error id: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Try again
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-card transition hover:bg-slate-50"
        >
          <span aria-hidden>&larr;</span>
          <span>Back to home</span>
        </a>
      </div>
    </div>
  )
}
