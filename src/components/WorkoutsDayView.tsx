'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import WorkoutSetRow from '@/components/WorkoutSetRow'
import { LocalTime, localDateKey, todayDateKey } from '@/components/LocalDateTime'

interface SetEntry {
  id: string
  set_number: number
  weight_lbs: number | null
  reps: number | null
  calories_burned: number | null
  exercise_name: string
}

interface WorkoutLogEntry {
  id: string
  logged_at: string
  sets: SetEntry[]
}

export default function WorkoutsDayView({ logs }: { logs: WorkoutLogEntry[] }) {
  const [selectedDate, setSelectedDate] = useState(todayDateKey())

  const dayLogs = useMemo(
    () => logs.filter((l) => localDateKey(l.logged_at) === selectedDate),
    [logs, selectedDate]
  )

  const totalSets = dayLogs.reduce((sum, l) => sum + l.sets.length, 0)
  const totalVolumeLbs = dayLogs.reduce(
    (sum, l) => sum + l.sets.reduce((s, set) => s + (set.weight_lbs ?? 0) * (set.reps ?? 0), 0),
    0
  )
  const totalCaloriesBurned = dayLogs.reduce(
    (sum, l) => sum + l.sets.reduce((s, set) => s + (set.calories_burned ?? 0), 0),
    0
  )

  function shiftDay(delta: number) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(localDateKey(d.toISOString()))
  }

  const isToday = selectedDate === todayDateKey()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => shiftDay(-1)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          ←
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm flex-1 text-center"
        />
        <button
          onClick={() => shiftDay(1)}
          disabled={isToday}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
        >
          →
        </button>
      </div>
      {!isToday && (
        <button
          onClick={() => setSelectedDate(todayDateKey())}
          className="text-xs text-neutral-600 underline underline-offset-2"
        >
          Jump to today
        </button>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-medium text-neutral-700 mb-2">
          {isToday ? "Today's totals" : 'Totals for this day'}
        </h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-semibold text-neutral-900">{totalSets}</p>
            <p className="text-xs text-neutral-700">sets</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-neutral-900">
              {Math.round(totalVolumeLbs).toLocaleString()}
            </p>
            <p className="text-xs text-neutral-700">lbs lifted</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-neutral-900">
              {Math.round(totalCaloriesBurned)}
            </p>
            <p className="text-xs text-neutral-700">cal burned (est.)</p>
          </div>
        </div>
      </section>

      {dayLogs.map((log) => {
        if (log.sets.length === 0) return null

        const byExercise = new Map<string, SetEntry[]>()
        for (const set of log.sets) {
          if (!byExercise.has(set.exercise_name)) byExercise.set(set.exercise_name, [])
          byExercise.get(set.exercise_name)!.push(set)
        }

        return (
          <section key={log.id} className="rounded-lg border border-neutral-200 bg-white p-5">
            <p className="text-xs text-neutral-600 mb-3">
              <LocalTime iso={log.logged_at} />
            </p>
            <div className="space-y-3">
              {Array.from(byExercise.entries()).map(([exerciseName, exSets]) => (
                <div key={exerciseName}>
                  <p className="text-sm font-medium text-neutral-900">{exerciseName}</p>
                  <ul className="space-y-1 mt-1">
                    {exSets
                      .sort((a, b) => a.set_number - b.set_number)
                      .map((set) => (
                        <WorkoutSetRow
                          key={set.id}
                          id={set.id}
                          setNumber={set.set_number}
                          weightLbs={set.weight_lbs}
                          reps={set.reps}
                          caloriesBurned={set.calories_burned}
                        />
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {dayLogs.length === 0 && (
        <p className="text-sm text-neutral-700 text-center py-8">
          {isToday
            ? 'No workout logged today yet. Tap "+ Log" to get started.'
            : 'No workout logged on this day.'}
        </p>
      )}

      <Link
        href="/dashboard"
        className="block text-center text-sm text-neutral-700 underline underline-offset-2"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
