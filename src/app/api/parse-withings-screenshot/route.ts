import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_PROMPT = `You are reading screenshots of Withings Sleep Analyzer (or Withings Health Mate app) sleep results. There may be multiple screenshots covering different sections of the same night's results (duration/stages, snoring/HRV, heart rate/breathing, sleep quality score breakdown) — combine everything you see into one result.

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
  "avg_respiratory_rate": number or null,
  "respiratory_rate_min": number or null,
  "respiratory_rate_max": number or null,
  "snoring_minutes": number or null,
  "hrv_first_90_ms": number or null,
  "hrv_last_90_ms": number or null,
  "sleep_latency_minutes": number or null,
  "time_to_get_up_minutes": number or null,
  "interruptions_count": number or null,
  "regularity_rating": string or null (e.g. "Good", "Fair", "Poor" — as shown),
  "depth_rating": string or null (e.g. "Good", "Fair", "Poor" — as shown),
  "breathing_quality_assessment": string or null (e.g. "Optimal", "Good", "Poor" — as shown)
}

Convert any hour/minute display (e.g. "7h 32m") to total minutes. "Time to sleep" maps to sleep_latency_minutes. "Time to get up" maps to time_to_get_up_minutes. "Interruptions" maps to interruptions_count. HRV values shown as "Average (first 90 min)" and "Average (last 90 min)" map to hrv_first_90_ms and hrv_last_90_ms respectively. If the images don't show legible sleep tracker results, return all fields as null.`

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
    // Accept either a single image (legacy) or an array of images (a full
    // night's Withings results is usually spread across several screens).
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
        max_tokens: 500,
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

    const found = parsed.total_sleep_minutes != null || parsed.sleep_score != null

    return NextResponse.json({ found, ...parsed })
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that screenshot. Try a clearer, uncropped shot of the results screen." },
      { status: 502 }
    )
  }
}
