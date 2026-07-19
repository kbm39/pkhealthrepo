'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'
import { resizeImageToBase64 } from '@/lib/image-utils'
import { todayDateKey } from '@/components/LocalDateTime'

export default function NewSleepPage() {
  const router = useRouter()
  const supabase = createClient()
  const ouraInputRef = useRef<HTMLInputElement>(null)
  const withingsInputRef = useRef<HTMLInputElement>(null)

  const [sleepDate, setSleepDate] = useState(todayDateKey())
  const [totalSleep, setTotalSleep] = useState('')
  const [lightSleep, setLightSleep] = useState('')
  const [deepSleep, setDeepSleep] = useState('')
  const [remSleep, setRemSleep] = useState('')
  const [awake, setAwake] = useState('')
  const [sleepScore, setSleepScore] = useState('')
  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [avgRespiratoryRate, setAvgRespiratoryRate] = useState('')
  const [respRateMin, setRespRateMin] = useState('')
  const [respRateMax, setRespRateMax] = useState('')
  const [hrvFirst90, setHrvFirst90] = useState('')
  const [hrvLast90, setHrvLast90] = useState('')
  const [sleepLatency, setSleepLatency] = useState('')
  const [timeToGetUp, setTimeToGetUp] = useState('')
  const [interruptions, setInterruptions] = useState('')
  const [regularityRating, setRegularityRating] = useState('')
  const [depthRating, setDepthRating] = useState('')
  const [breathingQuality, setBreathingQuality] = useState('')
  const [snoringMinutes, setSnoringMinutes] = useState('')
  const [source, setSource] = useState<'manual' | 'oura' | 'withings'>('manual')

  const [scanning, setScanning] = useState<'oura' | 'withings' | null>(null)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function markManual() {
    setSource('manual')
  }

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

      if (data.total_sleep_minutes != null) setTotalSleep(String(data.total_sleep_minutes))
      if (data.light_sleep_minutes != null) setLightSleep(String(data.light_sleep_minutes))
      if (data.deep_sleep_minutes != null) setDeepSleep(String(data.deep_sleep_minutes))
      if (data.rem_sleep_minutes != null) setRemSleep(String(data.rem_sleep_minutes))
      if (data.awake_minutes != null) setAwake(String(data.awake_minutes))
      if (data.sleep_score != null) setSleepScore(String(data.sleep_score))
      if (data.avg_heart_rate != null) setAvgHeartRate(String(data.avg_heart_rate))
      if (data.avg_respiratory_rate != null)
        setAvgRespiratoryRate(String(data.avg_respiratory_rate))
      if (data.respiratory_rate_min != null) setRespRateMin(String(data.respiratory_rate_min))
      if (data.respiratory_rate_max != null) setRespRateMax(String(data.respiratory_rate_max))
      if (data.hrv_first_90_ms != null) setHrvFirst90(String(data.hrv_first_90_ms))
      if (data.hrv_last_90_ms != null) setHrvLast90(String(data.hrv_last_90_ms))
      if (data.sleep_latency_minutes != null) setSleepLatency(String(data.sleep_latency_minutes))
      if (data.time_to_get_up_minutes != null)
        setTimeToGetUp(String(data.time_to_get_up_minutes))
      if (data.interruptions_count != null) setInterruptions(String(data.interruptions_count))
      if (data.regularity_rating) setRegularityRating(data.regularity_rating)
      if (data.depth_rating) setDepthRating(data.depth_rating)
      if (data.breathing_quality_assessment) setBreathingQuality(data.breathing_quality_assessment)
      if (data.snoring_minutes != null) setSnoringMinutes(String(data.snoring_minutes))
      setSource(device)
    } catch {
      setScreenshotError("Couldn't read those screenshots. Try clearer shots, or enter values manually.")
    }

    setScanning(null)
    if (device === 'oura' && ouraInputRef.current) ouraInputRef.current.value = ''
    if (device === 'withings' && withingsInputRef.current) withingsInputRef.current.value = ''
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

    const { error } = await supabase.from('sleep_logs').insert({
      user_id: user.id,
      sleep_date: sleepDate,
      source,
      total_sleep_minutes: totalSleep ? Number(totalSleep) : null,
      light_sleep_minutes: lightSleep ? Number(lightSleep) : null,
      deep_sleep_minutes: deepSleep ? Number(deepSleep) : null,
      rem_sleep_minutes: remSleep ? Number(remSleep) : null,
      awake_minutes: awake ? Number(awake) : null,
      sleep_score: sleepScore ? Number(sleepScore) : null,
      avg_heart_rate: avgHeartRate ? Number(avgHeartRate) : null,
      avg_respiratory_rate: avgRespiratoryRate ? Number(avgRespiratoryRate) : null,
      respiratory_rate_min: respRateMin ? Number(respRateMin) : null,
      respiratory_rate_max: respRateMax ? Number(respRateMax) : null,
      hrv_first_90_ms: hrvFirst90 ? Number(hrvFirst90) : null,
      hrv_last_90_ms: hrvLast90 ? Number(hrvLast90) : null,
      sleep_latency_minutes: sleepLatency ? Number(sleepLatency) : null,
      time_to_get_up_minutes: timeToGetUp ? Number(timeToGetUp) : null,
      interruptions_count: interruptions ? Number(interruptions) : null,
      regularity_rating: regularityRating || null,
      depth_rating: depthRating || null,
      breathing_quality_assessment: breathingQuality || null,
      snoring_minutes: snoringMinutes ? Number(snoringMinutes) : null,
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/sleep')
    router.refresh()
  }

  function numberField(
    label: string,
    value: string,
    setValue: (v: string) => void,
    step?: string
  ) {
    return (
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            markManual()
          }}
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
          You can select multiple screenshots at once (e.g. duration, HRV, heart rate, and score
          screens) — they&apos;ll be combined into one entry.
        </p>
        {screenshotError && (
          <p className="text-xs text-red-600" role="alert">
            {screenshotError}
          </p>
        )}
        {source !== 'manual' && (
          <p className="text-xs text-green-700">
            Fields below filled from {source === 'oura' ? 'Oura' : 'Withings'} — review before
            saving.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Sleep date
            </label>
            <input
              type="date"
              value={sleepDate}
              onChange={(e) => setSleepDate(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {numberField('Total sleep (min)', totalSleep, setTotalSleep)}
            {numberField('Sleep score', sleepScore, setSleepScore)}
            {numberField('Light sleep (min)', lightSleep, setLightSleep)}
            {numberField('Deep sleep (min)', deepSleep, setDeepSleep)}
            {numberField('REM sleep (min)', remSleep, setRemSleep)}
            {numberField('Awake (min)', awake, setAwake)}
          </div>

          <div className="pt-2 border-t border-neutral-100">
            <p className="text-xs font-medium text-neutral-700 mb-2">Heart & breathing</p>
            <div className="grid grid-cols-2 gap-3">
              {numberField('Avg heart rate', avgHeartRate, setAvgHeartRate)}
              {numberField('Avg resp. rate', avgRespiratoryRate, setAvgRespiratoryRate, '0.1')}
              {numberField('Resp. rate min', respRateMin, setRespRateMin, '0.1')}
              {numberField('Resp. rate max', respRateMax, setRespRateMax, '0.1')}
              {numberField('Snoring (min)', snoringMinutes, setSnoringMinutes)}
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-100">
            <p className="text-xs font-medium text-neutral-700 mb-2">HRV & recovery</p>
            <div className="grid grid-cols-2 gap-3">
              {numberField('HRV first 90min (ms)', hrvFirst90, setHrvFirst90)}
              {numberField('HRV last 90min (ms)', hrvLast90, setHrvLast90)}
              {numberField('Time to sleep (min)', sleepLatency, setSleepLatency)}
              {numberField('Time to get up (min)', timeToGetUp, setTimeToGetUp)}
              {numberField('Interruptions', interruptions, setInterruptions)}
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
                value={regularityRating}
                onChange={(e) => {
                  setRegularityRating(e.target.value)
                  markManual()
                }}
                placeholder="e.g. Good"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Depth</label>
              <input
                type="text"
                value={depthRating}
                onChange={(e) => {
                  setDepthRating(e.target.value)
                  markManual()
                }}
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
                value={breathingQuality}
                onChange={(e) => {
                  setBreathingQuality(e.target.value)
                  markManual()
                }}
                placeholder="e.g. Optimal"
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
