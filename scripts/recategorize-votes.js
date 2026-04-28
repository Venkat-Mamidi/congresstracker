// Recategorizes existing rows in the `votes` table without re-fetching from Voteview.
// Use this after fixing the categorizer in seed-stats.js — much faster than re-seeding.
//
// Usage: node scripts/recategorize-votes.js

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

async function main() {
  console.log('Pulling all votes (this can take a moment)...')
  const PAGE = 1000
  let from = 0
  const all = []
  while (true) {
    const { data, error } = await supabase
      .from('votes')
      .select('id, bill_title_plain, bill_title_raw, bill_category')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
    process.stdout.write(`.${all.length}`)
  }
  process.stdout.write(`\nFetched ${all.length} rows.\n`)

  const updates = []
  const counts = {}
  for (const row of all) {
    const newCat = categorizeBill(row.bill_title_plain || row.bill_title_raw)
    counts[newCat] = (counts[newCat] || 0) + 1
    if (newCat !== row.bill_category) {
      updates.push({ id: row.id, bill_category: newCat })
    }
  }

  console.log('Resulting category distribution:')
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(15)} ${v}`)
  }

  if (updates.length === 0) {
    console.log('No rows need updating. Done.')
    return
  }

  // Group updates by target category, then bulk-update each category in chunks.
  // Avoids upsert (which would null out other required columns).
  const byCategory = {}
  for (const u of updates) {
    byCategory[u.bill_category] ||= []
    byCategory[u.bill_category].push(u.id)
  }

  console.log(`Updating ${updates.length} rows across ${Object.keys(byCategory).length} categories...`)
  const CHUNK = 500
  let done = 0
  for (const [category, ids] of Object.entries(byCategory)) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const { error } = await supabase
        .from('votes')
        .update({ bill_category: category })
        .in('id', slice)
      if (error) throw error
      done += slice.length
      process.stdout.write(`\r  ${category.padEnd(15)} ${done}/${updates.length}`)
    }
  }
  process.stdout.write('\nDone.\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
