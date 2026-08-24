'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'
import { resizeImageToBase64 } from '@/lib/image-utils'
import { todayDateKey } from '@/components/LocalDateTime'
import { resolveDateLabel, combineDateAndTime, parseTimeOfDayToMinutes } from '@/lib/screenshot-date'

/** Sorts a day's detected activities chronologically by clock time; undated ones sink to the end. */
function sortActivitiesByTime(activities: ActivityEntry[]): ActivityEntry[] {
  return [...activities].sort((a, b) => {
    const am = parseTimeOfDayToMinutes(a.timeOfDay)
    const bm = parseTimeOfDayToMinutes(b.timeOfDay)
    if (am == null && bm == null) return 0
    if (am == null) return 1
    if (bm == null) return -1
    return am - bm
  })
}

interface ActivityEntry {
  activityType: string
  timeOfDay: string // free text as shown, e.g. "8:17 AM" — used only to compute started_at
  durationMinutes: string
  calories: string
  avgHeartRate: string
}

interface DayGroup {
  key: string
  date: string // YYYY-MM-DD, may be '' if it couldn't be resolved and needs the user to pick one
  dateGuessLabel: string | null // what was detected on screen, shown as a hint (e.g. "Today", "Aug 5")
  steps: string
  goalProgressCalories: string
  goalCalories: string
  totalCalories: string
  activityTimeMinutes: string
  activities: ActivityEntry[]
}

function emptyActivity(): ActivityEntry {
  return { activityType: '', timeOfDay: '', durationMinutes: '', calories: '', avgHeartRate: '' }
}

function emptyDayGroup(date: string): DayGroup {
  return {
    key: Math.random().toString(36).slice(2),
    date,
    dateGuessLabel: null,
    steps: '',
    goalProgressCalories: '',
    goalCalories: '',
    totalCalories: '',
    activityTimeMinutes: '',
    activities: [],
  }
}

export default function NewActivityPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dayGroups, setDayGroups] = useState<DayGroup[]>([emptyDayGroup(todayDateKey())])
  const [source, setSource] = useState<'manual' | 'oura'>('manual')

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
            "Couldn't read activity results in those screenshots. Try clearer shots, or enter values manually."
        )
        setScanning(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      type ParsedResult = {
        date_label: string | null
        steps: number | null
        total_calories: number | null
        goal_progress_calories: number | null
        goal_target_calories: number | null
        activity_time_minutes: number | null
        activities: {
          activity_type?: string
          time_of_day?: string | null
          duration_minutes?: number | null
          calories?: number | null
          avg_heart_rate?: number | null
        }[]
      }

      const results: ParsedResult[] = data.results ?? []

      setDayGroups((prev) => {
        // Drop the single blank starter group if we're about to populate from screenshots.
        const base = prev.filter(
          (g) =>
            g.steps || g.goalProgressCalories || g.goalCalories || g.totalCalories ||
            g.activityTimeMinutes || g.activities.length > 0
        )
        const next = [...base]

        for (const r of results) {
          const resolvedDate = resolveDateLabel(r.date_label)
          const parsedActivities: ActivityEntry[] = r.activities.map((a) => ({
            activityType: a.activity_type ?? '',
            timeOfDay: a.time_of_day ?? '',
            durationMinutes: a.duration_minutes != null ? String(a.duration_minutes) : '',
            calories: a.calories != null ? String(a.calories) : '',
            avgHeartRate: a.avg_heart_rate != null ? String(a.avg_heart_rate) : '',
          }))

          // Merge into an existing group only if we have a confidently resolved,
          // matching date — otherwise each image gets its own group.
          const existing = resolvedDate ? next.find((g) => g.date === resolvedDate) : undefined

          if (existing) {
            if (r.steps != null && !existing.steps) existing.steps = String(r.steps)
            if (r.goal_progress_calories != null && !existing.goalProgressCalories)
              existing.goalProgressCalories = String(r.goal_progress_calories)
            if (r.goal_target_calories != null && !existing.goalCalories)
              existing.goalCalories = String(r.goal_target_calories)
            if (r.total_calories != null && !existing.totalCalories)
              existing.totalCalories = String(r.total_calories)
            if (r.activity_time_minutes != null && !existing.activityTimeMinutes)
              existing.activityTimeMinutes = String(r.activity_time_minutes)
            existing.activities = sortActivitiesByTime([...existing.activities, ...parsedActivities])
          } else {
            next.push({
              key: Math.random().toString(36).slice(2),
              date: resolvedDate,
              dateGuessLabel: r.date_label,
              steps: r.steps != null ? String(r.steps) : '',
              goalProgressCalories: r.goal_progress_calories != null ? String(r.goal_progress_calories) : '',
              goalCalories: r.goal_target_calories != null ? String(r.goal_target_calories) : '',
              totalCalories: r.total_calories != null ? String(r.total_calories) : '',
              activityTimeMinutes: r.activity_time_minutes != null ? String(r.activity_time_minutes) : '',
              activities: sortActivitiesByTime(parsedActivities),
            })
          }
        }

        // Keep day groups themselves in date order (newest last isn't required here —
        // just make sure they're not left in arbitrary screenshot-selection order).
        next.sort((a, b) => (a.date && b.date ? (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) : 0))

        return next.length > 0 ? next : [emptyDayGroup(todayDateKey())]
      })

      setSource('oura')
    } catch {
      setScreenshotError("Couldn't read those screenshots. Try clearer shots, or enter values manually.")
    }

    setScanning(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function updateGroup(key: string, field: keyof DayGroup, value: string) {
    setDayGroups((prev) => prev.map((g) => (g.key === key ? { ...g, [field]: value } : g)))
  }

  function removeGroup(key: string) {
    setDayGroups((prev) => prev.filter((g) => g.key !== key))
  }

  function addGroup() {
    setDayGroups((prev) => [...prev, emptyDayGroup(todayDateKey())])
  }

  function updateActivity(groupKey: string, index: number, field: keyof ActivityEntry, value: string) {
    setDayGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey
          ? { ...g, activities: g.activities.map((a, i) => (i === index ? { ...a, [field]: value } : a)) }
          : g
      )
    )
  }

  function removeActivity(groupKey: string, index: number) {
    setDayGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey ? { ...g, activities: g.activities.filter((_, i) => i !== index) } : g
      )
    )
  }

  function addActivity(groupKey: string) {
    setDayGroups((prev) =>
      prev.map((g) => (g.key === groupKey ? { ...g, activities: [...g.activities, emptyActivity()] } : g))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (dayGroups.some((g) => !g.date)) {
      setError("One or more days couldn't be dated automatically — pick a date for each before saving.")
      return
    }

    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You need to be signed in to continue.')
      setSaving(false)
      return
    }

    const dates = Array.from(new Set(dayGroups.map((g) => g.date))).filter(Boolean)
    const { data: existing } = await supabase
      .from('activity_logs')
      .select('activity_date, activity_type, started_at')
      .eq('user_id', user.id)
      .in('activity_date', dates)

    // Match on date + clock time (ignoring exact calorie/type text, which can shift
    // between scans of the same real activity) so re-importing an overlapping range
    // doesn't silently create duplicate rows.
    const existingActivityKeys = new Set(
      (existing ?? [])
        .filter((e) => e.started_at)
        .map((e) => `${e.activity_date}::${new Date(e.started_at as string).toISOString()}`)
    )
    const existingSummaryDates = new Set(
      (existing ?? []).filter((e) => e.activity_type == null && !e.started_at).map((e) => e.activity_date)
    )

    const rows: Record<string, unknown>[] = []
    let skippedCount = 0

    for (const g of dayGroups) {
      const hasSummaryData =
        g.steps || g.goalProgressCalories || g.goalCalories || g.totalCalories || g.activityTimeMinutes

      if (hasSummaryData) {
        if (existingSummaryDates.has(g.date)) {
          skippedCount++
        } else {
          rows.push({
            user_id: user.id,
            activity_date: g.date,
            source,
            steps: g.steps ? Number(g.steps) : null,
            active_calories: g.goalProgressCalories ? Number(g.goalProgressCalories) : null,
            total_calories: g.totalCalories ? Number(g.totalCalories) : null,
            goal_calories: g.goalCalories ? Number(g.goalCalories) : null,
            activity_time_minutes: g.activityTimeMinutes ? Number(g.activityTimeMinutes) : null,
          })
        }
      }

      for (const a of g.activities) {
        if (!a.activityType) continue
        const startedAt = a.timeOfDay ? combineDateAndTime(g.date, a.timeOfDay) : null
        const key = startedAt ? `${g.date}::${new Date(startedAt).toISOString()}` : null
        if (key && existingActivityKeys.has(key)) {
          skippedCount++
          continue
        }
        rows.push({
          user_id: user.id,
          activity_date: g.date,
          source,
          activity_type: a.activityType,
          duration_minutes: a.durationMinutes ? Number(a.durationMinutes) : null,
          active_calories: a.calories ? Number(a.calories) : null,
          avg_heart_rate: a.avgHeartRate ? Number(a.avgHeartRate) : null,
          started_at: startedAt,
        })
      }
    }

    if (rows.length === 0 && skippedCount > 0) {
      setError(
        `All ${skippedCount} ${skippedCount === 1 ? 'entry matches' : 'entries match'} something already in your history for ${skippedCount === 1 ? 'that day/time' : 'those days/times'} — nothing new to save.`
      )
      setSaving(false)
      return
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

    if (skippedCount > 0) {
      window.alert(
        `Saved. Skipped ${skippedCount} ${skippedCount === 1 ? 'entry' : 'entries'} that matched something already in your history at the same date/time.`
      )
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
            {scanning ? 'Reading screenshots…' : '📷 Import from Oura screenshots'}
          </button>
          <p className="text-xs text-neutral-600">
            Select multiple screenshots at once — even from different days. Each one is read on
            its own and its date is detected automatically (Today/Yesterday/a specific date), so
            screenshots from the same day get merged and different days become separate entries
            below. Double-check the detected dates before saving.
          </p>
          {screenshotError && (
            <p className="text-xs text-red-600" role="alert">
              {screenshotError}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {dayGroups.map((g) => (
            <div key={g.key} className="rounded-lg border border-neutral-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Date
                    {g.dateGuessLabel && (
                      <span className="text-xs text-neutral-500 font-normal">
                        {' '}
                        — detected &quot;{g.dateGuessLabel}&quot;
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={g.date}
                    onChange={(e) => updateGroup(g.key, 'date', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 text-sm ${
                      g.date ? 'border-neutral-300' : 'border-red-400'
                    }`}
                  />
                  {!g.date && (
                    <p className="text-xs text-red-600 mt-1">Pick a date for this entry.</p>
                  )}
                </div>
                {dayGroups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGroup(g.key)}
                    className="text-xs text-red-600 underline underline-offset-2 ml-3 shrink-0"
                  >
                    Remove day
                  </button>
                )}
              </div>

              <div className="pt-2 border-t border-neutral-100 space-y-3">
                <p className="text-xs font-medium text-neutral-700">Daily summary</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Steps</label>
                    <input
                      type="number"
                      value={g.steps}
                      onChange={(e) => {
                        updateGroup(g.key, 'steps', e.target.value)
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
                      value={g.goalProgressCalories}
                      onChange={(e) => {
                        updateGroup(g.key, 'goalProgressCalories', e.target.value)
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
                      value={g.goalCalories}
                      onChange={(e) => {
                        updateGroup(g.key, 'goalCalories', e.target.value)
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
                      value={g.totalCalories}
                      onChange={(e) => {
                        updateGroup(g.key, 'totalCalories', e.target.value)
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
                      value={g.activityTimeMinutes}
                      onChange={(e) => {
                        updateGroup(g.key, 'activityTimeMinutes', e.target.value)
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
                    Activities ({g.activities.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      addActivity(g.key)
                      setSource('manual')
                    }}
                    className="text-xs text-neutral-700 underline underline-offset-2"
                  >
                    + Add activity
                  </button>
                </div>

                {g.activities.map((a, i) => (
                  <div key={i} className="rounded-md border border-neutral-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        placeholder="Activity type (e.g. Swimming)"
                        value={a.activityType}
                        onChange={(e) => updateActivity(g.key, i, 'activityType', e.target.value)}
                        className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm mr-2"
                      />
                      <button
                        type="button"
                        onClick={() => removeActivity(g.key, i)}
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
                        onChange={(e) => updateActivity(g.key, i, 'timeOfDay', e.target.value)}
                        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Duration (min)"
                        value={a.durationMinutes}
                        onChange={(e) => updateActivity(g.key, i, 'durationMinutes', e.target.value)}
                        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Calories"
                        value={a.calories}
                        onChange={(e) => updateActivity(g.key, i, 'calories', e.target.value)}
                        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Avg heart rate"
                        value={a.avgHeartRate}
                        onChange={(e) => updateActivity(g.key, i, 'avgHeartRate', e.target.value)}
                        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addGroup}
            className="w-full rounded-md border border-neutral-300 text-neutral-700 text-sm font-medium py-2 hover:bg-neutral-50"
          >
            + Add another day
          </button>

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
            {saving ? 'Saving…' : `Save ${dayGroups.length > 1 ? `${dayGroups.length} days` : 'entry'}`}
          </button>
        </form>
      </div>
    </main>
  )
}
