import { NextRequest, NextResponse } from 'next/server'

interface PlateItem {
  name: string
  estimatedPortion: string
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
}

interface PlateAnalysis {
  items: PlateItem[]
  confidenceNote: string
}

const EXTRACTION_PROMPT = `You are looking at a photo of a plate or meal. Identify each distinct food item and estimate its portion size and nutrition.

Important: this is a visual estimate, not a precise measurement. Be honest and reasonable — use typical serving sizes for what you see, and don't imply more precision than a photo can actually give.

Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{
  "items": [
    {
      "name": string,
      "estimatedPortion": string (e.g. "1 cup", "6 oz grilled"),
      "calories": number,
      "protein_g": number or null,
      "carbs_g": number or null,
      "fat_g": number or null
    }
  ],
  "confidenceNote": string (one honest sentence about estimation uncertainty, e.g. "Portion sizes and hidden ingredients like oil or sauce are estimated and could shift totals by 20% or more.")
}

If you can't identify any food in the image, return an empty items array and explain why in confidenceNote.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Plate scanning is not configured on the server yet.' },
      { status: 501 }
    )
  }

  try {
    const { imageBase64, mediaType } = await request.json()

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
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
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'image/jpeg',
                  data: imageBase64,
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
      return NextResponse.json({ error: `Plate scan failed: ${errText}` }, { status: 502 })
    }

    const data = await res.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    const rawText: string = textBlock?.text ?? ''

    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const parsed: PlateAnalysis = JSON.parse(cleaned)

    return NextResponse.json({ found: parsed.items.length > 0, ...parsed })
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that photo. Try a clearer, well-lit shot of the plate." },
      { status: 502 }
    )
  }
}
