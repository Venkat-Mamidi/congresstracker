import { createClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'http://localhost:54321'
const FALLBACK_SUPABASE_KEY = 'missing-supabase-key'

function envOrFallback(value: string | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback
}

const supabaseUrl = envOrFallback(process.env.NEXT_PUBLIC_SUPABASE_URL, FALLBACK_SUPABASE_URL)
const supabaseAnonKey = envOrFallback(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, FALLBACK_SUPABASE_KEY)
const supabaseServiceKey = envOrFallback(process.env.SUPABASE_SERVICE_ROLE_KEY, FALLBACK_SUPABASE_KEY)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side only: never expose to browser.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})
