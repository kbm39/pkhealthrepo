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

/**
 * Resizes an image file down to a max dimension and returns a data URL.
 * Full-resolution phone photos (3000-4000px wide) can hurt 1D barcode
 * decoding more than help it — this brings it down to a size the decoder
 * handles reliably while preserving enough detail to read the barcode.
 */
function resizeImageForDecoding(file: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not process image'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image'))
    }

    img.src = objectUrl
  })
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

  // Manual barcode entry — offered when photo decoding fails.
  const [manualBarcodeEntry, setManualBarcodeEntry] = useState('')

  // Manual nutrition entry — offered when a barcode is known but not found
  // in Open Food Facts. Saving this attaches the barcode to a new food
  // record, so scanning the same product again will find it instantly.
  const [manualName, setManualName] = useState('')
  const [manualCalories, setManualCalories] = useState('')
  const [manualProtein, setManualProtein] = useState('')
  const [manualCarbs, setManualCarbs] = useState('')
  const [manualFat, setManualFat] = useState('')

  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [quantity, setQuantity] = useState('1')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function triggerCapture() {
    fileInputRef.current?.click()
  }

  async function decodeAndLookup(file: File) {
    setScanError(null)
    setResult(null)
    setBarcode(null)
    setDecoding(true)

    try {
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
      hints.set(DecodeHintType.TRY_HARDER, true)

      const reader = new BrowserMultiFormatReader(hints)
      const resizedDataUrl = await resizeImageForDecoding(file, 1000)

      const zxingResult = await reader.decodeFromImageUrl(resizedDataUrl)
      const decoded = zxingResult.getText()
      setDecoding(false)
      setBarcode(decoded)
      await lookupBarcode(decoded)
    } catch {
      setDecoding(false)
      setScanError(
        "Couldn't read a barcode in that photo. Try again, or type the barcode number in below."
      )
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await decodeAndLookup(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleManualBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = manualBarcodeEntry.trim()
    if (!code) return
    setScanError(null)
    setBarcode(code)
    await lookupBarcode(code)
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
    setManualBarcodeEntry('')
    setManualName('')
    setManualCalories('')
    setManualProtein('')
    setManualCarbs('')
    setManualFat('')
  }

  async function saveFoodAndLog(foodData: {
    name: string
    brand?: string | null
    servingSize?: string
    calories: number
    protein_g?: number | null
    carbs_g?: number | null
    fat_g?: number | null
    fiber_g?: number | null
    sugar_g?: number | null
    sodium_mg?: number | null
    source: 'barcode_openfoodfacts' | 'manual'
  }) {
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
        name: foodData.name,
        brand: foodData.brand ?? null,
        serving_size: 1,
        serving_unit: foodData.servingSize || 'serving',
        calories: foodData.calories,
        protein_g: foodData.protein_g ?? null,
        carbs_g: foodData.carbs_g ?? null,
        fat_g: foodData.fat_g ?? null,
        fiber_g: foodData.fiber_g ?? null,
        sugar_g: foodData.sugar_g ?? null,
        sodium_mg: foodData.sodium_mg ?? null,
        source: foodData.source,
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
      food_name_snapshot: foodData.name,
      meal_type: mealType,
      quantity: qty,
      calories: foodData.calories * qty,
      protein_g: foodData.protein_g != null ? foodData.protein_g * qty : null,
      carbs_g: foodData.carbs_g != null ? foodData.carbs_g * qty : null,
      fat_g: foodData.fat_g != null ? foodData.fat_g * qty : null,
      fiber_g: foodData.fiber_g != null ? foodData.fiber_g * qty : null,
      sugar_g: foodData.sugar_g != null ? foodData.sugar_g * qty : null,
      sodium_mg: foodData.sodium_mg != null ? foodData.sodium_mg * qty : null,
      entry_method: barcode ? 'barcode' : 'manual',
    })

    setSaving(false)

    if (logError) {
      setSaveError(logError.message)
      return
    }

    router.push('/meals')
    router.refresh()
  }

  async function handleLogMeal() {
    if (!result || !result.found) return
    await saveFoodAndLog({
      name: result.name ?? 'Unknown product',
      brand: result.brand,
      servingSize: result.servingSize,
      calories: result.calories ?? 0,
      protein_g: result.protein_g,
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
      fiber_g: result.fiber_g,
      sugar_g: result.sugar_g,
      sodium_mg: result.sodium_mg,
      source: 'barcode_openfoodfacts',
    })
  }

  async function handleManualNutritionSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualName || !manualCalories) return
    await saveFoodAndLog({
      name: manualName,
      calories: Number(manualCalories),
      protein_g: manualProtein ? Number(manualProtein) : null,
      carbs_g: manualCarbs ? Number(manualCarbs) : null,
      fat_g: manualFat ? Number(manualFat) : null,
      source: 'manual',
    })
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
              <div className="space-y-3 pt-2 border-t border-neutral-100">
                <p className="text-sm text-red-600" role="alert">
                  {scanError}
                </p>
                <form onSubmit={handleManualBarcodeSubmit} className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Type barcode number"
                    value={manualBarcodeEntry}
                    onChange={(e) => setManualBarcodeEntry(e.target.value)}
                    className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
                  >
                    Look up
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {decoding && (
          <p className="text-sm text-neutral-700 text-center py-8">Reading barcode…</p>
        )}

        {!decoding && lookupLoading && (
          <p className="text-sm text-neutral-700 text-center py-8">Looking up product…</p>
        )}

        {!decoding && !lookupLoading && result && !result.found && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-5 text-center">
              <p className="text-sm text-neutral-700">
                No product found for barcode {barcode}. Enter it manually below — this will save
                it so scanning this barcode again works instantly next time.
              </p>
            </div>

            <form
              onSubmit={handleManualNutritionSubmit}
              className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Food name
                </label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Calories
                  </label>
                  <input
                    type="number"
                    required
                    value={manualCalories}
                    onChange={(e) => setManualCalories(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    value={manualProtein}
                    onChange={(e) => setManualProtein(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    value={manualCarbs}
                    onChange={(e) => setManualCarbs(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Fat (g)
                  </label>
                  <input
                    type="number"
                    value={manualFat}
                    onChange={(e) => setManualFat(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Meal
                </label>
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
                  type="button"
                  onClick={retake}
                  className="flex-1 rounded-md border border-neutral-300 text-neutral-700 text-sm font-medium py-2 hover:bg-neutral-50"
                >
                  Start over
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save & log meal'}
                </button>
              </div>
            </form>
          </div>
        )}

        {!decoding && !lookupLoading && result?.found && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="font-semibold text-neutral-900">{result.name}</h2>
              {result.brand && <p className="text-sm text-neutral-700">{result.brand}</p>}
              <p className="text-xs text-neutral-600 mt-1">Per {result.servingSize}</p>
              <div className="grid grid-cols-4 gap-2 text-center mt-3">
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {Math.round(result.calories ?? 0)}
                  </p>
                  <p className="text-xs text-neutral-700">cal</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {result.protein_g != null ? Math.round(result.protein_g) : '—'}g
                  </p>
                  <p className="text-xs text-neutral-700">protein</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {result.carbs_g != null ? Math.round(result.carbs_g) : '—'}g
                  </p>
                  <p className="text-xs text-neutral-700">carbs</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {result.fat_g != null ? Math.round(result.fat_g) : '—'}g
                  </p>
                  <p className="text-xs text-neutral-700">fat</p>
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
