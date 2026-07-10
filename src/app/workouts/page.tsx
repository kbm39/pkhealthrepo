import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfTodayISO(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export default async function WorkoutsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: workoutLogs } = await supabase
    .from('workout_logs')
    .select('id, logged_at, notes, workout_sets(id, set_number, weight_lbs, reps, calories_burned, exercises(name, category))')
    .eq('user_id', user.id)
    .gte('logged_at', startOfTodayISO())
    .lte('logged_at', endOfTodayISO())
    .order('logged_at', { ascending: true })

  const logs = workoutLogs ?? []

  const totalCaloriesBurned = logs.reduce((sum, log) => {
    const sets = Array.isArray(log.workout_sets) ? log.workout_sets : []
    return sum + sets.reduce((s, set) => s + (set.calories_burned ?? 0), 0)
  }, 0)

  const totalSets = logs.reduce((sum, log) => {
    const sets = Array.isArray(log.workout_sets) ? log.workout_sets : []
    return sum + sets.length
  }, 0)

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Today&apos;s Workout</h1>
          <Link
            href="/workouts/new"
            className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
          >
            + Log
          </Link>
        </div>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-700 mb-2">Today&apos;s totals</h2>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold text-neutral-900">{totalSets}</p>
              <p className="text-xs text-neutral-700">sets</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900">
                {Math.round(totalCaloriesBurned)}
              </p>
              <p className="text-xs text-neutral-700">cal burned (est.)</p>
            </div>
          </div>
        </section>

        {logs.map((log) => {
          const sets = Array.isArray(log.workout_sets) ? log.workout_sets : []
          if (sets.length === 0) return null

          // Group sets by exercise for display.
          const byExercise = new Map<string, typeof sets>()
          for (const set of sets) {
            const exName = Array.isArray(set.exercises)
              ? set.exercises[0]?.name
              : (set.exercises as { name: string } | null)?.name
            const key = exName ?? 'Exercise'
            if (!byExercise.has(key)) byExercise.set(key, [])
            byExercise.get(key)!.push(set)
          }

          return (
            <section key={log.id} className="rounded-lg border border-neutral-200 bg-white p-5">
              <p className="text-xs text-neutral-600 mb-3">
                {new Date(log.logged_at).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              <div className="space-y-3">
                {Array.from(byExercise.entries()).map(([exerciseName, exSets]) => (
                  <div key={exerciseName}>
                    <p className="text-sm font-medium text-neutral-900">{exerciseName}</p>
                    <ul className="text-xs text-neutral-700 space-y-0.5 mt-1">
                      {exSets
                        .sort((a, b) => a.set_number - b.set_number)
                        .map((set) => (
                          <li key={set.id}>
                            Set {set.set_number}: {set.weight_lbs ?? '—'} lbs × {set.reps ?? '—'}{' '}
                            reps
                            {set.calories_burned != null &&
                              ` · ${Math.round(set.calories_burned)} cal`}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        {logs.length === 0 && (
          <p className="text-sm text-neutral-700 text-center py-8">
            No workout logged today yet. Tap &quot;+ Log&quot; to get started.
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
