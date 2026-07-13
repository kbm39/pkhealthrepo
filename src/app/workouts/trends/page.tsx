import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeLink from '@/components/HomeLink'
import ExerciseTrendsView from '@/components/ExerciseTrendsView'

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

  const rawRows = (data ?? []) as unknown as RawSetRow[]

  const rows = rawRows
    .map((row) => {
      const exerciseObj = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises
      const logObj = Array.isArray(row.workout_logs) ? row.workout_logs[0] : row.workout_logs
      if (!exerciseObj || !logObj) return null
      return {
        weight_lbs: row.weight_lbs,
        reps: row.reps,
        exercise_name: exerciseObj.name,
        logged_at: logObj.logged_at,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Exercise Trends</h1>

        <ExerciseTrendsView rows={rows} />

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
