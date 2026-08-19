'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  generateShareToken,
  expirationToDate,
  SHARE_SECTIONS,
  type ExpirationOption,
  type ShareSectionKey,
} from '@/lib/share-token'

interface ShareLink {
  id: string
  token: string
  label: string | null
  sections: string[]
  expires_at: string | null
  revoked_at: string | null
  last_viewed_at: string | null
  created_at: string
}

function statusOf(link: ShareLink): 'active' | 'revoked' | 'expired' {
  if (link.revoked_at) return 'revoked'
  if (link.expires_at && new Date(link.expires_at) < new Date()) return 'expired'
  return 'active'
}

export default function ShareLinksSection() {
  const supabase = createClient()

  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [expiration, setExpiration] = useState<ExpirationOption>('90d')
  const [sections, setSections] = useState<ShareSectionKey[]>(
    SHARE_SECTIONS.map((s) => s.key)
  )
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [justCreatedUrl, setJustCreatedUrl] = useState<string | null>(null)

  async function loadLinks() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { data, error: fetchError } = await supabase
      .from('share_links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) setError(fetchError.message)
    setLinks(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleSection(key: ShareSectionKey) {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    )
  }

  async function handleCreate() {
    if (sections.length === 0) {
      setError('Pick at least one section to share.')
      return
    }
    setError(null)
    setCreating(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You need to be signed in.')
      setCreating(false)
      return
    }

    const token = generateShareToken()

    const { error: insertError } = await supabase.from('share_links').insert({
      user_id: user.id,
      token,
      label: label.trim() || null,
      sections,
      expires_at: expirationToDate(expiration),
    })

    setCreating(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setJustCreatedUrl(`${window.location.origin}/share/${token}`)
    setLabel('')
    setShowForm(false)
    loadLinks()
  }

  async function handleRevoke(id: string) {
    const { error: revokeError } = await supabase
      .from('share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)

    if (revokeError) {
      setError(revokeError.message)
      return
    }
    loadLinks()
  }

  function urlFor(link: ShareLink) {
    return `${window.location.origin}/share/${link.token}`
  }

  async function handleCopy(link: ShareLink) {
    await navigator.clipboard.writeText(urlFor(link))
    setCopiedId(link.id)
    setTimeout(() => setCopiedId((prev) => (prev === link.id ? null : prev)), 2000)
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-neutral-900">Share with a health professional</h2>
        <p className="text-xs text-neutral-600 mt-1">
          Create a read-only link — no login required — showing your recent data.
          Revoke it any time.
        </p>
      </div>

      {justCreatedUrl && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-2">
          <p className="text-xs font-medium text-green-800">
            Link created. Copy it now and send it to them:
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={justCreatedUrl}
              className="flex-1 min-w-0 rounded border border-green-300 bg-white px-2 py-1.5 text-xs text-neutral-900"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(justCreatedUrl)
              }}
              className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setJustCreatedUrl(null)}
            className="text-xs text-green-800 underline"
          >
            Done
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-600">Loading…</p>
      ) : (
        <>
          {links.length > 0 && (
            <div className="space-y-2">
              {links.map((link) => {
                const status = statusOf(link)
                return (
                  <div
                    key={link.id}
                    className="rounded-md border border-neutral-200 px-3 py-2 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {link.label || 'Untitled link'}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : status === 'expired'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {status === 'active' ? 'Active' : status === 'expired' ? 'Expired' : 'Revoked'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">
                      {link.expires_at
                        ? `Expires ${new Date(link.expires_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}`
                        : 'Never expires'}
                      {link.last_viewed_at &&
                        ` · Last viewed ${new Date(link.last_viewed_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}`}
                    </p>
                    {status === 'active' && (
                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => handleCopy(link)}
                          className="text-xs text-neutral-900 underline"
                        >
                          {copiedId === link.id ? 'Copied!' : 'Copy link'}
                        </button>
                        <button
                          onClick={() => handleRevoke(link.id)}
                          className="text-xs text-red-600 underline"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {showForm ? (
            <div className="rounded-md border border-neutral-200 p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Label (optional)
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Dr. Patel"
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Expires
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      ['7d', '7 days'],
                      ['30d', '30 days'],
                      ['90d', '90 days'],
                      ['never', 'Never'],
                    ] as [ExpirationOption, string][]
                  ).map(([value, text]) => (
                    <button
                      key={value}
                      onClick={() => setExpiration(value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                        expiration === value
                          ? 'bg-neutral-900 text-white'
                          : 'border border-neutral-300 text-neutral-700'
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Include
                </label>
                <div className="space-y-1">
                  {SHARE_SECTIONS.map((s) => (
                    <label key={s.key} className="flex items-center gap-2 text-sm text-neutral-800">
                      <input
                        type="checkbox"
                        checked={sections.includes(s.key)}
                        onChange={() => toggleSection(s.key)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create link'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full rounded-md border border-neutral-300 text-sm font-medium py-2 text-neutral-700 hover:bg-neutral-50"
            >
              + New share link
            </button>
          )}
        </>
      )}
    </section>
  )
}
