import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isFresh, markFresh } from '@/lib/cache'
import { fetchMemberBillsFromCongress, fetchMemberFromCongress } from '@/lib/congress-api'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const role = req.nextUrl.searchParams.get('role') || undefined  // sponsor | cosponsor
  const status = req.nextUrl.searchParams.get('status') || undefined
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 200)
  const offset = Number(req.nextUrl.searchParams.get('offset')) || 0

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    if (!(await isFresh('bills', id))) {
      const fresh = await fetchMemberBillsFromCongress(id).catch(() => [])

      if (fresh.length > 0) {
        const unique = new Map<string, (typeof fresh)[number]>()
        for (const bill of fresh) {
          if (!bill.bill_id || !bill.role) continue
          unique.set(`${bill.member_id}:${bill.bill_id}:${bill.role}`, bill)
        }
        const upsertable = Array.from(unique.values())

        if (upsertable.length > 0) {
          const { error: upsertError } = await supabaseAdmin
            .from('bills')
            .upsert(upsertable, { onConflict: 'member_id,bill_id,role' })
          if (upsertError) throw upsertError
        }

        const memberStats = await fetchMemberFromCongress(id).catch(() => null)
        const sponsoredCount =
          memberStats?.bills_sponsored ?? upsertable.filter((b) => b.role === 'sponsor').length
        const { error: updateError } = await supabaseAdmin
          .from('members')
          .update({ bills_sponsored: sponsoredCount })
          .eq('id', id)
        if (updateError) throw updateError

        await markFresh('bills', id)
      }
    }

    let query = supabaseAdmin
      .from('bills')
      .select('*')
      .eq('member_id', id)
      .order('introduced_date', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (role && role !== 'All') query = query.eq('role', role)
    if (status && status !== 'All') query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ bills: data || [] })
  } catch (err) {
    console.error('/api/bills error:', err)
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 })
  }
}
