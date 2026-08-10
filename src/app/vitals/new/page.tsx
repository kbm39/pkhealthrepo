'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'
import { resizeImageToBase64 } from '@/lib/image-utils'
import { nowDateTimeLocalValue } from '@/components/LocalDateTime'

type VitalType = 'blood_pressure' | 'blood_glucose'

export default function NewVitalPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [vitalType, setVitalType] = useState<VitalType>('blood_pressure')
  const [recordedAt, setRecordedAt] = useState(nowDateTimeLocalValue())

  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [ecgResult, setEcgResult] = useState('')

  const [glucose, setGlucose] = useState('')

  const [importedSource, setImportedSource] = useState<
    'withings_bpm_core' | 'freestyle_libre' | null
  >(null)

  const [scanningScreenshot, setScanningScreenshot] = useState(false)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function clearImportFlag() {
    setImportedSource(null)
  }

  async function handleScreenshotSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setScreenshotError(null)
    setScanningScreenshot(true)

    const endpoint = vitalType === 'blood_pressure' ? '/api/parse-bp-screenshot' : '/api/parse-glucose-screenshot'

    try {
      const { base64, mediaType } = await resizeImageToBase64(file, 1500)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      })
      const data = await res.json()

      if (!res.ok || !data.found) {
        setScreenshotError(
          data.error || "Couldn't read any results in that screenshot. Try a clearer, uncropped shot, or enter values manually."
        )
        setScanningScreenshot(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      if (vitalType === 'blood_pressure') {
        if (data.systolic != null) setSystolic(String(data.systolic))
        if (data.diastolic != null) setDiastolic(String(data.diastolic))
        if (data.heart_rate != null) setHeartRate(String(data.heart_rate))
        if (data.ecg_result != null) setEcgResult(data.ecg_result)
        setImportedSource('withings_bpm_core')
      } else {
        if (data.glucose_mg_dl != null) setGlucose(String(data.glucose_mg_dl))
        setImportedSource('freestyle_libre')
      }
    } catch {
      setScreenshotError("Couldn't read that screenshot. Try a clearer, uncropped shot, or enter values manually.")
    }

    setScanningScreenshot(false)
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

    const source =
      importedSource ?? (vitalType === 'blood_pressure' ? 'manual' : 'manual')

    const payload = {
      user_id: user.id,
      vital_type: vitalType,
      source,
      recorded_at: new Date(recordedAt).toISOString(),
      systolic: vitalType === 'blood_pressure' && systolic ? Number(systolic) : null,
      diastolic: vitalType === 'blood_pressure' && diastolic ? Number(diastolic) : null,
      heart_rate: vitalType === 'blood_pressure' && heartRate ? Number(heartRate) : null,
      ecg_result: vitalType === 'blood_pressure' ? ecgResult || null : null,
      glucose_mg_dl: vitalType === 'blood_glucose' && glucose ? Number(glucose) : null,
    }

    const { error } = await supabase.from('vitals').insert(payload)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/vitals')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Add vitals reading</h1>

        <div className="flex rounded-md border border-neutral-300 overflow-hidden text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setVitalType('blood_pressure')
              clearImportFlag()
            }}
            className={`flex-1 py-2 ${
              vitalType === 'blood_pressure'
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Blood Pressure
          </button>
          <button
            type="button"
            onClick={() => {
              setVitalType('blood_glucose')
              clearImportFlag()
            }}
            className={`flex-1 py-2 ${
              vitalType === 'blood_glucose'
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Blood Glucose
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleScreenshotSelected}
          className="hidden"
        />

        <div className="rounded-md border border-dashed border-neutral-300 p-3 space-y-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanningScreenshot}
            className="w-full rounded-md bg-neutral-100 text-neutral-700 text-sm font-medium py-2 hover:bg-neutral-200 disabled:opacity-50"
          >
            {scanningScreenshot
              ? 'Reading screenshot…'
              : vitalType === 'blood_pressure'
                ? '📷 Import from Withings BPM Core screenshot'
                : '📷 Import from FreeStyle Libre screenshot'}
          </button>
          <p className="text-xs text-neutral-600">
            {vitalType === 'blood_pressure'
              ? 'Take a screenshot of your BPM Core reading, then select it here — fields below will auto-fill for you to review.'
              : 'Take a screenshot of your FreeStyle Libre reading, then select it here — the field below will auto-fill for you to review.'}
          </p>
          {screenshotError && (
            <p className="text-xs text-red-600" role="alert">
              {screenshotError}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Date & time
            </label>
            <input
              type="datetime-local"
              required
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          {vitalType === 'blood_pressure' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Systolic
                  </label>
                  <input
                    type="number"
                    required
                    value={systolic}
                    onChange={(e) => {
                      setSystolic(e.target.value)
                      clearImportFlag()
                    }}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Diastolic
                  </label>
                  <input
                    type="number"
                    required
                    value={diastolic}
                    onChange={(e) => {
                      setDiastolic(e.target.value)
                      clearImportFlag()
                    }}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Heart rate (bpm, optional)
                </label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={(e) => {
                    setHeartRate(e.target.value)
                    clearImportFlag()
                  }}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  ECG result (optional — from BPM Core)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Normal sinus rhythm"
                  value={ecgResult}
                  onChange={(e) => {
                    setEcgResult(e.target.value)
                    clearImportFlag()
                  }}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Glucose (mg/dL)
              </label>
              <input
                type="number"
                required
                value={glucose}
                onChange={(e) => {
                  setGlucose(e.target.value)
                  clearImportFlag()
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          )}

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
