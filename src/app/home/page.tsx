import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface TopicLink {
  href: string
  title: string
  description: string
}

const topics: TopicLink[] = [
  {
    href: '/dashboard',
    title: 'Dashboard',
    description: 'Daily calorie target and goal weight timeline',
  },
  {
    href: '/meals',
    title: 'Meals',
    description: 'Log food, scan barcodes or nutrition labels, scan your plate',
  },
  {
    href: '/workouts',
    title: 'Workouts',
    description: 'Log sets and reps, see calories burned and exercise trends',
  },
  {
    href: '/body-metrics',
    title: 'Body Metrics',
    description: 'Weight, body fat %, muscle mass, and progress over time',
  },
]

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Health Tracker</h1>

        <div className="space-y-3">
          {topics.map((topic) => (
            <Link
              key={topic.href}
              href={topic.href}
              className="block rounded-lg border border-neutral-200 bg-white p-4 hover:bg-neutral-50"
            >
              <h2 className="text-sm font-semibold text-neutral-900">{topic.title}</h2>
              <p className="text-xs text-neutral-700 mt-1">{topic.description}</p>
            </Link>
          ))}
        </div>

        <p className="text-xs text-neutral-600 text-center pt-4">
          More sections — vitals, medications, device sync — coming soon.
        </p>
      </div>
    </main>
  )
}
