import { NextRequest, NextResponse } from 'next/server'

interface OpenFoodFactsProduct {
  product_name?: string
  brands?: string
  serving_size?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    'energy-kcal_serving'?: number
    proteins_100g?: number
    proteins_serving?: number
    carbohydrates_100g?: number
    carbohydrates_serving?: number
    fat_100g?: number
    fat_serving?: number
    fiber_100g?: number
    fiber_serving?: number
    sugars_100g?: number
    sugars_serving?: number
    sodium_100g?: number
    sodium_serving?: number
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ barcode: string }> }
) {
  const { barcode } = await params

  if (!barcode || !/^\d{6,14}$/.test(barcode)) {
    return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,serving_size,nutriments`,
      { headers: { 'User-Agent': 'HealthTrackerApp/1.0' } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Lookup failed' }, { status: 502 })
    }

    const data = await res.json()

    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ found: false })
    }

    const product: OpenFoodFactsProduct = data.product
    const n = product.nutriments ?? {}

    // Prefer per-serving values when Open Food Facts provides them; otherwise
    // fall back to per-100g values (still useful, just labeled accordingly).
    const usingServing = n['energy-kcal_serving'] != null

    return NextResponse.json({
      found: true,
      name: product.product_name || 'Unknown product',
      brand: product.brands || null,
      servingSize: product.serving_size || (usingServing ? 'serving' : '100g'),
      calories: usingServing ? n['energy-kcal_serving'] : n['energy-kcal_100g'] ?? null,
      protein_g: usingServing ? n.proteins_serving : n.proteins_100g ?? null,
      carbs_g: usingServing ? n.carbohydrates_serving : n.carbohydrates_100g ?? null,
      fat_g: usingServing ? n.fat_serving : n.fat_100g ?? null,
      fiber_g: usingServing ? n.fiber_serving : n.fiber_100g ?? null,
      sugar_g: usingServing ? n.sugars_serving : n.sugars_100g ?? null,
      // Open Food Facts reports sodium in grams; convert to mg for our schema.
      sodium_mg:
        (usingServing ? n.sodium_serving : n.sodium_100g) != null
          ? Math.round((usingServing ? n.sodium_serving! : n.sodium_100g!) * 1000)
          : null,
    })
  } catch {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 502 })
  }
}
