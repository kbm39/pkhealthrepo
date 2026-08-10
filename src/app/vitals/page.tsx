import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeLink from '@/components/HomeLink'
import VitalActions from '@/components/VitalActions'
import { LocalDate, LocalTime } from '@/components/LocalDateTime'

const sourceLabels: Record<string, string> = {
  withings_bpm_core: 'Withings BPM Core',
  freestyle_libre: 'FreeStyle Libre',
  manual: 'Manual',
}

export default async function VitalsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: entries } = await supabase
    .from('vitals')
    .select('*')
    .eq('user_id', user.id)
    .order('recorded_at', { ascending: false })

  const allEntries = entries ?? []
  const latestBp = allEntries.find((e) => e.vital_type === 'blood_pressure') ?? null
  const latestGlucose = allEntries.find((e) => e.vital_type === 'blood_glucose') ?? null

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Vitals</h1>
          <Link
            href="/vitals/new"
            className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800"
          >
            + Add
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-xs font-medium text-neutral-600 mb-1">Latest BP</h2>
            {latestBp ? (
              <>
                <p className="text-lg font-semibold text-neutral-900">
                  {latestBp.systolic ?? '—'}/{latestBp.diastolic ?? '—'}
                </p>
                <p className="text-xs text-neutral-600">
                  <LocalDate iso={latestBp.recorded_at} />
                  {latestBp.heart_rate != null && ` · ${latestBp.heart_rate} bpm`}
                </p>
              </>
            ) : (
              <p className="text-sm text-neutral-500">No readings yet</p>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-xs font-medium text-neutral-600 mb-1">Latest Glucose</h2>
            {latestGlucose ? (
              <>
                <p className="text-lg font-semibold text-neutral-900">
                  {latestGlucose.glucose_mg_dl ?? '—'}{' '}
                  <span className="text-xs font-normal text-neutral-600">mg/dL</span>
                </p>
                <p className="text-xs text-neutral-600">
                  <LocalDate iso={latestGlucose.recorded_at} />{' '}
                  <LocalTime iso={latestGlucose.recorded_at} />
                </p>
              </>
            ) : (
              <p className="text-sm text-neutral-500">No readings yet</p>
            )}
          </section>
        </div>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-700 mb-3">History</h2>
          {allEntries.length === 0 ? (
            <p className="text-sm text-neutral-700 text-center py-4">
              No readings yet. Tap &quot;+ Add&quot; to log your first blood pressure or glucose
              reading.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {allEntries.map((entry) => (
                <li key={entry.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-neutral-900">
                      {entry.vital_type === 'blood_pressure'
                        ? `${entry.systolic ?? '—'}/${entry.diastolic ?? '—'} mmHg${
                            entry.heart_rate != null ? ` · ${entry.heart_rate} bpm` : ''
                          }`
                        : `${entry.glucose_mg_dl ?? '—'} mg/dL`}
                      {entry.ecg_result && ` · ${entry.ecg_result}`}
                    </span>
                    <span className="block text-xs text-neutral-600">
                      <LocalDate iso={entry.recorded_at} /> <LocalTime iso={entry.recorded_at} />
                      {' · '}
                      {sourceLabels[entry.source] ?? entry.source}
                    </span>
                  </div>
                  <VitalActions entryId={entry.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href="/dashboard"
          className="block text-center text-sm text-neutral-700 underline underline-offset-2"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}
