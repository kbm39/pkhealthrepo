import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  calculateDailyTarget,
  projectDaysToGoal,
  type ActivityLevel,
} from '@/lib/calc/calories'

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
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-500 mb-1">
            Daily calorie target
          </h2>
          <p className="text-3xl font-semibold text-neutral-900">
            {dailyTarget.dailyTarget.toLocaleString()}{' '}
            <span className="text-base font-normal text-neutral-500">cal/day</span>
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            TDEE: {Math.round(dailyTarget.tdee).toLocaleString()} cal/day
          </p>
          {dailyTarget.note && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
              {dailyTarget.note}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-500 mb-1">
            Goal weight timeline
          </h2>
          {projection.projectedDays !== null ? (
            <>
              <p className="text-3xl font-semibold text-neutral-900">
                {projection.projectedDays}{' '}
                <span className="text-base font-normal text-neutral-500">days</span>
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Projected: {projection.projectedDate} · {projection.poundsToLose} lbs to go
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-700">Not enough data to project yet.</p>
          )}
          <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2 mt-3">
            {projection.note}
          </p>
        </section>

        <Link
          href="/meals"
          className="block text-center rounded-md bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800"
        >
          Log a meal
        </Link>
      </div>
    </main>
  )
}
