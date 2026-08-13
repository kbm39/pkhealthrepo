'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HomeLink from '@/components/HomeLink'

type InputType = 'ingredients' | 'craving' | 'both'

export default function NewRecipePage() {
  const router = useRouter()
  const supabase = createClient()

  const [inputType, setInputType] = useState<InputType>('both')
  const [ingredientsText, setIngredientsText] = useState('')
  const [cravingText, setCravingText] = useState('')
  const [servings, setServings] = useState('2')
  const [dietType, setDietType] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDiet() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('diet_type').eq('id', user.id).single()
      if (data?.diet_type) setDietType(data.diet_type)
    }
    loadDiet()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (inputType !== 'craving' && !ingredientsText.trim()) {
      setError('Add the ingredients you have on hand, or switch to "Craving / meal type".')
      return
    }
    if (inputType !== 'ingredients' && !cravingText.trim()) {
      setError('Describe what you\'re craving or the meal type, or switch to "Ingredients on hand".')
      return
    }

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You need to be signed in to continue.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputType,
          ingredientsText: inputType !== 'craving' ? ingredientsText : '',
          cravingText: inputType !== 'ingredients' ? cravingText : '',
          servings,
          dietType,
        }),
      })

      const recipe = await res.json()

      if (!res.ok) {
        setError(recipe.error ?? 'Could not generate a recipe.')
        setLoading(false)
        return
      }

      // Create a linked `foods` row (per-serving values) so this recipe can be
      // re-logged instantly through the same food bank flow as everything else.
      const { data: food, error: foodError } = await supabase
        .from('foods')
        .insert({
          name: recipe.title,
          serving_size: 1,
          serving_unit: 'serving',
          calories: recipe.nutrition_estimate.calories,
          protein_g: recipe.nutrition_estimate.protein_g,
          carbs_g: recipe.nutrition_estimate.carbs_g,
          fat_g: recipe.nutrition_estimate.fat_g,
          fiber_g: recipe.nutrition_estimate.fiber_g,
          sugar_g: recipe.nutrition_estimate.sugar_g,
          source: 'recipe_ai',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (foodError || !food) {
        setError(foodError?.message ?? 'Could not save recipe.')
        setLoading(false)
        return
      }

      const { data: savedRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          user_id: user.id,
          title: recipe.title,
          servings: recipe.servings,
          input_type: inputType,
          input_query: [ingredientsText, cravingText].filter(Boolean).join(' | '),
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          glycemic_notes: recipe.glycemic_notes,
          calories: recipe.nutrition_estimate.calories,
          protein_g: recipe.nutrition_estimate.protein_g,
          carbs_g: recipe.nutrition_estimate.carbs_g,
          fat_g: recipe.nutrition_estimate.fat_g,
          fiber_g: recipe.nutrition_estimate.fiber_g,
          sugar_g: recipe.nutrition_estimate.sugar_g,
          food_id: food.id,
        })
        .select('id')
        .single()

      setLoading(false)

      if (recipeError || !savedRecipe) {
        setError(recipeError?.message ?? 'Could not save recipe.')
        return
      }

      router.push(`/recipes/${savedRecipe.id}`)
      router.refresh()
    } catch {
      setError("Couldn't generate a recipe right now. Try again.")
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Generate a recipe</h1>
        <p className="text-sm text-neutral-600">
          Low-glycemic recipes built to fit what you have or what you&apos;re craving
          {dietType ? ` (and your ${dietType} preference)` : ''}.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              What should drive this recipe?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['ingredients', 'craving', 'both'] as InputType[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setInputType(opt)}
                  className={`rounded-md border px-2 py-2 text-xs font-medium capitalize ${
                    inputType === opt
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {opt === 'ingredients' ? 'Ingredients' : opt === 'craving' ? 'Craving' : 'Both'}
                </button>
              ))}
            </div>
          </div>

          {inputType !== 'craving' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Ingredients on hand
              </label>
              <textarea
                value={ingredientsText}
                onChange={(e) => setIngredientsText(e.target.value)}
                rows={3}
                placeholder="e.g. chicken thighs, spinach, canned black beans, greek yogurt"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {inputType !== 'ingredients' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Craving / meal type
              </label>
              <input
                type="text"
                value={cravingText}
                onChange={(e) => setCravingText(e.target.value)}
                placeholder="e.g. something warm and Italian for dinner"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Servings</label>
            <input
              type="number"
              min="1"
              step="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
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
            disabled={loading}
            className="w-full rounded-md bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate recipe'}
          </button>
        </form>
      </div>
    </main>
  )
}
