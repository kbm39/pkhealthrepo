'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export default function EditMealPage() {
  const params = useParams()
  const mealLogId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [foodName, setFoodName] = useState('')
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [quantity, setQuantity] = useState('1')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [sugar, setSugar] = useState('')
  const [sodium, setSodium] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function loadMeal() {
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('id', mealLogId)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setFoodName(data.food_name_snapshot ?? 'Food')
      setMealType(data.meal_type)
      setQuantity(String(data.quantity))
      setCalories(String(data.calories))
      setProtein(data.protein_g != null ? String(data.protein_g) : '')
      setCarbs(data.carbs_g != null ? String(data.carbs_g) : '')
      setFat(data.fat_g != null ? String(data.fat_g) : '')
      setFiber(data.fiber_g != null ? String(data.fiber_g) : '')
      setSugar(data.sugar_g != null ? String(data.sugar_g) : '')
      setSodium(data.sodium_mg != null ? String(data.sodium_mg) : '')
      setLoading(false)
    }
    loadMeal()
  }, [mealLogId, supabase])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const { error } = await supabase
      .from('meal_logs')
      .update({
        meal_type: mealType,
        quantity: Number(quantity),
        calories: Number(calories),
        protein_g: protein ? Number(protein) : null,
        carbs_g: carbs ? Number(carbs) : null,
        fat_g: fat ? Number(fat) : null,
        fiber_g: fiber ? Number(fiber) : null,
        sugar_g: sugar ? Number(sugar) : null,
        sodium_mg: sodium ? Number(sodium) : null,
      })
      .eq('id', mealLogId)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/meals')
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('meal_logs').delete().eq('id', mealLogId)
    router.push('/meals')
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
        <p className="text-sm text-neutral-700 text-center">Meal entry not found.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Edit meal</h1>
        <p className="text-sm text-neutral-700">{foodName}</p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Meal</label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Quantity (servings)
            </label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-neutral-600 mt-1">
              Changing quantity doesn&apos;t auto-scale the values below — adjust calories/macros
              manually if needed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Calories</label>
              <input
                type="number"
                required
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Protein (g)
              </label>
              <input
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Carbs (g)</label>
              <input
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Fat (g)</label>
              <input
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Fiber (g)</label>
              <input
                type="number"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Sugar (g)</label>
              <input
                type="number"
                value={sugar}
                onChange={(e) => setSugar(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Sodium (mg)
              </label>
              <input
                type="number"
                value={sodium}
                onChange={(e) => setSodium(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
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
