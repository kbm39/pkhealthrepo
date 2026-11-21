import { createAdminClient } from '@/lib/supabase/admin'
import ShareView from '@/components/ShareView'
import { findShareLink, loadSharedHealthData, shareLinkStatus } from '@/lib/shared-health-data'

function InvalidLink({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-2">
        <h1 className="text-lg font-semibold text-neutral-900">Link unavailable</h1>
        <p className="text-sm text-neutral-600">{message}</p>
      </div>
    </main>
  )
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const link = await findShareLink(admin, token)
  const status = shareLinkStatus(link)
  if (!link) {
    return <InvalidLink message="This link doesn't exist. Double-check the URL you were sent." />
  }
  if (status === 'revoked') {
    return <InvalidLink message="This link has been revoked by its owner." />
  }
  if (status === 'expired') {
    return <InvalidLink message="This link has expired. Ask for a new one." />
  }

  const data = await loadSharedHealthData(admin, link)

  // Best-effort — don't fail the page render if this write fails.
  admin
    .from('share_links')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', link.id)
    .then(() => {})

  return <ShareView data={data} />
}
