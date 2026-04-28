import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Returns the 10 most recent votes across all members, joined with their member info.
// Uses the service-role client so it bypasses RLS — safe because no input from the browser.
export async function GET() {
  try {
    // 1. Try last 7 days first
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const cutoff = sevenDaysAgo.toISOString().slice(0, 10)

    let { data: voteRows } = await supabaseAdmin
      .from('votes')
      .select('member_id, vote_date, vote_position, bill_title_plain, bill_title_raw, bill_id, congress, session, roll_call, bill_category')
      .gte('vote_date', cutoff)
      .neq('vote_position', 'Not Voting')
      .order('vote_date', { ascending: false })
      .limit(10)

    // 2. Fall back to all-time
    if (!voteRows || voteRows.length === 0) {
      const { data: fallback } = await supabaseAdmin
        .from('votes')
        .select('member_id, vote_date, vote_position, bill_title_plain, bill_title_raw, bill_id, congress, session, roll_call, bill_category')
        .neq('vote_position', 'Not Voting')
        .order('vote_date', { ascending: false })
        .limit(10)
      voteRows = fallback || []
    }

    if (!voteRows || voteRows.length === 0) {
      return NextResponse.json({ votes: [] })
    }

    // 3. Fetch corresponding members in one batch
    const memberIds = Array.from(new Set(voteRows.map((v) => v.member_id)))
    const { data: memberRows } = await supabaseAdmin
      .from('members')
      .select('id, full_name, party_code, state, chamber, district')
      .in('id', memberIds)

    const byId: Record<string, unknown> = {}
    for (const m of memberRows || []) byId[(m as { id: string }).id] = m

    const merged = voteRows.map((v) => ({
      ...v,
      member: byId[v.member_id] || null,
    }))

    return NextResponse.json({ votes: merged })
  } catch (err) {
    console.error('/api/recent-activity error:', err)
    return NextResponse.json({ error: 'Failed to load recent activity', votes: [] }, { status: 500 })
  }
}
