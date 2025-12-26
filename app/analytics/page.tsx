import {
  getAnalyticsSummary,
  getMessagesOverTime,
  getMessagesByDirection,
  getStatusBreakdown,
  getTopActiveContacts,
  getNewContactsOverTime,
  getHourlyDistribution,
} from '@/lib/db/queries'
import { StatCard } from '@/components/analytics/stat-card'
import { MessagesChart } from '@/components/analytics/messages-chart'
import { DirectionChart } from '@/components/analytics/direction-chart'
import { StatusPieChart } from '@/components/analytics/status-pie-chart'
import { HourlyChart } from '@/components/analytics/hourly-chart'
import { TopContactsTable } from '@/components/analytics/top-contacts-table'
import { GrowthChart } from '@/components/analytics/growth-chart'
import { MessageSquare, Users, ArrowDownCircle, CheckCircle2 } from 'lucide-react'

export default async function AnalyticsPage() {
  // Fetch all analytics data in parallel
  const [
    summary,
    messagesOverTime,
    messagesByDirection,
    statusBreakdown,
    topContacts,
    newContactsOverTime,
    hourlyDistribution,
  ] = await Promise.all([
    getAnalyticsSummary(),
    getMessagesOverTime(),
    getMessagesByDirection(),
    getStatusBreakdown(),
    getTopActiveContacts(10),
    getNewContactsOverTime(),
    getHourlyDistribution(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          View insights and metrics for your SMS dashboard.
        </p>
      </div>

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
