import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_PROMPT = `You are reading a screenshot of a Withings BPM Core (or Withings Health Mate app) blood pressure reading. There may be multiple screenshots covering different sections of the same reading (main result, ECG detail) — combine everything you see into one result.

Extract the values EXACTLY as shown — do not estimate or infer anything not visible on screen.

Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{
  "systolic": number or null,
  "diastolic": number or null,
  "heart_rate": number or null,
  "ecg_result": string or null (e.g. "Normal sinus rhythm", "Inconclusive", "Atrial fibrillation" — exactly as labeled on screen)
}

If the image doesn't show a legible blood pressure result, return all fields as null.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Screenshot import is not configured on the server yet.' },
      { status: 501 }
    )
  }

  try {
    const body = await request.json()
    const images: { base64: string; mediaType?: string }[] = body.images
      ? body.images
      : body.imageBase64
        ? [{ base64: body.imageBase64, mediaType: body.mediaType }]
        : []

    if (images.length === 0) {
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
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((img) => ({
                type: 'image',
                source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 },
              })),
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

    const found = parsed.systolic != null || parsed.diastolic != null

    return NextResponse.json({ found, ...parsed })
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that screenshot. Try a clearer, uncropped shot of the results screen." },
      { status: 502 }
    )
  }
}
