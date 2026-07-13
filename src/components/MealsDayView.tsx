'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import MealActions from '@/components/MealActions'
import { LocalTime, localDateKey, todayDateKey } from '@/components/LocalDateTime'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

interface MealLogEntry {
  id: string
  food_name_snapshot: string | null
  meal_type: string
  quantity: number
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  logged_at: string
}

export default function MealsDayView({ entries }: { entries: MealLogEntry[] }) {
  const [selectedDate, setSelectedDate] = useState(todayDateKey())

  const dayEntries = useMemo(
    () => entries.filter((e) => localDateKey(e.logged_at) === selectedDate),
    [entries, selectedDate]
  )

  const totals = dayEntries.reduce(
    (acc, m) => {
      acc.calories += m.calories ?? 0
      acc.protein_g += m.protein_g ?? 0
      acc.carbs_g += m.carbs_g ?? 0
      acc.fat_g += m.fat_g ?? 0
      return acc
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
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
        const items = dayEntries.filter((m) => m.meal_type === type)
        if (items.length === 0) return null

        return (
          <section key={type} className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-medium text-neutral-700 mb-3 capitalize">{type}</h2>
            <ul className="space-y-2">
              {items.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm gap-2">
                  <div>
                    <span className="text-neutral-900">
                      {m.food_name_snapshot ?? 'Food'} {m.quantity !== 1 ? `× ${m.quantity}` : ''}
                    </span>
                    <span className="block text-xs text-neutral-600">
                      <LocalTime iso={m.logged_at} />
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-neutral-700">{Math.round(m.calories)} cal</span>
                    <MealActions mealLogId={m.id} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {dayEntries.length === 0 && (
        <p className="text-sm text-neutral-700 text-center py-8">
          {isToday
            ? 'No meals logged today yet. Tap "+ Add" to log your first meal.'
            : 'No meals logged on this day.'}
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
