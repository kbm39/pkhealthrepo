'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface LookupResult {
  found: boolean
  name?: string
  brand?: string | null
  servingSize?: string
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  fiber_g?: number | null
  sugar_g?: number | null
  sodium_mg?: number | null
}

export default function ScanBarcodePage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [barcode, setBarcode] = useState<string | null>(null)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [decoding, setDecoding] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)

  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [quantity, setQuantity] = useState('1')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function triggerCapture() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setScanError(null)
    setResult(null)
    setBarcode(null)
    setDecoding(true)

    try {
      // ZXing decodes directly from an image URL and handles full-resolution
      // photos more reliably than the html5-qrcode file-scan path, which was
      // failing to decode even well-framed, well-lit barcode photos.
      const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import(
        '@zxing/library'
      )

      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
      ])

      const reader = new BrowserMultiFormatReader(hints)
      const imageUrl = URL.createObjectURL(file)

      try {
        const zxingResult = await reader.decodeFromImageUrl(imageUrl)
        const decoded = zxingResult.getText()
        setDecoding(false)
        setBarcode(decoded)
        await lookupBarcode(decoded)
      } finally {
        URL.revokeObjectURL(imageUrl)
      }
    } catch (err) {
      setDecoding(false)
      const detail = err instanceof Error ? err.message : String(err)
      setScanError(
        `Couldn't read a barcode in that photo. (Debug info: ${detail}) Try again with the barcode centered, well-lit, and filling more of the frame.`
      )
    } finally {
      // Reset the input so selecting the same file again still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function lookupBarcode(code: string) {
    setLookupLoading(true)
    try {
      const res = await fetch(`/api/food-lookup/${code}`)
      const data: LookupResult = await res.json()
      setResult(data)
    } catch {
      setResult({ found: false })
    }
    setLookupLoading(false)
  }

  function retake() {
    setBarcode(null)
    setResult(null)
    setScanError(null)
    setSaveError(null)
    triggerCapture()
  }

  async function handleLogMeal() {
    if (!result || !result.found) return
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

    const qty = Number(quantity) || 1

    const { data: newFood, error: foodError } = await supabase
      .from('foods')
      .insert({
        barcode,
        name: result.name,
        brand: result.brand,
        serving_size: 1,
        serving_unit: result.servingSize || 'serving',
        calories: result.calories ?? 0,
        protein_g: result.protein_g,
        carbs_g: result.carbs_g,
        fat_g: result.fat_g,
        fiber_g: result.fiber_g,
        sugar_g: result.sugar_g,
        sodium_mg: result.sodium_mg,
        source: 'barcode_openfoodfacts',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (foodError || !newFood) {
      setSaveError(foodError?.message ?? 'Could not save food.')
      setSaving(false)
      return
    }

    await supabase.from('user_food_bank').upsert(
      {
        user_id: user.id,
        food_id: newFood.id,
        last_logged_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,food_id' }
    )

    const { error: logError } = await supabase.from('meal_logs').insert({
      user_id: user.id,
      food_id: newFood.id,
      food_name_snapshot: result.name,
      meal_type: mealType,
      quantity: qty,
      calories: (result.calories ?? 0) * qty,
      protein_g: result.protein_g != null ? result.protein_g * qty : null,
      carbs_g: result.carbs_g != null ? result.carbs_g * qty : null,
      fat_g: result.fat_g != null ? result.fat_g * qty : null,
      fiber_g: result.fiber_g != null ? result.fiber_g * qty : null,
      sugar_g: result.sugar_g != null ? result.sugar_g * qty : null,
      sodium_mg: result.sodium_mg != null ? result.sodium_mg * qty : null,
      entry_method: 'barcode',
    })

    setSaving(false)

    if (logError) {
      setSaveError(logError.message)
      return
    }

    router.push('/meals')
    router.refresh()
  }

  const showCaptureButton = !barcode && !decoding && !lookupLoading

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Scan barcode</h1>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />

        {showCaptureButton && (
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center space-y-4">
            <p className="text-sm text-neutral-600">
              Take a photo of a product barcode — center it and get it well-lit.
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

        {decoding && (
          <p className="text-sm text-neutral-500 text-center py-8">Reading barcode…</p>
        )}

        {!decoding && lookupLoading && (
          <p className="text-sm text-neutral-500 text-center py-8">Looking up product…</p>
        )}

        {!decoding && !lookupLoading && result && !result.found && (
          <div className="rounded-lg border border-neutral-200 bg-white p-5 text-center space-y-3">
            <p className="text-sm text-neutral-700">
              No product found for barcode {barcode}. Try again or use manual entry instead.
            </p>
            <button
              onClick={retake}
              className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
            >
              Take another photo
            </button>
          </div>
        )}

        {!decoding && !lookupLoading && result?.found && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="font-semibold text-neutral-900">{result.name}</h2>
              {result.brand && <p className="text-sm text-neutral-500">{result.brand}</p>}
              <p className="text-xs text-neutral-400 mt-1">Per {result.servingSize}</p>
              <div className="grid grid-cols-4 gap-2 text-center mt-3">
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {Math.round(result.calories ?? 0)}
                  </p>
                  <p className="text-xs text-neutral-500">cal</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {result.protein_g != null ? Math.round(result.protein_g) : '—'}g
                  </p>
                  <p className="text-xs text-neutral-500">protein</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {result.carbs_g != null ? Math.round(result.carbs_g) : '—'}g
                  </p>
                  <p className="text-xs text-neutral-500">carbs</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {result.fat_g != null ? Math.round(result.fat_g) : '—'}g
                  </p>
                  <p className="text-xs text-neutral-500">fat</p>
                </div>
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

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Quantity (servings)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
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
                  onClick={handleLogMeal}
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
