'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewBodyMetricPage() {
  const router = useRouter()
  const supabase = createClient()

  const [weight, setWeight] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [smm, setSmm] = useState('')
  const [leanMass, setLeanMass] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Body fat lbs is derived from weight × body fat % when both are provided,
  // rather than asked for separately — keeps the two numbers from silently
  // disagreeing with each other.
  const bodyFatLbs =
    weight && bodyFatPct ? (Number(weight) * (Number(bodyFatPct) / 100)).toFixed(1) : null

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
      source: 'manual',
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
        <h1 className="text-2xl font-semibold text-neutral-900">Add weigh-in</h1>

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
              onChange={(e) => setWeight(e.target.value)}
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
              onChange={(e) => setBodyFatPct(e.target.value)}
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
              onChange={(e) => setSmm(e.target.value)}
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
              onChange={(e) => setLeanMass(e.target.value)}
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
