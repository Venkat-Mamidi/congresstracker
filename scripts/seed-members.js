// Seeds the `members` table with all current members of Congress from Congress.gov.
// Usage: node scripts/seed-members.js
//
// Requires env vars (loaded from .env.local automatically):
//   CONGRESS_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

const fs = require('fs')
const path = require('path')

// Tiny .env.local loader so this works without an extra dependency
function loadDotEnv() {
  const file = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const [, k, v] = m
    if (!process.env[k]) process.env[k] = v.replace(/^['"]|['"]$/g, '')
  }
}
loadDotEnv()

const { createClient } = require('@supabase/supabase-js')

const CONGRESS_KEY = process.env.CONGRESS_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!CONGRESS_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Need CONGRESS_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function getPartyCode(party) {
  const p = (party || '').toLowerCase()
  if (p.includes('democrat')) return 'D'
  if (p.includes('republican')) return 'R'
  return 'I'
}

const STATE_ABBR = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
}

function normalizeState(state) {
  return STATE_ABBR[state] || state || null
}

function parseCongressName(name) {
  if (!name) return { fullName: '', firstName: null, lastName: null }
  const [last, rest] = String(name).split(',').map((part) => part.trim())
  if (last && rest) {
    return {
      fullName: `${rest} ${last}`.replace(/\s+/g, ' ').trim(),
      firstName: rest.split(/\s+/)[0] || null,
      lastName: last || null,
    }
  }

  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  return {
    fullName: parts.join(' '),
    firstName: parts[0] || null,
    lastName: parts.slice(-1)[0] || null,
  }
}

async function fetchPage(offset) {
  const url = new URL('https://api.congress.gov/v3/member')
  url.searchParams.set('api_key', CONGRESS_KEY)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '250')
  url.searchParams.set('offset', String(offset))
  url.searchParams.set('currentMember', 'true')
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Congress.gov members → ${res.status}`)
  return res.json()
}

async function main() {
  console.log('Fetching current members from Congress.gov…')
  const all = []
  let offset = 0
  // Walk pages until empty; current Congress has roughly 540 members
  while (true) {
    const data = await fetchPage(offset)
    const batch = data.members || []
    if (batch.length === 0) break
    all.push(...batch)
    offset += batch.length
    if (batch.length < 250) break
  }
  console.log(`Fetched ${all.length} members. Normalizing…`)

  const rows = all
    .map((m) => {
      const term = (m.terms?.item || []).slice(-1)[0] || {}
      const chamber = String(term.chamber || '').includes('Senate') ? 'Senate' : 'House'
      const parsedName = parseCongressName(m.directOrderName || m.invertedOrderName || m.name)
      const fullName =
        parsedName.fullName ||
        `${m.firstName || ''} ${m.lastName || ''}`.trim()
      const startYear = Math.min(
        ...((m.terms?.item || []).map((t) => Number(t.startYear)).filter(Boolean) || [new Date().getFullYear()]),
      )

      return {
        id: m.bioguideId,
        full_name: fullName,
        first_name: m.firstName || parsedName.firstName,
        last_name: m.lastName || parsedName.lastName,
        party: m.partyName || m.party || null,
        party_code: getPartyCode(m.partyName || m.party),
        chamber,
        state: normalizeState(m.state),
        district: m.district != null ? String(m.district) : null,
        photo_url: m.depiction?.imageUrl || null,
        years_served: Number.isFinite(startYear) ? new Date().getFullYear() - startYear : 0,
        contact_url: m.officialWebsiteUrl || null,
        updated_at: new Date().toISOString(),
      }
    })
    .filter((r) => r.id)

  console.log(`Upserting ${rows.length} rows…`)
  // Chunk to keep request size reasonable
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const { error } = await supabase.from('members').upsert(slice)
    if (error) {
      console.error(`Chunk ${i}-${i + slice.length} failed:`, error.message)
      process.exit(1)
    }
    process.stdout.write(`.${i + slice.length}`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
