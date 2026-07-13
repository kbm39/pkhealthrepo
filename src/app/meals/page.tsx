import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeLink from '@/components/HomeLink'
import MealsDayView from '@/components/MealsDayView'

export default async function MealsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch a wide window (90 days) rather than filtering "today" on the
  // server — the server runs in UTC, so a UTC day boundary doesn't match
  // the user's actual local day. All day filtering happens client-side
  // instead, using the browser's real local timezone.
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: meals } = await supabase
    .from('meal_logs')
    .select('id, food_name_snapshot, meal_type, quantity, calories, protein_g, carbs_g, fat_g, logged_at')
    .eq('user_id', user.id)
    .gte('logged_at', ninetyDaysAgo.toISOString())
    .order('logged_at', { ascending: true })

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Meals</h1>
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

        <MealsDayView entries={meals ?? []} />
      </div>
    </main>
  )
}
