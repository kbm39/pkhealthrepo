'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface WorkoutSetRowProps {
  id: string
  setNumber: number
  weightLbs: number | null
  reps: number | null
  caloriesBurned: number | null
}

export default function WorkoutSetRow({
  id,
  setNumber,
  weightLbs,
  reps,
  caloriesBurned,
}: WorkoutSetRowProps) {
  const router = useRouter()
  const supabase = createClient()

  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(weightLbs != null ? String(weightLbs) : '')
  const [repsValue, setRepsValue] = useState(reps != null ? String(reps) : '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleSave() {
    setSaving(true)
    await supabase
      .from('workout_sets')
      .update({
        weight_lbs: weight ? Number(weight) : null,
        reps: repsValue ? Number(repsValue) : null,
      })
      .eq('id', id)
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    await supabase.from('workout_sets').delete().eq('id', id)
    setDeleting(false)
    router.refresh()
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 text-xs">
        <span className="text-neutral-700">Set {setNumber}:</span>
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-16 rounded border border-neutral-300 px-1.5 py-1"
        />
        <span className="text-neutral-600">lbs ×</span>
        <input
          type="number"
          value={repsValue}
          onChange={(e) => setRepsValue(e.target.value)}
          className="w-14 rounded border border-neutral-300 px-1.5 py-1"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-neutral-900 underline underline-offset-2 disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-neutral-600 underline underline-offset-2"
        >
          Cancel
        </button>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between text-xs text-neutral-700">
      <span>
        Set {setNumber}: {weightLbs ?? '—'} lbs × {reps ?? '—'} reps
        {caloriesBurned != null && ` · ${Math.round(caloriesBurned)} cal`}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="text-neutral-600 underline underline-offset-2"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-600 underline underline-offset-2 disabled:opacity-50"
        >
          {deleting ? '…' : confirming ? 'Confirm?' : 'Delete'}
        </button>
      </span>
    </li>
  )
}
