import { NextRequest, NextResponse } from 'next/server'

interface ParsedNutrition {
  name: string | null
  servingSize: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
}

const EXTRACTION_PROMPT = `You are reading a photo of a Nutrition Facts label. Extract the values EXACTLY as printed — do not estimate, round differently, or infer anything not shown on the label.

Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{
  "name": string or null (product name if visible on the label/packaging, otherwise null),
  "servingSize": string or null (e.g. "1 cup (240ml)"),
  "calories": number or null,
  "protein_g": number or null,
  "carbs_g": number or null,
  "fat_g": number or null,
  "fiber_g": number or null,
  "sugar_g": number or null,
  "sodium_mg": number or null
}

If the image doesn't show a legible Nutrition Facts label, return all fields as null except leave "name" as whatever text you can see, or null if nothing is legible. Never guess a number that isn't visible.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Nutrition label scanning is not configured on the server yet.' },
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
        max_tokens: 500,
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
      return NextResponse.json(
        { error: `Nutrition label scan failed: ${errText}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    const rawText: string = textBlock?.text ?? ''

    // Defensive parse: strip any accidental markdown fences before JSON.parse.
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const parsed: ParsedNutrition = JSON.parse(cleaned)

    return NextResponse.json({ found: true, ...parsed })
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that label. Try a clearer, well-lit photo." },
      { status: 502 }
    )
  }
}
