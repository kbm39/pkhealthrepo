'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'
import { nowDateTimeLocalValue } from '@/components/LocalDateTime'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface Ingredient {
  name: string
  amount: string
  unit: string
}

interface Recipe {
  id: string
  title: string
  servings: number
  ingredients: Ingredient[]
  instructions: string[]
  glycemic_notes: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  food_id: string | null
}

export default function RecipeDetailPage() {
  const params = useParams()
  const recipeId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [mealType, setMealType] = useState<MealType>('dinner')
  const [loggedAt, setLoggedAt] = useState(nowDateTimeLocalValue())
  const [quantity, setQuantity] = useState('1')
  const [logging, setLogging] = useState(false)
  const [logged, setLogged] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)

  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    async function loadRecipe() {
      const { data, error } = await supabase.from('recipes').select('*').eq('id', recipeId).single()
      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setRecipe(data as Recipe)
      setLoading(false)
    }
    loadRecipe()
  }, [recipeId, supabase])

  async function handleLog(e: React.FormEvent) {
    e.preventDefault()
    if (!recipe) return
    setLogError(null)
    setLogging(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLogError('You need to be signed in to continue.')
      setLogging(false)
      return
    }

    let foodId = recipe.food_id

    // Older recipes may not have a linked food row yet — create one on the fly.
    if (!foodId) {
      const { data: food, error: foodError } = await supabase
        .from('foods')
        .insert({
          name: recipe.title,
          serving_size: 1,
          serving_unit: 'serving',
          calories: recipe.calories,
          protein_g: recipe.protein_g,
          carbs_g: recipe.carbs_g,
          fat_g: recipe.fat_g,
          fiber_g: recipe.fiber_g,
          sugar_g: recipe.sugar_g,
          source: 'recipe_ai',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (foodError || !food) {
        setLogError(foodError?.message ?? 'Could not log this recipe.')
        setLogging(false)
        return
      }
      foodId = food.id
      await supabase.from('recipes').update({ food_id: foodId }).eq('id', recipe.id)
    }

    const qty = Number(quantity) || 1

    const { error: logInsertError } = await supabase.from('meal_logs').insert({
      user_id: user.id,
      food_id: foodId,
      food_name_snapshot: recipe.title,
      meal_type: mealType,
      quantity: qty,
      logged_at: new Date(loggedAt).toISOString(),
      calories: (recipe.calories ?? 0) * qty,
      protein_g: recipe.protein_g != null ? recipe.protein_g * qty : null,
      carbs_g: recipe.carbs_g != null ? recipe.carbs_g * qty : null,
      fat_g: recipe.fat_g != null ? recipe.fat_g * qty : null,
      fiber_g: recipe.fiber_g != null ? recipe.fiber_g * qty : null,
      sugar_g: recipe.sugar_g != null ? recipe.sugar_g * qty : null,
      entry_method: 'recipe',
    })

    if (logInsertError) {
      setLogError(logInsertError.message)
      setLogging(false)
      return
    }

    await supabase
      .from('user_food_bank')
      .upsert(
        { user_id: user.id, food_id: foodId, last_logged_at: new Date().toISOString() },
        { onConflict: 'user_id,food_id' }
      )

    setLogging(false)
    setLogged(true)
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleting(true)
    await supabase.from('recipes').delete().eq('id', recipeId)
    router.push('/recipes')
    router.refresh()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-10">
        <p className="text-sm text-neutral-700 text-center">Loading…</p>
      </main>
    )
  }

  if (notFound || !recipe) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-10">
        <p className="text-sm text-neutral-700 text-center">Recipe not found.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />

        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{recipe.title}</h1>
          <p className="text-sm text-neutral-600 mt-1">{recipe.servings} servings</p>
        </div>

        {recipe.glycemic_notes && (
          <section className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h2 className="text-sm font-medium text-green-900 mb-1">Why this is low-glycemic</h2>
            <p className="text-xs text-green-800">{recipe.glycemic_notes}</p>
          </section>
        )}

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-medium text-neutral-900 mb-2">
            Nutrition (per serving, AI estimate)
          </h2>
          <div className="grid grid-cols-3 gap-2 text-xs text-neutral-700">
            <p>Calories: {recipe.calories ?? '—'}</p>
            <p>Protein: {recipe.protein_g ?? '—'}g</p>
            <p>Carbs: {recipe.carbs_g ?? '—'}g</p>
            <p>Fat: {recipe.fat_g ?? '—'}g</p>
            <p>Fiber: {recipe.fiber_g ?? '—'}g</p>
            <p>Sugar: {recipe.sugar_g ?? '—'}g</p>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-medium text-neutral-900 mb-2">Ingredients</h2>
          <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>
                {ing.amount} {ing.unit} {ing.name}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-medium text-neutral-900 mb-2">Instructions</h2>
          <ol className="text-sm text-neutral-700 space-y-2 list-decimal list-inside">
            {recipe.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-medium text-neutral-900 mb-3">Log to meal diary</h2>

          {logged ? (
            <p className="text-sm text-green-700">Logged. You can log it again below any time.</p>
          ) : null}

          <form onSubmit={handleLog} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Meal</label>
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
              <label className="block text-xs font-medium text-neutral-700 mb-1">Date &amp; time</label>
              <input
                type="datetime-local"
                value={loggedAt}
                onChange={(e) => setLoggedAt(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Servings eaten
              </label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            {logError && (
              <p className="text-sm text-red-600" role="alert">
                {logError}
              </p>
            )}

            <button
              type="submit"
              disabled={logging}
              className="w-full rounded-md bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
            >
              {logging ? 'Logging…' : 'Log this meal'}
            </button>
          </form>
        </section>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full rounded-md border border-red-300 text-red-600 text-sm font-medium py-2 hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : confirmingDelete ? 'Confirm delete recipe?' : 'Delete recipe'}
        </button>
      </div>
    </main>
  )
}
