export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />

      <header className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-6 sm:flex-row sm:items-center">
        <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-gray-200" />
        <div className="flex-1 space-y-3">
          <div className="h-6 w-1/2 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
        </div>
      </header>

      <section>
        <div className="mb-3 h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
              <div className="h-3 w-16 rounded bg-gray-200" />
              <div className="mt-2 h-6 w-12 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-3 h-5 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-56 animate-pulse rounded-lg bg-gray-100" />
        </div>
        <div>
          <div className="mb-3 h-5 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-56 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </section>

      <section>
        <div className="mb-3 h-5 w-32 animate-pulse rounded bg-gray-200" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-white" />
          ))}
        </div>
      </section>
    </div>
  )
}
