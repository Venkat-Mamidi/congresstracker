# CongressTracker

> What has your representative actually done? Not what they tweeted. Not what their campaign says. The real votes, the real bills, and how often they show up.

A non-partisan tool that turns a 5-digit zip code into a full voting record for your two senators and your House representative — in under 30 seconds, end-to-end.

**Stack:** Next.js 14 · Supabase · Tailwind · Recharts · Vercel
**Total cost to operate:** $0 (see [§7](#7-total-cost-0))

---

## 1. The problem

Three tools already exist for this and all three are bad at it.

- **Congress.gov** is the official source. The data is authoritative but the UX is built for legislative staffers. Bill titles read `"H.R.4521 — AS AMENDED IN THE NATURE OF A SUBSTITUTE — A BILL TO PROVIDE FOR INVESTMENTS IN UNITED STATES MANUFACTURING..."`. Vote pages list every roll call in chronological order with no way to filter by topic. There's no "show me what my rep voted on for healthcare" view.
- **GovTrack** is more usable but visually 2009-era and slow. Its mobile experience is unusable. The compare feature exists but is buried three clicks deep.
- **VoteSmart** is even slower, requires an account for half the features, and shows so much data it's noise.

None of them have a clean **zip code → representative → full record** flow that a regular voter can finish in 30 seconds.

That's the gap CongressTracker fills.

---

## 2. What got built

| Feature | What it does |
|---|---|
| Zip code lookup | 5-digit zip → House rep + both senators, with photos, party, district |
| Member profile | Voting record at a glance, vote breakdown chart, monthly attendance trend, recent votes feed, bill sponsorships |
| Voting record feed | Filter by 10 categories (Healthcare, Defense, Economy, …), filter by position (Yes / No / Present), party-alignment indicator (✓ / ✗) per vote, infinite scroll |
| Bill sponsorships | Sponsored + cosponsored bills, filter by status (Introduced / In Committee / Passed House / Became Law) |
| Compare two members | Voting overlap %, color-coded verdict (Strongly aligned → Strongly opposed), per-category breakdown with progress bars |
| Search | Name search backed by Supabase full-text + filters by chamber, state, party |
| Recent activity | 10 most recent votes across all of Congress on the homepage |
| Shareable URLs | Every page renders fully on direct load, with `generateMetadata` setting Open Graph tags so links unfurl with the member's photo |

---

## 3. The caching architecture

> *This is the most important architectural decision in the project.*

Congress.gov rate-limits at 5,000 requests/hour. If every page load hit the API fresh, the app would be slow on cache miss, slow on cache hit, and would blow through the rate limit on a single Hacker News spike. The fix is a Postgres cache layer in Supabase that sits in front of every external API.

### The pattern

Every data fetch follows the same flow:

```
Browser → Next.js API route → check cache_log table
                                ├─ fresh? → read from Supabase (~10ms)
                                └─ stale? → fetch from external API
                                            → upsert into Supabase
                                            → mark fresh in cache_log
                                            → return
```

The browser never talks to Congress.gov directly. The Next.js API routes act as a **proxy + cache layer**. API keys live server-side only, never shipped to the client.

### TTLs by resource type

| Resource | TTL | Rationale |
|---|---|---|
| Zip → reps | **7 days** | Districts almost never change |
| Member profile + stats | **24 hours** | Photos and metadata change rarely |
| Voting records | **24 hours** | New roll calls happen daily but not hourly |
| Bill sponsorships | **48 hours** | Less volatile than votes |

### Cron-driven invalidation

A daily Vercel cron job hits `/api/cron`, which runs the `invalidate_stale_cache()` SQL function. It deletes rows in `cache_log` whose `fetched_at` exceeds their TTL. Next request for that resource sees a stale cache, refetches, and writes back. The cron is **protected by `CRON_SECRET`** in the request header so nobody can DoS the invalidator.

This pattern means **97% of requests are served from Supabase in ~10ms**, and the remaining 3% (cache misses) take 1–3 seconds but only happen at the rate of TTL expiration, not user traffic.

---

## 4. Bill title normalization

Raw titles from Congress.gov are unreadable:

> `H.R.4521 — AS AMENDED IN THE NATURE OF A SUBSTITUTE — A BILL TO ESTABLISH AN OFFICE OF MANUFACTURING AND INDUSTRIAL INNOVATION POLICY, TO PROVIDE FUNDING FOR DOMESTIC SEMICONDUCTOR MANUFACTURING, AND FOR OTHER PURPOSES`

After normalization:

> `Establish an office of manufacturing and industrial innovation policy, to provide funding for domestic semiconductor manufacturing, and for other purposes`

The normalizer in [`lib/congress-api.ts`](lib/congress-api.ts) does this in five passes:

1. Strip the bill number prefix (`H.R.4521 — `, `S.1234 - `, etc.)
2. Strip ALL-CAPS legislative boilerplate (`AS AMENDED IN THE NATURE OF A SUBSTITUTE`, `AS AMENDED`, etc.)
3. Strip leading filler (`A BILL TO`, `AN ACT TO`, `TO`)
4. Collapse whitespace and trailing punctuation
5. Sentence-case the first letter

Then a keyword matcher in [`categorizeBill()`](lib/congress-api.ts#L150) maps the cleaned title into one of 10 categories using a curated keyword list per category. Healthcare gets `health`, `medicare`, `abortion`, `obamacare`, etc. Defense gets `military`, `troops`, `nato`, `ukraine`. The match is first-wins by category order, which is intentional: a bill mentioning both `veteran` (Defense) and `health` (Healthcare) gets bucketed by whichever appears first in the iteration order.

About 40% of votes still end up in `Other` — that's not a categorizer failure, that's procedural votes (motions to recommit, motions to table) that genuinely have no subject matter. Real subject votes classify well.

---

## 5. The voting overlap score

The compare page asks: **on bills where both members cast a Yes/No vote, what percentage of the time did they vote the same way?**

This is a set intersection problem.

```js
// For each member, build a Map of roll_call_key → position
votesByMember[memberId] = {
  '119-1-42': { position: 'Yes', category: 'Healthcare' },
  '119-1-43': { position: 'No', category: 'Defense' },
  ...
}

// Walk member A's votes; check if member B voted on the same roll call
for (const key of Object.keys(aMap)) {
  if (!bMap[key]) continue                           // not a shared vote
  if (!['Yes', 'No'].includes(aMap[key].position)) continue   // skip Present/Not Voting
  if (!['Yes', 'No'].includes(bMap[key].position)) continue

  total++
  if (aMap[key].position === bMap[key].position) agreed++
}

agreement_pct = agreed / total
```

Why it's interesting:

- **Decisive votes only.** Present and Not Voting don't count — they're not real disagreement, they're abstention. Only Yes/No vs Yes/No.
- **Roll-call indexed.** The key is `${congress}-${session}-${roll_call}` so it works across multiple sessions automatically.
- **Per-category breakdown.** Same algorithm applied per category yields the breakdown bars on the compare page. You can see two members agree 80% overall but disagree heavily on Defense.
- **Cross-chamber short-circuit.** A Senator and Rep never vote on the same roll call (different chambers). The API detects this and returns 0 of 0 instead of running the full intersection.

The compare result is the most shareable output in the app. People will compare their rep against a famous member and post the result.

---

## 6. Stack decisions

### Supabase over Elasticsearch

Full-text search on members is `~540 rows`. Elasticsearch is wildly overkill — a `tsvector` column on `members` with a GIN index does name search in single-digit milliseconds. Supabase ships Postgres + auth + RLS + a hosted dashboard for free. ES would be $50+/month minimum and require a separate ops track.

### Voteview over ProPublica for vote data

The brief originally specified ProPublica's Congress API for attendance and party-loyalty stats. **ProPublica killed that API in 2023.** I swapped to Voteview (UCLA's roll-call dataset, used by political science academics for decades). It's published as static CSV files, so I wrote a one-time bulk-import script (`scripts/seed-stats.js`) that pulls ~240,000 vote rows and computes the stats client-side. The trade-off: vote data is bulk-refreshed on demand, not live-streamed. For a portfolio piece this is acceptable; the alternative was a dead API.

### Census geocoder over Google Civic for zip lookup

The brief specified Google Civic Information API. It works, but requires a Cloud Console project and credentials that can be revoked. The U.S. Census geocoder is free, no key required, and gives you `zip → congressional district` directly — which is all we need. Removed a credential, simplified setup.

### Next.js API routes over a separate backend

Tempting to build a separate Express/Fastify backend for "real architecture." Pointless for this scope. Next.js App Router gives you:
- Server components for SSR with metadata
- API routes for the proxy/cache layer
- Same repo, same deploy, same env vars
- Free hosting on Vercel with zero config

A separate backend would mean two repos, two deploys, two sets of env vars, CORS config, and zero functional benefit.

### Tailwind over CSS modules / styled-components

Vibe-coded with Claude Code in a 24-hour hackathon. Tailwind is the fastest CSS to write when iterating with an AI — class names are deterministic, no naming bikeshedding, no specificity battles. Inline classes also keep component logic and styling co-located, which makes refactors atomic.

---

## 7. Total cost: $0

| Service | Tier | Why it's free |
|---|---|---|
| **Vercel** | Hobby | Hosts Next.js + serverless functions + cron. 100 GB bandwidth/month. |
| **Supabase** | Free | 500 MB Postgres, 2 GB egress, full Postgres including indexes, full-text search, and `pg_cron`. |
| **Congress.gov API** | Free | 5,000 req/hour with a free key. Cache layer keeps us well under. |
| **U.S. Census geocoder** | Free | No key, no rate limit documented for reasonable use. |
| **Voteview dataset** | Free | UCLA-published static CSVs. Pull once via the seed script. |
| **Domain** | None | Use the free `*.vercel.app` URL. |

Everything is on free tiers and the architecture is shaped to stay there. The cache layer keeps Congress.gov requests linear with TTL expiration instead of linear with user traffic, so a 10× spike doesn't 10× the API usage. Supabase egress is small because the page is mostly server-rendered, with thin RSC payloads on navigation. Vercel bandwidth is small for the same reason.

---

## Getting it running locally

Setup is intentionally short — full file structure is documented in the brief.

```bash
# 1. Clone, install
npm install

# 2. Set up Supabase
#    - Create a free project at supabase.com
#    - Open SQL Editor, paste in supabase/schema.sql, run

# 3. Get API keys
#    CONGRESS_API_KEY     → api.congress.gov/sign-up
#    NEXT_PUBLIC_SUPABASE_URL, anon key, service_role key → Supabase project settings
#    CRON_SECRET          → any random string

# 4. Drop them into .env.local
cp .env.example .env.local
# (fill in the values)

# 5. Seed the database
npm run seed         # ~540 members from Congress.gov
npm run seed:stats   # ~240k vote rows from Voteview (5–10 min)
npm run recategorize # classify votes into 10 categories

# 6. Run
npm run dev
```

Open `http://localhost:3000`, type your zip, click a representative.

---

## Repo layout

```
congresstracker/
├── app/
│   ├── api/                    # Cache-or-fetch proxy routes
│   │   ├── rep/                # zip → reps
│   │   ├── member/             # bioguide ID → profile
│   │   ├── votes/              # member votes (DB-only, seeded from Voteview)
│   │   ├── bills/              # sponsored + cosponsored
│   │   ├── compare/            # set-intersection overlap score
│   │   └── cron/               # daily cache invalidation
│   ├── rep/[id]/               # member profile page (SSR + generateMetadata)
│   ├── compare/                # two-up comparison page
│   ├── components/             # MemberCard, StatsBlock, VoteRow, charts, etc.
│   └── page.tsx                # homepage: zip search + recent activity + browse
├── lib/
│   ├── supabase.ts             # client + admin clients
│   ├── cache.ts                # isFresh() + markFresh() helpers
│   └── congress-api.ts         # external API calls + normalizers + categorization
├── scripts/
│   ├── seed-members.js         # one-time member ingest from Congress.gov
│   ├── seed-stats.js           # bulk vote ingest from Voteview
│   ├── recategorize-votes.js   # in-place re-classification of vote rows
│   └── inspect-votes.js        # diagnostic: position + category breakdown
└── supabase/
    └── schema.sql              # full DDL: tables, indexes, triggers, cron function
```

---

## Attribution

- Member metadata, bills, and roll calls: [Congress.gov](https://api.congress.gov/)
- Historical vote data: [Voteview](https://voteview.com/) (UCLA)
- Zip code → district resolution: [U.S. Census geocoder](https://geocoding.geo.census.gov/)
- Member photos: [bioguide.congress.gov](https://bioguide.congress.gov/)

Non-partisan. Free. Open data.
