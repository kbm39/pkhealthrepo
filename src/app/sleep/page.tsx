import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeLink from '@/components/HomeLink'

function formatMinutes(mins: number | null): string {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

// sleep_date is a plain YYYY-MM-DD string (no time). Parsing it directly
// with `new Date(str)` treats it as UTC midnight, which can display as the
// wrong day depending on timezone — appending a local time avoids that.
function formatSleepDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export default async function SleepPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: entries } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('sleep_date', { ascending: false })
    .limit(60)

  const allEntries = entries ?? []
  const latest = allEntries[0] ?? null

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Sleep</h1>
          <Link
            href="/sleep/new"
            className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
          >
            + Add
          </Link>
        </div>

        {latest && (
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-medium text-neutral-700 mb-2">
              Latest — {formatSleepDate(latest.sleep_date)}
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {formatMinutes(latest.total_sleep_minutes)}
                </p>
                <p className="text-xs text-neutral-700">total sleep</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.sleep_score ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">sleep score</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.avg_heart_rate ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">avg HR</p>
              </div>
            </div>
          </section>
        )}

        {(['oura', 'withings'] as const).map((deviceSource) => {
          const deviceEntries = allEntries.filter((e) => e.source === deviceSource)
          return (
            <section key={deviceSource} className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-medium text-neutral-700 mb-3">
                {deviceSource === 'oura' ? 'Oura Ring' : 'Withings Sleep Analyzer'}
              </h2>
              {deviceEntries.length === 0 ? (
                <p className="text-sm text-neutral-700 text-center py-2">No entries yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {deviceEntries.map((entry) => (
                    <li key={entry.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-900">
                          {formatMinutes(entry.total_sleep_minutes)}
                          {entry.sleep_score != null && ` · Score ${entry.sleep_score}`}
                        </span>
                        <span className="text-xs text-neutral-600">
                          {formatSleepDate(entry.sleep_date)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}

        {allEntries.some((e) => e.source !== 'oura' && e.source !== 'withings') && (
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-medium text-neutral-700 mb-3">Other / Manual</h2>
            <ul className="divide-y divide-neutral-100">
              {allEntries
                .filter((e) => e.source !== 'oura' && e.source !== 'withings')
                .map((entry) => (
                  <li key={entry.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-900">
                        {formatMinutes(entry.total_sleep_minutes)}
                        {entry.sleep_score != null && ` · Score ${entry.sleep_score}`}
                      </span>
                      <span className="text-xs text-neutral-600">
                        {formatSleepDate(entry.sleep_date)} · {entry.source}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {allEntries.length === 0 && (
          <p className="text-sm text-neutral-700 text-center py-8">
            No sleep entries yet. Tap &quot;+ Add&quot; to log your first night.
          </p>
        )}

        <Link
          href="/dashboard"
          className="block text-center text-sm text-neutral-700 underline underline-offset-2"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}
