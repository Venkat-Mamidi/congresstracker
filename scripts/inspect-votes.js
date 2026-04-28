// Inspect what's actually in the votes table — useful for debugging "no rows" issues.
//
// Usage:
//   node scripts/inspect-votes.js                 # global counts by position + category
//   node scripts/inspect-votes.js P000197         # per-member breakdown for one bioguide id

const fs = require('fs')
const path = require('path')

function loadDotEnv() {
  const file = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const [, k, v] = m
    if (!process.env[k]) process.env[k] = v.replace(/^['"]|['"]$/g, '')
  }
}
loadDotEnv()

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function pageAll(query, pageSize = 1000) {
  let from = 0
  const out = []
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return out
}

function tally(rows, key) {
  const counts = {}
  for (const r of rows) counts[r[key]] = (counts[r[key]] || 0) + 1
  return counts
}

function printTable(counts, label) {
  console.log(`\n${label}:`)
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  for (const [k, v] of entries) {
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'
    console.log(`  ${String(k).padEnd(15)} ${String(v).padStart(8)}  (${pct}%)`)
  }
  console.log(`  ${'TOTAL'.padEnd(15)} ${String(total).padStart(8)}`)
}

async function main() {
  const memberId = process.argv[2]

  if (memberId) {
    console.log(`Inspecting member ${memberId}...`)
    const rows = await pageAll(
      supabase.from('votes').select('vote_position, bill_category').eq('member_id', memberId),
    )
    if (rows.length === 0) {
      console.log('No votes for this member.')
      return
    }
    printTable(tally(rows, 'vote_position'), 'Positions')
    printTable(tally(rows, 'bill_category'), 'Categories')
    return
  }

  console.log('Inspecting global votes table...')
  const rows = await pageAll(
    supabase.from('votes').select('vote_position, bill_category'),
  )
  printTable(tally(rows, 'vote_position'), 'Positions (all members)')
  printTable(tally(rows, 'bill_category'), 'Categories (all members)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
