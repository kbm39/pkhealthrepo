'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'
import { resizeImageToBase64 } from '@/lib/image-utils'
import { todayDateKey } from '@/components/LocalDateTime'

export default function NewSwimPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [swimDate, setSwimDate] = useState(todayDateKey())
  const [yardage, setYardage] = useState('')
  const [distanceUnit, setDistanceUnit] = useState<'yards' | 'meters'>('yards')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [activeCalories, setActiveCalories] = useState('')
  const [totalCalories, setTotalCalories] = useState('')
  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [strokeType, setStrokeType] = useState('')
  const [laps, setLaps] = useState('')
  const [source, setSource] = useState<'manual' | 'apple_watch'>('manual')

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
            "Couldn't read a swim workout in that screenshot. Try a clearer shot, or enter values manually."
        )
        setScanning(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      if (data.yardage != null) setYardage(String(data.yardage))
      if (data.distance_unit) setDistanceUnit(data.distance_unit)
      if (data.duration_minutes != null) setDurationMinutes(String(data.duration_minutes))
      if (data.active_calories != null) setActiveCalories(String(data.active_calories))
      if (data.total_calories != null) setTotalCalories(String(data.total_calories))
      if (data.avg_heart_rate != null) setAvgHeartRate(String(data.avg_heart_rate))
      if (data.stroke_type) setStrokeType(data.stroke_type)
      if (data.laps != null) setLaps(String(data.laps))
      setSource('apple_watch')
    } catch {
      setScreenshotError("Couldn't read that screenshot. Try a clearer shot, or enter values manually.")
    }

    setScanning(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
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

    const { error } = await supabase.from('swim_logs').insert({
      user_id: user.id,
      swim_date: swimDate,
      source,
      yardage: yardage ? Number(yardage) : null,
      distance_unit: distanceUnit,
      duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      active_calories: activeCalories ? Number(activeCalories) : null,
      total_calories: totalCalories ? Number(totalCalories) : null,
      avg_heart_rate: avgHeartRate ? Number(avgHeartRate) : null,
      stroke_type: strokeType || null,
      laps: laps ? Number(laps) : null,
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/workouts/swim')
    router.refresh()
  }

  function markManual() {
    setSource('manual')
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
            {scanning ? 'Reading screenshot…' : '📷 Import from Apple Watch screenshot'}
          </button>
          <p className="text-xs text-neutral-600">
            Take a screenshot of your Apple Watch/Fitness swim summary, then select it here —
            fields below will auto-fill for you to review. You can select multiple at once.
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
              value={swimDate}
              onChange={(e) => setSwimDate(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Yardage</label>
              <input
                type="number"
                value={yardage}
                onChange={(e) => {
                  setYardage(e.target.value)
                  markManual()
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Unit</label>
              <select
                value={distanceUnit}
                onChange={(e) => {
                  setDistanceUnit(e.target.value as 'yards' | 'meters')
                  markManual()
                }}
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
                value={durationMinutes}
                onChange={(e) => {
                  setDurationMinutes(e.target.value)
                  markManual()
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Active calories
              </label>
              <input
                type="number"
                value={activeCalories}
                onChange={(e) => {
                  setActiveCalories(e.target.value)
                  markManual()
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Total calories
              </label>
              <input
                type="number"
                value={totalCalories}
                onChange={(e) => {
                  setTotalCalories(e.target.value)
                  markManual()
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Avg heart rate
              </label>
              <input
                type="number"
                value={avgHeartRate}
                onChange={(e) => {
                  setAvgHeartRate(e.target.value)
                  markManual()
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Laps</label>
              <input
                type="number"
                value={laps}
                onChange={(e) => {
                  setLaps(e.target.value)
                  markManual()
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Stroke type
              </label>
              <input
                type="text"
                value={strokeType}
                onChange={(e) => {
                  setStrokeType(e.target.value)
                  markManual()
                }}
                placeholder="e.g. Freestyle, Mixed"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
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
