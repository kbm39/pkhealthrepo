'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'
import { resizeImageToBase64 } from '@/lib/image-utils'
import { todayDateKey } from '@/components/LocalDateTime'

export default function NewActivityPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activityDate, setActivityDate] = useState(todayDateKey())
  const [steps, setSteps] = useState('')
  const [activeCalories, setActiveCalories] = useState('')
  const [totalCalories, setTotalCalories] = useState('')
  const [activityType, setActivityType] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [avgHeartRate, setAvgHeartRate] = useState('')
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
            "Couldn't read activity results in that screenshot. Try a clearer shot, or enter values manually."
        )
        setScanning(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      if (data.steps != null) setSteps(String(data.steps))
      if (data.active_calories != null) setActiveCalories(String(data.active_calories))
      if (data.total_calories != null) setTotalCalories(String(data.total_calories))
      if (data.activity_type) setActivityType(data.activity_type)
      if (data.duration_minutes != null) setDurationMinutes(String(data.duration_minutes))
      if (data.avg_heart_rate != null) setAvgHeartRate(String(data.avg_heart_rate))
      setSource('oura')
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

    const { error } = await supabase.from('activity_logs').insert({
      user_id: user.id,
      activity_date: activityDate,
      source,
      steps: steps ? Number(steps) : null,
      active_calories: activeCalories ? Number(activeCalories) : null,
      total_calories: totalCalories ? Number(totalCalories) : null,
      activity_type: activityType || null,
      duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      avg_heart_rate: avgHeartRate ? Number(avgHeartRate) : null,
    })

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
            Take a screenshot of your Oura steps/calories or a detected workout, then select it
            here — fields below will auto-fill for you to review. You can select multiple at once.
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
                Active calories
              </label>
              <input
                type="number"
                value={activeCalories}
                onChange={(e) => {
                  setActiveCalories(e.target.value)
                  setSource('manual')
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
                  setSource('manual')
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
                  setSource('manual')
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-100 space-y-3">
            <p className="text-xs font-medium text-neutral-700">
              Detected workout (optional — leave blank for a daily summary)
            </p>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Activity type
              </label>
              <input
                type="text"
                value={activityType}
                onChange={(e) => {
                  setActivityType(e.target.value)
                  setSource('manual')
                }}
                placeholder="e.g. Walking, Running"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
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
                  setSource('manual')
                }}
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
