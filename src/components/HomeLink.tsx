import Link from 'next/link'

export default function HomeLink() {
  return (
    <Link
      href="/home"
      className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-2"
    >
      ← Home
    </Link>
  )
}
