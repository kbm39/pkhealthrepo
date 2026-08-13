'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { nowDateTimeLocalValue } from '@/components/LocalDateTime'

interface Ingredient {
  name: string
  amount: string
  unit: string
}

interface RecipeListItem {
  id: string
  title: string
  servings: number
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  ingredients: Ingredient[]
  food_id: string | null
  created_at: string
}

/** Breakfast/lunch/dinner/snack based on the current local hour. */
function defaultMealType(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const hour = new Date().getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

export default function RecipesListView({ recipes }: { recipes: RecipeListItem[] }) {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [loggedId, setLoggedId] = useState<string | null>(null)
  const [loggedNutrition, setLoggedNutrition] = useState<Pick<
    RecipeListItem,
    'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sugar_g'
  > | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return recipes
    return recipes.filter((r) => {
      if (r.title.toLowerCase().includes(term)) return true
      return r.ingredients?.some((ing) => ing.name?.toLowerCase().includes(term))
    })
  }, [recipes, search])

  async function handleLogNow(recipe: RecipeListItem) {
    setErrorId(null)
    setLoggedId(null)
    setLoggingId(recipe.id)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setErrorId(recipe.id)
      setLoggingId(null)
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
        setErrorId(recipe.id)
        setLoggingId(null)
        return
      }
      foodId = food.id
      await supabase.from('recipes').update({ food_id: foodId }).eq('id', recipe.id)
    }

    const { error: logInsertError } = await supabase.from('meal_logs').insert({
      user_id: user.id,
      food_id: foodId,
      food_name_snapshot: recipe.title,
      meal_type: defaultMealType(),
      quantity: 1,
      logged_at: new Date(nowDateTimeLocalValue()).toISOString(),
      calories: recipe.calories ?? 0,
      protein_g: recipe.protein_g,
      carbs_g: recipe.carbs_g,
      fat_g: recipe.fat_g,
      fiber_g: recipe.fiber_g,
      sugar_g: recipe.sugar_g,
      entry_method: 'recipe',
    })

    if (logInsertError) {
      setErrorId(recipe.id)
      setLoggingId(null)
      return
    }

    await supabase
      .from('user_food_bank')
      .upsert(
        { user_id: user.id, food_id: foodId, last_logged_at: new Date().toISOString() },
        { onConflict: 'user_id,food_id' }
      )

    setLoggingId(null)
    setLoggedId(recipe.id)
    setLoggedNutrition({
      calories: recipe.calories,
      protein_g: recipe.protein_g,
      carbs_g: recipe.carbs_g,
      fat_g: recipe.fat_g,
      fiber_g: recipe.fiber_g,
      sugar_g: recipe.sugar_g,
    })
  }

  return (
    <div className="space-y-4">
      {recipes.length > 0 && (
        <input
          type="text"
          placeholder="Search by name or ingredient…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm bg-white"
        />
      )}

      {recipes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center">
          <p className="text-sm text-neutral-600">
            No recipes yet. Generate a low-glycemic recipe from ingredients you have or a
            craving.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-neutral-600 text-center py-4">
          No recipes match &quot;{search}&quot;.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((recipe) => (
            <li key={recipe.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/recipes/${recipe.id}`} className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-neutral-900 truncate hover:underline">
                    {recipe.title}
                  </h2>
                  <p className="text-xs text-neutral-700 mt-1">
                    {recipe.calories ?? '—'} cal · {recipe.carbs_g ?? '—'}g carbs per serving ·{' '}
                    {recipe.servings} srv
                  </p>
                </Link>
                <button
                  onClick={() => handleLogNow(recipe)}
                  disabled={loggingId === recipe.id}
                  className="shrink-0 rounded-md bg-neutral-900 text-white text-xs font-medium px-3 py-2 hover:bg-neutral-800 disabled:opacity-50"
                >
                  {loggingId === recipe.id
                    ? 'Logging…'
                    : loggedId === recipe.id
                      ? '✓ Logged'
                      : 'Log now'}
                </button>
              </div>
              {errorId === recipe.id && (
                <p className="text-xs text-red-600 mt-2" role="alert">
                  Couldn&apos;t log this recipe. Try again or open it to log manually.
                </p>
              )}
              {loggedId === recipe.id && loggedNutrition && (
                <div className="mt-2 rounded-md bg-green-50 border border-green-200 px-3 py-2">
                  <p className="text-xs font-medium text-green-900 mb-1">
                    Logged to today&apos;s diary ({defaultMealType()}, 1 serving)
                  </p>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs text-green-800">
                    <p>{loggedNutrition.calories ?? '—'} cal</p>
                    <p>{loggedNutrition.protein_g ?? '—'}g protein</p>
                    <p>{loggedNutrition.carbs_g ?? '—'}g carbs</p>
                    <p>{loggedNutrition.fat_g ?? '—'}g fat</p>
                    <p>{loggedNutrition.fiber_g ?? '—'}g fiber</p>
                    <p>{loggedNutrition.sugar_g ?? '—'}g sugar</p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
