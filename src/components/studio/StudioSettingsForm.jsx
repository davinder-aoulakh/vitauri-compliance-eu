import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";

/**
 * Classification Studio — tenant CRS elections (StudioSettings).
 * Editable by tenant_admin (own tenant) and super_admin; read-only otherwise.
 * Every save writes an AuditLog entry (action_type "settings_changed").
 */

const SWITCHES = [
  { key: "residence_address_test_allowed", label: "Residence address test allowed", help: "Lower value pre-existing individual accounts may use documentary evidence of the residence address instead of the indicia search (Handbook ¶160)." },
  { key: "entity_250k_exemption", label: "USD 250,000 entity exemption elected", help: "Pre-existing entity accounts at or below USD 250,000 are not reviewed until they exceed it at a year end (Handbook ¶189)." },
  { key: "wider_approach", label: "Wider approach", help: "Run due diligence for all non-residents, not only residents of jurisdictions on the reportable list (Handbook Part I ¶23–28)." },
  { key: "discretionary_beneficiary_alignment", label: "Report discretionary beneficiaries only in distribution years", help: "Off means trust beneficiaries are reported every year (Handbook ¶268)." },
  { key: "alt_new_rules_for_preexisting", label: "Apply new-account rules to pre-existing accounts", help: "Optional election (Handbook ¶224)." },
  { key: "alt_hv_rules_for_lv", label: "Apply high value rules to lower value accounts", help: "Optional election (Handbook ¶224)." },
  { key: "new_accounts_of_existing_customers_as_preexisting", label: "Treat new accounts of existing customers as pre-existing", help: "Only where your jurisdiction allows it (Handbook ¶180, FAQ II-14)." },
  { key: "require_second_signoff", label: "Require a second sign-off before confirming", help: "A second admin or supervisor must approve each decision." },
  { key: "ai_suggestions_enabled", label: "AI suggestions for open questions", help: "Suggestions are shown only for questions the data can't answer. A person always confirms." },
];

const NUMBERS = [
  { key: "review_deadline_hv_months", label: "Review deadline, high value (months)", min: 1, max: 60 },
  { key: "review_deadline_lv_months", label: "Review deadline, lower value and entities (months)", min: 1, max: 60 },
  { key: "retention_years", label: "Keep decision records for (years)", min: 5, max: 30 },
];

const TRACKED = ["reporting_jurisdiction", "preexisting_cutoff", "reporting_currency", ...SWITCHES.map((s) => s.key), ...NUMBERS.map((n) => n.key), "values_confirmed", "confirmation_note"];

export default function StudioSettingsForm({ user, tenant }) {
  const queryClient = useQueryClient();
  const role = user?.app_role;
  const tenantId = tenant?.id || user?.tenant_id;
  const canEdit = role === "tenant_admin" || role === "super_admin";

  const { data: settings, isLoading } = useQuery({
    queryKey: ["studio-settings", tenantId],
    queryFn: async () => {
      const rows = await base44.entities.StudioSettings.filter({ tenant_id: tenantId });
      return rows[0] || null;
    },
    enabled: !!tenantId,
  });

  const jurisdiction = settings?.reporting_jurisdiction;
  const { data: list } = useQuery({
    queryKey: ["studio-reportable-list", jurisdiction],
    queryFn: async () => {
      const rows = await base44.entities.ReportableJurisdictionList.filter({ reporting_jurisdiction: jurisdiction });
      return rows.filter((r) => r.status !== "retired").sort((a, b) => (b.year || 0) - (a.year || 0))[0] || null;
    },
    enabled: !!jurisdiction,
  });

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (settings) setForm({ ...settings }); }, [settings]);

  const changes = useMemo(() => {
    if (!settings || !form) return {};
    const diff = {};
    TRACKED.forEach((k) => {
      if ((settings[k] ?? null) !== (form[k] ?? null)) diff[k] = { before: settings[k] ?? null, after: form[k] ?? null };
    });
    return diff;
  }, [settings, form]);
  const dirty = Object.keys(changes).length > 0;

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-700" /></div>;
  }

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CRS settings not set up yet</CardTitle>
          <CardDescription>Your platform administrator sets up the studio's CRS settings for your organisation before the pilot starts.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!form) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      TRACKED.forEach((k) => { payload[k] = form[k]; });
      payload.last_updated_by = user?.email;
      await base44.entities.StudioSettings.update(settings.id, payload);
      try {
        await base44.entities.AuditLog.create({
          tenant_id: tenantId,
          action_type: "settings_changed",
          actor_email: user?.email,
          actor_role: role,
          target_entity_type: "StudioSettings",
          target_entity_id: settings.id,
          target_entity_name: `Classification Studio settings (${form.reporting_jurisdiction})`,
          changes,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Audit log for studio settings failed", e);
      }
      await queryClient.invalidateQueries({ queryKey: ["studio-settings", tenantId] });
      toast.success("Settings saved");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save the settings. Only tenant admins can change them.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {!settings.values_confirmed && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong>Settings not yet confirmed.</strong> These values were set up for the pilot and need checking against your jurisdiction's rules.
            {settings.confirmation_note && <span className="block mt-1 text-sm">{settings.confirmation_note}</span>}
          </AlertDescription>
        </Alert>
      )}
      {!canEdit && (
        <p className="text-sm text-slate-500">Only tenant admins can change these settings. You can view them here.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jurisdiction</CardTitle>
          <CardDescription>The reporting jurisdiction sets which countries are reportable and which accounts count as pre-existing.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="studio-jurisdiction">Reporting jurisdiction (ISO code)</Label>
            <Input id="studio-jurisdiction" value={form.reporting_jurisdiction || ""} disabled={role !== "super_admin"} maxLength={3}
              onChange={(e) => set("reporting_jurisdiction", e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="studio-cutoff">Pre-existing account cut-off</Label>
            <Input id="studio-cutoff" type="date" value={form.preexisting_cutoff || ""} disabled={!canEdit}
              onChange={(e) => set("preexisting_cutoff", e.target.value)} />
            <p className="text-xs text-slate-500">Accounts open on this date are pre-existing (Handbook ¶154–156).</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="studio-currency">Reporting currency</Label>
            <Input id="studio-currency" value={form.reporting_currency || ""} disabled={!canEdit} maxLength={3}
              onChange={(e) => set("reporting_currency", e.target.value.toUpperCase())} />
          </div>
          <div className="sm:col-span-3 rounded-md border bg-slate-50 p-3 text-sm flex flex-wrap items-center gap-2">
            <span className="font-medium">Reportable jurisdictions:</span>
            {list ? (
              <>
                <span>{list.version} · {list.jurisdictions?.length || 0} jurisdictions</span>
                <Badge variant="outline" className={list.status === "published" ? "border-green-600 text-green-700" : "border-amber-500 text-amber-700"}>{list.status}</Badge>
                {list.source_note && <span className="text-slate-500 w-full">{list.source_note}</span>}
              </>
            ) : (
              <span className="text-slate-500">No list for this jurisdiction yet.</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Elections and options</CardTitle>
          <CardDescription>Choices the CRS leaves to your jurisdiction or your institution.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {SWITCHES.map((s) => (
            <div key={s.key} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <Label htmlFor={`studio-${s.key}`} className="font-medium">{s.label}</Label>
                <p className="text-xs text-slate-500 mt-0.5">{s.help}</p>
              </div>
              <Switch id={`studio-${s.key}`} checked={!!form[s.key]} disabled={!canEdit} onCheckedChange={(v) => set(s.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deadlines and record keeping</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {NUMBERS.map((n) => (
            <div key={n.key} className="space-y-1.5">
              <Label htmlFor={`studio-${n.key}`}>{n.label}</Label>
              <Input id={`studio-${n.key}`} type="number" min={n.min} max={n.max} value={form[n.key] ?? ""} disabled={!canEdit}
                onChange={(e) => set(n.key, e.target.value === "" ? null : Number(e.target.value))} />
            </div>
          ))}
          <p className="text-xs text-slate-500 sm:col-span-3">The CRS requires records of the steps taken and evidence relied on for at least 5 years (Handbook Part I ¶18). Your local law may require longer.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confirmation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox id="studio-confirmed" checked={!!form.values_confirmed} disabled={!canEdit} onCheckedChange={(v) => set("values_confirmed", v === true)} />
            <Label htmlFor="studio-confirmed">These settings have been checked against our jurisdiction's rules</Label>
          </div>
          <Textarea id="studio-note" rows={3} value={form.confirmation_note || ""} disabled={!canEdit}
            placeholder="Who checked the settings and against which source"
            onChange={(e) => set("confirmation_note", e.target.value)} />
          {settings.last_updated_by && (
            <p className="text-xs text-slate-500">Last updated by {settings.last_updated_by}{settings.updated_date ? ` on ${new Date(settings.updated_date).toLocaleString()}` : ""}.</p>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex items-center justify-end gap-3">
          {dirty && <span className="text-sm text-slate-500">{Object.keys(changes).length} unsaved change{Object.keys(changes).length > 1 ? "s" : ""}</span>}
          <Button variant="outline" disabled={!dirty || saving} onClick={() => setForm({ ...settings })}>Discard</Button>
          <Button disabled={!dirty || saving} onClick={save} className="bg-teal-700 hover:bg-teal-800">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : settings.values_confirmed ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save settings
          </Button>
        </div>
      )}
    </div>
  );
}
