import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  calculateDailyTarget,
  projectDaysToGoal,
  type ActivityLevel,
} from '@/lib/calc/calories'
import HomeLink from '@/components/HomeLink'
import TodayEnergyCard from '@/components/TodayEnergyCard'

// Default weekly rate target — adjustable per-goal in a future settings screen.
const DEFAULT_WEEKLY_RATE_LBS = 2

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const diffMs = Date.now() - dob.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: latestMetric } = await supabase
    .from('body_metrics')
    .select('*')
    .eq('user_id', user.id)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single()

  const { data: activeGoal } = await supabase
    .from('weight_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!profile || !latestMetric || !activeGoal) {
    redirect('/onboarding')
  }

  const profileInput = {
    sex: profile.sex as 'male' | 'female',
    age: calculateAge(profile.date_of_birth),
    heightIn: profile.height_in,
    weightLbs: latestMetric.weight_lbs,
    activityLevel: profile.activity_level as ActivityLevel,
  }

  const dailyTarget = calculateDailyTarget(profileInput, DEFAULT_WEEKLY_RATE_LBS)

  // Pull a few days of energy data rather than filtering to "today" here — the
  // server runs in UTC, so the day boundary is resolved client-side instead.
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 3)
  const windowStartIso = windowStart.toISOString()
  const windowStartDate = windowStartIso.slice(0, 10)

  const [
    { data: recentMeals },
    { data: recentActivity },
    { data: recentSwims },
    { data: recentWorkouts },
  ] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('calories, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', windowStartIso),
    supabase
      .from('activity_logs')
      .select('activity_date, active_calories, activity_type')
      .eq('user_id', user.id)
      .gte('activity_date', windowStartDate),
    supabase
      .from('swim_logs')
      .select('swim_date, active_calories')
      .eq('user_id', user.id)
      .gte('swim_date', windowStartDate),
    supabase
      .from('workout_logs')
      .select('logged_at, workout_sets(calories_burned)')
      .eq('user_id', user.id)
      .gte('logged_at', windowStartIso),
  ])

  const strengthBurn = (recentWorkouts ?? []).map((w) => ({
    logged_at: w.logged_at as string,
    calories_burned: (w.workout_sets ?? []).reduce(
      (sum: number, s: { calories_burned: number | null }) =>
        sum + (s.calories_burned ?? 0),
      0
    ),
  }))

  // TODO: replace with real 7–14 day logged average from meal_logs
  // once meal logging is built. Falls back to theoretical target for now.
  const projection = projectDaysToGoal(
    latestMetric.weight_lbs,
    activeGoal.goal_weight_lbs,
    dailyTarget
  )

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>

        <TodayEnergyCard
          dailyTarget={dailyTarget.dailyTarget}
          meals={recentMeals ?? []}
          activity={recentActivity ?? []}
          swims={recentSwims ?? []}
          strength={strengthBurn}
        />

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-700 mb-1">
            Daily calorie target
          </h2>
          <p className="text-3xl font-semibold text-neutral-900">
            {dailyTarget.dailyTarget.toLocaleString()}{' '}
            <span className="text-base font-normal text-neutral-700">cal/day</span>
          </p>
          <p className="text-xs text-neutral-700 mt-1">
            TDEE: {Math.round(dailyTarget.tdee).toLocaleString()} cal/day
          </p>
          {dailyTarget.note && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
              {dailyTarget.note}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-700 mb-1">
            Goal weight timeline
          </h2>
          {projection.projectedDays !== null ? (
            <>
              <p className="text-3xl font-semibold text-neutral-900">
                {projection.projectedDays}{' '}
                <span className="text-base font-normal text-neutral-700">days</span>
              </p>
              <p className="text-xs text-neutral-700 mt-1">
                Projected: {projection.projectedDate} · {projection.poundsToLose} lbs to go
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-700">Not enough data to project yet.</p>
          )}
          <p className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2 mt-3">
            {projection.note}
          </p>
        </section>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/meals"
            className="flex-1 block text-center rounded-md bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800"
          >
            Log a meal
          </Link>
          <Link
            href="/workouts"
            className="flex-1 block text-center rounded-md border border-neutral-300 text-neutral-700 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Log a workout
          </Link>
          <Link
            href="/body-metrics"
            className="flex-1 block text-center rounded-md border border-neutral-300 text-neutral-700 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Body metrics
          </Link>
        </div>
      </div>
    </main>
  )
}
