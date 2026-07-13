'use client'

export function LocalTime({ iso }: { iso: string }) {
  return (
    <>
      {new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </>
  )
}

export function LocalDate({ iso }: { iso: string }) {
  return <>{new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
}

/** Returns YYYY-MM-DD for the given ISO timestamp in the browser's local timezone. */
export function localDateKey(iso: string): string {
  const d = new Date(iso)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Returns today's date as YYYY-MM-DD in the browser's local timezone. */
export function todayDateKey(): string {
  return localDateKey(new Date().toISOString())
}
