import { findShareLink, loadSharedHealthData, shareLinkStatus } from '@/lib/shared-health-data'
import { createAdminClient } from '@/lib/supabase/admin'

const privateHeaders = { 'Cache-Control': 'private, no-store' }

function unauthorized() {
  return Response.json({ error: 'A valid share token is required.' }, {
    status: 401,
    headers: { ...privateHeaders, 'WWW-Authenticate': 'Bearer' },
  })
}

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(authorization)?.[1]
  if (!token) return unauthorized()

  try {
    const admin = createAdminClient()
    const link = await findShareLink(admin, token)
    if (!link || shareLinkStatus(link) !== 'active') return unauthorized()

    const data = await loadSharedHealthData(admin, link, { includeProfile: false })
    const sections = new Set(data.sections)

    return Response.json({
      lookbackDays: data.lookbackDays,
      ...(sections.has('body_metrics') && { bodyMetrics: data.bodyMetrics, weightGoal: data.weightGoal }),
      ...(sections.has('vitals') && { vitals: data.vitals }),
      ...(sections.has('workouts') && {
        workouts: data.workouts.map(({ loggedAt, setCount, totalVolume }) => ({
          loggedAt, setCount, totalVolume,
        })),
      }),
      ...(sections.has('sleep') && { sleep: data.sleep }),
      ...(sections.has('activity') && { activity: data.activity }),
      ...(sections.has('swim') && { swim: data.swim }),
      ...(sections.has('meals') && { mealsDaily: data.mealsDaily }),
    }, { headers: privateHeaders })
  } catch {
    return Response.json({ error: 'Health data is temporarily unavailable.' }, {
      status: 503,
      headers: privateHeaders,
    })
  }
}
