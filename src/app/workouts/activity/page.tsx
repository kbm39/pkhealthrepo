import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeLink from '@/components/HomeLink'

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export default async function ActivityPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: entries } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('activity_date', { ascending: false })
    .order('started_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(60)

  // Batch screenshot imports insert several rows for the same day in one statement,
  // so Postgres gives them an identical `created_at` — that alone isn't a reliable
  // tiebreaker. `started_at` (the actual detected clock time) is, so entries with a
  // real timestamp are sorted by it; only day-summary rows (no started_at) fall back
  // to insertion order.
  const allEntries = entries ?? []
  const latest = allEntries[0] ?? null

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Activity</h1>
          <Link
            href="/workouts/activity/new"
            className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
          >
            + Add
          </Link>
        </div>

        {latest && (
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-medium text-neutral-700 mb-2">
              Latest — {formatDate(latest.activity_date)}
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.steps?.toLocaleString() ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">steps</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.active_calories ?? '—'}
                  {latest.goal_calories != null && (
                    <span className="text-xs text-neutral-500"> / {latest.goal_calories}</span>
                  )}
                </p>
                <p className="text-xs text-neutral-700">goal progress cal</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.total_calories ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">total burn</p>
              </div>
            </div>
            {latest.activity_time_minutes != null && (
              <p className="text-xs text-neutral-600 text-center mt-3">
                Activity time: {Math.floor(latest.activity_time_minutes / 60)}h{' '}
                {latest.activity_time_minutes % 60}m
              </p>
            )}
            {latest.activity_type && (
              <p className="text-xs text-neutral-600 text-center mt-1">
                {latest.activity_type}
                {latest.duration_minutes != null && ` · ${latest.duration_minutes} min`}
                {latest.avg_heart_rate != null && ` · avg HR ${latest.avg_heart_rate}`}
              </p>
            )}
          </section>
        )}

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-700 mb-3">History</h2>
          {allEntries.length === 0 ? (
            <p className="text-sm text-neutral-700 text-center py-4">
              No activity entries yet. Tap &quot;+ Add&quot; to import from Oura or enter manually.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {allEntries.map((entry) => (
                <li key={entry.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-900">
                      {entry.steps != null && `${entry.steps.toLocaleString()} steps`}
                      {entry.activity_type && ` · ${entry.activity_type}`}
                      {entry.active_calories != null && ` · ${entry.active_calories} cal`}
                      {entry.duration_minutes != null && ` · ${entry.duration_minutes} min`}
                    </span>
                    <span className="text-xs text-neutral-600">
                      {entry.started_at
                        ? new Date(entry.started_at).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : formatDate(entry.activity_date)}{' '}
                      · {entry.source}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href="/workouts"
          className="block text-center text-sm text-neutral-700 underline underline-offset-2"
        >
          Back to workouts
        </Link>
      </div>
    </main>
  )
}
