'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'
import { resizeImageToBase64 } from '@/lib/image-utils'
import { todayDateKey } from '@/components/LocalDateTime'
import { resolveDateLabel } from '@/lib/screenshot-date'

interface SleepGroup {
  key: string
  date: string
  dateGuessLabel: string | null
  totalSleep: string
  lightSleep: string
  deepSleep: string
  remSleep: string
  awake: string
  sleepScore: string
  avgHeartRate: string
  avgRespiratoryRate: string
  respRateMin: string
  respRateMax: string
  hrvFirst90: string
  hrvLast90: string
  sleepLatency: string
  timeToGetUp: string
  interruptions: string
  regularityRating: string
  depthRating: string
  breathingQuality: string
  snoringMinutes: string
  source: 'manual' | 'oura' | 'withings' | 'oura+withings'
}

function emptySleepGroup(date: string): SleepGroup {
  return {
    key: Math.random().toString(36).slice(2),
    date,
    dateGuessLabel: null,
    totalSleep: '',
    lightSleep: '',
    deepSleep: '',
    remSleep: '',
    awake: '',
    sleepScore: '',
    avgHeartRate: '',
    avgRespiratoryRate: '',
    respRateMin: '',
    respRateMax: '',
    hrvFirst90: '',
    hrvLast90: '',
    sleepLatency: '',
    timeToGetUp: '',
    interruptions: '',
    regularityRating: '',
    depthRating: '',
    breathingQuality: '',
    snoringMinutes: '',
    source: 'manual',
  }
}

function isBlank(g: SleepGroup): boolean {
  return (
    !g.totalSleep &&
    !g.lightSleep &&
    !g.deepSleep &&
    !g.remSleep &&
    !g.awake &&
    !g.sleepScore &&
    !g.avgHeartRate &&
    !g.avgRespiratoryRate &&
    !g.hrvFirst90 &&
    !g.hrvLast90 &&
    !g.sleepLatency &&
    !g.timeToGetUp &&
    !g.interruptions &&
    !g.regularityRating &&
    !g.depthRating &&
    !g.breathingQuality &&
    !g.snoringMinutes
  )
}

type ParsedResult = {
  date_label: string | null
  total_sleep_minutes: number | null
  light_sleep_minutes: number | null
  deep_sleep_minutes: number | null
  rem_sleep_minutes: number | null
  awake_minutes: number | null
  sleep_score: number | null
  avg_heart_rate: number | null
  avg_respiratory_rate: number | null
  respiratory_rate_min: number | null
  respiratory_rate_max: number | null
  snoring_minutes?: number | null
  hrv_first_90_ms: number | null
  hrv_last_90_ms: number | null
  sleep_latency_minutes: number | null
  time_to_get_up_minutes: number | null
  interruptions_count: number | null
  regularity_rating: string | null
  depth_rating: string | null
  breathing_quality_assessment?: string | null
}

export default function NewSleepPage() {
  const router = useRouter()
  const supabase = createClient()
  const ouraInputRef = useRef<HTMLInputElement>(null)
  const withingsInputRef = useRef<HTMLInputElement>(null)

  const [sleepGroups, setSleepGroups] = useState<SleepGroup[]>([emptySleepGroup(todayDateKey())])

  const [scanning, setScanning] = useState<'oura' | 'withings' | null>(null)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleScreenshotsSelected(
    e: React.ChangeEvent<HTMLInputElement>,
    device: 'oura' | 'withings'
  ) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setScreenshotError(null)
    setScanning(device)

    try {
      const images = await Promise.all(
        Array.from(files).map((f) => resizeImageToBase64(f, 1500))
      )
      const endpoint =
        device === 'oura' ? '/api/parse-oura-screenshot' : '/api/parse-withings-screenshot'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      })
      const data = await res.json()

      if (!res.ok || !data.found) {
        setScreenshotError(
          data.error ||
            `Couldn't read sleep results in ${files.length > 1 ? 'those screenshots' : 'that screenshot'}. Try clearer shots, or enter values manually.`
        )
        setScanning(null)
        if (device === 'oura' && ouraInputRef.current) ouraInputRef.current.value = ''
        if (device === 'withings' && withingsInputRef.current) withingsInputRef.current.value = ''
        return
      }

      const results: ParsedResult[] = data.results ?? []

      setSleepGroups((prev) => {
        const base = prev.filter((g) => !isBlank(g))
        const next = [...base]

        for (const r of results) {
          const resolvedDate = resolveDateLabel(r.date_label)
          const existing = resolvedDate ? next.find((g) => g.date === resolvedDate) : undefined

          const fillIfBlank = (curr: string, val: number | string | null | undefined) =>
            !curr && val != null ? String(val) : curr

          if (existing) {
            existing.totalSleep = fillIfBlank(existing.totalSleep, r.total_sleep_minutes)
            existing.lightSleep = fillIfBlank(existing.lightSleep, r.light_sleep_minutes)
            existing.deepSleep = fillIfBlank(existing.deepSleep, r.deep_sleep_minutes)
            existing.remSleep = fillIfBlank(existing.remSleep, r.rem_sleep_minutes)
            existing.awake = fillIfBlank(existing.awake, r.awake_minutes)
            existing.sleepScore = fillIfBlank(existing.sleepScore, r.sleep_score)
            existing.avgHeartRate = fillIfBlank(existing.avgHeartRate, r.avg_heart_rate)
            existing.avgRespiratoryRate = fillIfBlank(existing.avgRespiratoryRate, r.avg_respiratory_rate)
            existing.respRateMin = fillIfBlank(existing.respRateMin, r.respiratory_rate_min)
            existing.respRateMax = fillIfBlank(existing.respRateMax, r.respiratory_rate_max)
            existing.hrvFirst90 = fillIfBlank(existing.hrvFirst90, r.hrv_first_90_ms)
            existing.hrvLast90 = fillIfBlank(existing.hrvLast90, r.hrv_last_90_ms)
            existing.sleepLatency = fillIfBlank(existing.sleepLatency, r.sleep_latency_minutes)
            existing.timeToGetUp = fillIfBlank(existing.timeToGetUp, r.time_to_get_up_minutes)
            existing.interruptions = fillIfBlank(existing.interruptions, r.interruptions_count)
            existing.regularityRating = fillIfBlank(existing.regularityRating, r.regularity_rating)
            existing.depthRating = fillIfBlank(existing.depthRating, r.depth_rating)
            existing.breathingQuality = fillIfBlank(existing.breathingQuality, r.breathing_quality_assessment)
            existing.snoringMinutes = fillIfBlank(existing.snoringMinutes, r.snoring_minutes)
            existing.source = existing.source === 'manual' || existing.source === device
              ? device
              : 'oura+withings'
            continue
          }

          next.push({
            key: Math.random().toString(36).slice(2),
            date: resolvedDate,
            dateGuessLabel: r.date_label,
            totalSleep: r.total_sleep_minutes != null ? String(r.total_sleep_minutes) : '',
            lightSleep: r.light_sleep_minutes != null ? String(r.light_sleep_minutes) : '',
            deepSleep: r.deep_sleep_minutes != null ? String(r.deep_sleep_minutes) : '',
            remSleep: r.rem_sleep_minutes != null ? String(r.rem_sleep_minutes) : '',
            awake: r.awake_minutes != null ? String(r.awake_minutes) : '',
            sleepScore: r.sleep_score != null ? String(r.sleep_score) : '',
            avgHeartRate: r.avg_heart_rate != null ? String(r.avg_heart_rate) : '',
            avgRespiratoryRate: r.avg_respiratory_rate != null ? String(r.avg_respiratory_rate) : '',
            respRateMin: r.respiratory_rate_min != null ? String(r.respiratory_rate_min) : '',
            respRateMax: r.respiratory_rate_max != null ? String(r.respiratory_rate_max) : '',
            hrvFirst90: r.hrv_first_90_ms != null ? String(r.hrv_first_90_ms) : '',
            hrvLast90: r.hrv_last_90_ms != null ? String(r.hrv_last_90_ms) : '',
            sleepLatency: r.sleep_latency_minutes != null ? String(r.sleep_latency_minutes) : '',
            timeToGetUp: r.time_to_get_up_minutes != null ? String(r.time_to_get_up_minutes) : '',
            interruptions: r.interruptions_count != null ? String(r.interruptions_count) : '',
            regularityRating: r.regularity_rating ?? '',
            depthRating: r.depth_rating ?? '',
            breathingQuality: r.breathing_quality_assessment ?? '',
            snoringMinutes: r.snoring_minutes != null ? String(r.snoring_minutes) : '',
            source: device,
          })
        }

        return next.length > 0 ? next : [emptySleepGroup(todayDateKey())]
      })
    } catch {
      setScreenshotError("Couldn't read those screenshots. Try clearer shots, or enter values manually.")
    }

    setScanning(null)
    if (device === 'oura' && ouraInputRef.current) ouraInputRef.current.value = ''
    if (device === 'withings' && withingsInputRef.current) withingsInputRef.current.value = ''
  }

  function updateGroup(key: string, field: keyof SleepGroup, value: string) {
    setSleepGroups((prev) =>
      prev.map((g) =>
        g.key === key
          ? {
              ...g,
              [field]: value,
              // Picking a date (often required when a screenshot's on-screen date
              // couldn't be auto-resolved) isn't an override of the device data —
              // only demote to 'manual' when an actual health-data field is edited.
              source: field === 'date' ? g.source : 'manual',
            }
          : g
      )
    )
  }

  function removeGroup(key: string) {
    setSleepGroups((prev) => prev.filter((g) => g.key !== key))
  }

  function addGroup() {
    setSleepGroups((prev) => [...prev, emptySleepGroup(todayDateKey())])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (sleepGroups.some((g) => !g.date)) {
      setError("One or more nights couldn't be dated automatically — pick a date for each before saving.")
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

    const rows = sleepGroups
      .filter((g) => !isBlank(g))
      .map((g) => ({
        user_id: user.id,
        sleep_date: g.date,
        source: g.source === 'oura+withings' ? 'oura' : g.source,
        total_sleep_minutes: g.totalSleep ? Number(g.totalSleep) : null,
        light_sleep_minutes: g.lightSleep ? Number(g.lightSleep) : null,
        deep_sleep_minutes: g.deepSleep ? Number(g.deepSleep) : null,
        rem_sleep_minutes: g.remSleep ? Number(g.remSleep) : null,
        awake_minutes: g.awake ? Number(g.awake) : null,
        sleep_score: g.sleepScore ? Number(g.sleepScore) : null,
        avg_heart_rate: g.avgHeartRate ? Number(g.avgHeartRate) : null,
        avg_respiratory_rate: g.avgRespiratoryRate ? Number(g.avgRespiratoryRate) : null,
        respiratory_rate_min: g.respRateMin ? Number(g.respRateMin) : null,
        respiratory_rate_max: g.respRateMax ? Number(g.respRateMax) : null,
        hrv_first_90_ms: g.hrvFirst90 ? Number(g.hrvFirst90) : null,
        hrv_last_90_ms: g.hrvLast90 ? Number(g.hrvLast90) : null,
        sleep_latency_minutes: g.sleepLatency ? Number(g.sleepLatency) : null,
        time_to_get_up_minutes: g.timeToGetUp ? Number(g.timeToGetUp) : null,
        interruptions_count: g.interruptions ? Number(g.interruptions) : null,
        regularity_rating: g.regularityRating || null,
        depth_rating: g.depthRating || null,
        breathing_quality_assessment: g.breathingQuality || null,
        snoring_minutes: g.snoringMinutes ? Number(g.snoringMinutes) : null,
      }))

    if (rows.length === 0) {
      setError('Add at least total sleep or a sleep score before saving.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('sleep_logs').insert(rows)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/sleep')
    router.refresh()
  }

  function numberField(
    groupKey: string,
    field: keyof SleepGroup,
    label: string,
    value: string,
    step?: string
  ) {
    return (
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => updateGroup(groupKey, field, e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Add sleep entry</h1>

        <input
          ref={ouraInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleScreenshotsSelected(e, 'oura')}
          className="hidden"
        />
        <input
          ref={withingsInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleScreenshotsSelected(e, 'withings')}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-dashed border-neutral-300 p-3 space-y-2">
            <p className="text-xs font-medium text-neutral-700">Oura Ring</p>
            <button
              type="button"
              onClick={() => ouraInputRef.current?.click()}
              disabled={scanning !== null}
              className="w-full rounded-md bg-neutral-100 text-neutral-700 text-xs font-medium py-2 hover:bg-neutral-200 disabled:opacity-50"
            >
              {scanning === 'oura' ? 'Reading…' : '📷 Import screenshots'}
            </button>
          </div>
          <div className="rounded-md border border-dashed border-neutral-300 p-3 space-y-2">
            <p className="text-xs font-medium text-neutral-700">Withings Sleep Analyzer</p>
            <button
              type="button"
              onClick={() => withingsInputRef.current?.click()}
              disabled={scanning !== null}
              className="w-full rounded-md bg-neutral-100 text-neutral-700 text-xs font-medium py-2 hover:bg-neutral-200 disabled:opacity-50"
            >
              {scanning === 'withings' ? 'Reading…' : '📷 Import screenshots'}
            </button>
          </div>
        </div>
        <p className="text-xs text-neutral-600">
          Select multiple screenshots at once — even from different nights. Screenshots detected
          as the same night are merged into one entry; different nights become separate entries
          below. Double-check the detected dates before saving.
        </p>
        {screenshotError && (
          <p className="text-xs text-red-600" role="alert">
            {screenshotError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {sleepGroups.map((g) => (
            <div key={g.key} className="rounded-lg border border-neutral-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Sleep date
                    {g.dateGuessLabel && (
                      <span className="text-xs text-neutral-500 font-normal">
                        {' '}
                        — detected &quot;{g.dateGuessLabel}&quot;
                      </span>
                    )}
                    {g.source !== 'manual' && (
                      <span className="text-xs text-green-700 font-normal">
                        {' '}
                        · filled from {g.source === 'oura+withings' ? 'Oura + Withings' : g.source}
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
                {sleepGroups.length > 1 && (
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
                {numberField(g.key, 'totalSleep', 'Total sleep (min)', g.totalSleep)}
                {numberField(g.key, 'sleepScore', 'Sleep score', g.sleepScore)}
                {numberField(g.key, 'lightSleep', 'Light sleep (min)', g.lightSleep)}
                {numberField(g.key, 'deepSleep', 'Deep sleep (min)', g.deepSleep)}
                {numberField(g.key, 'remSleep', 'REM sleep (min)', g.remSleep)}
                {numberField(g.key, 'awake', 'Awake (min)', g.awake)}
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <p className="text-xs font-medium text-neutral-700 mb-2">Heart & breathing</p>
                <div className="grid grid-cols-2 gap-3">
                  {numberField(g.key, 'avgHeartRate', 'Avg heart rate', g.avgHeartRate)}
                  {numberField(g.key, 'avgRespiratoryRate', 'Avg resp. rate', g.avgRespiratoryRate, '0.1')}
                  {numberField(g.key, 'respRateMin', 'Resp. rate min', g.respRateMin, '0.1')}
                  {numberField(g.key, 'respRateMax', 'Resp. rate max', g.respRateMax, '0.1')}
                  {numberField(g.key, 'snoringMinutes', 'Snoring (min)', g.snoringMinutes)}
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <p className="text-xs font-medium text-neutral-700 mb-2">HRV & recovery</p>
                <div className="grid grid-cols-2 gap-3">
                  {numberField(g.key, 'hrvFirst90', 'HRV first 90min (ms)', g.hrvFirst90)}
                  {numberField(g.key, 'hrvLast90', 'HRV last 90min (ms)', g.hrvLast90)}
                  {numberField(g.key, 'sleepLatency', 'Time to sleep (min)', g.sleepLatency)}
                  {numberField(g.key, 'timeToGetUp', 'Time to get up (min)', g.timeToGetUp)}
                  {numberField(g.key, 'interruptions', 'Interruptions', g.interruptions)}
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 space-y-3">
                <p className="text-xs font-medium text-neutral-700">Quality ratings</p>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Regularity
                  </label>
                  <input
                    type="text"
                    value={g.regularityRating}
                    onChange={(e) => updateGroup(g.key, 'regularityRating', e.target.value)}
                    placeholder="e.g. Good"
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Depth</label>
                  <input
                    type="text"
                    value={g.depthRating}
                    onChange={(e) => updateGroup(g.key, 'depthRating', e.target.value)}
                    placeholder="e.g. Good"
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Breathing quality
                  </label>
                  <input
                    type="text"
                    value={g.breathingQuality}
                    onChange={(e) => updateGroup(g.key, 'breathingQuality', e.target.value)}
                    placeholder="e.g. Optimal"
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
            + Add another night
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
            {saving ? 'Saving…' : `Save ${sleepGroups.length > 1 ? `${sleepGroups.length} entries` : 'entry'}`}
          </button>
        </form>
      </div>
    </main>
  )
}
