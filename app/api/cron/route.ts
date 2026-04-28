import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Periodic cleanup endpoint — call from a Vercel cron (or external scheduler).
// Authenticates via CRON_SECRET to keep it private.
export async function GET(req: NextRequest) {
  // Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` automatically.
  // Manual triggers can use `x-cron-secret` header or `?secret=` query param.
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null
  const secret =
    bearer ||
    req.headers.get('x-cron-secret') ||
    req.nextUrl.searchParams.get('secret')

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { error } = await supabaseAdmin.rpc('invalidate_stale_cache')
    if (error) throw error
    return NextResponse.json({ ok: true, ran_at: new Date().toISOString() })
  } catch (err) {
    console.error('/api/cron error:', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
