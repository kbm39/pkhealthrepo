'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function EditBodyMetricPage() {
  const params = useParams()
  const entryId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [weight, setWeight] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [smm, setSmm] = useState('')
  const [leanMass, setLeanMass] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function loadEntry() {
      const { data, error } = await supabase
        .from('body_metrics')
        .select('*')
        .eq('id', entryId)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setWeight(data.weight_lbs != null ? String(data.weight_lbs) : '')
      setBodyFatPct(data.body_fat_pct != null ? String(data.body_fat_pct) : '')
      setSmm(data.skeletal_muscle_mass_lbs != null ? String(data.skeletal_muscle_mass_lbs) : '')
      setLeanMass(data.lean_mass_lbs != null ? String(data.lean_mass_lbs) : '')
      setLoading(false)
    }
    loadEntry()
  }, [entryId, supabase])

  const bodyFatLbs =
    weight && bodyFatPct ? (Number(weight) * (Number(bodyFatPct) / 100)).toFixed(1) : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const { error } = await supabase
      .from('body_metrics')
      .update({
        weight_lbs: weight ? Number(weight) : null,
        body_fat_pct: bodyFatPct ? Number(bodyFatPct) : null,
        body_fat_lbs: bodyFatLbs ? Number(bodyFatLbs) : null,
        skeletal_muscle_mass_lbs: smm ? Number(smm) : null,
        lean_mass_lbs: leanMass ? Number(leanMass) : null,
      })
      .eq('id', entryId)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/body-metrics')
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('body_metrics').delete().eq('id', entryId)
    router.push('/body-metrics')
    router.refresh()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-10">
        <p className="text-sm text-neutral-700 text-center">Loading…</p>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-10">
        <p className="text-sm text-neutral-700 text-center">Entry not found.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Edit weigh-in</h1>

        <form onSubmit={handleSave} className="space-y-4">
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
              Body fat % (optional)
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 rounded-md border border-red-300 text-red-600 text-sm font-medium py-2 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
