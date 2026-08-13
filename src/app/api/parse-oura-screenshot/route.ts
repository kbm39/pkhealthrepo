import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_PROMPT = `You are reading one or more screenshots of Oura Ring (or similar sleep tracker app) sleep results. Each image may be from a DIFFERENT night — do NOT merge them together. Process each image independently and return one result object per image, in the same order the images were provided.

For each image, extract the values EXACTLY as shown — do not estimate or infer anything not visible on screen. Also report the date the screen is showing: Oura typically shows a relative label like "Today" or "Yesterday", or a specific date/weekday if the person navigated to an earlier night. Report whatever text is shown exactly. If genuinely no date indicator is visible, use null.

If an image doesn't show legible sleep tracker results at all, still include an entry for it with all fields null — the output array must have exactly one entry per input image, in order.

Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{
  "results": [
    {
      "date_label": string or null,
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
      "hrv_first_90_ms": number or null,
      "hrv_last_90_ms": number or null,
      "sleep_latency_minutes": number or null,
      "time_to_get_up_minutes": number or null,
      "interruptions_count": number or null,
      "regularity_rating": string or null,
      "depth_rating": string or null
    }
  ]
}

Convert any hour/minute display (e.g. "7h 32m") to total minutes.`

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
        max_tokens: 300 + images.length * 500,
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((img) => ({
                type: 'image',
                source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 },
              })),
              {
                type: 'text',
                text:
                  images.length > 1
                    ? `There are ${images.length} images above, in order (image 1 first, image ${images.length} last). ` +
                      EXTRACTION_PROMPT
                    : EXTRACTION_PROMPT,
              },
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

    const results = Array.isArray(parsed.results) ? parsed.results : []
    const found = results.some(
      (r: { total_sleep_minutes?: number | null; sleep_score?: number | null }) =>
        r.total_sleep_minutes != null || r.sleep_score != null
    )

    return NextResponse.json({ found, results })
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that screenshot. Try a clearer, uncropped shot of the results screen." },
      { status: 502 }
    )
  }
}
