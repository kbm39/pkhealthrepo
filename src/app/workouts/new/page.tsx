'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'

interface Exercise {
  id: string
  name: string
  category: string | null
  met_value: number | null
}

interface PendingSet {
  exerciseId: string
  exerciseName: string
  metValue: number | null
  weight: string
  reps: string
}

// Rough estimate of active working time per set (not counting rest) — a
// common simplification fitness apps use for resistance-training calorie
// estimates, since MET tables are built around continuous activity time.
const ASSUMED_SET_DURATION_HOURS = 1 / 60

const LBS_PER_KG = 2.20462

function estimateCaloriesBurned(
  metValue: number | null,
  bodyWeightLbs: number | null
): number | null {
  if (metValue == null || bodyWeightLbs == null) return null
  const weightKg = bodyWeightLbs / LBS_PER_KG
  return metValue * weightKg * ASSUMED_SET_DURATION_HOURS
}

export default function NewWorkoutPage() {
  const router = useRouter()
  const supabase = createClient()

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [bodyWeightLbs, setBodyWeightLbs] = useState<number | null>(null)

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  const [pendingSets, setPendingSets] = useState<PendingSet[]>([])
  const [notes, setNotes] = useState('')

  const [showAddExercise, setShowAddExercise] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [newExerciseCategory, setNewExerciseCategory] = useState('other')
  const [newExerciseMet, setNewExerciseMet] = useState('4.0')
  const [addExerciseError, setAddExerciseError] = useState<string | null>(null)
  const [addingExercise, setAddingExercise] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadData() {
      const { data: exerciseData } = await supabase
        .from('exercises')
        .select('id, name, category, met_value')
        .order('name')
      if (exerciseData) setExercises(exerciseData)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: metric } = await supabase
        .from('body_metrics')
        .select('weight_lbs')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()

      if (metric) setBodyWeightLbs(metric.weight_lbs)
    }
    loadData()
  }, [supabase])

  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  )

  async function handleAddExercise(e: React.FormEvent) {
    e.preventDefault()
    if (!newExerciseName.trim()) return
    setAddExerciseError(null)
    setAddingExercise(true)

    const metValue = newExerciseMet ? Number(newExerciseMet) : null

    const { data: newExercise, error } = await supabase
      .from('exercises')
      .insert({
        name: newExerciseName.trim(),
        category: newExerciseCategory,
        met_value: metValue,
      })
      .select('id, name, category, met_value')
      .single()

    setAddingExercise(false)

    if (error || !newExercise) {
      setAddExerciseError(error?.message ?? 'Could not add exercise.')
      return
    }

    setExercises((prev) => [...prev, newExercise].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedExercise(newExercise)
    setExerciseSearch('')
    setShowAddExercise(false)
    setNewExerciseName('')
    setNewExerciseMet('4.0')
  }

  function addSet() {
    if (!selectedExercise || !weight || !reps) return

    setPendingSets((prev) => [
      ...prev,
      {
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        metValue: selectedExercise.met_value,
        weight,
        reps,
      },
    ])
    // Keep the same exercise/weight selected so logging consecutive sets is fast —
    // just clear reps in case it varies set to set.
  }

  function removeSet(index: number) {
    setPendingSets((prev) => prev.filter((_, i) => i !== index))
  }

  const totalEstimatedCalories = pendingSets.reduce((sum, set) => {
    const cal = estimateCaloriesBurned(set.metValue, bodyWeightLbs)
    return sum + (cal ?? 0)
  }, 0)

  async function handleSaveWorkout() {
    if (pendingSets.length === 0) return
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

    const { data: workoutLog, error: workoutError } = await supabase
      .from('workout_logs')
      .insert({ user_id: user.id, notes: notes || null })
      .select('id')
      .single()

    if (workoutError || !workoutLog) {
      setError(workoutError?.message ?? 'Could not save workout.')
      setSaving(false)
      return
    }

    // Set numbers restart per exercise within this session.
    const setNumberByExercise = new Map<string, number>()
    const rows = pendingSets.map((set) => {
      const nextNum = (setNumberByExercise.get(set.exerciseId) ?? 0) + 1
      setNumberByExercise.set(set.exerciseId, nextNum)

      return {
        workout_log_id: workoutLog.id,
        exercise_id: set.exerciseId,
        set_number: nextNum,
        weight_lbs: Number(set.weight),
        reps: Number(set.reps),
        calories_burned: estimateCaloriesBurned(set.metValue, bodyWeightLbs),
      }
    })

    const { error: setsError } = await supabase.from('workout_sets').insert(rows)

    setSaving(false)

    if (setsError) {
      setError(setsError.message)
      return
    }

    router.push('/workouts')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Log workout</h1>

        {!bodyWeightLbs && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            No body weight on file yet — calorie estimates need this. Log a weight entry to see
            estimated calories burned.
          </p>
        )}

        <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-medium text-neutral-700">Add a set</h2>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Exercise</label>
            {selectedExercise ? (
              <div className="flex items-center justify-between rounded-md border border-neutral-300 px-3 py-2">
                <span className="text-sm text-neutral-900">{selectedExercise.name}</span>
                <button
                  onClick={() => setSelectedExercise(null)}
                  className="text-xs text-neutral-600 underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search exercises…"
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm mb-2"
                />
                <ul className="max-h-48 overflow-y-auto divide-y divide-neutral-100 border border-neutral-200 rounded-md">
                  {filteredExercises.slice(0, 30).map((ex) => (
                    <li key={ex.id}>
                      <button
                        onClick={() => {
                          setSelectedExercise(ex)
                          setExerciseSearch('')
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
                      >
                        {ex.name}
                        {ex.category && (
                          <span className="text-xs text-neutral-600"> · {ex.category}</span>
                        )}
                      </button>
                    </li>
                  ))}
                  {filteredExercises.length === 0 && (
                    <li className="px-3 py-2 text-sm text-neutral-700">No matches</li>
                  )}
                </ul>

                {!showAddExercise ? (
                  <button
                    onClick={() => {
                      setNewExerciseName(exerciseSearch)
                      setShowAddExercise(true)
                    }}
                    className="mt-2 text-sm text-neutral-700 underline underline-offset-2"
                  >
                    Can&apos;t find it? Add a new exercise
                  </button>
                ) : (
                  <form
                    onSubmit={handleAddExercise}
                    className="mt-2 border border-neutral-200 rounded-md p-3 space-y-3"
                  >
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Exercise name
                      </label>
                      <input
                        type="text"
                        required
                        value={newExerciseName}
                        onChange={(e) => setNewExerciseName(e.target.value)}
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Category
                      </label>
                      <select
                        value={newExerciseCategory}
                        onChange={(e) => setNewExerciseCategory(e.target.value)}
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      >
                        <option value="chest">Chest</option>
                        <option value="back">Back</option>
                        <option value="legs">Legs</option>
                        <option value="shoulders">Shoulders</option>
                        <option value="arms">Arms</option>
                        <option value="core">Core</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Intensity (MET value)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={newExerciseMet}
                        onChange={(e) => setNewExerciseMet(e.target.value)}
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <p className="text-xs text-neutral-600 mt-1">
                        Used to estimate calories burned. 3.5 for light effort, 5 for moderate
                        compound lifts, 6+ for heavy/explosive movements — the default (4.0) is a
                        reasonable middle ground if unsure.
                      </p>
                    </div>
                    {addExerciseError && (
                      <p className="text-sm text-red-600" role="alert">
                        {addExerciseError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddExercise(false)}
                        className="flex-1 rounded-md border border-neutral-300 text-neutral-700 text-sm font-medium py-2 hover:bg-neutral-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={addingExercise}
                        className="flex-1 rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
                      >
                        {addingExercise ? 'Adding…' : 'Add & select'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

          {selectedExercise && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Reps</label>
                  <input
                    type="number"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={addSet}
                disabled={!weight || !reps}
                className="w-full rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
              >
                Add set
              </button>
            </>
          )}
        </section>

        {pendingSets.length > 0 && (
          <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-medium text-neutral-700">This session</h2>
            <ul className="space-y-2">
              {pendingSets.map((set, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-900">
                    {set.exerciseName}: {set.weight} lbs × {set.reps}
                  </span>
                  <button
                    onClick={() => removeSet(i)}
                    className="text-xs text-red-600 underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-sm">
              <span className="font-medium text-neutral-700">
                Estimated calories burned
              </span>
              <span className="font-semibold text-neutral-900">
                {bodyWeightLbs ? Math.round(totalEstimatedCalories) : '—'}
              </span>
            </div>
          </section>
        )}

        <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            onClick={handleSaveWorkout}
            disabled={pendingSets.length === 0 || saving}
            className="w-full rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save workout'}
          </button>
        </section>
      </div>
    </main>
  )
}
