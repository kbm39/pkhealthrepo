import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfTodayISO(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export default async function MealsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: meals } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('logged_at', startOfTodayISO())
    .lte('logged_at', endOfTodayISO())
    .order('logged_at', { ascending: true })

  const mealsList = meals ?? []

  const totals = mealsList.reduce(
    (acc, m) => {
      acc.calories += m.calories ?? 0
      acc.protein_g += m.protein_g ?? 0
      acc.carbs_g += m.carbs_g ?? 0
      acc.fat_g += m.fat_g ?? 0
      return acc
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Today&apos;s Meals</h1>
          <div className="flex gap-2 flex-wrap justify-end">
            <Link
              href="/meals/plate-scan"
              className="rounded-md border border-neutral-300 text-neutral-700 text-sm font-medium px-4 py-2 hover:bg-neutral-50"
            >
              Plate
            </Link>
            <Link
              href="/meals/scan"
              className="rounded-md border border-neutral-300 text-neutral-700 text-sm font-medium px-4 py-2 hover:bg-neutral-50"
            >
              Scan
            </Link>
            <Link
              href="/meals/new"
              className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
            >
              + Add
            </Link>
          </div>
        </div>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-700 mb-2">Today&apos;s totals</h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold text-neutral-900">
                {Math.round(totals.calories)}
              </p>
              <p className="text-xs text-neutral-700">cal</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900">
                {Math.round(totals.protein_g)}g
              </p>
              <p className="text-xs text-neutral-700">protein</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900">
                {Math.round(totals.carbs_g)}g
              </p>
              <p className="text-xs text-neutral-700">carbs</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900">
                {Math.round(totals.fat_g)}g
              </p>
              <p className="text-xs text-neutral-700">fat</p>
            </div>
          </div>
        </section>

        {MEAL_TYPES.map((type) => {
          const items = mealsList.filter((m) => m.meal_type === type)
          if (items.length === 0) return null

          return (
            <section key={type} className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-medium text-neutral-700 mb-3 capitalize">{type}</h2>
              <ul className="space-y-2">
                {items.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-neutral-900">
                        {m.food_name_snapshot ?? 'Food'} {m.quantity !== 1 ? `× ${m.quantity}` : ''}
                      </span>
                      <span className="block text-xs text-neutral-600">
                        {new Date(m.logged_at).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span className="text-neutral-700">{Math.round(m.calories)} cal</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

        {mealsList.length === 0 && (
          <p className="text-sm text-neutral-700 text-center py-8">
            No meals logged today yet. Tap &quot;+ Add&quot; to log your first meal.
          </p>
        )}

        <Link
          href="/dashboard"
          className="block text-center text-sm text-neutral-600 underline underline-offset-2"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}
