'use client'

import { useEffect, useState } from 'react'

interface DietCheckResult {
  verdict: 'fits' | 'does_not_fit' | 'unclear'
  reason: string
}

interface DietCheckBadgeProps {
  dietType: string | null
  foodName: string
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  fiber_g?: number | null
  sugar_g?: number | null
}

export default function DietCheckBadge({
  dietType,
  foodName,
  calories,
  protein_g,
  carbs_g,
  fat_g,
  fiber_g,
  sugar_g,
}: DietCheckBadgeProps) {
  const [result, setResult] = useState<DietCheckResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!dietType || !foodName) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setResult(null)

    fetch('/api/check-diet-compatibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        foodName,
        dietType,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        fiber_g,
        sugar_g,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
        } else {
          setResult(data)
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't check diet compatibility.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietType, foodName])

  if (!dietType) return null

  if (loading) {
    return <p className="text-xs text-neutral-600">Checking against {dietType}…</p>
  }

  if (error) {
    return <p className="text-xs text-neutral-600">{error}</p>
  }

  if (!result) return null

  const styles = {
    fits: 'bg-green-50 border-green-200 text-green-800',
    does_not_fit: 'bg-red-50 border-red-200 text-red-800',
    unclear: 'bg-amber-50 border-amber-200 text-amber-800',
  }[result.verdict]

  const label = {
    fits: `✓ Fits ${dietType}`,
    does_not_fit: `✗ Doesn't fit ${dietType}`,
    unclear: `? Unclear for ${dietType}`,
  }[result.verdict]

  return (
    <div className={`text-xs border rounded-md px-3 py-2 ${styles}`}>
      <p className="font-medium">{label}</p>
      <p className="mt-0.5">{result.reason}</p>
    </div>
  )
}
