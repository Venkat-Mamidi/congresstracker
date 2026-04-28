import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isFresh, markFresh } from '@/lib/cache'
import { fetchMemberFromCongress } from '@/lib/congress-api'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    if (await isFresh('member', id)) {
      const { data } = await supabaseAdmin.from('members').select('*').eq('id', id).single()
      if (data) return NextResponse.json({ member: data })
    }

    const fromCongress = await fetchMemberFromCongress(id).catch(() => ({}))

    // Merge into any existing record (preserves stats computed by /api/votes)
    const { data: existing } = await supabaseAdmin.from('members').select('*').eq('id', id).single()

    const merged = {
      ...(existing || {}),
      ...fromCongress,
      id,
      updated_at: new Date().toISOString(),
    }

    await supabaseAdmin.from('members').upsert(merged)
    await markFresh('member', id)

    return NextResponse.json({ member: merged })
  } catch (err) {
    console.error('/api/member error:', err)
    return NextResponse.json({ error: 'Failed to fetch member' }, { status: 500 })
  }
}
