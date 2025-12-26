'use client'

import * as React from 'react'
import { StatCard } from '@/components/analytics/stat-card'
import { MessagesChart } from '@/components/analytics/messages-chart'
import { DirectionChart } from '@/components/analytics/direction-chart'
import { StatusPieChart } from '@/components/analytics/status-pie-chart'
import { HourlyChart } from '@/components/analytics/hourly-chart'
import { TopContactsTable } from '@/components/analytics/top-contacts-table'
import { GrowthChart } from '@/components/analytics/growth-chart'
import { MessageSquare, Users, ArrowDownCircle, CheckCircle2 } from 'lucide-react'
import type {
  AnalyticsSummary,
  MessagesOverTime,
  MessagesByDirection,
  StatusBreakdown,
  TopActiveContact,
  NewContactsOverTime,
  HourlyDistribution,
} from '@/lib/db/queries'

interface AnalyticsDialogContentProps {
  data: {
    summary: AnalyticsSummary
    messagesOverTime: MessagesOverTime[]
    messagesByDirection: MessagesByDirection[]
    statusBreakdown: StatusBreakdown[]
    topContacts: TopActiveContact[]
    newContactsOverTime: NewContactsOverTime[]
    hourlyDistribution: HourlyDistribution[]
  }
}

export function AnalyticsDialogContent({ data }: AnalyticsDialogContentProps) {
  const {
    summary,
    messagesOverTime,
    messagesByDirection,
    statusBreakdown,
    topContacts,
    newContactsOverTime,
    hourlyDistribution,
  } = data

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Messages"
          value={summary.totalMessages.toLocaleString()}
          description="All-time message volume"
          icon={MessageSquare}
        />
        <StatCard
          title="Total Contacts"
          value={summary.totalContacts.toLocaleString()}
          description="Unique phone numbers"
          icon={Users}
        />
        <StatCard
          title="Inbound Messages"
          value={summary.inboundCount.toLocaleString()}
          description={`${summary.outboundCount.toLocaleString()} outbound`}
          icon={ArrowDownCircle}
        />
        <StatCard
          title="Delivery Rate"
          value={`${summary.deliveryRate.toFixed(1)}%`}
          description="Successfully delivered"
          icon={CheckCircle2}
        />
      </div>

      {/* Main Charts */}
      <div className="space-y-4">
        <MessagesChart data={messagesOverTime} />

        <div className="grid gap-4 md:grid-cols-2">
          <DirectionChart data={messagesByDirection} />
          <StatusPieChart data={statusBreakdown} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <HourlyChart data={hourlyDistribution} />
          <TopContactsTable data={topContacts} />
        </div>

        <GrowthChart data={newContactsOverTime} />
      </div>
    </div>
  )
}

