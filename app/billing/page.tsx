"use client"

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing information.
        </p>
      </div>
      <div className="space-y-4">
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Subscription</h2>
          <p className="text-muted-foreground">
            Your billing information and subscription details will be displayed here.
          </p>
        </div>
      </div>
    </div>
  )
}
