// Pure helpers for parsing InBody CSV exports. Kept separate so they can be
// exercised directly without a browser.

export const KG_TO_LBS = 2.20462

export type Field = 'date' | 'weight' | 'bodyFatPct' | 'bodyFatMass' | 'smm' | 'leanMass'

/** Header keywords, most specific first — the first match wins for each field. */
const MATCHERS: { field: Field; patterns: string[] }[] = [
  { field: 'date', patterns: ['test date', 'date/time', 'datetime', 'date'] },
  {
    field: 'bodyFatPct',
    patterns: ['percent body fat', 'body fat percentage', 'pbf', 'body fat %', 'bf%'],
  },
  {
    field: 'bodyFatMass',
    patterns: ['body fat mass', 'fat mass', 'bfm'],
  },
  {
    field: 'smm',
    patterns: ['skeletal muscle mass', 'smm', 'muscle mass'],
  },
  {
    field: 'leanMass',
    patterns: ['fat free mass', 'fat-free mass', 'lean body mass', 'ffm', 'lean mass'],
  },
  { field: 'weight', patterns: ['weight'] },
]

export function detectColumn(headers: string[], field: Field): string | null {
  const entry = MATCHERS.find((m) => m.field === field)
  if (!entry) return null

  const norm = (h: string) => h.toLowerCase().trim()
  // Drop a trailing unit parenthetical so "Weight (lbs)" compares as "weight".
  const core = (h: string) => norm(h).replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  // When several headers match, the shortest is the least-qualified one —
  // "Weight (lbs)" rather than "Weight Control (lbs)".
  const shortest = (matches: string[]) =>
    matches.length === 0
      ? null
      : matches.reduce((a, b) => (core(a).length <= core(b).length ? a : b))

  for (const pattern of entry.patterns) {
    const exact = shortest(headers.filter((h) => core(h) === pattern))
    if (exact) return exact
  }
  for (const pattern of entry.patterns) {
    const starts = shortest(headers.filter((h) => core(h).startsWith(pattern)))
    if (starts) return starts
  }
  for (const pattern of entry.patterns) {
    const hit = shortest(headers.filter((h) => core(h).includes(pattern)))
    if (hit) return hit
  }
  return null
}

/** Reads a unit out of a header like "Weight (kg)" — falls back to null. */
export function detectUnit(header: string | null): 'kg' | 'lbs' | null {
  if (!header) return null
  const h = header.toLowerCase()
  if (h.includes('kg')) return 'kg'
  if (h.includes('lb')) return 'lbs'
  return null
}

export function toNumber(raw: unknown): number | null {
  if (raw == null) return null
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** InBody exports vary; accept the common shapes and fall back to Date parsing. */
export function toIsoDate(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s === '') return null

  // InBody's compact export format: YYYYMMDDHHMMSS (no separators at all),
  // e.g. "20260819065201". Check this before the loose Date() fallback,
  // since native parsing chokes on it.
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (compact) {
    const [, y, m, d, hh, mm] = compact
    return new Date(
      Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)
    ).toISOString()
  }

  // Same format but date-only: YYYYMMDD
  const compactDate = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compactDate) {
    const [, y, m, d] = compactDate
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0).toISOString()
  }

  // YYYY-MM-DD or YYYY.MM.DD, optionally followed by a time
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (ymd) {
    const [, y, m, d, hh = '12', mm = '00'] = ymd
    return new Date(
      Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)
    ).toISOString()
  }

  // MM/DD/YYYY, optionally followed by a time
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (mdy) {
    const [, m, d, y, hh = '12', mm = '00'] = mdy
    return new Date(
      Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)
    ).toISOString()
  }

  const parsed = new Date(s)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

