'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'

type Row = Record<string, unknown>

/** Renders a timestamp as a plain local-time string for the spreadsheet. */
function localStamp(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

function minutesToHm(mins: number | null): string {
  if (mins == null) return ''
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default function ExportPage() {
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function handleExport() {
    setBusy(true)
    setError(null)
    setDone(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('You need to be signed in to export.')
        setBusy(false)
        return
      }

      const [
        profile,
        goals,
        meals,
        workouts,
        activity,
        swims,
        sleep,
        body,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('weight_goals').select('*').eq('user_id', user.id),
        supabase
          .from('meal_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('logged_at', { ascending: true }),
        supabase
          .from('workout_logs')
          .select('logged_at, notes, workout_sets(set_number, weight_lbs, reps, calories_burned, exercises(name))')
          .eq('user_id', user.id)
          .order('logged_at', { ascending: true }),
        supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('activity_date', { ascending: true }),
        supabase
          .from('swim_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('swim_date', { ascending: true }),
        supabase
          .from('sleep_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('sleep_date', { ascending: true }),
        supabase
          .from('body_metrics')
          .select('*')
          .eq('user_id', user.id)
          .order('recorded_at', { ascending: true }),
      ])

      const wb = XLSX.utils.book_new()

      // --- Meals ---------------------------------------------------------
      const mealRows: Row[] = (meals.data ?? []).map((m) => ({
        Date: localStamp(m.logged_at),
        Meal: m.meal_type,
        Food: m.food_name_snapshot ?? '',
        Quantity: m.quantity,
        Calories: m.calories,
        'Protein (g)': m.protein_g,
        'Carbs (g)': m.carbs_g,
        'Fat (g)': m.fat_g,
        'Fiber (g)': m.fiber_g,
        'Sugar (g)': m.sugar_g,
        'Sodium (mg)': m.sodium_mg,
        'Logged via': m.entry_method,
      }))

      // --- Daily summary -------------------------------------------------
      const byDay = new Map<
        string,
        { eaten: number; protein: number; carbs: number; fat: number; burned: number; steps: number | null }
      >()

      const touch = (day: string) => {
        if (!byDay.has(day)) {
          byDay.set(day, { eaten: 0, protein: 0, carbs: 0, fat: 0, burned: 0, steps: null })
        }
        return byDay.get(day)!
      }

      for (const m of meals.data ?? []) {
        const day = localStamp(m.logged_at).slice(0, 10)
        const d = touch(day)
        d.eaten += m.calories ?? 0
        d.protein += m.protein_g ?? 0
        d.carbs += m.carbs_g ?? 0
        d.fat += m.fat_g ?? 0
      }
      for (const a of activity.data ?? []) {
        const d = touch(a.activity_date)
        d.burned += a.active_calories ?? 0
        if (a.steps != null) d.steps = (d.steps ?? 0) + a.steps
      }
      for (const s of swims.data ?? []) {
        touch(s.swim_date).burned += s.active_calories ?? 0
      }

      const summaryRows: Row[] = [...byDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, d]) => ({
          Date: day,
          'Calories eaten': Math.round(d.eaten),
          'Calories burned': Math.round(d.burned),
          Net: Math.round(d.eaten - d.burned),
          Steps: d.steps ?? '',
          'Protein (g)': Math.round(d.protein),
          'Carbs (g)': Math.round(d.carbs),
          'Fat (g)': Math.round(d.fat),
        }))

      // --- Workouts (one row per set) -------------------------------------
      const workoutRows: Row[] = []
      for (const w of workouts.data ?? []) {
        const sets = (w.workout_sets ?? []) as {
          set_number: number
          weight_lbs: number | null
          reps: number | null
          calories_burned: number | null
          exercises: { name: string } | { name: string }[] | null
        }[]
        for (const s of sets) {
          const ex = Array.isArray(s.exercises) ? s.exercises[0] : s.exercises
          workoutRows.push({
            Date: localStamp(w.logged_at),
            Exercise: ex?.name ?? '',
            Set: s.set_number,
            'Weight (lbs)': s.weight_lbs,
            Reps: s.reps,
            'Calories burned': s.calories_burned,
            Notes: w.notes ?? '',
          })
        }
      }

      // --- Activity --------------------------------------------------------
      const activityRows: Row[] = (activity.data ?? []).map((a) => ({
        Date: a.activity_date,
        Source: a.source,
        Steps: a.steps,
        'Active calories': a.active_calories,
        'Total calories': a.total_calories,
        Type: a.activity_type ?? '',
        'Duration (min)': a.duration_minutes,
        'Avg HR': a.avg_heart_rate,
      }))

      // --- Swim -------------------------------------------------------------
      const swimRows: Row[] = (swims.data ?? []).map((s) => ({
        Date: s.swim_date,
        Source: s.source,
        Distance: s.yardage,
        Unit: s.distance_unit,
        'Duration (min)': s.duration_minutes,
        'Active calories': s.active_calories,
        'Total calories': s.total_calories,
        'Avg HR': s.avg_heart_rate,
        Stroke: s.stroke_type ?? '',
        Laps: s.laps,
      }))

      // --- Sleep ------------------------------------------------------------
      const sleepRows: Row[] = (sleep.data ?? []).map((s) => ({
        Date: s.sleep_date,
        Source: s.source,
        'Total sleep': minutesToHm(s.total_sleep_minutes),
        'Total (min)': s.total_sleep_minutes,
        'Light (min)': s.light_sleep_minutes,
        'Deep (min)': s.deep_sleep_minutes,
        'REM (min)': s.rem_sleep_minutes,
        'Awake (min)': s.awake_minutes,
        Score: s.sleep_score,
        'Avg HR': s.avg_heart_rate,
        'HRV first 90 (ms)': s.hrv_first_90_ms,
        'HRV last 90 (ms)': s.hrv_last_90_ms,
        'Latency (min)': s.sleep_latency_minutes,
        Interruptions: s.interruptions_count,
        'Resp. rate': s.avg_respiratory_rate,
      }))

      // --- Body metrics ------------------------------------------------------
      const bodyRows: Row[] = (body.data ?? []).map((b) => ({
        Date: localStamp(b.recorded_at),
        Source: b.source,
        'Weight (lbs)': b.weight_lbs,
        'Body fat %': b.body_fat_pct,
        'Body fat (lbs)': b.body_fat_lbs,
        'Skeletal muscle (lbs)': b.skeletal_muscle_mass_lbs,
        'Lean mass (lbs)': b.lean_mass_lbs,
      }))

      // --- Profile -----------------------------------------------------------
      const p = profile.data
      const profileRows: Row[] = p
        ? [
            { Field: 'Name', Value: p.full_name ?? '' },
            { Field: 'Date of birth', Value: p.date_of_birth ?? '' },
            { Field: 'Sex', Value: p.sex ?? '' },
            { Field: 'Height (in)', Value: p.height_in ?? '' },
            { Field: 'Activity level', Value: p.activity_level ?? '' },
            { Field: 'Diet type', Value: p.diet_type ?? '' },
            ...(goals.data ?? []).map((g) => ({
              Field: `Goal weight${g.is_active ? ' (active)' : ''}`,
              Value: `${g.goal_weight_lbs} lbs${g.target_date ? ` by ${g.target_date}` : ''}`,
            })),
            { Field: 'Exported', Value: localStamp(new Date().toISOString()) },
          ]
        : []

      const sheets: [string, Row[]][] = [
        ['Daily summary', summaryRows],
        ['Meals', mealRows],
        ['Workouts', workoutRows],
        ['Activity', activityRows],
        ['Swim', swimRows],
        ['Sleep', sleepRows],
        ['Body metrics', bodyRows],
        ['Profile', profileRows],
      ]

      for (const [name, rows] of sheets) {
        const ws = XLSX.utils.json_to_sheet(
          rows.length > 0 ? rows : [{ 'No data': '' }]
        )
        XLSX.utils.book_append_sheet(wb, ws, name)
      }

      const today = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const filename = `health-export-${today.getFullYear()}-${pad(
        today.getMonth() + 1
      )}-${pad(today.getDate())}.xlsx`

      XLSX.writeFile(wb, filename)
      setDone(filename)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong building the file.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Export data</h1>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
          <p className="text-sm text-neutral-700">
            Downloads everything you&rsquo;ve logged as an Excel workbook, with a
            separate tab for each area:
          </p>
          <ul className="text-sm text-neutral-700 list-disc pl-5 space-y-1">
            <li>
              <span className="font-medium text-neutral-900">Daily summary</span> —
              calories eaten, burned, net, steps and macros per day
            </li>
            <li>Meals — every item logged, with macros</li>
            <li>Workouts — one row per set</li>
            <li>Activity and Swim — imported wearable data</li>
            <li>Sleep — stages, score, HRV</li>
            <li>Body metrics and Profile</li>
          </ul>

          <button
            onClick={handleExport}
            disabled={busy}
            className="w-full rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
          >
            {busy ? 'Building file…' : 'Download Excel file'}
          </button>

          {done && (
            <p className="text-sm text-neutral-700">
              Saved as <span className="font-medium text-neutral-900">{done}</span> —
              check your downloads.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <p className="text-xs text-neutral-700">
            The file is built in your browser and never passes through anyone
            else&rsquo;s server.
          </p>
        </section>
      </div>
    </main>
  )
}
