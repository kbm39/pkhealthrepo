// Pure helpers for the read-only share-link feature. Kept separate so the
// token format can be tested without a browser.

/** URL-safe, unguessable token — 32 random bytes, base64url encoded (~43 chars). */
export function generateShareToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export type ExpirationOption = '7d' | '30d' | '90d' | 'never'

export function expirationToDate(option: ExpirationOption): string | null {
  if (option === 'never') return null
  const days = { '7d': 7, '30d': 30, '90d': 90 }[option]
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export const SHARE_SECTIONS = [
  { key: 'body_metrics', label: 'Body composition' },
  { key: 'vitals', label: 'Blood pressure & glucose' },
  { key: 'workouts', label: 'Strength workouts' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'activity', label: 'Daily activity' },
  { key: 'swim', label: 'Swimming' },
  { key: 'meals', label: 'Nutrition' },
] as const

export type ShareSectionKey = (typeof SHARE_SECTIONS)[number]['key']
