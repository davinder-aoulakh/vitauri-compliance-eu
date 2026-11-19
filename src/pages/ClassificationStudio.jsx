import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StudioSettingsForm from "@/components/studio/StudioSettingsForm";
import StudioQueues from "@/components/studio/StudioQueues";
import StudioComparison from "@/components/studio/StudioComparison";
import { useStudioData } from "@/components/studio/useStudioData";
import { Inbox, Settings as SettingsIcon, Lock, ArrowLeft, Scale, Loader2, AlertTriangle } from "lucide-react";

/**
 * Classification Studio — extra, opt-in screen behind the tenant feature flag `classification_studio`.
 * Phase 3: read-only queues, review screen and studio-vs-manual comparison using the shared CRS engine.
 * It does not change the manual classification flow on the Accounts page.
 */

const STUDIO_ROLES = ["tenant_admin", "tenant_supervisor", "tenant_user", "super_admin"];
const CONFIRM_ROLES = ["tenant_admin", "tenant_supervisor"];

function useStudioContext() {
  return useQuery({
    queryKey: ["classification-studio-context"],
    queryFn: async () => {
      const user = await base44.auth.me();
      let tenant = null;
      if (user?.tenant_id) {
        const tenants = await base44.entities.Tenant.filter({ id: user.tenant_id });
        tenant = tenants[0] || null;
      }
      return { user, tenant };
    },
    staleTime: 60 * 1000,
  });
}

function usePilotTenants(enabled) {
  return useQuery({
    queryKey: ["classification-studio-pilot-tenants"],
    queryFn: async () => {
      const all = await base44.entities.Tenant.filter({}, "name", 500);
      return all.filter((t) => t.enabled_features?.classification_studio === true);
    },
    enabled,
  });
}

function StudioWorkspace({ tenantId, user, tenant, accountId }) {
  const data = useStudioData(tenantId);
  const [tab, setTab] = useState(accountId ? "queues" : "queues");
  const [openAccount, setOpenAccount] = useState(accountId || null);
  useEffect(() => { if (accountId) setOpenAccount(accountId); }, [accountId]);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="queues"><Inbox className="w-4 h-4 mr-2" />Queues</TabsTrigger>
        <TabsTrigger value="comparison"><Scale className="w-4 h-4 mr-2" />Studio vs manual</TabsTrigger>
        <TabsTrigger value="settings"><SettingsIcon className="w-4 h-4 mr-2" />Settings</TabsTrigger>
      </TabsList>

      {(tab === "queues" || tab === "comparison") && (
        data.isLoading ? (
          <div className="flex items-center gap-2 py-16 justify-center text-sm text-slate-500"><Loader2 className="w-5 h-5 animate-spin text-teal-700" />Checking accounts against the CRS rules…</div>
        ) : data.error ? (
          <Alert className="mt-4 border-red-300 bg-red-50"><AlertTriangle className="w-4 h-4 text-red-600" /><AlertDescription>Couldn't load the studio data: {String(data.error.message || data.error)}</AlertDescription></Alert>
        ) : !data.settings ? (
          <Alert className="mt-4"><AlertDescription>The studio's CRS settings aren't set up for this organisation yet. Open the Settings tab, or ask your platform administrator.</AlertDescription></Alert>
        ) : null
      )}

      <TabsContent value="queues" className="mt-4">
        {!data.isLoading && !data.error && data.settings && (
          <StudioQueues key={openAccount || "none"} data={data} initialAccountId={openAccount} />
        )}
      </TabsContent>
      <TabsContent value="comparison" className="mt-4">
        {!data.isLoading && !data.error && data.settings && (
          <StudioComparison data={data} onOpen={(id) => { setOpenAccount(id); setTab("queues"); }} />
        )}
      </TabsContent>
      <TabsContent value="settings" className="mt-4">
        <StudioSettingsForm user={user} tenant={tenant || { id: tenantId }} />
      </TabsContent>
    </Tabs>
  );
}

export default function ClassificationStudio() {
  const location = useLocation();
  const accountId = new URLSearchParams(location.search).get("account");
  const { data: ctx, isLoading } = useStudioContext();
  const user = ctx?.user;
  const role = user?.app_role;
  const isSuperAdmin = role === "super_admin";
  const { data: pilotTenants = [] } = usePilotTenants(isSuperAdmin && !user?.tenant_id);
  const [pickedTenantId, setPickedTenantId] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-700" />
      </div>
    );
  }

  const tenant = ctx?.tenant;
  const enabled = isSuperAdmin || tenant?.enabled_features?.classification_studio === true;

  if (!STUDIO_ROLES.includes(role) || !enabled) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-slate-500" />Classification Studio isn't switched on</CardTitle>
            <CardDescription>
              Your organisation doesn't have the Classification Studio yet. You can keep classifying accounts from the Accounts page as usual.
              Ask your platform administrator if you'd like to join the pilot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline"><Link to={createPageUrl("Accounts")}><ArrowLeft className="w-4 h-4 mr-2" />Back to Accounts</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tenantId = user?.tenant_id || pickedTenantId;
  const pickedTenant = pilotTenants.find((t) => t.id === pickedTenantId) || null;
  const canConfirm = CONFIRM_ROLES.includes(role);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Classification Studio</h1>
            <Badge variant="outline" className="border-teal-600 text-teal-700">Pilot</Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Checks each account against the OECD CRS rules using the data you already hold, asks only what the data can't answer,
            and keeps a permanent record of every decision. Manual classification on the Accounts page keeps working as before.
          </p>
        </div>
        <Badge variant="secondary">{isSuperAdmin ? "Super admin · read-only" : canConfirm ? "You can confirm decisions" : "You can review and draft answers"}</Badge>
      </div>

      {isSuperAdmin && !user?.tenant_id && (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-700">Pilot tenant</span>
            <Select value={pickedTenantId} onValueChange={setPickedTenantId}>
              <SelectTrigger className="w-72"><SelectValue placeholder={pilotTenants.length ? "Choose a tenant" : "No tenant has the studio switched on"} /></SelectTrigger>
              <SelectContent>{pilotTenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {tenantId ? (
        <StudioWorkspace tenantId={tenantId} user={user} tenant={tenant || pickedTenant} accountId={accountId} />
      ) : (
        <p className="text-sm text-slate-500">Choose a pilot tenant to see its accounts.</p>
      )}
    </div>
  );
}
