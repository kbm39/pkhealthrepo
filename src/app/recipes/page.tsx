import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeLink from '@/components/HomeLink'
import RecipesListView from '@/components/RecipesListView'

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
    .select(
      'id, title, servings, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, ingredients, food_id, created_at'
    )
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

        <RecipesListView recipes={recipes ?? []} />
      </div>
    </main>
  )
}
