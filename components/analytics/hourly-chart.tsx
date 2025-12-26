'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HourlyDistribution } from '@/lib/db/queries'

interface HourlyChartProps {
  data: HourlyDistribution[]
}

export function HourlyChart({ data }: HourlyChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Peak Hours</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="hour"
              className="text-xs"
              tickFormatter={(value) => {
                const hour = value % 24
                return `${hour}:00`
              }}
            />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
              labelFormatter={(value) => `${value}:00`}
            />
            <Bar dataKey="count" fill="var(--chart-4)" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

