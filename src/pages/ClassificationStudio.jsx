import React from "react";
import { useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ListChecks, Inbox, HelpCircle, RefreshCw, CheckCircle2, Settings as SettingsIcon, Lock, ArrowLeft } from "lucide-react";

/**
 * Classification Studio (Phase 0 scaffold).
 *
 * Extra, opt-in screen behind the tenant feature flag `classification_studio`.
 * It does not change the manual classification flow on the Accounts page.
 * Later phases add the CRS engine, queues, review screen and decision records.
 */

const STUDIO_ROLES = ["tenant_admin", "tenant_supervisor", "tenant_user", "super_admin"];
const CONFIRM_ROLES = ["tenant_admin", "tenant_supervisor"];

const QUEUES = [
  { key: "ready", label: "Ready to confirm", icon: CheckCircle2, text: "Accounts the data fully answers. You check them and confirm, one by one or in bulk." },
  { key: "needs", label: "Needs input", icon: HelpCircle, text: "Accounts where the data can't answer every CRS question. Only the open questions are asked." },
  { key: "changed", label: "Changed", icon: RefreshCw, text: "Accounts whose data changed after classification. The confirmed status stays until someone confirms the proposal." },
  { key: "done", label: "Classified", icon: ListChecks, text: "Confirmed decisions, each with a permanent record of why." },
];

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

function useSelectedAccount(accountId) {
  return useQuery({
    queryKey: ["classification-studio-account", accountId],
    queryFn: async () => {
      const rows = await base44.entities.Account.filter({ id: accountId });
      return rows[0] || null;
    },
    enabled: !!accountId,
  });
}

export default function ClassificationStudio() {
  const location = useLocation();
  const accountId = new URLSearchParams(location.search).get("account");
  const { data: ctx, isLoading } = useStudioContext();
  const { data: account, isLoading: accountLoading } = useSelectedAccount(accountId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-700" />
      </div>
    );
  }

  const user = ctx?.user;
  const tenant = ctx?.tenant;
  const role = user?.app_role;
  const isSuperAdmin = role === "super_admin";
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
        <Badge variant="secondary">{canConfirm ? "You can confirm decisions" : "You can review and draft answers"}</Badge>
      </div>

      {accountId && (
        <Alert>
          <AlertDescription>
            {accountLoading
              ? "Loading the selected account…"
              : account
                ? <>Opened from Accounts: <strong>{account.account_holder_name || "Unnamed holder"}</strong> · {account.account_number || account.id}. The review screen for this account arrives in a later phase.</>
                : "The selected account wasn't found or you don't have access to it."}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="queues">
        <TabsList>
          <TabsTrigger value="queues"><Inbox className="w-4 h-4 mr-2" />Queues</TabsTrigger>
          <TabsTrigger value="settings"><SettingsIcon className="w-4 h-4 mr-2" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="queues" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUEUES.map((q) => (
              <Card key={q.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><q.icon className="w-4 h-4 text-teal-700" />{q.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{q.text}</p>
                  <p className="text-xs text-slate-400 mt-3">Available once the CRS engine is connected.</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CRS settings for your organisation</CardTitle>
              <CardDescription>
                Elections such as the pre-existing account cut-off date, the residence address test and the USD 250,000 entity exemption.
                {role === "tenant_admin" ? " You'll be able to edit them here." : " Your tenant admin will be able to edit them here."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Coming in the next phase.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
