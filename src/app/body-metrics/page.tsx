import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WeightTrendChart from '@/components/WeightTrendChart'
import BodyMetricActions from '@/components/BodyMetricActions'
import HomeLink from '@/components/HomeLink'

export default async function BodyMetricsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: entries } = await supabase
    .from('body_metrics')
    .select('*')
    .eq('user_id', user.id)
    .order('recorded_at', { ascending: false })

  const { data: activeGoal } = await supabase
    .from('weight_goals')
    .select('goal_weight_lbs')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const allEntries = entries ?? []
  const latest = allEntries[0] ?? null

  const chartData = [...allEntries]
    .reverse()
    .filter((e) => e.weight_lbs != null)
    .map((e) => ({
      date: new Date(e.recorded_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      weight: e.weight_lbs,
    }))

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Body Metrics</h1>
          <Link
            href="/body-metrics/new"
            className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
          >
            + Add
          </Link>
        </div>

        {latest && (
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-medium text-neutral-700 mb-2">
              Latest —{' '}
              {new Date(latest.recorded_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </h2>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.weight_lbs ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">weight (lbs)</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.body_fat_pct != null ? `${latest.body_fat_pct}%` : '—'}
                </p>
                <p className="text-xs text-neutral-700">body fat %</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.skeletal_muscle_mass_lbs ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">SMM (lbs)</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">
                  {latest.lean_mass_lbs ?? '—'}
                </p>
                <p className="text-xs text-neutral-700">lean mass (lbs)</p>
              </div>
            </div>
          </section>
        )}

        {chartData.length >= 2 ? (
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-medium text-neutral-700 mb-2">Weight trend</h2>
            <WeightTrendChart data={chartData} goalWeight={activeGoal?.goal_weight_lbs} />
          </section>
        ) : (
          <p className="text-sm text-neutral-700 text-center py-4">
            Log at least 2 weight entries to see a trend chart.
          </p>
        )}

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-700 mb-3">History</h2>
          {allEntries.length === 0 ? (
            <p className="text-sm text-neutral-700 text-center py-4">
              No entries yet. Tap &quot;+ Add&quot; to log your first weigh-in.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {allEntries.map((entry) => (
                <li key={entry.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-neutral-900">
                      {entry.weight_lbs != null ? `${entry.weight_lbs} lbs` : 'No weight'}
                      {entry.body_fat_pct != null && ` · ${entry.body_fat_pct}% BF`}
                    </span>
                    <span className="block text-xs text-neutral-600">
                      {new Date(entry.recorded_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      · {entry.source === 'inbody_h30' ? 'InBody H30' : 'Manual'}
                    </span>
                  </div>
                  <BodyMetricActions entryId={entry.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

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
