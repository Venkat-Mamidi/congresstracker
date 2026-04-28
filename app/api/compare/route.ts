import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface CategoryAgreement {
  category: string
  total: number
  agreed: number
  agreement_pct: number
}

export async function GET(req: NextRequest) {
  const urlIds = [
    ...req.nextUrl.searchParams.getAll('id'),
    req.nextUrl.searchParams.get('a'),
    req.nextUrl.searchParams.get('b'),
    req.nextUrl.searchParams.get('c'),
    req.nextUrl.searchParams.get('d'),
  ].filter(Boolean) as string[]
  const ids = Array.from(new Set(urlIds))
  if (ids.length < 2 || ids.length > 4) {
    return NextResponse.json(
      { error: 'Provide between 2 and 4 member ids' },
      { status: 400 },
    )
  }

  try {
    const { data: members, error: mErr } = await supabaseAdmin
      .from('members')
      .select('*')
      .in('id', ids)
    if (mErr) throw mErr
    if (!members || members.length < 2) {
      return NextResponse.json({ error: 'Members not found' }, { status: 404 })
    }
    const memberById = Object.fromEntries(members.map((member) => [member.id, member]))

    // Pull recent votes for each member (cap to bound the workload)
    const votesByMember: Record<string, Record<string, { position: string; category: string }>> = {}
    for (const id of ids) {
      const { data } = await supabaseAdmin
        .from('votes')
        .select('congress, session, roll_call, vote_position, bill_category')
        .eq('member_id', id)
        .order('vote_date', { ascending: false })
        .limit(500)

      const map: Record<string, { position: string; category: string }> = {}
      for (const v of data || []) {
        if (!v.congress || !v.session || !v.roll_call) continue
        const key = `${v.congress}-${v.session}-${v.roll_call}`
        map[key] = { position: v.vote_position, category: v.bill_category || 'Other' }
      }
      votesByMember[id] = map
    }

    // Compare each pair on shared roll calls
    const pairs: {
      a: string
      b: string
      total: number
      agreed: number
      agreement_pct: number
      by_category: CategoryAgreement[]
    }[] = []

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]
        const b = ids[j]
        const aMember = memberById[a]
        const bMember = memberById[b]

        if (aMember?.chamber && bMember?.chamber && aMember.chamber !== bMember.chamber) {
          pairs.push({
            a,
            b,
            total: 0,
            agreed: 0,
            agreement_pct: 0,
            by_category: [],
          })
          continue
        }

        const aMap = votesByMember[a] || {}
        const bMap = votesByMember[b] || {}

        let total = 0
        let agreed = 0
        const byCat: Record<string, { total: number; agreed: number }> = {}

        for (const key of Object.keys(aMap)) {
          if (!bMap[key]) continue
          const aVote = aMap[key]
          const bVote = bMap[key]
          // Only count decisive votes (Yes/No) on both sides
          if (!['Yes', 'No'].includes(aVote.position)) continue
          if (!['Yes', 'No'].includes(bVote.position)) continue

          total++
          const same = aVote.position === bVote.position
          if (same) agreed++

          const cat = aVote.category
          byCat[cat] ||= { total: 0, agreed: 0 }
          byCat[cat].total++
          if (same) byCat[cat].agreed++
        }

        pairs.push({
          a,
          b,
          total,
          agreed,
          agreement_pct: total > 0 ? Math.round((agreed / total) * 1000) / 10 : 0,
          by_category: Object.entries(byCat)
            .map(([category, { total, agreed }]) => ({
              category,
              total,
              agreed,
              agreement_pct: total > 0 ? Math.round((agreed / total) * 1000) / 10 : 0,
            }))
            .sort((x, y) => y.total - x.total),
        })
      }
    }

    return NextResponse.json({ members, pairs })
  } catch (err) {
    console.error('/api/compare error:', err)
    return NextResponse.json({ error: 'Failed to compare members' }, { status: 500 })
  }
}
