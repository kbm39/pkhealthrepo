/**
 * Shared helpers for resolving an on-screen date label (as read by a
 * screenshot-import AI parser) into an actual YYYY-MM-DD date, and for
 * combining that date with a clock-time string into an ISO timestamp.
 * Used by any screenshot import flow that batches multiple days at once
 * (Activity, Swim, Sleep).
 */

export function formatDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Best-effort resolution of an on-screen date label ("Today", "Yesterday",
 * "Aug 5", "Monday") to YYYY-MM-DD. Returns '' if it can't be confidently
 * resolved, so the caller can prompt the person to pick a date manually.
 */
export function resolveDateLabel(label: string | null): string {
  if (!label) return ''
  const norm = label.trim().toLowerCase()
  const today = new Date()

  if (norm === 'today') return formatDateKey(today)
  if (norm === 'yesterday') {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return formatDateKey(d)
  }

  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const match = label.trim().match(/^([A-Za-z]{3,9})\s+(\d{1,2})/)
  if (match) {
    const mIdx = monthNames.findIndex((m) => match[1].toLowerCase().startsWith(m))
    if (mIdx >= 0) {
      const day = parseInt(match[2], 10)
      const d = new Date(today.getFullYear(), mIdx, day)
      // If that date is more than a day in the future, it must be from last year.
      if (d.getTime() > today.getTime() + 86400000) d.setFullYear(d.getFullYear() - 1)
      return formatDateKey(d)
    }
  }

  return ''
}

/** Parses a "8:17 AM" style clock time into minutes-since-midnight, or null if unparseable. */
export function parseTimeOfDayToMinutes(timeOfDay: string): number | null {
  const match = timeOfDay.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridiem = match[3].toUpperCase()
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

/** Combines a YYYY-MM-DD date with a "8:17 AM" style time into an ISO string, or null if unparseable. */
export function combineDateAndTime(dateKey: string, timeOfDay: string): string | null {
  const match = timeOfDay.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match || !dateKey) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridiem = match[3].toUpperCase()
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  const [year, month, day] = dateKey.split('-').map(Number)
  const d = new Date(year, month - 1, day, hours, minutes)
  return d.toISOString()
}
