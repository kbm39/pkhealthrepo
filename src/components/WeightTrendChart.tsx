'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'

interface WeightPoint {
  date: string
  weight: number
}

export default function WeightTrendChart({
  data,
  goalWeight,
}: {
  data: WeightPoint[]
  goalWeight?: number | null
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 15, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
        <Tooltip />
        {goalWeight != null && (
          <ReferenceLine
            y={goalWeight}
            stroke="#16a34a"
            strokeDasharray="4 4"
            label={{ value: 'Goal', fontSize: 10, fill: '#16a34a', position: 'right' }}
          />
        )}
        <Line type="monotone" dataKey="weight" stroke="#171717" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
