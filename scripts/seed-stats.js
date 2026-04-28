// Backfills member stats from Congress.gov and official roll-call XML.
// Usage: node scripts/seed-stats.js
//
// Requires env vars (loaded from .env.local automatically):
//   CONGRESS_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

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

const CONGRESS_KEY = process.env.CONGRESS_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!CONGRESS_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Need CONGRESS_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CURRENT_CONGRESS = 119
const HOUSE_SESSIONS = [
  { year: 2025, session: 1 },
  { year: 2026, session: 2 },
]
const SENATE_SESSIONS = [
  { congress: 119, session: 1 },
  { congress: 119, session: 2 },
]

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function text(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

function attr(xml, name) {
  const match = xml.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

function parseDate(value, fallbackYear) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim()
  if (!raw) return `${fallbackYear}-01-01`

  const house = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (house) {
    const [, day, mon, year] = house
    const month = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    }[mon]
    return `${year}-${month || '01'}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return `${fallbackYear}-01-01`
}

function normalizeVotePosition(raw) {
  const vote = String(raw || '').toLowerCase().trim()
  if (['yea', 'aye', 'yes'].includes(vote)) return 'Yes'
  if (['nay', 'no'].includes(vote)) return 'No'
  if (vote === 'present') return 'Present'
  return 'Not Voting'
}

function normalizeVoteviewCast(code) {
  const value = Number(code)
  if ([1, 2, 3].includes(value)) return 'Yes'
  if ([4, 5, 6].includes(value)) return 'No'
  if ([7, 8].includes(value)) return 'Present'
  return 'Not Voting'
}

function normalizeBillTitle(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim()
}

// Keyword-based bill categorization. Mirrors lib/congress-api.ts.
const CATEGORY_KEYWORDS = {
  Healthcare: [
    'health', 'medical', 'medicare', 'medicaid', 'hospital', 'patient', 'drug', 'vaccine',
    'disease', 'mental health', 'opioid', 'cancer', 'pharmacy', 'fda', 'nih', 'nursing',
    'abortion', 'reproductive', 'contraception', 'roe v', 'planned parenthood',
    'obamacare', 'affordable care act', 'prescription', 'physician', 'clinical',
    'pandemic', 'covid', 'public health', 'cdc', 'overdose',
  ],
  Defense: [
    'defense', 'military', 'army', 'navy', 'air force', 'marines', 'veteran', 'weapon',
    'nato', 'national security', 'armed forces', 'pentagon', 'combat', 'intelligence',
    'troops', 'soldier', 'national guard', 'sanction', 'foreign policy', 'state department',
    'homeland security', 'dhs', 'cia', 'fbi', 'terrorism', 'terrorist', 'hostage',
    'nuclear', 'missile', 'ukraine', 'israel', 'taiwan', 'iran',
  ],
  Economy: [
    'economy', 'economic', 'trade', 'tax', 'budget', 'fiscal', 'finance', 'appropriat',
    'spend', 'debt', 'deficit', 'small business', 'manufacturing', 'jobs', 'employment',
    'tariff', 'commerce', 'labor', 'workforce', 'wage', 'inflation', 'stimulus',
    'subsidy', 'subsidies', 'banking', 'irs', 'treasury', 'antitrust', 'merger',
    'consumer protection', 'retirement', 'pension', 'social security',
  ],
  Immigration: [
    'immigrat', 'border', 'visa', 'asylum', 'refugee', 'citizenship', 'naturalization',
    'customs', 'daca', 'deportat', 'alien', 'undocumented', 'sanctuary city',
    'green card', 'work visa',
  ],
  Environment: [
    'environment', 'climate', 'energy', 'renewable', 'solar', 'wind', 'emission',
    'pollution', 'conservation', 'wildlife', 'forest', 'carbon', 'clean air',
    'clean water', 'epa', 'oil', 'natural gas', 'drilling', 'fossil', 'coal',
    'petroleum', 'national park', 'public land', 'wilderness', 'endangered species',
  ],
  Education: [
    'education', 'school', 'student', 'teacher', 'university', 'college', 'loan',
    'scholarship', 'pell grant', 'learning', 'curriculum', 'literacy', 'stem',
    'tuition', 'borrower', 'k-12', 'charter school', 'fafsa', 'title ix',
  ],
  Infrastructure: [
    'infrastructure', 'highway', 'bridge', 'road', 'transit', 'broadband',
    'internet access', 'water system', 'airport', 'port', 'rail', 'public works',
    'grid', 'pipeline', 'amtrak', 'sewer', 'dam ', 'subway', 'metro rail',
  ],
  Technology: [
    'technology', 'cyber', 'digital', 'artificial intelligence', 'semiconductor', 'data',
    'privacy', 'social media', 'innovation', 'research', 'science', 'computing',
    'ai ', 'tech', 'tiktok', 'encryption', 'section 230', 'big tech',
  ],
  Housing: [
    'housing', 'rent', 'mortgage', 'home', 'homeowner', 'affordable housing', 'tenant',
    'homelessness', 'real estate', 'eviction', 'hud', 'shelter', 'public housing',
    'section 8', 'fha', 'foreclosure', 'landlord',
  ],
}

function categorizeBill(title) {
  const lower = String(title || '').toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat
  }
  return 'Other'
}

function partyMajorities(rows) {
  const counts = {}
  for (const row of rows) {
    if (!['Yes', 'No'].includes(row.vote_position)) continue
    counts[row.party] ||= { Yes: 0, No: 0 }
    counts[row.party][row.vote_position]++
  }

  return Object.fromEntries(
    Object.entries(counts).map(([party, count]) => {
      if (count.Yes === count.No) return [party, undefined]
      return [party, count.Yes > count.No ? 'Yes' : 'No']
    }),
  )
}

function applyPartyLoyalty(rows) {
  const majorities = partyMajorities(rows)
  return rows.map((row) => {
    const partyMajority = majorities[row.party]
    return {
      ...row,
      voted_with_party:
        partyMajority && ['Yes', 'No'].includes(row.vote_position)
          ? row.vote_position === partyMajority
          : undefined,
    }
  })
}

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) return null
  return res.text()
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }

  const [headers, ...body] = rows
  return body
    .filter((values) => values.some(Boolean))
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])),
    )
}

async function fetchCsv(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return parseCsv(await res.text())
}

async function getHouseRolls(year) {
  const index = await fetchText(`https://clerk.house.gov/evs/${year}/index.asp`)
  if (!index) return []
  const rolls = new Set()
  for (const match of index.matchAll(/rollnumber=(\d+)/gi)) rolls.add(Number(match[1]))
  return [...rolls].filter(Boolean).sort((a, b) => a - b)
}

function parseHouseVote(xml, year, session) {
  const congress = Number(text(xml, 'congress')) || CURRENT_CONGRESS
  const rollCall = Number(text(xml, 'rollcall-num'))
  const voteDate = parseDate(text(xml, 'action-date'), year)
  const billId = text(xml, 'legis-num')
  const titleRaw = normalizeBillTitle([text(xml, 'vote-question'), text(xml, 'vote-desc')].filter(Boolean).join(' - '))
  const blocks = xml.match(/<recorded-vote>[\s\S]*?<\/recorded-vote>/gi) || []

  const rows = blocks
    .map((block) => {
      const legislator = block.match(/<legislator[\s\S]*?<\/legislator>/i)?.[0] || ''
      const memberId = attr(legislator, 'name-id')
      if (!memberId) return null

      return {
        member_id: memberId,
        vote_date: voteDate,
        bill_id: billId,
        bill_title_raw: titleRaw,
        bill_title_plain: titleRaw || billId || `House roll call ${rollCall}`,
        bill_category: categorizeBill(titleRaw),
        vote_position: normalizeVotePosition(text(block, 'vote')),
        congress,
        session,
        roll_call: rollCall,
        party: attr(legislator, 'party'),
      }
    })
    .filter(Boolean)

  return applyPartyLoyalty(rows).map(({ party, ...row }) => row)
}

async function getSenateVotes(congress, session) {
  const menuUrl = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${congress}_${session}.xml`
  const menu = await fetchText(menuUrl)
  if (!menu) return []
  return [...menu.matchAll(/<vote_number>(\d+)<\/vote_number>/gi)]
    .map((match) => Number(match[1]))
    .filter(Boolean)
    .sort((a, b) => a - b)
}

function senateKey(lastName, state) {
  return `${String(lastName || '').toLowerCase()}|${state}`
}

function parseSenateVote(xml, senateByLastState) {
  const congress = Number(text(xml, 'congress')) || CURRENT_CONGRESS
  const session = Number(text(xml, 'session'))
  const rollCall = Number(text(xml, 'vote_number'))
  const voteDate = parseDate(text(xml, 'vote_date'), text(xml, 'congress_year') || 2025)
  const docName = text(xml, 'document_name')
  const titleRaw = normalizeBillTitle(text(xml, 'vote_title') || text(xml, 'vote_question_text') || text(xml, 'vote_document_text'))
  const blocks = xml.match(/<member>[\s\S]*?<\/member>/gi) || []

  const rows = blocks
    .map((block) => {
      const member = senateByLastState.get(senateKey(text(block, 'last_name'), text(block, 'state')))
      if (!member) return null

      return {
        member_id: member.id,
        vote_date: voteDate,
        bill_id: docName,
        bill_title_raw: titleRaw,
        bill_title_plain: titleRaw || docName || `Senate vote ${rollCall}`,
        bill_category: categorizeBill(titleRaw),
        vote_position: normalizeVotePosition(text(block, 'vote_cast')),
        congress,
        session,
        roll_call: rollCall,
        party: text(block, 'party'),
      }
    })
    .filter(Boolean)

  return applyPartyLoyalty(rows).map(({ party, ...row }) => row)
}

async function mapLimit(items, limit, worker) {
  const out = []
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      out[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return out
}

async function chunkedUpsert(table, rows, onConflict, chunkSize = 1000) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict })
    if (error) throw error
    process.stdout.write(`.${Math.min(i + chunk.length, rows.length)}`)
  }
  process.stdout.write('\n')
}

async function updateMemberStats(rows) {
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    await Promise.all(
      chunk.map(async ({ id, ...patch }) => {
        const { error } = await supabase.from('members').update(patch).eq('id', id)
        if (error) throw error
      }),
    )
    process.stdout.write(`.${Math.min(i + chunk.length, rows.length)}`)
  }
  process.stdout.write('\n')
}

async function fetchMembers() {
  const { data, error } = await supabase
    .from('members')
    .select('id, first_name, last_name, party_code, chamber, state')
  if (error) throw error
  return data || []
}

async function backfillSponsoredCounts(members) {
  console.log(`Fetching sponsored-legislation counts for ${members.length} members...`)
  const updates = await mapLimit(members, 8, async (member) => {
    const url = new URL(`https://api.congress.gov/v3/member/${member.id}`)
    url.searchParams.set('api_key', CONGRESS_KEY)
    url.searchParams.set('format', 'json')
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`\nCongress.gov member ${member.id} -> ${res.status}`)
      return null
    }
    const data = await res.json()
    return {
      id: member.id,
      bills_sponsored: Number(data.member?.sponsoredLegislation?.count) || 0,
      updated_at: new Date().toISOString(),
    }
  })

  const rows = updates.filter(Boolean)
  await updateMemberStats(rows)
}

function updateStats(stats, rows) {
  for (const row of rows) {
    const stat = stats.get(row.member_id) || {
      total: 0,
      attended: 0,
      partyComparable: 0,
      partySame: 0,
    }
    stat.total++
    if (row.vote_position !== 'Not Voting') stat.attended++
    if (row.voted_with_party !== undefined) {
      stat.partyComparable++
      if (row.voted_with_party) stat.partySame++
    }
    stats.set(row.member_id, stat)
  }
}

async function backfillVotes(members) {
  const memberIds = new Set(members.map((member) => member.id))
  const memberById = new Map(members.map((member) => [member.id, member]))
  const stats = new Map()
  const allRows = []

  console.log('Fetching Voteview member crosswalk...')
  const voteviewMembers = await fetchCsv('https://voteview.com/static/data/out/members/HS119_members.csv')
  const bioguideByVoteview = new Map(
    voteviewMembers
      .filter((member) => member.bioguide_id && member.icpsr)
      .map((member) => [`${member.chamber}:${member.icpsr}`, member.bioguide_id]),
  )

  for (const chamber of ['House', 'Senate']) {
    console.log(`Fetching Voteview ${chamber} roll calls and votes...`)
    const rollcalls = await fetchCsv(`https://voteview.com/static/data/out/rollcalls/${chamber[0]}119_rollcalls.csv`)
    const rollByNumber = new Map(rollcalls.map((roll) => [roll.rollnumber, roll]))
    const votes = await fetchCsv(`https://voteview.com/static/data/out/votes/${chamber[0]}119_votes.csv`)
    const rowsByRoll = new Map()

    for (const vote of votes) {
      const memberId = bioguideByVoteview.get(`${chamber}:${vote.icpsr}`)
      if (!memberId || !memberIds.has(memberId)) continue

      const roll = rollByNumber.get(vote.rollnumber)
      if (!roll) continue

      const votePosition = normalizeVoteviewCast(vote.cast_code)
      const member = memberById.get(memberId)
      const row = {
        member_id: memberId,
        vote_date: roll.date,
        bill_id: roll.bill_number || '',
        bill_title_raw: normalizeBillTitle([roll.vote_question, roll.vote_desc, roll.dtl_desc].filter(Boolean).join(' - ')),
        bill_title_plain: normalizeBillTitle([roll.vote_question, roll.vote_desc, roll.dtl_desc].filter(Boolean).join(' - ')) || roll.bill_number || `${chamber} roll call ${roll.clerk_rollnumber || roll.rollnumber}`,
        bill_category: categorizeBill(roll.vote_desc || roll.dtl_desc || roll.bill_number),
        vote_position: votePosition,
        congress: Number(roll.congress) || CURRENT_CONGRESS,
        session: Number(roll.session),
        roll_call: Number(roll.clerk_rollnumber || roll.rollnumber),
        party: member?.party_code || '',
      }

      const key = `${chamber}:${roll.rollnumber}`
      if (!rowsByRoll.has(key)) rowsByRoll.set(key, [])
      rowsByRoll.get(key).push(row)
    }

    for (const rows of rowsByRoll.values()) {
      const withLoyalty = applyPartyLoyalty(rows).map(({ party, ...row }) => row)
      updateStats(stats, withLoyalty)
      allRows.push(...withLoyalty)
    }
  }

  console.log(`Upserting ${allRows.length} vote rows...`)
  await chunkedUpsert('votes', allRows, 'member_id,congress,session,roll_call', 1000)

  const statRows = members.map((member) => {
    const stat = stats.get(member.id)
    return {
      id: member.id,
      total_votes: stat?.total || 0,
      attendance_pct: stat?.total ? Math.round((stat.attended / stat.total) * 1000) / 10 : null,
      party_loyalty_pct: stat?.partyComparable
        ? Math.round((stat.partySame / stat.partyComparable) * 1000) / 10
        : null,
      updated_at: new Date().toISOString(),
    }
  })

  console.log(`Updating vote stats for ${statRows.length} members...`)
  await updateMemberStats(statRows)
}

async function main() {
  const members = await fetchMembers()
  if (members.length === 0) throw new Error('No members found. Run npm run seed first.')

  await backfillSponsoredCounts(members)
  await backfillVotes(members)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
