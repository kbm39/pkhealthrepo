'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'
import { resizeImageToBase64 } from '@/lib/image-utils'
import { todayDateKey } from '@/components/LocalDateTime'

interface ActivityEntry {
  activityType: string
  timeOfDay: string // free text as shown, e.g. "8:17 AM" — used only to compute started_at
  durationMinutes: string
  calories: string
  avgHeartRate: string
}

function emptyActivity(): ActivityEntry {
  return { activityType: '', timeOfDay: '', durationMinutes: '', calories: '', avgHeartRate: '' }
}

/** Combines a YYYY-MM-DD date with a "8:17 AM" style time into an ISO string, or null if unparseable. */
function combineDateAndTime(dateKey: string, timeOfDay: string): string | null {
  const match = timeOfDay.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridiem = match[3].toUpperCase()
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  const [year, month, day] = dateKey.split('-').map(Number)
  const d = new Date(year, month - 1, day, hours, minutes)
  return d.toISOString()
}

export default function NewActivityPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activityDate, setActivityDate] = useState(todayDateKey())
  const [steps, setSteps] = useState('')
  const [goalProgressCalories, setGoalProgressCalories] = useState('')
  const [goalCalories, setGoalCalories] = useState('')
  const [totalCalories, setTotalCalories] = useState('')
  const [activityTimeMinutes, setActivityTimeMinutes] = useState('')
  const [source, setSource] = useState<'manual' | 'oura'>('manual')

  const [activities, setActivities] = useState<ActivityEntry[]>([])

  const [scanning, setScanning] = useState(false)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleScreenshotsSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setScreenshotError(null)
    setScanning(true)

    try {
      const images = await Promise.all(
        Array.from(files).map((f) => resizeImageToBase64(f, 1500))
      )
      const res = await fetch('/api/parse-oura-activity-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      })
      const data = await res.json()

      if (!res.ok || !data.found) {
        setScreenshotError(
          data.error ||
            "Couldn't read activity results in that screenshot. Try a clearer shot, or enter values manually."
        )
        setScanning(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      if (data.steps != null) setSteps(String(data.steps))
      if (data.goal_progress_calories != null) setGoalProgressCalories(String(data.goal_progress_calories))
      if (data.goal_target_calories != null) setGoalCalories(String(data.goal_target_calories))
      if (data.total_calories != null) setTotalCalories(String(data.total_calories))
      if (data.activity_time_minutes != null) setActivityTimeMinutes(String(data.activity_time_minutes))

      if (Array.isArray(data.activities) && data.activities.length > 0) {
        setActivities((prev) => [
          ...prev,
          ...data.activities.map(
            (a: {
              activity_type?: string
              time_of_day?: string | null
              duration_minutes?: number | null
              calories?: number | null
              avg_heart_rate?: number | null
            }) => ({
              activityType: a.activity_type ?? '',
              timeOfDay: a.time_of_day ?? '',
              durationMinutes: a.duration_minutes != null ? String(a.duration_minutes) : '',
              calories: a.calories != null ? String(a.calories) : '',
              avgHeartRate: a.avg_heart_rate != null ? String(a.avg_heart_rate) : '',
            })
          ),
        ])
      }

      setSource('oura')
    } catch {
      setScreenshotError("Couldn't read that screenshot. Try a clearer shot, or enter values manually.")
    }

    setScanning(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function updateActivity(index: number, field: keyof ActivityEntry, value: string) {
    setActivities((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)))
  }

  function removeActivity(index: number) {
    setActivities((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You need to be signed in to continue.')
      setSaving(false)
      return
    }

    const hasSummaryData =
      steps || goalProgressCalories || goalCalories || totalCalories || activityTimeMinutes

    const rows: Record<string, unknown>[] = []

    if (hasSummaryData) {
      rows.push({
        user_id: user.id,
        activity_date: activityDate,
        source,
        steps: steps ? Number(steps) : null,
        active_calories: goalProgressCalories ? Number(goalProgressCalories) : null,
        total_calories: totalCalories ? Number(totalCalories) : null,
        goal_calories: goalCalories ? Number(goalCalories) : null,
        activity_time_minutes: activityTimeMinutes ? Number(activityTimeMinutes) : null,
      })
    }

    for (const a of activities) {
      if (!a.activityType) continue
      rows.push({
        user_id: user.id,
        activity_date: activityDate,
        source,
        activity_type: a.activityType,
        duration_minutes: a.durationMinutes ? Number(a.durationMinutes) : null,
        active_calories: a.calories ? Number(a.calories) : null,
        avg_heart_rate: a.avgHeartRate ? Number(a.avgHeartRate) : null,
        started_at: a.timeOfDay ? combineDateAndTime(activityDate, a.timeOfDay) : null,
      })
    }

    if (rows.length === 0) {
      setError('Add at least steps/calories or one activity before saving.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('activity_logs').insert(rows)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/workouts/activity')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Add activity</h1>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleScreenshotsSelected}
          className="hidden"
        />

        <div className="rounded-md border border-dashed border-neutral-300 p-3 space-y-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="w-full rounded-md bg-neutral-100 text-neutral-700 text-sm font-medium py-2 hover:bg-neutral-200 disabled:opacity-50"
          >
            {scanning ? 'Reading screenshot…' : '📷 Import from Oura screenshot'}
          </button>
          <p className="text-xs text-neutral-600">
            Import the full Activity page — goal progress, total burn, activity time, steps, and
            every listed activity all get captured. Select multiple screenshots at once if needed.
          </p>
          {screenshotError && (
            <p className="text-xs text-red-600" role="alert">
              {screenshotError}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
            <input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="pt-2 border-t border-neutral-100 space-y-3">
            <p className="text-xs font-medium text-neutral-700">Daily summary</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Steps</label>
                <input
                  type="number"
                  value={steps}
                  onChange={(e) => {
                    setSteps(e.target.value)
                    setSource('manual')
                  }}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Goal progress (cal)
                </label>
                <input
                  type="number"
                  value={goalProgressCalories}
                  onChange={(e) => {
                    setGoalProgressCalories(e.target.value)
                    setSource('manual')
                  }}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Goal target (cal)
                </label>
                <input
                  type="number"
                  value={goalCalories}
                  onChange={(e) => {
                    setGoalCalories(e.target.value)
                    setSource('manual')
                  }}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Total burn (cal)
                </label>
                <input
                  type="number"
                  value={totalCalories}
                  onChange={(e) => {
                    setTotalCalories(e.target.value)
                    setSource('manual')
                  }}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Activity time (minutes)
                </label>
                <input
                  type="number"
                  value={activityTimeMinutes}
                  onChange={(e) => {
                    setActivityTimeMinutes(e.target.value)
                    setSource('manual')
                  }}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-100 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-neutral-700">
                Activities ({activities.length})
              </p>
              <button
                type="button"
                onClick={() => {
                  setActivities((prev) => [...prev, emptyActivity()])
                  setSource('manual')
                }}
                className="text-xs text-neutral-700 underline underline-offset-2"
              >
                + Add activity
              </button>
            </div>

            {activities.map((a, i) => (
              <div key={i} className="rounded-md border border-neutral-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    placeholder="Activity type (e.g. Swimming)"
                    value={a.activityType}
                    onChange={(e) => updateActivity(i, 'activityType', e.target.value)}
                    className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm mr-2"
                  />
                  <button
                    type="button"
                    onClick={() => removeActivity(i)}
                    className="text-xs text-red-600 underline underline-offset-2 shrink-0"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Time (e.g. 8:17 AM)"
                    value={a.timeOfDay}
                    onChange={(e) => updateActivity(i, 'timeOfDay', e.target.value)}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Duration (min)"
                    value={a.durationMinutes}
                    onChange={(e) => updateActivity(i, 'durationMinutes', e.target.value)}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Calories"
                    value={a.calories}
                    onChange={(e) => updateActivity(i, 'calories', e.target.value)}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Avg heart rate"
                    value={a.avgHeartRate}
                    onChange={(e) => updateActivity(i, 'avgHeartRate', e.target.value)}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </form>
      </div>
    </main>
  )
}
