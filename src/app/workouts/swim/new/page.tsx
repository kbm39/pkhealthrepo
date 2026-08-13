'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'
import { resizeImageToBase64 } from '@/lib/image-utils'
import { todayDateKey } from '@/components/LocalDateTime'
import { resolveDateLabel } from '@/lib/screenshot-date'

interface SwimGroup {
  key: string
  date: string
  dateGuessLabel: string | null
  yardage: string
  distanceUnit: 'yards' | 'meters'
  durationMinutes: string
  activeCalories: string
  totalCalories: string
  avgHeartRate: string
  strokeType: string
  laps: string
  source: 'manual' | 'apple_watch'
}

function emptySwimGroup(date: string): SwimGroup {
  return {
    key: Math.random().toString(36).slice(2),
    date,
    dateGuessLabel: null,
    yardage: '',
    distanceUnit: 'yards',
    durationMinutes: '',
    activeCalories: '',
    totalCalories: '',
    avgHeartRate: '',
    strokeType: '',
    laps: '',
    source: 'manual',
  }
}

function isBlank(g: SwimGroup): boolean {
  return (
    !g.yardage &&
    !g.durationMinutes &&
    !g.activeCalories &&
    !g.totalCalories &&
    !g.avgHeartRate &&
    !g.strokeType &&
    !g.laps
  )
}

export default function NewSwimPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [swimGroups, setSwimGroups] = useState<SwimGroup[]>([emptySwimGroup(todayDateKey())])

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
      const res = await fetch('/api/parse-swim-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      })
      const data = await res.json()

      if (!res.ok || !data.found) {
        setScreenshotError(
          data.error ||
            "Couldn't read a swim workout in those screenshots. Try clearer shots, or enter values manually."
        )
        setScanning(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      type ParsedResult = {
        date_label: string | null
        yardage: number | null
        distance_unit: 'yards' | 'meters' | null
        duration_minutes: number | null
        active_calories: number | null
        total_calories: number | null
        avg_heart_rate: number | null
        stroke_type: string | null
        laps: number | null
      }
      const results: ParsedResult[] = data.results ?? []

      setSwimGroups((prev) => {
        const base = prev.filter((g) => !isBlank(g))
        const next = [...base]

        for (const r of results) {
          const resolvedDate = resolveDateLabel(r.date_label)
          const existing = resolvedDate ? next.find((g) => g.date === resolvedDate) : undefined

          if (existing) {
            if (r.yardage != null && !existing.yardage) existing.yardage = String(r.yardage)
            if (r.distance_unit) existing.distanceUnit = r.distance_unit
            if (r.duration_minutes != null && !existing.durationMinutes)
              existing.durationMinutes = String(r.duration_minutes)
            if (r.active_calories != null && !existing.activeCalories)
              existing.activeCalories = String(r.active_calories)
            if (r.total_calories != null && !existing.totalCalories)
              existing.totalCalories = String(r.total_calories)
            if (r.avg_heart_rate != null && !existing.avgHeartRate)
              existing.avgHeartRate = String(r.avg_heart_rate)
            if (r.stroke_type && !existing.strokeType) existing.strokeType = r.stroke_type
            if (r.laps != null && !existing.laps) existing.laps = String(r.laps)
            existing.source = 'apple_watch'
          } else {
            next.push({
              key: Math.random().toString(36).slice(2),
              date: resolvedDate,
              dateGuessLabel: r.date_label,
              yardage: r.yardage != null ? String(r.yardage) : '',
              distanceUnit: r.distance_unit ?? 'yards',
              durationMinutes: r.duration_minutes != null ? String(r.duration_minutes) : '',
              activeCalories: r.active_calories != null ? String(r.active_calories) : '',
              totalCalories: r.total_calories != null ? String(r.total_calories) : '',
              avgHeartRate: r.avg_heart_rate != null ? String(r.avg_heart_rate) : '',
              strokeType: r.stroke_type ?? '',
              laps: r.laps != null ? String(r.laps) : '',
              source: 'apple_watch',
            })
          }
        }

        return next.length > 0 ? next : [emptySwimGroup(todayDateKey())]
      })
    } catch {
      setScreenshotError("Couldn't read those screenshots. Try clearer shots, or enter values manually.")
    }

    setScanning(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function updateGroup(key: string, field: keyof SwimGroup, value: string) {
    setSwimGroups((prev) =>
      prev.map((g) => (g.key === key ? { ...g, [field]: value, source: 'manual' } : g))
    )
  }

  function removeGroup(key: string) {
    setSwimGroups((prev) => prev.filter((g) => g.key !== key))
  }

  function addGroup() {
    setSwimGroups((prev) => [...prev, emptySwimGroup(todayDateKey())])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (swimGroups.some((g) => !g.date)) {
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

    const rows = swimGroups
      .filter((g) => !isBlank(g))
      .map((g) => ({
        user_id: user.id,
        swim_date: g.date,
        source: g.source,
        yardage: g.yardage ? Number(g.yardage) : null,
        distance_unit: g.distanceUnit,
        duration_minutes: g.durationMinutes ? Number(g.durationMinutes) : null,
        active_calories: g.activeCalories ? Number(g.activeCalories) : null,
        total_calories: g.totalCalories ? Number(g.totalCalories) : null,
        avg_heart_rate: g.avgHeartRate ? Number(g.avgHeartRate) : null,
        stroke_type: g.strokeType || null,
        laps: g.laps ? Number(g.laps) : null,
      }))

    if (rows.length === 0) {
      setError('Add at least a yardage or duration before saving.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('swim_logs').insert(rows)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/workouts/swim')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Add swim</h1>

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
            {scanning ? 'Reading screenshots…' : '📷 Import from Apple Watch screenshots'}
          </button>
          <p className="text-xs text-neutral-600">
            Select multiple screenshots at once — even from different swims on different days.
            Screenshots detected as the same day are merged into one entry; different days become
            separate entries below. Double-check the detected dates before saving.
          </p>
          {screenshotError && (
            <p className="text-xs text-red-600" role="alert">
              {screenshotError}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {swimGroups.map((g) => (
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
                {swimGroups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGroup(g.key)}
                    className="text-xs text-red-600 underline underline-offset-2 ml-3 shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Yardage</label>
                  <input
                    type="number"
                    value={g.yardage}
                    onChange={(e) => updateGroup(g.key, 'yardage', e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Unit</label>
                  <select
                    value={g.distanceUnit}
                    onChange={(e) => updateGroup(g.key, 'distanceUnit', e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="yards">Yards</option>
                    <option value="meters">Meters</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={g.durationMinutes}
                    onChange={(e) => updateGroup(g.key, 'durationMinutes', e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Active calories
                  </label>
                  <input
                    type="number"
                    value={g.activeCalories}
                    onChange={(e) => updateGroup(g.key, 'activeCalories', e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Total calories
                  </label>
                  <input
                    type="number"
                    value={g.totalCalories}
                    onChange={(e) => updateGroup(g.key, 'totalCalories', e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Avg heart rate
                  </label>
                  <input
                    type="number"
                    value={g.avgHeartRate}
                    onChange={(e) => updateGroup(g.key, 'avgHeartRate', e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Laps</label>
                  <input
                    type="number"
                    value={g.laps}
                    onChange={(e) => updateGroup(g.key, 'laps', e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Stroke type
                  </label>
                  <input
                    type="text"
                    value={g.strokeType}
                    onChange={(e) => updateGroup(g.key, 'strokeType', e.target.value)}
                    placeholder="e.g. Freestyle, Mixed"
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addGroup}
            className="w-full rounded-md border border-neutral-300 text-neutral-700 text-sm font-medium py-2 hover:bg-neutral-50"
          >
            + Add another swim
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
            {saving ? 'Saving…' : `Save ${swimGroups.length > 1 ? `${swimGroups.length} entries` : 'entry'}`}
          </button>
        </form>
      </div>
    </main>
  )
}
