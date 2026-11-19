import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, Loader2, Settings2, XCircle } from "lucide-react";
import { buildCountryIndex, normalizeWithIndex } from "../../../base44/shared/crs/countries.js";

/** Handbook-based defaults for a new tenant. Every value is marked "to confirm". */
export function defaultStudioSettings(tenantId, jurisdiction) {
  return {
    tenant_id: tenantId,
    reporting_jurisdiction: jurisdiction,
    preexisting_cutoff: "2015-12-31",
    residence_address_test_allowed: true,
    entity_250k_exemption: true,
    wider_approach: false,
    discretionary_beneficiary_alignment: false,
    alt_new_rules_for_preexisting: false,
    alt_hv_rules_for_lv: false,
    new_accounts_of_existing_customers_as_preexisting: false,
    review_deadline_hv_months: 12,
    review_deadline_lv_months: 24,
    retention_years: 5,
    reporting_currency: "USD",
    fx_rates: [],
    require_second_signoff: false,
    ai_suggestions_enabled: true,
    values_confirmed: false,
    confirmation_note: `Set up with Handbook defaults for ${jurisdiction}. Please confirm against local rules: (1) pre-existing cut-off date (31 Dec 2015 for early adopters, 31 Dec 2016 for 2018 exchanges), (2) the reportable jurisdiction list, (3) whether the wider approach applies, (4) whether the residence address test is allowed, (5) the record retention period (Handbook minimum 5 years), (6) whether the USD 250,000 entity exemption is elected, (7) the reporting currency and year-end exchange rates.`,
  };
}

function useCountryIndex() {
  const { data: countries = [] } = useQuery({ queryKey: ["studio-countries"], queryFn: () => base44.entities.CrsCountryInfo.filter({}, "country_code", 1000), staleTime: 10 * 60 * 1000 });
  return useMemo(() => buildCountryIndex(countries), [countries]);
}

/** Shown when a tenant has the studio but no CRS settings yet: creates them from the Handbook defaults. */
export function SetupSettings({ user, tenant, tenantId }) {
  const qc = useQueryClient();
  const index = useCountryIndex();
  const guess = normalizeWithIndex(index, tenant?.jurisdiction) || "";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const canSetUp = user?.app_role === "super_admin" || user?.app_role === "tenant_admin";
  const value = (code || guess).toUpperCase();

  const create = async () => {
    if (!/^[A-Z]{2}$/.test(value)) { toast.error("Enter the two-letter code of the reporting jurisdiction, for example CW or NL."); return; }
    setBusy(true);
    try {
      const existing = await base44.entities.StudioSettings.filter({ tenant_id: tenantId });
      if (existing.length) { toast.info("Settings already exist for this organisation."); }
      else {
        const row = await base44.entities.StudioSettings.create(defaultStudioSettings(tenantId, value));
        await base44.entities.AuditLog.create({ tenant_id: tenantId, action_type: "settings_changed", actor_email: user?.email, actor_role: user?.app_role,
          target_entity_type: "StudioSettings", target_entity_id: row?.id, target_entity_name: `Classification Studio settings (${value})`,
          changes: { action: "created_from_defaults", reporting_jurisdiction: value }, timestamp: new Date().toISOString() }).catch(() => {});
        toast.success("CRS settings created. Review and confirm each value.");
      }
      await qc.invalidateQueries({ queryKey: ["studio-settings", tenantId] });
    } catch (e) { toast.error(`Couldn't create the settings: ${e.message || e}`); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4 text-teal-700" />CRS settings not set up yet</CardTitle>
        <CardDescription>
          The studio needs your reporting jurisdiction and the elections your institution has made. Setting up fills in the Handbook defaults, marked as not yet confirmed, so you can check each one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canSetUp ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="setup-jur">Reporting jurisdiction (ISO code)</Label>
              <Input id="setup-jur" className="w-40 uppercase" value={code || guess} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 2))} placeholder="e.g. CW" />
            </div>
            <Button onClick={create} disabled={busy} className="bg-teal-700 hover:bg-teal-800">{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Set up CRS settings</Button>
            {tenant?.jurisdiction && <p className="text-xs text-slate-500 w-full">Taken from the organisation's jurisdiction: {tenant.jurisdiction}.</p>}
          </div>
        ) : (
          <p className="text-sm text-slate-600">Ask your tenant admin or platform administrator to set up the CRS settings.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Pilot readiness: what must be in place before the studio's decisions can be relied on. */
export function StudioReadiness({ user, tenantId }) {
  const role = user?.app_role;
  const isAdmin = role === "tenant_admin" || role === "super_admin";
  const { data: settings } = useQuery({ queryKey: ["studio-settings", tenantId], queryFn: async () => (await base44.entities.StudioSettings.filter({ tenant_id: tenantId }))[0] || null, enabled: !!tenantId });
  const jurisdiction = settings?.reporting_jurisdiction;
  const { data: lists = [] } = useQuery({ queryKey: ["studio-readiness-lists", jurisdiction], queryFn: () => base44.entities.ReportableJurisdictionList.filter({ reporting_jurisdiction: jurisdiction }), enabled: !!jurisdiction });
  const { data: packs = [] } = useQuery({ queryKey: ["studio-readiness-packs"], queryFn: () => base44.entities.CrsRulePack.filter({ status: "published" }, "-published_at", 20) });
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["studio-readiness-users", tenantId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getTenantUsers", {});
      return (res?.data?.users || []).filter((u) => u.tenant_id === tenantId);
    },
    enabled: isAdmin && !!tenantId,
  });

  const list = lists.filter((l) => l.status !== "retired").sort((a, b) => (b.year || 0) - (a.year || 0))[0];
  const confirmers = (users || []).filter((u) => ["tenant_admin", "tenant_supervisor"].includes(u.app_role));
  const items = [
    { ok: !!settings, label: "CRS settings set up", detail: settings ? `Reporting jurisdiction ${jurisdiction}` : "Set them up below" },
    { ok: !!settings?.values_confirmed, label: "Settings confirmed", detail: settings?.values_confirmed ? "Confirmed" : "Check each value and tick 'Mark as confirmed' below" },
    { ok: !!list, warn: list?.status === "provisional", label: "Reportable jurisdiction list", detail: list ? `${list.version} · ${list.status}${list.status === "provisional" ? " (check it against the official list)" : ""} · ${(list.jurisdictions || []).length} jurisdictions` : `No list for ${jurisdiction || "the jurisdiction"} yet`,
      link: role === "super_admin" ? { to: createPageUrl("CrsRuleLibrary"), text: "Reference data" } : null },
    { ok: packs.some((p) => !p.jurisdiction_scope || p.jurisdiction_scope === "global"), label: "Published CRS rules", detail: packs.length ? packs.map((p) => `${p.jurisdiction_scope && p.jurisdiction_scope !== "global" ? p.jurisdiction_scope : "Global"} v${p.version}`).join(", ") : "The built-in Handbook rules are used" },
    isAdmin
      ? { ok: confirmers.length > 0, pending: usersLoading, label: "Someone who can confirm", detail: usersLoading ? "Checking…" : confirmers.length ? `${confirmers.length} admin or supervisor user${confirmers.length > 1 ? "s" : ""}` : "Give at least one user the tenant admin or supervisor role" }
      : { ok: null, label: "Someone who can confirm", detail: "Your tenant admin can check this" },
  ];
  const ready = items.every((i) => i.ok);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{ready ? "Ready for the pilot" : "Before relying on studio decisions"}</CardTitle>
        <CardDescription>These need to be in place so the studio applies your jurisdiction's rules.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {items.map((i) => (
            <li key={i.label} className="flex items-start gap-2">
              {i.pending || i.ok === null ? <CircleDashed className="w-4 h-4 mt-0.5 text-slate-400" /> : i.ok && !i.warn ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600" /> : i.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-amber-500" /> : <XCircle className="w-4 h-4 mt-0.5 text-red-500" />}
              <span><span className="font-medium text-slate-800">{i.label}</span><span className="text-slate-500"> · {i.detail}</span>
                {i.link && <> · <Link to={i.link.to} className="text-teal-800 underline">{i.link.text}</Link></>}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
