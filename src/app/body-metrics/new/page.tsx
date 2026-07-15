'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'
import { resizeImageToBase64 } from '@/lib/image-utils'

export default function NewBodyMetricPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [weight, setWeight] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [smm, setSmm] = useState('')
  const [leanMass, setLeanMass] = useState('')
  const [importedFromScreenshot, setImportedFromScreenshot] = useState(false)

  const [scanningScreenshot, setScanningScreenshot] = useState(false)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Body fat lbs is derived from weight × body fat % when both are provided,
  // rather than asked for separately — keeps the two numbers from silently
  // disagreeing with each other.
  const bodyFatLbs =
    weight && bodyFatPct ? (Number(weight) * (Number(bodyFatPct) / 100)).toFixed(1) : null

  async function handleScreenshotSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setScreenshotError(null)
    setScanningScreenshot(true)

    try {
      const { base64, mediaType } = await resizeImageToBase64(file, 1500)
      const res = await fetch('/api/parse-inbody-screenshot', {
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

      if (data.weight_lbs != null) setWeight(String(data.weight_lbs))
      if (data.body_fat_pct != null) setBodyFatPct(String(data.body_fat_pct))
      if (data.skeletal_muscle_mass_lbs != null) setSmm(String(data.skeletal_muscle_mass_lbs))
      if (data.lean_mass_lbs != null) setLeanMass(String(data.lean_mass_lbs))
      setImportedFromScreenshot(true)
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

    const { error } = await supabase.from('body_metrics').insert({
      user_id: user.id,
      source: importedFromScreenshot ? 'inbody_h30' : 'manual',
      weight_lbs: weight ? Number(weight) : null,
      body_fat_pct: bodyFatPct ? Number(bodyFatPct) : null,
      body_fat_lbs: bodyFatLbs ? Number(bodyFatLbs) : null,
      skeletal_muscle_mass_lbs: smm ? Number(smm) : null,
      lean_mass_lbs: leanMass ? Number(leanMass) : null,
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/body-metrics')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Add weigh-in</h1>

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
            {scanningScreenshot ? 'Reading screenshot…' : '📷 Import from InBody screenshot'}
          </button>
          <p className="text-xs text-neutral-600">
            Take a screenshot of your InBody results, then select it here — fields below will
            auto-fill for you to review.
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
              Weight (lbs)
            </label>
            <input
              type="number"
              step="0.1"
              required
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value)
                setImportedFromScreenshot(false)
              }}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Body fat % (optional — from InBody H30)
            </label>
            <input
              type="number"
              step="0.1"
              value={bodyFatPct}
              onChange={(e) => {
                setBodyFatPct(e.target.value)
                setImportedFromScreenshot(false)
              }}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            {bodyFatLbs && (
              <p className="text-xs text-neutral-600 mt-1">≈ {bodyFatLbs} lbs of body fat</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Skeletal Muscle Mass (lbs, optional)
            </label>
            <input
              type="number"
              step="0.1"
              value={smm}
              onChange={(e) => {
                setSmm(e.target.value)
                setImportedFromScreenshot(false)
              }}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Lean Mass (lbs, optional)
            </label>
            <input
              type="number"
              step="0.1"
              value={leanMass}
              onChange={(e) => {
                setLeanMass(e.target.value)
                setImportedFromScreenshot(false)
              }}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
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
