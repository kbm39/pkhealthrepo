import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_PROMPT = `You are reading screenshots of Oura Ring (or similar wearable app) activity/exercise results. There may be multiple screenshots covering different sections of the same day — combine everything you see into one result.

Extract the values EXACTLY as shown — do not estimate or infer anything not visible on screen. Capture EVERY category shown, including:
- Steps
- Total Burn (total calories for the day)
- Goal Progress (e.g. "936 / 450 Cal" — the first number is progress toward the goal, the second is the goal target itself)
- Activity Time (total daily active/exercise time, e.g. "1h 16m")
- EVERY individual activity/workout listed (e.g. Swimming, Strength training) — there may be more than one, including duplicates of the same type at different times. For each one capture: the activity name, the clock time it started (exactly as shown, e.g. "8:17 AM"), its duration, its calories, and its average heart rate if shown (use null if the heart rate is blank or shown as "–").

Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{
  "steps": number or null,
  "total_calories": number or null,
  "goal_progress_calories": number or null,
  "goal_target_calories": number or null,
  "activity_time_minutes": number or null,
  "activities": [
    {
      "activity_type": string,
      "time_of_day": string or null (exactly as shown, e.g. "8:17 AM"),
      "duration_minutes": number or null,
      "calories": number or null,
      "avg_heart_rate": number or null
    }
  ]
}

If the screenshot doesn't show a given category, leave it null. If no individual activities are visible, return an empty array for "activities". If nothing legible is found at all, return all fields null and an empty activities array.`

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
        max_tokens: 1200,
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

    const found =
      parsed.steps != null ||
      parsed.total_calories != null ||
      parsed.goal_progress_calories != null ||
      parsed.activity_time_minutes != null ||
      (Array.isArray(parsed.activities) && parsed.activities.length > 0)

    return NextResponse.json({ found, ...parsed, activities: parsed.activities ?? [] })
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that screenshot. Try a clearer, uncropped shot of the results screen." },
      { status: 502 }
    )
  }
}
