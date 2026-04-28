import { supabaseAdmin } from './supabase'

export type CacheResourceType = 'member' | 'votes' | 'bills' | 'zip_reps'

const TTL_MS: Record<CacheResourceType, number> = {
  zip_reps: 7 * 24 * 60 * 60 * 1000,  // 7 days
  member:   24 * 60 * 60 * 1000,        // 24 hours
  votes:    24 * 60 * 60 * 1000,        // 24 hours
  bills:    48 * 60 * 60 * 1000,        // 48 hours
}

export async function isFresh(type: CacheResourceType, id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('cache_log')
    .select('fetched_at')
    .eq('resource_type', type)
    .eq('resource_id', id)
    .single()

  if (!data) return false
  return Date.now() - new Date(data.fetched_at).getTime() < TTL_MS[type]
}

export async function markFresh(type: CacheResourceType, id: string): Promise<void> {
  await supabaseAdmin.from('cache_log').upsert({
    resource_type: type,
    resource_id: id,
    fetched_at: new Date().toISOString(),
  })
}
