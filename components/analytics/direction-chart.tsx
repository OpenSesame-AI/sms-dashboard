'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MessagesByDirection } from '@/lib/db/queries'

interface DirectionChartProps {
  data: MessagesByDirection[]
}

export function DirectionChart({ data }: DirectionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inbound vs Outbound Messages</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
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
            <Legend />
            <Bar
              dataKey="inbound"
              stackId="messages"
              fill="var(--chart-2)"
              name="Inbound"
            />
            <Bar
              dataKey="outbound"
              stackId="messages"
              fill="var(--chart-3)"
              name="Outbound"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

