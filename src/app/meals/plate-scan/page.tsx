'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resizeImageToBase64 } from '@/lib/image-utils'
import HomeLink from '@/components/HomeLink'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface PlateItem {
  name: string
  estimatedPortion: string
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  include: boolean
}

export default function PlateScanPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [items, setItems] = useState<PlateItem[]>([])
  const [confidenceNote, setConfidenceNote] = useState<string | null>(null)

  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function triggerCapture() {
    fileInputRef.current?.click()
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setScanError(null)
    setItems([])
    setConfidenceNote(null)
    setAnalyzing(true)

    try {
      const { base64, mediaType } = await resizeImageToBase64(file, 1500)
      const res = await fetch('/api/parse-plate-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      })
      const data = await res.json()

      if (!res.ok || !data.found) {
        setScanError(
          data.error ||
            data.confidenceNote ||
            "Couldn't identify any food in that photo. Try a clearer shot, or use manual entry instead."
        )
        setAnalyzing(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      setItems(
        data.items.map((item: Omit<PlateItem, 'include'>) => ({ ...item, include: true }))
      )
      setConfidenceNote(data.confidenceNote)
    } catch {
      setScanError("Couldn't read that photo. Try a clearer, well-lit shot of the plate.")
    }

    setAnalyzing(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function updateItem(index: number, field: keyof PlateItem, value: string | number | boolean) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  function retake() {
    setItems([])
    setConfidenceNote(null)
    setScanError(null)
    setSaveError(null)
    triggerCapture()
  }

  async function handleLogAll() {
    const itemsToLog = items.filter((item) => item.include)
    if (itemsToLog.length === 0) return

    setSaveError(null)
    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSaveError('You need to be signed in to continue.')
      setSaving(false)
      return
    }

    for (const item of itemsToLog) {
      const { data: newFood, error: foodError } = await supabase
        .from('foods')
        .insert({
          name: item.name,
          serving_size: 1,
          serving_unit: item.estimatedPortion || 'serving',
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          source: 'plate_scan_ai',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (foodError || !newFood) {
        setSaveError(foodError?.message ?? 'Could not save one of the items.')
        setSaving(false)
        return
      }

      const { error: logError } = await supabase.from('meal_logs').insert({
        user_id: user.id,
        food_id: newFood.id,
        food_name_snapshot: item.name,
        meal_type: mealType,
        quantity: 1,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        entry_method: 'plate_scan',
      })

      if (logError) {
        setSaveError(logError.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    router.push('/meals')
    router.refresh()
  }

  const totalCalories = items
    .filter((i) => i.include)
    .reduce((sum, i) => sum + (Number(i.calories) || 0), 0)

  const showCaptureButton = items.length === 0 && !analyzing

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Scan your plate</h1>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelected}
          className="hidden"
        />

        {showCaptureButton && (
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center space-y-4">
            <p className="text-sm text-neutral-700">
              Take a photo of your meal — AI will identify each food and estimate nutrition.
              You&apos;ll be able to review and adjust everything before logging.
            </p>
            <button
              onClick={triggerCapture}
              className="rounded-md bg-neutral-900 text-white text-sm font-medium px-6 py-3 hover:bg-neutral-800"
            >
              Take photo
            </button>
            {scanError && (
              <p className="text-sm text-red-600" role="alert">
                {scanError}
              </p>
            )}
          </div>
        )}

        {analyzing && (
          <p className="text-sm text-neutral-700 text-center py-8">Analyzing your plate…</p>
        )}

        {!analyzing && items.length > 0 && (
          <div className="space-y-4">
            {confidenceNote && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {confidenceNote}
              </p>
            )}

            <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-medium text-neutral-700">
                Detected items — tap to adjust
              </h2>

              {items.map((item, i) => (
                <div
                  key={i}
                  className={`border rounded-md p-3 space-y-2 ${
                    item.include ? 'border-neutral-200' : 'border-neutral-100 opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="checkbox"
                      checked={item.include}
                      onChange={(e) => updateItem(i, 'include', e.target.checked)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(i, 'name', e.target.value)}
                        className="w-full font-medium text-sm text-neutral-900 border-b border-transparent focus:border-neutral-300 outline-none"
                      />
                      <input
                        type="text"
                        value={item.estimatedPortion}
                        onChange={(e) => updateItem(i, 'estimatedPortion', e.target.value)}
                        className="w-full text-xs text-neutral-600 border-b border-transparent focus:border-neutral-300 outline-none"
                        placeholder="portion size"
                      />
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] text-neutral-600">cal</label>
                          <input
                            type="number"
                            value={item.calories}
                            onChange={(e) =>
                              updateItem(i, 'calories', Number(e.target.value))
                            }
                            className="w-full rounded border border-neutral-300 px-1.5 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-600">protein</label>
                          <input
                            type="number"
                            value={item.protein_g ?? ''}
                            onChange={(e) =>
                              updateItem(i, 'protein_g', Number(e.target.value))
                            }
                            className="w-full rounded border border-neutral-300 px-1.5 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-600">carbs</label>
                          <input
                            type="number"
                            value={item.carbs_g ?? ''}
                            onChange={(e) =>
                              updateItem(i, 'carbs_g', Number(e.target.value))
                            }
                            className="w-full rounded border border-neutral-300 px-1.5 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-600">fat</label>
                          <input
                            type="number"
                            value={item.fat_g ?? ''}
                            onChange={(e) => updateItem(i, 'fat_g', Number(e.target.value))}
                            className="w-full rounded border border-neutral-300 px-1.5 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                <span className="text-sm font-medium text-neutral-700">Total</span>
                <span className="text-sm font-semibold text-neutral-900">
                  {Math.round(totalCalories)} cal
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Meal</label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              {saveError && (
                <p className="text-sm text-red-600" role="alert">
                  {saveError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={retake}
                  className="flex-1 rounded-md border border-neutral-300 text-neutral-700 text-sm font-medium py-2 hover:bg-neutral-50"
                >
                  Retake
                </button>
                <button
                  onClick={handleLogAll}
                  disabled={saving}
                  className="flex-1 rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Log meal'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
