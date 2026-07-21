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

export default async function SwimPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: entries } = await supabase
    .from('swim_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('swim_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(60)

  const allEntries = entries ?? []
  const latest = allEntries[0] ?? null

  const totalYardageThisMonth = allEntries
    .filter((e) => {
      const d = new Date(e.swim_date + 'T00:00:00')
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + (e.yardage ?? 0), 0)

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Swim</h1>
          <Link
            href="/workouts/swim/new"
            className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
          >
            + Add
          </Link>
        </div>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-700 mb-2">This month</h2>
          <div className="text-center">
            <p className="text-2xl font-semibold text-neutral-900">
              {totalYardageThisMonth.toLocaleString()}
            </p>
            <p className="text-xs text-neutral-700">total yardage</p>
          </div>
        </section>

        {latest && (
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-medium text-neutral-700 mb-2">
              Latest — {formatDate(latest.swim_date)}
            </h2>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.yardage?.toLocaleString() ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">{latest.distance_unit ?? 'yards'}</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.duration_minutes ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">minutes</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.active_calories ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">active cal</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.total_calories ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">total cal</p>
              </div>
            </div>
            {(latest.stroke_type || latest.avg_heart_rate != null) && (
              <p className="text-xs text-neutral-600 text-center mt-3">
                {latest.stroke_type}
                {latest.avg_heart_rate != null && ` · avg HR ${latest.avg_heart_rate}`}
              </p>
            )}
          </section>
        )}

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-700 mb-3">History</h2>
          {allEntries.length === 0 ? (
            <p className="text-sm text-neutral-700 text-center py-4">
              No swims logged yet. Tap &quot;+ Add&quot; to import from Apple Watch or enter
              manually.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {allEntries.map((entry) => (
                <li key={entry.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-900">
                      {entry.yardage != null &&
                        `${entry.yardage.toLocaleString()} ${entry.distance_unit ?? 'yards'}`}
                      {entry.duration_minutes != null && ` · ${entry.duration_minutes} min`}
                      {entry.active_calories != null && ` · ${entry.active_calories} cal`}
                    </span>
                    <span className="text-xs text-neutral-600">
                      {formatDate(entry.swim_date)} · {entry.source}
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
