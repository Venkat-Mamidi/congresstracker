import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const category = req.nextUrl.searchParams.get('category') || undefined
  const position = req.nextUrl.searchParams.get('position') || undefined
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 200)
  const offset = Number(req.nextUrl.searchParams.get('offset')) || 0

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    let query = supabaseAdmin
      .from('votes')
      .select('*')
      .eq('member_id', id)
      .order('vote_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category && category !== 'All') query = query.eq('bill_category', category)
    if (position && position !== 'All') query = query.eq('vote_position', position)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ votes: data || [], source_unavailable: false })
  } catch (err) {
    console.error('/api/votes error:', err)
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
  }
}
