'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { localDateKey, todayDateKey } from '@/components/LocalDateTime'

interface MealEntry {
  calories: number | null
  logged_at: string
}

interface ActivityEntry {
  activity_date: string
  active_calories: number | null
  activity_type: string | null
}

interface SwimEntry {
  swim_date: string
  active_calories: number | null
}

interface StrengthEntry {
  logged_at: string
  calories_burned: number | null
}

interface Props {
  dailyTarget: number
  meals: MealEntry[]
  activity: ActivityEntry[]
  swims: SwimEntry[]
  strength: StrengthEntry[]
}

export default function TodayEnergyCard({
  dailyTarget,
  meals,
  activity,
  swims,
  strength,
}: Props) {
  const today = todayDateKey()

  const { eaten, burned, sources } = useMemo(() => {
    const eatenTotal = meals
      .filter((m) => localDateKey(m.logged_at) === today)
      .reduce((sum, m) => sum + (m.calories ?? 0), 0)

    const todayActivity = activity.filter((a) => a.activity_date === today)

    // A whole-day Oura entry (no specific activity type) already counts every
    // workout the ring saw that day — so when one exists it becomes the single
    // source of truth, and individually logged sessions are NOT added on top.
    const wholeDay = todayActivity.filter((a) => a.activity_type == null)
    const sessions = todayActivity.filter((a) => a.activity_type != null)

    const breakdown: { label: string; value: number }[] = []
    let burnedTotal = 0

    if (wholeDay.length > 0) {
      burnedTotal = Math.max(...wholeDay.map((a) => a.active_calories ?? 0))
      breakdown.push({ label: 'Oura — full day', value: burnedTotal })
    } else {
      for (const s of sessions) {
        const v = s.active_calories ?? 0
        if (v > 0) {
          burnedTotal += v
          breakdown.push({ label: s.activity_type ?? 'Activity', value: v })
        }
      }

      const swimTotal = swims
        .filter((s) => s.swim_date === today)
        .reduce((sum, s) => sum + (s.active_calories ?? 0), 0)
      if (swimTotal > 0) {
        burnedTotal += swimTotal
        breakdown.push({ label: 'Swim', value: swimTotal })
      }

      const strengthTotal = strength
        .filter((s) => localDateKey(s.logged_at) === today)
        .reduce((sum, s) => sum + (s.calories_burned ?? 0), 0)
      if (strengthTotal > 0) {
        burnedTotal += strengthTotal
        breakdown.push({ label: 'Strength', value: strengthTotal })
      }
    }

    return {
      eaten: Math.round(eatenTotal),
      burned: Math.round(burnedTotal),
      sources: breakdown,
    }
  }, [meals, activity, swims, strength, today])

  const net = eaten - burned
  const remaining = dailyTarget - eaten
  const overTarget = remaining < 0
  const hasWholeDayOura = sources.some((s) => s.label === 'Oura — full day')

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-medium text-neutral-700 mb-3">Today</h2>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xl font-semibold text-neutral-900">
            {eaten.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-700">eaten</p>
        </div>
        <div>
          <p className="text-xl font-semibold text-neutral-900">
            {burned > 0 ? burned.toLocaleString() : '—'}
          </p>
          <p className="text-xs text-neutral-700">burned</p>
        </div>
        <div>
          <p className="text-xl font-semibold text-neutral-900">
            {net.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-700">net</p>
        </div>
      </div>

      <div className="mt-4 border-t border-neutral-200 pt-3">
        <p className="text-sm text-neutral-700">
          {overTarget ? (
            <>
              <span className="font-medium text-neutral-900">
                {Math.abs(remaining).toLocaleString()} cal
              </span>{' '}
              over your {dailyTarget.toLocaleString()} target
            </>
          ) : (
            <>
              <span className="font-medium text-neutral-900">
                {remaining.toLocaleString()} cal
              </span>{' '}
              left of your {dailyTarget.toLocaleString()} target
            </>
          )}
        </p>
      </div>

      {sources.length > 0 && (
        <div className="mt-3 space-y-1">
          {sources.map((s) => (
            <div
              key={s.label}
              className="flex justify-between text-xs text-neutral-700"
            >
              <span>{s.label}</span>
              <span>{Math.round(s.value).toLocaleString()} cal</span>
            </div>
          ))}
          {hasWholeDayOura && (
            <p className="text-xs text-neutral-700 pt-1">
              Full-day figure — any workouts your ring detected are already inside
              this number.
            </p>
          )}
        </div>
      )}

      {burned === 0 && (
        <p className="text-xs text-neutral-700 mt-3">
          No activity logged today yet —{' '}
          <Link href="/workouts/activity/new" className="underline">
            import an Oura screenshot
          </Link>
          .
        </p>
      )}

      <p className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2 mt-3">
        Your target already assumes your usual activity level, so burned calories
        are shown here for context rather than added to your allowance. Treat
        &ldquo;remaining&rdquo; as the number to steer by.
      </p>
    </section>
  )
}
