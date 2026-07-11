import { NextRequest, NextResponse } from 'next/server'

interface DietCheckResult {
  verdict: 'fits' | 'does_not_fit' | 'unclear'
  reason: string
}

const SYSTEM_CONTEXT = `You are evaluating whether a specific food fits a named diet. Use your general knowledge of what that diet actually permits or restricts (e.g., keto restricts carbs heavily, vegan excludes all animal products, paleo excludes grains/legumes/dairy, Mediterranean emphasizes whole foods and limits processed items and red meat).

Be honest and direct — do not soften a "does not fit" verdict to be agreeable, and do not guess if the food name and nutrition data genuinely aren't enough to tell (for example, "chicken sandwich" could be whole-grain or white bread, which matters for some diets — say so rather than assuming).

Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{
  "verdict": "fits" | "does_not_fit" | "unclear",
  "reason": string (one concise, honest sentence explaining why)
}`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Diet checking is not configured on the server yet.' },
      { status: 501 }
    )
  }

  try {
    const { foodName, dietType, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g } =
      await request.json()

    if (!foodName || !dietType) {
      return NextResponse.json({ error: 'Missing food name or diet type' }, { status: 400 })
    }

    const prompt = `Diet: ${dietType}

Food: ${foodName}
Nutrition (best available data, may be partial): calories ${calories ?? 'unknown'}, protein ${protein_g ?? 'unknown'}g, carbs ${carbs_g ?? 'unknown'}g, fat ${fat_g ?? 'unknown'}g, fiber ${fiber_g ?? 'unknown'}g, sugar ${sugar_g ?? 'unknown'}g.

Does this food fit the diet?`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        system: SYSTEM_CONTEXT,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `Diet check failed: ${errText}` }, { status: 502 })
    }

    const data = await res.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    const rawText: string = textBlock?.text ?? ''
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const parsed: DietCheckResult = JSON.parse(cleaned)

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Could not evaluate this food right now.' }, { status: 502 })
  }
}
