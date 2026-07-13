'use client'

import ExerciseTrendChart from '@/components/ExerciseTrendChart'
import { localDateKey } from '@/components/LocalDateTime'

interface RawRow {
  weight_lbs: number | null
  reps: number | null
  exercise_name: string
  logged_at: string
}

export default function ExerciseTrendsView({ rows }: { rows: RawRow[] }) {
  const byExercise = new Map<string, Map<string, { maxWeight: number; volume: number }>>()

  for (const row of rows) {
    const day = localDateKey(row.logged_at)
    const weight = row.weight_lbs ?? 0
    const reps = row.reps ?? 0

    if (!byExercise.has(row.exercise_name)) byExercise.set(row.exercise_name, new Map())
    const dayMap = byExercise.get(row.exercise_name)!

    const existing = dayMap.get(day) ?? { maxWeight: 0, volume: 0 }
    dayMap.set(day, {
      maxWeight: Math.max(existing.maxWeight, weight),
      volume: existing.volume + weight * reps,
    })
  }

  const formatDay = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const exerciseTrends = Array.from(byExercise.entries())
    .map(([name, dayMap]) => ({
      name,
      points: Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date: formatDay(date), ...vals })),
    }))
    .filter((ex) => ex.points.length >= 2)
    .sort((a, b) => a.name.localeCompare(b.name))

  const singleSessionExercises = Array.from(byExercise.keys()).filter(
    (name) => !exerciseTrends.some((ex) => ex.name === name)
  )

  return (
    <div className="space-y-6">
      {exerciseTrends.length === 0 && (
        <p className="text-sm text-neutral-700 text-center py-8">
          Log the same exercise across at least 2 sessions to see a trend here.
        </p>
      )}

      {exerciseTrends.map((ex) => (
        <section key={ex.name} className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900 mb-3">{ex.name}</h2>
          <ExerciseTrendChart data={ex.points} />
        </section>
      ))}

      {singleSessionExercises.length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-xs text-neutral-700">
            Logged once so far — needs a second session to show a trend:{' '}
            {singleSessionExercises.join(', ')}
          </p>
        </section>
      )}
    </div>
  )
}
