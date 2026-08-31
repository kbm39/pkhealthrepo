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

// Same shape/mapping logic as /api/food-lookup/[barcode] — kept in sync
// intentionally rather than shared, since the two routes consume different
// Open Food Facts response shapes (single product vs. search results).
function mapProduct(product: OpenFoodFactsProduct) {
  const n = product.nutriments ?? {}
  const usingServing = n['energy-kcal_serving'] != null

  return {
    name: product.product_name || 'Unknown product',
    brand: product.brands || null,
    servingSize: product.serving_size || (usingServing ? 'serving' : '100g'),
    calories: usingServing ? n['energy-kcal_serving']! : n['energy-kcal_100g'] ?? null,
    protein_g: usingServing ? n.proteins_serving ?? null : n.proteins_100g ?? null,
    carbs_g: usingServing ? n.carbohydrates_serving ?? null : n.carbohydrates_100g ?? null,
    fat_g: usingServing ? n.fat_serving ?? null : n.fat_100g ?? null,
    fiber_g: usingServing ? n.fiber_serving ?? null : n.fiber_100g ?? null,
    sugar_g: usingServing ? n.sugars_serving ?? null : n.sugars_100g ?? null,
    sodium_mg:
      (usingServing ? n.sodium_serving : n.sodium_100g) != null
        ? Math.round((usingServing ? n.sodium_serving! : n.sodium_100g!) * 1000)
        : null,
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) {
    return NextResponse.json({ error: 'Enter at least 2 characters' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
        q
      )}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,serving_size,nutriments`,
      { headers: { 'User-Agent': 'HealthTrackerApp/1.0' } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Search failed' }, { status: 502 })
    }

    const data = await res.json()
    const products: OpenFoodFactsProduct[] = data.products ?? []

    // Open Food Facts is user-submitted and many entries are missing a name
    // or calorie value entirely — drop those rather than show useless rows.
    const results = products
      .filter(
        (p) =>
          p.product_name &&
          p.nutriments &&
          (p.nutriments['energy-kcal_100g'] != null || p.nutriments['energy-kcal_serving'] != null)
      )
      .slice(0, 8)
      .map(mapProduct)

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 502 })
  }
}
