'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'

const DIET_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Keto', label: 'Keto' },
  { value: 'Low-Carb', label: 'Low-Carb' },
  { value: 'High-Protein', label: 'High-Protein' },
  { value: 'Vegan', label: 'Vegan' },
  { value: 'Vegetarian', label: 'Vegetarian' },
  { value: 'Paleo', label: 'Paleo' },
  { value: 'Mediterranean', label: 'Mediterranean' },
]

export default function SettingsPage() {
  const supabase = createClient()

  const [dietType, setDietType] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('diet_type')
        .eq('id', user.id)
        .single()

      if (data?.diet_type) setDietType(data.diet_type)
      setLoading(false)
    }
    loadProfile()
  }, [supabase])

  async function handleSave() {
    setError(null)
    setSaving(true)
    setSaved(false)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You need to be signed in to continue.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ diet_type: dietType || null })
      .eq('id', user.id)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setSaved(true)
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Settings</h1>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Diet preference
            </label>
            {loading ? (
              <p className="text-sm text-neutral-600">Loading…</p>
            ) : (
              <select
                value={dietType}
                onChange={(e) => {
                  setDietType(e.target.value)
                  setSaved(false)
                }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                {DIET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-neutral-600 mt-1">
              When set, food you scan or log will be checked for whether it fits this diet.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {saved && <p className="text-sm text-green-700">Saved.</p>}

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </section>
      </div>
    </main>
  )
}
