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
  const [source, setSource] = useState<'manual' | 'oura' | 'withings'>('manual')

  const [scanning, setScanning] = useState<'oura' | 'withings' | null>(null)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleScreenshotSelected(
    e: React.ChangeEvent<HTMLInputElement>,
    device: 'oura' | 'withings'
  ) {
    const file = e.target.files?.[0]
    if (!file) return

    setScreenshotError(null)
    setScanning(device)

    try {
      const { base64, mediaType } = await resizeImageToBase64(file, 1500)
      const endpoint =
        device === 'oura' ? '/api/parse-oura-screenshot' : '/api/parse-withings-screenshot'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      })
      const data = await res.json()

      if (!res.ok || !data.found) {
        setScreenshotError(
          data.error ||
            `Couldn't read sleep results in that screenshot. Try a clearer shot, or enter values manually.`
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
      setSource(device)
    } catch {
      setScreenshotError("Couldn't read that screenshot. Try a clearer shot, or enter values manually.")
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
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/sleep')
    router.refresh()
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
          onChange={(e) => handleScreenshotSelected(e, 'oura')}
          className="hidden"
        />
        <input
          ref={withingsInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleScreenshotSelected(e, 'withings')}
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
              {scanning === 'oura' ? 'Reading…' : '📷 Import screenshot'}
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
              {scanning === 'withings' ? 'Reading…' : '📷 Import screenshot'}
            </button>
          </div>
        </div>
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
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Total sleep (min)
              </label>
              <input
                type="number"
                value={totalSleep}
                onChange={(e) => {
                  setTotalSleep(e.target.value)
                  setSource('manual')
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Sleep score
              </label>
              <input
                type="number"
                value={sleepScore}
                onChange={(e) => {
                  setSleepScore(e.target.value)
                  setSource('manual')
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Light sleep (min)
              </label>
              <input
                type="number"
                value={lightSleep}
                onChange={(e) => {
                  setLightSleep(e.target.value)
                  setSource('manual')
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Deep sleep (min)
              </label>
              <input
                type="number"
                value={deepSleep}
                onChange={(e) => {
                  setDeepSleep(e.target.value)
                  setSource('manual')
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                REM sleep (min)
              </label>
              <input
                type="number"
                value={remSleep}
                onChange={(e) => {
                  setRemSleep(e.target.value)
                  setSource('manual')
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Awake (min)
              </label>
              <input
                type="number"
                value={awake}
                onChange={(e) => {
                  setAwake(e.target.value)
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
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Resp. rate
              </label>
              <input
                type="number"
                step="0.1"
                value={avgRespiratoryRate}
                onChange={(e) => {
                  setAvgRespiratoryRate(e.target.value)
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
