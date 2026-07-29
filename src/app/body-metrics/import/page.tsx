'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import {
  KG_TO_LBS,
  detectColumn,
  detectUnit,
  toIsoDate,
  toNumber,
  type Field,
} from '@/lib/inbody-csv'
import HomeLink from '@/components/HomeLink'

interface ParsedRow {
  recorded_at: string
  weight_lbs: number | null
  body_fat_pct: number | null
  body_fat_lbs: number | null
  skeletal_muscle_mass_lbs: number | null
  lean_mass_lbs: number | null
  include: boolean
}

export default function ImportBodyMetricsPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<Field, string>>({
    date: '', weight: '', bodyFatPct: '', bodyFatMass: '', smm: '', leanMass: '',
  })
  const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [skipped, setSkipped] = useState(0)

  function buildRows(
    data: Record<string, string>[],
    map: Record<Field, string>,
    u: 'kg' | 'lbs'
  ) {
    const factor = u === 'kg' ? KG_TO_LBS : 1
    const convert = (v: number | null) => (v == null ? null : Math.round(v * factor * 10) / 10)

    const built: ParsedRow[] = []
    let dropped = 0

    for (const r of data) {
      const recordedAt = toIsoDate(map.date ? r[map.date] : null)
      const weight = convert(toNumber(map.weight ? r[map.weight] : null))
      const bfPct = toNumber(map.bodyFatPct ? r[map.bodyFatPct] : null)
      const bfMass = convert(toNumber(map.bodyFatMass ? r[map.bodyFatMass] : null))
      const smm = convert(toNumber(map.smm ? r[map.smm] : null))
      const lean = convert(toNumber(map.leanMass ? r[map.leanMass] : null))

      // A row with no date or no measurements at all isn't worth importing.
      if (!recordedAt || (weight == null && bfPct == null && smm == null && lean == null)) {
        dropped++
        continue
      }

      built.push({
        recorded_at: recordedAt,
        weight_lbs: weight,
        body_fat_pct: bfPct,
        body_fat_lbs: bfMass,
        skeletal_muscle_mass_lbs: smm,
        lean_mass_lbs: lean,
        include: true,
      })
    }

    built.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    setRows(built)
    setSkipped(dropped)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setRows([])
    setSkipped(0)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const cols = (results.meta.fields ?? []).filter(Boolean)
        if (cols.length === 0) {
          setError('That file has no readable column headers.')
          return
        }

        const detected: Record<Field, string> = {
          date: detectColumn(cols, 'date') ?? '',
          weight: detectColumn(cols, 'weight') ?? '',
          bodyFatPct: detectColumn(cols, 'bodyFatPct') ?? '',
          bodyFatMass: detectColumn(cols, 'bodyFatMass') ?? '',
          smm: detectColumn(cols, 'smm') ?? '',
          leanMass: detectColumn(cols, 'leanMass') ?? '',
        }

        const detectedUnit = detectUnit(detected.weight) ?? detectUnit(detected.smm) ?? 'lbs'

        setHeaders(cols)
        setRawRows(results.data)
        setMapping(detected)
        setUnit(detectedUnit)
        buildRows(results.data, detected, detectedUnit)

        if (!detected.date) {
          setError('Couldn\u2019t spot a date column — pick one below.')
        }
      },
      error: () => setError('That file couldn\u2019t be read as a CSV.'),
    })
  }

  function updateMapping(field: Field, column: string) {
    const next = { ...mapping, [field]: column }
    setMapping(next)
    setError(null)
    buildRows(rawRows, next, unit)
  }

  function updateUnit(u: 'kg' | 'lbs') {
    setUnit(u)
    buildRows(rawRows, mapping, u)
  }

  function toggleRow(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, include: !r.include } : r))
    )
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.include)
    if (selected.length === 0) {
      setError('Nothing selected to import.')
      return
    }

    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You need to be signed in.')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('body_metrics').insert(
      selected.map((r) => ({
        user_id: user.id,
        recorded_at: r.recorded_at,
        source: 'inbody_csv',
        weight_lbs: r.weight_lbs,
        body_fat_pct: r.body_fat_pct,
        body_fat_lbs: r.body_fat_lbs,
        skeletal_muscle_mass_lbs: r.skeletal_muscle_mass_lbs,
        lean_mass_lbs: r.lean_mass_lbs,
      }))
    )

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    router.push('/body-metrics')
    router.refresh()
  }

  const selectedCount = rows.filter((r) => r.include).length

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <HomeLink />
        <h1 className="text-2xl font-semibold text-neutral-900">Import InBody CSV</h1>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
          <p className="text-sm text-neutral-700">
            Export your results from the InBody app or Lookin&rsquo;Body, then select
            the CSV here. Columns are matched automatically — you can correct them
            below before importing.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-800"
          />

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </section>

        {headers.length > 0 && (
          <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-medium text-neutral-700">Columns</h2>

            {(
              [
                ['date', 'Date'],
                ['weight', 'Weight'],
                ['bodyFatPct', 'Body fat %'],
                ['bodyFatMass', 'Body fat mass'],
                ['smm', 'Skeletal muscle mass'],
                ['leanMass', 'Lean / fat-free mass'],
              ] as [Field, string][]
            ).map(([field, label]) => (
              <div key={field} className="flex items-center justify-between gap-3">
                <label className="text-sm text-neutral-700">{label}</label>
                <select
                  value={mapping[field]}
                  onChange={(e) => updateMapping(field, e.target.value)}
                  className="flex-1 max-w-[55%] rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
                >
                  <option value="">— not in file —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-3">
              <label className="text-sm text-neutral-700">Weights are in</label>
              <div className="flex gap-2">
                {(['lbs', 'kg'] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => updateUnit(u)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      unit === u
                        ? 'bg-neutral-900 text-white'
                        : 'border border-neutral-300 text-neutral-700'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {unit === 'kg' && (
              <p className="text-xs text-neutral-700">
                Values will be converted to pounds on import.
              </p>
            )}
          </section>
        )}

        {rows.length > 0 && (
          <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-700">
                Preview — {selectedCount} of {rows.length} selected
              </h2>
              <button
                onClick={() =>
                  setRows((prev) => {
                    const allOn = prev.every((r) => r.include)
                    return prev.map((r) => ({ ...r, include: !allOn }))
                  })
                }
                className="text-xs text-neutral-700 underline"
              >
                Toggle all
              </button>
            </div>

            {skipped > 0 && (
              <p className="text-xs text-neutral-700">
                {skipped} row{skipped === 1 ? '' : 's'} skipped — no date or no
                measurements.
              </p>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {rows.map((r, i) => (
                <label
                  key={`${r.recorded_at}-${i}`}
                  className="flex items-start gap-3 rounded-md border border-neutral-200 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={() => toggleRow(i)}
                    className="mt-1"
                  />
                  <div className="text-sm">
                    <p className="font-medium text-neutral-900">
                      {new Date(r.recorded_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-neutral-700">
                      {r.weight_lbs != null && `${r.weight_lbs} lbs`}
                      {r.body_fat_pct != null && ` · ${r.body_fat_pct}% fat`}
                      {r.skeletal_muscle_mass_lbs != null &&
                        ` · ${r.skeletal_muscle_mass_lbs} lbs SMM`}
                      {r.lean_mass_lbs != null && ` · ${r.lean_mass_lbs} lbs lean`}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={handleImport}
              disabled={saving || selectedCount === 0}
              className="w-full rounded-md bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving
                ? 'Importing…'
                : `Import ${selectedCount} measurement${selectedCount === 1 ? '' : 's'}`}
            </button>
          </section>
        )}
      </div>
    </main>
  )
}
