'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'

type VitalType = 'blood_pressure' | 'blood_glucose'

export default function EditVitalPage() {
  const params = useParams()
  const entryId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [vitalType, setVitalType] = useState<VitalType>('blood_pressure')

  const [recordedAt, setRecordedAt] = useState('')
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [ecgResult, setEcgResult] = useState('')
  const [glucose, setGlucose] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function loadEntry() {
      const { data, error } = await supabase
        .from('vitals')
        .select('*')
        .eq('id', entryId)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setVitalType(data.vital_type)
      // datetime-local expects "YYYY-MM-DDTHH:mm" in local time
      const d = new Date(data.recorded_at)
      const pad = (n: number) => String(n).padStart(2, '0')
      setRecordedAt(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
          d.getHours()
        )}:${pad(d.getMinutes())}`
      )
      setSystolic(data.systolic != null ? String(data.systolic) : '')
      setDiastolic(data.diastolic != null ? String(data.diastolic) : '')
      setHeartRate(data.heart_rate != null ? String(data.heart_rate) : '')
      setEcgResult(data.ecg_result ?? '')
      setGlucose(data.glucose_mg_dl != null ? String(data.glucose_mg_dl) : '')
      setLoading(false)
    }
    loadEntry()
  }, [entryId, supabase])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const payload =
      vitalType === 'blood_pressure'
        ? {
            recorded_at: new Date(recordedAt).toISOString(),
            systolic: systolic ? Number(systolic) : null,
            diastolic: diastolic ? Number(diastolic) : null,
            heart_rate: heartRate ? Number(heartRate) : null,
            ecg_result: ecgResult || null,
          }
        : {
            recorded_at: new Date(recordedAt).toISOString(),
            glucose_mg_dl: glucose ? Number(glucose) : null,
          }

    const { error } = await supabase.from('vitals').update(payload).eq('id', entryId)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/vitals')
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('vitals').delete().eq('id', entryId)
    router.push('/vitals')
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
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">
          Edit {vitalType === 'blood_pressure' ? 'blood pressure' : 'glucose'} reading
        </h1>

        <form onSubmit={handleSave} className="space-y-4">
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
                    onChange={(e) => setSystolic(e.target.value)}
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
                    onChange={(e) => setDiastolic(e.target.value)}
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
                  onChange={(e) => setHeartRate(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  ECG result (optional)
                </label>
                <input
                  type="text"
                  value={ecgResult}
                  onChange={(e) => setEcgResult(e.target.value)}
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
                onChange={(e) => setGlucose(e.target.value)}
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
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full rounded-md border border-red-300 text-red-600 text-sm font-medium py-2 hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete entry'}
        </button>
      </div>
    </main>
  )
}
