'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MealActions({ mealLogId }: { mealLogId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    await supabase.from('meal_logs').delete().eq('id', mealLogId)
    setDeleting(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Link
        href={`/meals/edit/${mealLogId}`}
        className="text-xs text-neutral-600 underline underline-offset-2"
      >
        Edit
      </Link>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs text-red-600 underline underline-offset-2 disabled:opacity-50"
      >
        {deleting ? '…' : confirming ? 'Confirm?' : 'Delete'}
      </button>
    </div>
  )
}
