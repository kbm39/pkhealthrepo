import { NextRequest, NextResponse } from 'next/server'

interface GeneratedRecipe {
  title: string
  ingredients: { name: string; amount: string; unit: string }[]
  instructions: string[]
  glycemic_notes: string
  nutrition_estimate: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g: number
    sugar_g: number
  }
}

const SYSTEM_CONTEXT = `You write recipes optimized for a low glycemic diet — the goal is to minimize how much a meal spikes blood sugar.

Apply real low-glycemic principles, not just "low carb":
- Favor whole, minimally processed carbohydrate sources (legumes, intact whole grains, non-starchy vegetables) over refined grains, white flour, or added sugar.
- Pair carbohydrates with fiber, protein, and healthy fat, since these blunt the glucose response of a meal as a whole.
- Prefer cooking methods and ingredient forms that raise resistant starch or slow digestion (e.g. al dente pasta, cooled-and-reheated potatoes/rice) where it fits the dish.
- Keep portions of higher-carb ingredients reasonable rather than eliminating carbs entirely.

The user will give you either ingredients they have on hand, a craving or meal-type description, or both. Use whatever they provide. If they gave ingredients, the recipe should center on those (a reasonable pantry staple like salt, oil, or a common spice can be assumed, but don't invent produce/protein they didn't mention). If they gave a craving/meal type, design a dish that fits it. If a diet preference is also given (e.g. vegan, keto), the recipe must also respect that.

Be honest, not flattering — if the requested craving or ingredients push toward something that will spike blood sugar (e.g. "I want white rice and candy"), still generate the best low-glycemic version you reasonably can, and say so plainly in glycemic_notes rather than pretending it's a perfect fit.

Nutrition estimates are approximate — treat them as a best-effort estimate from typical ingredient values, not a lab measurement.

Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{
  "title": string,
  "ingredients": [{ "name": string, "amount": string, "unit": string }],
  "instructions": [string, ...],
  "glycemic_notes": string (2-4 sentences explaining IN PLAIN LANGUAGE why this recipe is/isn't strongly low-glycemic — mention the actual mechanism: fiber, protein/fat pairing, carb type, portion, etc.),
  "nutrition_estimate": {
    "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number, "sugar_g": number
  }
}
All nutrition values are PER SERVING for the requested serving count.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Recipe generation is not configured on the server yet.' },
      { status: 501 }
    )
  }

  try {
    const { inputType, ingredientsText, cravingText, servings, dietType } = await request.json()

    if (!inputType || (inputType !== 'craving' && !ingredientsText) || (inputType !== 'ingredients' && !cravingText)) {
      if (!ingredientsText && !cravingText) {
        return NextResponse.json({ error: 'Give me at least some ingredients or a craving/meal type.' }, { status: 400 })
      }
    }

    const servingCount = Number(servings) > 0 ? Number(servings) : 2

    const promptParts: string[] = [`Servings requested: ${servingCount}`]
    if (ingredientsText) promptParts.push(`Ingredients on hand: ${ingredientsText}`)
    if (cravingText) promptParts.push(`Craving / meal type: ${cravingText}`)
    if (dietType) promptParts.push(`Must also fit this diet: ${dietType}`)
    promptParts.push('Generate a low-glycemic recipe.')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system: SYSTEM_CONTEXT,
        messages: [{ role: 'user', content: promptParts.join('\n') }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `Recipe generation failed: ${errText}` }, { status: 502 })
    }

    const data = await res.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    const rawText: string = textBlock?.text ?? ''
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const parsed: GeneratedRecipe = JSON.parse(cleaned)

    return NextResponse.json({ ...parsed, servings: servingCount })
  } catch {
    return NextResponse.json({ error: "Couldn't generate a recipe right now. Try again." }, { status: 502 })
  }
}
