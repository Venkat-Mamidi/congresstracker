import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isFresh, markFresh } from '@/lib/cache'
import { fetchDistrictByZip } from '@/lib/congress-api'

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 })
  }

  try {
    if (await isFresh('zip_reps', zip)) {
      const { data: cached } = await supabaseAdmin
        .from('zip_reps')
        .select('member_ids')
        .eq('zip_code', zip)
        .single()

      if (cached?.member_ids?.length) {
        const { data: members } = await supabaseAdmin
          .from('members')
          .select('*')
          .in('id', cached.member_ids)
        return NextResponse.json({ members: members || [], approximate: true })
      }
    }

    const district = await fetchDistrictByZip(zip)
    if (!district.state) return NextResponse.json({ members: [], approximate: true })

    const houseQuery = supabaseAdmin
      .from('members')
      .select('*')
      .eq('state', district.state)
      .eq('chamber', 'House')
      .eq('district', district.district || '0')
      .limit(1)

    const senateQuery = supabaseAdmin
      .from('members')
      .select('*')
      .eq('state', district.state)
      .eq('chamber', 'Senate')
      .order('last_name')

    const [{ data: house, error: houseError }, { data: senators, error: senateError }] =
      await Promise.all([houseQuery, senateQuery])

    if (houseError) throw houseError
    if (senateError) throw senateError

    const members = [...(senators || []), ...(house || [])]
    const memberIds = members.map((member) => member.id)

    await supabaseAdmin.from('zip_reps').upsert({
      zip_code: zip,
      member_ids: memberIds,
      fetched_at: new Date().toISOString(),
    })
    await markFresh('zip_reps', zip)

    return NextResponse.json({ members, approximate: district.approximate })
  } catch (err) {
    console.error('/api/rep error:', err)
    return NextResponse.json({ error: 'Failed to fetch representatives' }, { status: 500 })
  }
}
