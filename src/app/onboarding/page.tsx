'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ActivityLevel } from '@/lib/calc/calories'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [heightIn, setHeightIn] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [currentWeight, setCurrentWeight] = useState('')
  const [goalWeight, setGoalWeight] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You need to be signed in to continue.')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      sex,
      date_of_birth: dateOfBirth,
      height_in: Number(heightIn),
      activity_level: activityLevel,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    const { error: metricError } = await supabase.from('body_metrics').insert({
      user_id: user.id,
      source: 'manual',
      weight_lbs: Number(currentWeight),
    })

    if (metricError) {
      setError(metricError.message)
      setLoading(false)
      return
    }

    const { error: goalError } = await supabase.from('weight_goals').insert({
      user_id: user.id,
      goal_weight_lbs: Number(goalWeight),
      is_active: true,
    })

    setLoading(false)

    if (goalError) {
      setError(goalError.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">
          Set up your profile
        </h1>
        <p className="text-sm text-neutral-700 mb-6">
          This powers your daily calorie target and goal timeline.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Sex
            </label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as 'male' | 'female')}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Date of birth
            </label>
            <input
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Height (inches)
            </label>
            <input
              type="number"
              required
              value={heightIn}
              onChange={(e) => setHeightIn(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Activity level
            </label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="sedentary">Sedentary (little/no exercise)</option>
              <option value="light">Light (1-3 days/week)</option>
              <option value="moderate">Moderate (3-5 days/week)</option>
              <option value="active">Active (6-7 days/week)</option>
              <option value="very_active">Very active (physical job + training)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Current weight (lbs)
            </label>
            <input
              type="number"
              required
              value={currentWeight}
              onChange={(e) => setCurrentWeight(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Goal weight (lbs)
            </label>
            <input
              type="number"
              required
              value={goalWeight}
              onChange={(e) => setGoalWeight(e.target.value)}
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
            {loading ? 'Saving…' : 'Continue to dashboard'}
          </button>
        </form>
      </div>
    </main>
  )
}
