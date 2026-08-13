import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeLink from '@/components/HomeLink'

export default async function RecipesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, title, servings, calories, carbs_g, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Recipes</h1>
          <Link
            href="/recipes/new"
            className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
          >
            + Generate
          </Link>
        </div>

        {!recipes || recipes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center">
            <p className="text-sm text-neutral-600">
              No recipes yet. Generate a low-glycemic recipe from ingredients you have or a
              craving.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="block rounded-lg border border-neutral-200 bg-white p-4 hover:bg-neutral-50"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">{recipe.title}</h2>
                    <span className="text-xs text-neutral-600">{recipe.servings} srv</span>
                  </div>
                  <p className="text-xs text-neutral-700 mt-1">
                    {recipe.calories ?? '—'} cal · {recipe.carbs_g ?? '—'}g carbs per serving
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
