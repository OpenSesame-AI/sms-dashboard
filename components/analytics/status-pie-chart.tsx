'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { StatusBreakdown } from '@/lib/db/queries'

interface StatusPieChartProps {
  data: StatusBreakdown[]
}

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export function StatusPieChart({ data }: StatusPieChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Status Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

