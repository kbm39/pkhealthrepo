import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExerciseTrendChart from '@/components/ExerciseTrendChart'
import HomeLink from '@/components/HomeLink'

interface RawSetRow {
  weight_lbs: number | null
  reps: number | null
  exercises: { name: string } | { name: string }[] | null
  workout_logs: { logged_at: string } | { logged_at: string }[] | null
}

export default async function WorkoutTrendsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data } = await supabase
    .from('workout_sets')
    .select('weight_lbs, reps, exercises(name), workout_logs!inner(logged_at, user_id)')
    .eq('workout_logs.user_id', user.id)
    .order('logged_at', { referencedTable: 'workout_logs', ascending: true })

  const rows = (data ?? []) as unknown as RawSetRow[]

  // Group by exercise name, then by calendar day: track heaviest single set
  // and total volume (weight × reps summed across sets) for that day.
  const byExercise = new Map<string, Map<string, { maxWeight: number; volume: number }>>()

  for (const row of rows) {
    const exerciseObj = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises
    const logObj = Array.isArray(row.workout_logs) ? row.workout_logs[0] : row.workout_logs
    if (!exerciseObj || !logObj) continue

    const exerciseName = exerciseObj.name
    const day = new Date(logObj.logged_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const weight = row.weight_lbs ?? 0
    const reps = row.reps ?? 0

    if (!byExercise.has(exerciseName)) byExercise.set(exerciseName, new Map())
    const dayMap = byExercise.get(exerciseName)!

    const existing = dayMap.get(day) ?? { maxWeight: 0, volume: 0 }
    dayMap.set(day, {
      maxWeight: Math.max(existing.maxWeight, weight),
      volume: existing.volume + weight * reps,
    })
  }

  const exerciseTrends = Array.from(byExercise.entries())
    .map(([name, dayMap]) => ({
      name,
      points: Array.from(dayMap.entries()).map(([date, vals]) => ({ date, ...vals })),
    }))
    .filter((ex) => ex.points.length >= 2) // need at least 2 sessions for a trend
    .sort((a, b) => a.name.localeCompare(b.name))

  const singleSessionExercises = Array.from(byExercise.keys()).filter(
    (name) => !exerciseTrends.some((ex) => ex.name === name)
  )

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Exercise Trends</h1>

        {exerciseTrends.length === 0 && (
          <p className="text-sm text-neutral-700 text-center py-8">
            Log the same exercise across at least 2 sessions to see a trend here.
          </p>
        )}

        {exerciseTrends.map((ex) => (
          <section key={ex.name} className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">{ex.name}</h2>
            <ExerciseTrendChart data={ex.points} />
          </section>
        ))}

        {singleSessionExercises.length > 0 && (
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <p className="text-xs text-neutral-700">
              Logged once so far — needs a second session to show a trend:{' '}
              {singleSessionExercises.join(', ')}
            </p>
          </section>
        )}

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
