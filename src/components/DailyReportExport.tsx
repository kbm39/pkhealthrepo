'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const nutritionFields = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const
type Nutrition = Partial<Record<(typeof nutritionFields)[number], number | null>>

function localDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function sumLogged(meals: Nutrition[], field: keyof Nutrition) {
  const values = meals.map(meal => meal[field]).filter(value => value != null)
  if (!values.length) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100
}

export default function DailyReportExport() {
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => setDay(localDay(new Date())), [])

  async function downloadReport() {
    setMessage('')
    setFailed(false)
    setBusy(true)

    try {
      const start = new Date(`${day}T00:00:00`)
      if (!Number.isFinite(start.getTime()) || localDay(start) !== day) {
        throw new Error('Choose a valid report date.')
      }
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
      const from = start.toISOString()
      const until = end.toISOString()
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sign in to download your daily report.')

      const [meals, body, activity, workouts, swim, sleep, vitals] = await Promise.all([
        supabase.from('meal_logs').select('logged_at, meal_type, food_name_snapshot, calories, protein_g, carbs_g, fat_g, fiber_g')
          .eq('user_id', user.id).gte('logged_at', from).lt('logged_at', until).order('logged_at').throwOnError(),
        supabase.from('body_metrics').select('recorded_at, source, weight_lbs, body_fat_pct, body_fat_lbs, skeletal_muscle_mass_lbs, lean_mass_lbs')
          .eq('user_id', user.id).gte('recorded_at', from).lt('recorded_at', until).order('recorded_at').throwOnError(),
        supabase.from('activity_logs').select('source, steps, active_calories, total_calories, activity_time_minutes, activity_type, duration_minutes, started_at')
          .eq('user_id', user.id).eq('activity_date', day).order('created_at').throwOnError(),
        supabase.from('workout_logs').select('logged_at, workout_sets(set_number, weight_lbs, reps, calories_burned, exercises(name))')
          .eq('user_id', user.id).gte('logged_at', from).lt('logged_at', until).order('logged_at').throwOnError(),
        supabase.from('swim_logs').select('source, yardage, distance_unit, duration_minutes, active_calories, laps')
          .eq('user_id', user.id).eq('swim_date', day).order('created_at').throwOnError(),
        supabase.from('sleep_logs').select('source, bedtime, wake_time, total_sleep_minutes, sleep_score')
          .eq('user_id', user.id).eq('sleep_date', day).order('created_at').throwOnError(),
        supabase.from('vitals').select('recorded_at, vital_type, systolic, diastolic, heart_rate, glucose_mg_dl, reading_context')
          .eq('user_id', user.id).gte('recorded_at', from).lt('recorded_at', until).order('recorded_at').throwOnError(),
      ])

      const mealRows = meals.data ?? []
      const activityRows = activity.data ?? []
      const sections = {
        'Nutrition totals (sum of known values only)': Object.fromEntries(
          nutritionFields.map(field => [field, sumLogged(mealRows, field)]),
        ),
        'Meals': mealRows,
        'Body composition': body.data ?? [],
        'Activity summaries (may overlap across sources)': activityRows.filter(row => !row.activity_type),
        'Individual activities': activityRows.filter(row => row.activity_type),
        'Strength workouts': workouts.data ?? [],
        'Swimming': swim.data ?? [],
        'Sleep (as logged for the selected date)': sleep.data ?? [],
        'Vitals': vitals.data ?? [],
      }
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const lines = [
        `PK Health daily report for ${day}`,
        `Time zone: ${timeZone}`,
        'Timestamps include their UTC offset. Null values were not recorded.',
        ...Object.entries(sections).map(([label, data]) =>
          `\n${label}\n${Array.isArray(data) && !data.length ? 'No entries for this date.' : JSON.stringify(data, null, 2)}`,
        ),
      ]
      const filename = `pk-health-daily-${day}.txt`
      const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage(`Download started for ${filename}.`)
    } catch (error) {
      setFailed(true)
      setMessage(error instanceof Error ? error.message : 'Could not load the daily report. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Daily report</h2>
      <div className="space-y-1">
        <label htmlFor="daily-report-date" className="block text-sm text-neutral-700">Report date</label>
        <input id="daily-report-date" type="date" value={day} onChange={event => setDay(event.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900" />
      </div>
      <button type="button" onClick={downloadReport} disabled={busy || !day}
        className="w-full rounded-md bg-neutral-900 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
        {busy ? 'Building report…' : 'Download daily report'}
      </button>
      {message && <p role={failed ? 'alert' : 'status'} className={failed ? 'text-sm text-red-600' : 'text-sm text-neutral-700'}>{message}</p>}
    </section>
  )
}
