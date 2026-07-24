import { NextRequest, NextResponse } from 'next/server'

interface EatenItem {
  name: string
  startingPortion: string
  percentEaten: number
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
}

interface BeforeAfterAnalysis {
  items: EatenItem[]
  confidenceNote: string
}

const EXTRACTION_PROMPT = `You are comparing a "before" and "after" photo of the same meal to estimate how much food was actually eaten. The first image is the plate before eating; the second is what's left afterward (which may be an empty plate, scraps, or a partially finished meal).

For each distinct food item visible in the "before" photo:
1. Identify it and estimate its starting portion size and full nutrition (as if it were all eaten).
2. Compare to the "after" photo and estimate what percentage of that specific item remains uneaten.
3. Calculate the eaten amount as (starting nutrition) × (percent eaten / 100).

Be honest about uncertainty — this compounds two visual estimates (starting portion AND how much is left), so it is inherently rougher than a single-photo estimate. Do not imply more precision than two photos can actually support.

Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{
  "items": [
    {
      "name": string,
      "startingPortion": string (e.g. "1 cup rice"),
      "percentEaten": number (0-100),
      "calories": number (the EATEN amount, not the starting amount),
      "protein_g": number or null (eaten amount),
      "carbs_g": number or null (eaten amount),
      "fat_g": number or null (eaten amount)
    }
  ],
  "confidenceNote": string (one honest sentence noting this estimate compounds two visual judgments and could be meaningfully off — more so than a single-photo estimate)
}

If you can't identify matching food in both images, return an empty items array and explain why in confidenceNote.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Plate scanning is not configured on the server yet.' },
      { status: 501 }
    )
  }

  try {
    const { beforeImage, afterImage } = await request.json()

    if (!beforeImage?.base64 || !afterImage?.base64) {
      return NextResponse.json({ error: 'Both before and after images are required' }, { status: 400 })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'BEFORE photo (meal as served):' },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: beforeImage.mediaType || 'image/jpeg',
                  data: beforeImage.base64,
                },
              },
              { type: 'text', text: 'AFTER photo (what remains):' },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: afterImage.mediaType || 'image/jpeg',
                  data: afterImage.base64,
                },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `Comparison failed: ${errText}` }, { status: 502 })
    }

    const data = await res.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    const rawText: string = textBlock?.text ?? ''

    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const parsed: BeforeAfterAnalysis = JSON.parse(cleaned)

    return NextResponse.json({ found: parsed.items.length > 0, ...parsed })
  } catch {
    return NextResponse.json(
      { error: "Couldn't compare those photos. Try clearer, well-lit shots of both the before and after plate." },
      { status: 502 }
    )
  }
}
