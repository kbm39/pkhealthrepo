import { createClient } from '@supabase/supabase-js'

// SERVER-ONLY. Never import this from a 'use client' file — the service
// role key bypasses Row Level Security entirely. It exists solely so the
// public /share/[token] route can look up a share_links row (and the data
// it grants) for a visitor who has no Supabase session of their own. Every
// caller must independently validate the token (not revoked, not expired)
// before using this client to read anything.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Supabase admin client is not configured (missing SUPABASE_SERVICE_ROLE_KEY).')
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
