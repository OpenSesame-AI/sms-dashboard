"use client"

import * as React from "react"
import { Plug } from "lucide-react"
import { SalesforceIntegration } from "@/components/integrations/salesforce-integration"
import { HubspotIntegration } from "@/components/integrations/hubspot-integration"
import { Dynamics365Integration } from "@/components/integrations/dynamics365-integration"
import { ZohoIntegration } from "@/components/integrations/zoho-integration"
import { ZohoBiginIntegration } from "@/components/integrations/zoho-bigin-integration"
import { AgencyzoomIntegration } from "@/components/integrations/agencyzoom-integration"
import { AttioIntegration } from "@/components/integrations/attio-integration"
import { ZendeskIntegration } from "@/components/integrations/zendesk-integration"

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Plug className="h-8 w-8" />
          Integrations
        </h1>
        <p className="text-muted-foreground">
          Connect and manage integrations. Contacts will be synced to all your cells automatically.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SalesforceIntegration />
        <HubspotIntegration />
        <Dynamics365Integration />
        <ZohoIntegration />
        <ZohoBiginIntegration />
        <AgencyzoomIntegration />
        <AttioIntegration />
        <ZendeskIntegration />
      </div>
    </div>
  )
}
