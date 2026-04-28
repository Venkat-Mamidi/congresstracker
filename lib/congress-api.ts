// All external API calls, data normalization, and categorization logic.

export type PartyCode = 'D' | 'R' | 'I'
export type Chamber = 'House' | 'Senate'
export type VotePosition = 'Yes' | 'No' | 'Not Voting' | 'Present'
export type BillCategory =
  | 'Healthcare' | 'Defense' | 'Economy' | 'Immigration' | 'Environment'
  | 'Education' | 'Infrastructure' | 'Technology' | 'Housing' | 'Other'
export type BillStatus = 'Introduced' | 'In Committee' | 'Passed House' | 'Became Law'

export interface Member {
  id: string
  full_name: string
  first_name?: string
  last_name?: string
  party?: string
  party_code: PartyCode
  chamber: Chamber
  state: string
  district?: string
  photo_url?: string
  years_served?: number
  contact_url?: string
  attendance_pct?: number
  party_loyalty_pct?: number
  total_votes?: number
  bills_sponsored?: number
}

export interface Vote {
  id?: string
  member_id: string
  vote_date: string
  bill_id?: string
  bill_title_raw?: string
  bill_title_plain: string
  bill_category: BillCategory
  vote_position: VotePosition
  voted_with_party?: boolean
  congress?: number
  session?: number
  roll_call?: number
}

export interface Bill {
  id?: string
  member_id: string
  bill_id: string
  title: string
  introduced_date?: string
  status: BillStatus
  became_law: boolean
  role: 'sponsor' | 'cosponsor'
}

const STATE_ABBR: Record<string, string> = {
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

export function normalizeState(state?: string): string {
  if (!state) return ''
  return STATE_ABBR[state] || state
}

export function normalizeCongressName(name?: string): string {
  if (!name) return ''
  const [last, rest] = name.split(',').map((part) => part.trim())
  if (last && rest) return `${rest} ${last}`.replace(/\s+/g, ' ').trim()
  return name.trim()
}

export function getPartyCode(party: string): PartyCode {
  const p = (party || '').toLowerCase()
  if (p.includes('democrat')) return 'D'
  if (p.includes('republican')) return 'R'
  return 'I'
}

export function normalizeVotePosition(raw: string): VotePosition {
  const p = (raw || '').toLowerCase().trim()
  if (['yea', 'aye', 'yes'].includes(p)) return 'Yes'
  if (['nay', 'no'].includes(p)) return 'No'
  if (['present'].includes(p)) return 'Present'
  return 'Not Voting'
}

export function normalizeBillTitle(raw: string): string {
  if (!raw) return ''
  let t = raw
  t = t.replace(/^(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.|H\.Res\.|S\.Res\.)\s*\d+\s*[-:]\s*/i, '')
  t = t.replace(/\bAS AMENDED IN THE NATURE OF A SUBSTITUTE\b/gi, '')
  t = t.replace(/\bAS AMENDED\b/gi, '')
  t = t.replace(/^A BILL TO\s+/i, '')
  t = t.replace(/^AN ACT TO\s+/i, '')
  t = t.replace(/^TO\s+/i, '')
  t = t.replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '')
  if (t.length > 0) t = t.charAt(0).toUpperCase() + t.slice(1)
  return t || raw
}

const CATEGORY_KEYWORDS: Record<BillCategory, string[]> = {
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
  Other: [],
}

export function categorizeBill(title: string): BillCategory {
  const lower = (title || '').toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [BillCategory, string[]][]) {
    if (cat === 'Other') continue
    if (keywords.some((kw) => lower.includes(kw))) return cat
  }
  return 'Other'
}

function mapBillStatus(raw: string): BillStatus {
  const r = (raw || '').toLowerCase()
  if (r.includes('became law') || r.includes('signed')) return 'Became Law'
  if (r.includes('passed house') || r.includes('passed senate') || r.includes('agreed')) return 'Passed House'
  if (r.includes('committee')) return 'In Committee'
  return 'Introduced'
}

const CONGRESS_BASE = process.env.CONGRESS_API_BASE || 'https://api.congress.gov/v3'

async function congressFetch(path: string, params: Record<string, string | number> = {}) {
  const key = process.env.CONGRESS_API_KEY
  if (!key) throw new Error('Missing CONGRESS_API_KEY')

  const url = new URL(`${CONGRESS_BASE}${path}`)
  url.searchParams.set('api_key', key)
  url.searchParams.set('format', 'json')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Congress.gov ${path} -> ${res.status}`)
  return res.json()
}

export async function fetchMemberFromCongress(bioguideId: string): Promise<Partial<Member>> {
  const data = await congressFetch(`/member/${bioguideId}`)
  const m = data.member
  if (!m) return {}

  const terms: { chamber?: string; startYear?: number; stateCode?: string }[] = Array.isArray(m.terms)
    ? m.terms
    : m.terms?.item || []
  const currentTerm = terms.slice(-1)[0] || {}
  const startYears = terms.map((t) => Number(t.startYear)).filter(Boolean)
  const yearsSince = startYears.length > 0 ? new Date().getFullYear() - Math.min(...startYears) : 0
  const party = m.partyName || m.partyHistory?.slice(-1)[0]?.partyName || m.party
  const fullName = m.directOrderName || normalizeCongressName(m.invertedOrderName || m.name) || `${m.firstName || ''} ${m.lastName || ''}`.trim()

  return {
    id: m.bioguideId,
    full_name: fullName,
    first_name: m.firstName,
    last_name: m.lastName,
    party,
    party_code: getPartyCode(party || ''),
    chamber: String(currentTerm.chamber || m.chamber || '').includes('Senate') ? 'Senate' : 'House',
    state: currentTerm.stateCode || normalizeState(m.state),
    district: m.district ? String(m.district) : undefined,
    photo_url: m.depiction?.imageUrl,
    years_served: yearsSince,
    contact_url: m.officialWebsiteUrl,
    bills_sponsored: Number(m.sponsoredLegislation?.count) || undefined,
  }
}

export async function fetchMemberVotesFromCongress(bioguideId: string, offset = 0): Promise<Vote[]> {
  const data = await congressFetch(`/member/${bioguideId}/votes`, { limit: 50, offset })
  const rawVotes: Record<string, unknown>[] = data.votes || data.memberVotes || []

  return rawVotes.map((v: Record<string, unknown>) => {
    const voteObj = v.vote as Record<string, unknown> | undefined
    const billObj = (v.bill || voteObj?.bill) as Record<string, unknown> | undefined
    const raw = String(voteObj?.position || v.position || v.memberVote || '')
    const titleRaw = String(v.description || voteObj?.description || billObj?.title || '')
    const plain = normalizeBillTitle(titleRaw)

    return {
      member_id: bioguideId,
      vote_date: String(v.date || voteObj?.date || ''),
      bill_id: String(v.billNumber || billObj?.number || ''),
      bill_title_raw: titleRaw,
      bill_title_plain: plain,
      bill_category: categorizeBill(plain),
      vote_position: normalizeVotePosition(raw),
      voted_with_party: undefined,
      congress: Number(v.congress || voteObj?.congress) || undefined,
      session: Number(v.sessionNumber || v.session || voteObj?.sessionNumber || voteObj?.session) || undefined,
      roll_call: Number(v.rollCall || v.roll_call || v.voteNumber || voteObj?.rollCall || voteObj?.voteNumber) || undefined,
    }
  })
}

export async function fetchMemberBillsFromCongress(bioguideId: string): Promise<Bill[]> {
  const [sponsoredData, cosponsoredData] = await Promise.all([
    congressFetch(`/member/${bioguideId}/sponsored-legislation`, { limit: 50 }),
    congressFetch(`/member/${bioguideId}/cosponsored-legislation`, { limit: 50 }),
  ])

  const mapBill = (b: Record<string, unknown>, role: 'sponsor' | 'cosponsor'): Bill => {
    const titleRaw = String(b.title || b.shortTitle || '')
    const latestAction = b.latestAction as { text?: string } | undefined
    const latestActionText = String(latestAction?.text || '')
    const congress = String(b.congress || '').trim()
    const type = String(b.type || b.billType || '').trim().toUpperCase()
    const number = String(b.number || b.billNumber || '').trim()
    const amendmentNumber = String(b.amendmentNumber || '').trim()
    const amendmentType = String(b.url || '').includes('/samdt/') ? 'SAMDT' : 'AMDT'
    const urlId = String(b.url || '')
      .replace(/^https:\/\/api\.congress\.gov\/v3\//, '')
      .replace(/\?format=json$/, '')
      .replace(/\//g, '-')
      .toUpperCase()
    const displayId = type && number ? `${type}${number}` : amendmentNumber ? `${amendmentType}${amendmentNumber}` : ''
    const displayTitle = type && number
      ? displayId
      : amendmentNumber
        ? `${amendmentType === 'SAMDT' ? 'S.Amdt.' : 'Amendment'} ${amendmentNumber}`
        : ''
    const billId = [congress, displayId].filter(Boolean).join('-') || urlId

    return {
      member_id: bioguideId,
      bill_id: billId || number,
      title: normalizeBillTitle(titleRaw) || titleRaw || displayTitle || displayId || urlId,
      introduced_date: b.introducedDate ? String(b.introducedDate) : undefined,
      status: mapBillStatus(String(latestActionText || b.status || '')),
      became_law: latestActionText.toLowerCase().includes('signed into law') || latestActionText.toLowerCase().includes('became public law'),
      role,
    }
  }

  const sponsored = (sponsoredData.sponsoredLegislation || []).map((b: Record<string, unknown>) => mapBill(b, 'sponsor'))
  const cosponsored = (cosponsoredData.cosponsoredLegislation || []).map((b: Record<string, unknown>) => mapBill(b, 'cosponsor'))
  return [...sponsored, ...cosponsored]
}

export interface CivicOfficial {
  name: string
  party?: string
  phones?: string[]
  urls?: string[]
  photoUrl?: string
}

export interface CivicOffice {
  name: string
  levels?: string[]
  roles?: string[]
  officialIndices: number[]
}

interface ZipCentroid {
  latitude: string
  longitude: string
  state: string
}

export interface ZipDistrict {
  state: string
  district?: string
  approximate: boolean
}

async function fetchZipCentroid(zip: string): Promise<ZipCentroid> {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { next: { revalidate: 60 * 60 * 24 * 30 } })
  if (!res.ok) throw new Error(`ZIP centroid lookup -> ${res.status}`)
  const data = await res.json()
  const place = data.places?.[0]

  if (!place?.latitude || !place?.longitude || !place?.['state abbreviation']) {
    throw new Error(`ZIP centroid lookup returned no match for ${zip}`)
  }

  return {
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    state: String(place['state abbreviation']),
  }
}

export async function fetchDistrictByZip(zip: string): Promise<ZipDistrict> {
  const centroid = await fetchZipCentroid(zip)

  const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/coordinates')
  url.searchParams.set('x', centroid.longitude)
  url.searchParams.set('y', centroid.latitude)
  url.searchParams.set('benchmark', 'Public_AR_Current')
  url.searchParams.set('vintage', 'Current_Current')
  url.searchParams.set('format', 'json')

  const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 * 30 } })
  if (!res.ok) throw new Error(`Census geocoder -> ${res.status}`)
  const data = await res.json()
  const geographies = data.result?.geographies || {}
  const congressionalKey = Object.keys(geographies).find((key) => key.includes('Congressional Districts'))
  const district = congressionalKey ? geographies[congressionalKey]?.[0] : undefined
  const rawDistrict = String(district?.CD119 || district?.CD118 || district?.BASENAME || '').trim()

  return {
    state: centroid.state,
    district: rawDistrict ? String(Number(rawDistrict)) : undefined,
    approximate: true,
  }
}

export async function fetchRepresentativesByZip(zip: string): Promise<ZipDistrict> {
  return fetchDistrictByZip(zip)
}
