import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeLink from '@/components/HomeLink'
import WorkoutsDayView from '@/components/WorkoutsDayView'

interface RawSetRow {
  id: string
  set_number: number
  weight_lbs: number | null
  reps: number | null
  calories_burned: number | null
  exercises: { name: string } | { name: string }[] | null
}

interface RawWorkoutLog {
  id: string
  logged_at: string
  workout_sets: RawSetRow[] | null
}

export default async function WorkoutsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch a wide window (90 days) rather than filtering "today" on the
  // server — the server runs in UTC, so a UTC day boundary doesn't match
  // the user's actual local day. All day filtering happens client-side
  // instead, using the browser's real local timezone.
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data } = await supabase
    .from('workout_logs')
    .select(
      'id, logged_at, workout_sets(id, set_number, weight_lbs, reps, calories_burned, exercises(name))'
    )
    .eq('user_id', user.id)
    .gte('logged_at', ninetyDaysAgo.toISOString())
    .order('logged_at', { ascending: true })

  const rawLogs = (data ?? []) as unknown as RawWorkoutLog[]

  const logs = rawLogs.map((log) => ({
    id: log.id,
    logged_at: log.logged_at,
    sets: (log.workout_sets ?? []).map((set) => {
      const exerciseObj = Array.isArray(set.exercises) ? set.exercises[0] : set.exercises
      return {
        id: set.id,
        set_number: set.set_number,
        weight_lbs: set.weight_lbs,
        reps: set.reps,
        calories_burned: set.calories_burned,
        exercise_name: exerciseObj?.name ?? 'Exercise',
      }
    }),
  }))

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Workouts</h1>
          <div className="flex gap-2 flex-wrap justify-end">
            <Link
              href="/workouts/activity"
              className="rounded-md border border-neutral-300 text-neutral-700 text-sm font-medium px-4 py-2 hover:bg-neutral-50"
            >
              Activity
            </Link>
            <Link
              href="/workouts/trends"
              className="rounded-md border border-neutral-300 text-neutral-700 text-sm font-medium px-4 py-2 hover:bg-neutral-50"
            >
              Trends
            </Link>
            <Link
              href="/workouts/new"
              className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
            >
              + Log
            </Link>
          </div>
        </div>

        <WorkoutsDayView logs={logs} />
      </div>
    </main>
  )
}
