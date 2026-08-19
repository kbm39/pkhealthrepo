'use client'

import type { ReactNode } from 'react'
import {
  classifyBloodPressure,
  classifyGlucose,
  BP_CATEGORY_LABEL,
  GLUCOSE_CATEGORY_LABEL,
} from '@/lib/vitals-classification'

export interface ShareData {
  fullName: string | null
  linkLabel: string | null
  sections: string[]
  lookbackDays: number
  weightGoal: { goalWeightLbs: number; targetDate: string | null } | null
  bodyMetrics: {
    recorded_at: string
    weight_lbs: number | null
    body_fat_pct: number | null
    skeletal_muscle_mass_lbs: number | null
    lean_mass_lbs: number | null
  }[]
  vitals: {
    recorded_at: string
    vital_type: string
    systolic: number | null
    diastolic: number | null
    heart_rate: number | null
    glucose_mg_dl: number | null
    reading_context: string | null
  }[]
  workouts: { loggedAt: string; notes: string | null; setCount: number; totalVolume: number }[]
  sleep: {
    sleep_date: string
    total_sleep_minutes: number | null
    sleep_score: number | null
    avg_heart_rate: number | null
    avg_respiratory_rate: number | null
  }[]
  activity: {
    activity_date: string
    steps: number | null
    total_calories: number | null
    goal_calories: number | null
    activity_time_minutes: number | null
  }[]
  swim: {
    swim_date: string
    yardage: number | null
    distance_unit: string | null
    duration_minutes: number | null
    avg_heart_rate: number | null
    stroke_type: string | null
  }[]
  mealsDaily: { day: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[]
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** For plain `date` columns (no time component) — anchor at noon to dodge UTC day-boundary shifts. */
function fmtDate(dateOnly: string) {
  return new Date(`${dateOnly}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function minutesToHm(minutes: number | null) {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-3">
      <h2 className="text-sm font-medium text-neutral-900">{title}</h2>
      {children}
    </section>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">No entries in this window.</p>
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-neutral-500">
            {headers.map((h) => (
              <th key={h} className="px-1 py-1 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-neutral-100">
              {row.map((cell, j) => (
                <td key={j} className="px-1 py-1.5 whitespace-nowrap text-neutral-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ShareView({ data }: { data: ShareData }) {
  const has = (key: string) => data.sections.includes(key)

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Read-only health summary
          </p>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {data.fullName || 'PKHealth'}
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            {data.linkLabel && <>Shared with {data.linkLabel} · </>}
            Last {data.lookbackDays} days
          </p>
        </div>

        {has('body_metrics') && (
          <SectionCard title="Body composition">
            {data.weightGoal && (
              <p className="text-xs text-neutral-600">
                Goal weight: {data.weightGoal.goalWeightLbs} lbs
                {data.weightGoal.targetDate && ` by ${fmtDate(data.weightGoal.targetDate)}`}
              </p>
            )}
            <Table
              headers={['Date', 'Weight', 'Body fat %', 'SMM', 'Lean mass']}
              rows={data.bodyMetrics.map((r) => [
                fmtDateTime(r.recorded_at),
                r.weight_lbs != null ? `${r.weight_lbs} lbs` : '—',
                r.body_fat_pct != null ? `${r.body_fat_pct}%` : '—',
                r.skeletal_muscle_mass_lbs != null ? `${r.skeletal_muscle_mass_lbs} lbs` : '—',
                r.lean_mass_lbs != null ? `${r.lean_mass_lbs} lbs` : '—',
              ])}
            />
          </SectionCard>
        )}

        {has('vitals') && (
          <SectionCard title="Blood pressure & glucose">
            <Table
              headers={['Date', 'Type', 'Reading', 'Category']}
              rows={data.vitals.map((r) => {
                if (r.vital_type === 'blood_pressure' && r.systolic != null && r.diastolic != null) {
                  const cat = classifyBloodPressure(r.systolic, r.diastolic)
                  return [
                    fmtDateTime(r.recorded_at),
                    'Blood pressure',
                    `${r.systolic}/${r.diastolic}${r.heart_rate ? ` · ${r.heart_rate} bpm` : ''}`,
                    BP_CATEGORY_LABEL[cat],
                  ]
                }
                if (r.vital_type === 'blood_glucose' && r.glucose_mg_dl != null) {
                  const cat = classifyGlucose(r.glucose_mg_dl, r.reading_context as 'fasting' | 'random' | null)
                  return [
                    fmtDateTime(r.recorded_at),
                    'Glucose',
                    `${r.glucose_mg_dl} mg/dL${r.reading_context ? ` (${r.reading_context})` : ''}`,
                    GLUCOSE_CATEGORY_LABEL[cat],
                  ]
                }
                return [fmtDateTime(r.recorded_at), r.vital_type, '—', '—']
              })}
            />
            <p className="text-[11px] text-neutral-400">
              Categories use AHA blood-pressure and ADA glucose thresholds for reference only —
              not a diagnosis.
            </p>
          </SectionCard>
        )}

        {has('workouts') && (
          <SectionCard title="Strength workouts">
            <Table
              headers={['Date', 'Sets', 'Volume (lbs×reps)', 'Notes']}
              rows={data.workouts.map((r) => [
                fmtDateTime(r.loggedAt),
                r.setCount,
                r.totalVolume.toLocaleString(),
                r.notes || '—',
              ])}
            />
          </SectionCard>
        )}

        {has('sleep') && (
          <SectionCard title="Sleep">
            <Table
              headers={['Date', 'Total sleep', 'Score', 'Avg HR', 'Avg resp. rate']}
              rows={data.sleep.map((r) => [
                fmtDate(r.sleep_date),
                minutesToHm(r.total_sleep_minutes),
                r.sleep_score ?? '—',
                r.avg_heart_rate != null ? `${r.avg_heart_rate} bpm` : '—',
                r.avg_respiratory_rate != null ? `${r.avg_respiratory_rate}/min` : '—',
              ])}
            />
          </SectionCard>
        )}

        {has('activity') && (
          <SectionCard title="Daily activity">
            <Table
              headers={['Date', 'Steps', 'Active minutes', 'Calories / goal']}
              rows={data.activity.map((r) => [
                fmtDate(r.activity_date),
                r.steps?.toLocaleString() ?? '—',
                r.activity_time_minutes ?? '—',
                `${r.total_calories ?? '—'} / ${r.goal_calories ?? '—'}`,
              ])}
            />
          </SectionCard>
        )}

        {has('swim') && (
          <SectionCard title="Swimming">
            <Table
              headers={['Date', 'Distance', 'Duration', 'Avg HR', 'Stroke']}
              rows={data.swim.map((r) => [
                fmtDate(r.swim_date),
                r.yardage != null ? `${r.yardage} ${r.distance_unit ?? 'yards'}` : '—',
                r.duration_minutes != null ? `${r.duration_minutes} min` : '—',
                r.avg_heart_rate != null ? `${r.avg_heart_rate} bpm` : '—',
                r.stroke_type || '—',
              ])}
            />
          </SectionCard>
        )}

        {has('meals') && (
          <SectionCard title="Nutrition (daily totals)">
            <Table
              headers={['Date', 'Calories', 'Protein', 'Carbs', 'Fat']}
              rows={data.mealsDaily.map((r) => [
                fmtDate(r.day),
                Math.round(r.calories),
                `${Math.round(r.protein_g)}g`,
                `${Math.round(r.carbs_g)}g`,
                `${Math.round(r.fat_g)}g`,
              ])}
            />
          </SectionCard>
        )}

        <p className="text-center text-xs text-neutral-400 pt-2">
          Shared via PKHealth · read-only · this link can be revoked by its owner at any time
        </p>
      </div>
    </main>
  )
}
