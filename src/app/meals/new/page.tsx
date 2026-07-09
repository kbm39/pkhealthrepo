'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface FoodBankItem {
  food_id: string
  name: string
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
  serving_size: number
  serving_unit: string
}

export default function NewMealPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [sugar, setSugar] = useState('')
  const [sodium, setSodium] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [foodBank, setFoodBank] = useState<FoodBankItem[]>([])
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadFoodBank() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('user_food_bank')
        .select('food_id, foods(name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, serving_size, serving_unit)')
        .eq('user_id', user.id)
        .order('last_logged_at', { ascending: false })
        .limit(20)

      if (data) {
        const items: FoodBankItem[] = data
          .filter((row) => row.foods)
          .map((row) => {
            const food = Array.isArray(row.foods) ? row.foods[0] : row.foods
            return {
              food_id: row.food_id,
              name: food.name,
              calories: food.calories,
              protein_g: food.protein_g,
              carbs_g: food.carbs_g,
              fat_g: food.fat_g,
              fiber_g: food.fiber_g,
              sugar_g: food.sugar_g,
              sodium_mg: food.sodium_mg,
              serving_size: food.serving_size,
              serving_unit: food.serving_unit,
            }
          })
        setFoodBank(items)
      }
    }
    loadFoodBank()
  }, [supabase])

  function selectFoodBankItem(item: FoodBankItem) {
    setSelectedFoodId(item.food_id)
    setName(item.name)
    setCalories(String(item.calories))
    setProtein(item.protein_g != null ? String(item.protein_g) : '')
    setCarbs(item.carbs_g != null ? String(item.carbs_g) : '')
    setFat(item.fat_g != null ? String(item.fat_g) : '')
    setFiber(item.fiber_g != null ? String(item.fiber_g) : '')
    setSugar(item.sugar_g != null ? String(item.sugar_g) : '')
    setSodium(item.sodium_mg != null ? String(item.sodium_mg) : '')
  }

  function clearSelection() {
    setSelectedFoodId(null)
    setName('')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
    setFiber('')
    setSugar('')
    setSodium('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You need to be signed in to continue.')
      setLoading(false)
      return
    }

    const qty = Number(quantity) || 1
    let foodId = selectedFoodId

    // If this is a brand-new manual food, create it in the shared foods table first.
    if (!foodId) {
      const { data: newFood, error: foodError } = await supabase
        .from('foods')
        .insert({
          name,
          calories: Number(calories),
          protein_g: protein ? Number(protein) : null,
          carbs_g: carbs ? Number(carbs) : null,
          fat_g: fat ? Number(fat) : null,
          fiber_g: fiber ? Number(fiber) : null,
          sugar_g: sugar ? Number(sugar) : null,
          sodium_mg: sodium ? Number(sodium) : null,
          source: 'manual',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (foodError || !newFood) {
        setError(foodError?.message ?? 'Could not save food.')
        setLoading(false)
        return
      }
      foodId = newFood.id
    }

    // Add/update this food in the user's food bank for fast re-logging later.
    await supabase
      .from('user_food_bank')
      .upsert(
        {
          user_id: user.id,
          food_id: foodId,
          last_logged_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,food_id' }
      )

    const { error: logError } = await supabase.from('meal_logs').insert({
      user_id: user.id,
      food_id: foodId,
      food_name_snapshot: name,
      meal_type: mealType,
      quantity: qty,
      calories: Number(calories) * qty,
      protein_g: protein ? Number(protein) * qty : null,
      carbs_g: carbs ? Number(carbs) * qty : null,
      fat_g: fat ? Number(fat) * qty : null,
      fiber_g: fiber ? Number(fiber) * qty : null,
      sugar_g: sugar ? Number(sugar) * qty : null,
      sodium_mg: sodium ? Number(sodium) * qty : null,
      entry_method: selectedFoodId ? 'food_bank' : 'manual',
    })

    setLoading(false)

    if (logError) {
      setError(logError.message)
      return
    }

    router.push('/meals')
    router.refresh()
  }

  const filteredFoodBank = foodBank.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Log a meal</h1>

        {foodBank.length > 0 && (
          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-medium text-neutral-500 mb-2">
              Your food bank — tap to re-log
            </h2>
            <input
              type="text"
              placeholder="Search your foods…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm mb-2"
            />
            <ul className="max-h-40 overflow-y-auto divide-y divide-neutral-100">
              {filteredFoodBank.map((item) => (
                <li key={item.food_id}>
                  <button
                    type="button"
                    onClick={() => selectFoodBankItem(item)}
                    className={`w-full text-left py-2 text-sm hover:bg-neutral-50 ${
                      selectedFoodId === item.food_id ? 'font-semibold text-neutral-900' : 'text-neutral-700'
                    }`}
                  >
                    {item.name} · {item.calories} cal
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-neutral-700">Food name</label>
              {selectedFoodId && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs text-neutral-500 underline"
                >
                  Clear / enter new food
                </button>
              )}
            </div>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!selectedFoodId}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Quantity (servings)
            </label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Calories (per serving)
              </label>
              <input
                type="number"
                required
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                disabled={!!selectedFoodId}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Protein (g)</label>
              <input
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                disabled={!!selectedFoodId}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Carbs (g)</label>
              <input
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                disabled={!!selectedFoodId}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Fat (g)</label>
              <input
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                disabled={!!selectedFoodId}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Fiber (g)</label>
              <input
                type="number"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                disabled={!!selectedFoodId}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Sugar (g)</label>
              <input
                type="number"
                value={sugar}
                onChange={(e) => setSugar(e.target.value)}
                disabled={!!selectedFoodId}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Sodium (mg)</label>
              <input
                type="number"
                value={sodium}
                onChange={(e) => setSodium(e.target.value)}
                disabled={!!selectedFoodId}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
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
            disabled={loading}
            className="w-full rounded-md bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Log meal'}
          </button>
        </form>
      </div>
    </main>
  )
}
