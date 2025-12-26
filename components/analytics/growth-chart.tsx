'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NewContactsOverTime } from '@/lib/db/queries'

interface GrowthChartProps {
  data: NewContactsOverTime[]
}

export function GrowthChart({ data }: GrowthChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Growth</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
            />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
              labelFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--chart-5)"
              strokeWidth={2}
              dot={{ fill: 'var(--chart-5)', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

