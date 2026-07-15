import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_PROMPT = `You are reading a screenshot of Oura Ring (or similar sleep tracker app) sleep results.

Extract the values EXACTLY as shown — do not estimate or infer anything not visible on screen.

Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{
  "total_sleep_minutes": number or null,
  "light_sleep_minutes": number or null,
  "deep_sleep_minutes": number or null,
  "rem_sleep_minutes": number or null,
  "awake_minutes": number or null,
  "sleep_score": number or null,
  "avg_heart_rate": number or null,
  "avg_respiratory_rate": number or null
}

Convert any hour/minute display (e.g. "7h 32m") to total minutes. If the image doesn't show legible sleep tracker results, return all fields as null.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Screenshot import is not configured on the server yet.' },
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
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `Screenshot read failed: ${errText}` }, { status: 502 })
    }

    const data = await res.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    const rawText: string = textBlock?.text ?? ''
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    const found = parsed.total_sleep_minutes != null || parsed.sleep_score != null

    return NextResponse.json({ found, ...parsed })
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that screenshot. Try a clearer, uncropped shot of the results screen." },
      { status: 502 }
    )
  }
}
