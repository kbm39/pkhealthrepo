import { createAdminClient } from '@/lib/supabase/admin'
import ShareView, { type ShareData } from '@/components/ShareView'

const LOOKBACK_DAYS = 90

function InvalidLink({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-2">
        <h1 className="text-lg font-semibold text-neutral-900">Link unavailable</h1>
        <p className="text-sm text-neutral-600">{message}</p>
      </div>
    </main>
  )
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!link) {
    return <InvalidLink message="This link doesn't exist. Double-check the URL you were sent." />
  }
  if (link.revoked_at) {
    return <InvalidLink message="This link has been revoked by its owner." />
  }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return <InvalidLink message="This link has expired. Ask for a new one." />
  }

  const sections: string[] = link.sections ?? []
  const userId: string = link.user_id
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)
  const cutoffIso = cutoff.toISOString()
  const cutoffDate = cutoffIso.slice(0, 10)

  const [{ data: profile }, { data: weightGoal }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    admin
      .from('weight_goals')
      .select('goal_weight_lbs, target_date')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const data: ShareData = {
    fullName: profile?.full_name ?? null,
    linkLabel: link.label,
    sections,
    lookbackDays: LOOKBACK_DAYS,
    weightGoal: weightGoal ? { goalWeightLbs: weightGoal.goal_weight_lbs, targetDate: weightGoal.target_date } : null,
    bodyMetrics: [],
    vitals: [],
    workouts: [],
    sleep: [],
    activity: [],
    swim: [],
    mealsDaily: [],
  }

  if (sections.includes('body_metrics')) {
    const { data: rows } = await admin
      .from('body_metrics')
      .select('recorded_at, weight_lbs, body_fat_pct, skeletal_muscle_mass_lbs, lean_mass_lbs')
      .eq('user_id', userId)
      .gte('recorded_at', cutoffIso)
      .order('recorded_at', { ascending: false })
      .limit(100)
    data.bodyMetrics = rows ?? []
  }

  if (sections.includes('vitals')) {
    const { data: rows } = await admin
      .from('vitals')
      .select('recorded_at, vital_type, systolic, diastolic, heart_rate, glucose_mg_dl, reading_context')
      .eq('user_id', userId)
      .gte('recorded_at', cutoffIso)
      .order('recorded_at', { ascending: false })
      .limit(150)
    data.vitals = rows ?? []
  }

  if (sections.includes('workouts')) {
    const { data: logs } = await admin
      .from('workout_logs')
      .select('id, logged_at, notes')
      .eq('user_id', userId)
      .gte('logged_at', cutoffIso)
      .order('logged_at', { ascending: false })
      .limit(60)

    const logIds = (logs ?? []).map((l) => l.id)
    let setsByLog: Record<string, { count: number; volume: number }> = {}

    if (logIds.length > 0) {
      const { data: sets } = await admin
        .from('workout_sets')
        .select('workout_log_id, weight_lbs, reps')
        .in('workout_log_id', logIds)

      setsByLog = (sets ?? []).reduce((acc, s) => {
        const key = s.workout_log_id as string
        if (!acc[key]) acc[key] = { count: 0, volume: 0 }
        acc[key].count += 1
        acc[key].volume += (s.weight_lbs ?? 0) * (s.reps ?? 0)
        return acc
      }, {} as Record<string, { count: number; volume: number }>)
    }

    data.workouts = (logs ?? []).map((l) => ({
      loggedAt: l.logged_at,
      notes: l.notes,
      setCount: setsByLog[l.id]?.count ?? 0,
      totalVolume: Math.round(setsByLog[l.id]?.volume ?? 0),
    }))
  }

  if (sections.includes('sleep')) {
    const { data: rows } = await admin
      .from('sleep_logs')
      .select('sleep_date, total_sleep_minutes, sleep_score, avg_heart_rate, avg_respiratory_rate')
      .eq('user_id', userId)
      .gte('sleep_date', cutoffDate)
      .order('sleep_date', { ascending: false })
      .limit(90)
    data.sleep = rows ?? []
  }

  if (sections.includes('activity')) {
    const { data: rows } = await admin
      .from('activity_logs')
      .select('activity_date, steps, total_calories, goal_calories, activity_time_minutes')
      .eq('user_id', userId)
      .is('activity_type', null)
      .gte('activity_date', cutoffDate)
      .order('activity_date', { ascending: false })
      .limit(90)
    data.activity = rows ?? []
  }

  if (sections.includes('swim')) {
    const { data: rows } = await admin
      .from('swim_logs')
      .select('swim_date, yardage, distance_unit, duration_minutes, avg_heart_rate, stroke_type')
      .eq('user_id', userId)
      .gte('swim_date', cutoffDate)
      .order('swim_date', { ascending: false })
      .limit(60)
    data.swim = rows ?? []
  }

  if (sections.includes('meals')) {
    const { data: rows } = await admin
      .from('meal_logs')
      .select('logged_at, calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .gte('logged_at', cutoffIso)
      .order('logged_at', { ascending: false })
      .limit(2000)

    const byDay = new Map<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }>()
    for (const r of rows ?? []) {
      const day = String(r.logged_at).slice(0, 10)
      const existing = byDay.get(day) ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      existing.calories += r.calories ?? 0
      existing.protein_g += r.protein_g ?? 0
      existing.carbs_g += r.carbs_g ?? 0
      existing.fat_g += r.fat_g ?? 0
      byDay.set(day, existing)
    }
    data.mealsDaily = Array.from(byDay.entries())
      .map(([day, totals]) => ({ day, ...totals }))
      .sort((a, b) => b.day.localeCompare(a.day))
  }

  // Best-effort — don't fail the page render if this write fails.
  admin
    .from('share_links')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', link.id)
    .then(() => {})

  return <ShareView data={data} />
}
