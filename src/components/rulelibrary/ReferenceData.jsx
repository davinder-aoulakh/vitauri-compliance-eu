import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { StudioReadiness } from "@/components/studio/StudioSetup";

const audit = (user, type, id, name, changes) => base44.entities.AuditLog.create({
  action_type: "settings_changed", actor_email: user?.email, actor_role: user?.app_role, target_entity_type: type, target_entity_id: id,
  target_entity_name: name, changes, timestamp: new Date().toISOString(),
}).catch((e) => console.error("Audit log failed", e));

/** Reference data the engine uses: reportable jurisdiction lists, TIN flags, and duplicate-country cleanup. */
export default function ReferenceData({ user }) {
  return (
    <div className="space-y-4">
      <PilotReadiness user={user} />
      <ReportableLists user={user} />
      <Countries user={user} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exchange rates</CardTitle>
          <CardDescription>Exchange rates are kept per tenant, in each tenant's Classification Studio settings (31 December spot rates), because each reporting jurisdiction converts from its own currency.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

/** Readiness of each tenant that has the studio switched on (rollout check for super admins). */
function PilotReadiness({ user }) {
  const { data: tenants = [] } = useQuery({
    queryKey: ["rule-library-pilot-tenants"],
    queryFn: async () => (await base44.entities.Tenant.filter({}, "name", 500)).filter((t) => t.enabled_features?.classification_studio === true),
  });
  const [tenantId, setTenantId] = useState("");
  const active = tenantId || tenants[0]?.id || "";
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Tenants using the studio</CardTitle>
          <CardDescription>To roll out to another tenant: switch on "Classification Studio" in Tenant Management, then set up its CRS settings in the studio and check its reportable jurisdiction list here.</CardDescription>
        </div>
        <Select value={active} onValueChange={setTenantId}>
          <SelectTrigger className="w-64"><SelectValue placeholder={tenants.length ? "Choose a tenant" : "No tenant has the studio on"} /></SelectTrigger>
          <SelectContent>{tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
      </CardHeader>
      {active && <CardContent><StudioReadiness user={user} tenantId={active} /></CardContent>}
    </Card>
  );
}

function ReportableLists({ user }) {
  const qc = useQueryClient();
  const { data: lists = [], isLoading } = useQuery({ queryKey: ["rule-library-lists"], queryFn: () => base44.entities.ReportableJurisdictionList.filter({}, "-year", 500) });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const open = (l) => setEditing(l ? { ...l, codesText: (l.jurisdictions || []).map((j) => j.code).join(", ") }
    : { reporting_jurisdiction: "", year: new Date().getFullYear() + 1, version: "", status: "provisional", source_note: "", codesText: "" });

  const save = async () => {
    const codes = [...new Set(editing.codesText.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean))];
    const bad = codes.filter((c) => !/^[A-Z]{2}$/.test(c));
    if (!/^[A-Z]{2}$/.test(String(editing.reporting_jurisdiction).toUpperCase())) { toast.error("Reporting jurisdiction must be a two-letter code."); return; }
    if (bad.length) { toast.error(`Not two-letter codes: ${bad.join(", ")}`); return; }
    if (!editing.version.trim()) { toast.error("Give the list a version name."); return; }
    setSaving(true);
    try {
      const payload = { reporting_jurisdiction: editing.reporting_jurisdiction.toUpperCase(), year: Number(editing.year), version: editing.version.trim(), status: editing.status,
        source_note: editing.source_note, jurisdictions: codes.map((code) => ({ code })),
        ...(editing.status === "published" && editing.status !== editing.prevStatus ? { published_at: new Date().toISOString(), published_by: user?.email } : {}) };
      let row;
      if (editing.id) row = await base44.entities.ReportableJurisdictionList.update(editing.id, payload);
      else row = await base44.entities.ReportableJurisdictionList.create(payload);
      await audit(user, "ReportableJurisdictionList", row?.id || editing.id, `${payload.reporting_jurisdiction} ${payload.version}`, { action: editing.id ? "update" : "create", codes: codes.length, status: payload.status });
      toast.success("List saved");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["rule-library-lists"] });
      await qc.invalidateQueries({ queryKey: ["studio-reportable-list"] });
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Reportable jurisdiction lists</CardTitle>
          <CardDescription>Per reporting jurisdiction and year. The studio uses the newest list that isn't retired. Mark a list published once it has been checked against the official list.</CardDescription>
        </div>
        <Button onClick={() => open(null)} variant="outline"><Plus className="w-4 h-4 mr-1" />New list</Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? <Loader2 className="w-5 h-5 m-4 animate-spin" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Reporting jurisdiction</TableHead><TableHead>Year</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Jurisdictions</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {lists.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono">{l.reporting_jurisdiction}</TableCell>
                  <TableCell>{l.year}</TableCell>
                  <TableCell className="font-mono text-xs">{l.version}</TableCell>
                  <TableCell><Badge variant="outline" className={l.status === "published" ? "border-green-300 text-green-800" : l.status === "retired" ? "" : "border-amber-300 text-amber-800"}>{l.status}</Badge></TableCell>
                  <TableCell className="text-xs">{(l.jurisdictions || []).length}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => open({ ...l, prevStatus: l.status })}>Edit</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit list" : "New list"}</DialogTitle><DialogDescription>Codes are ISO two-letter codes, separated by commas or spaces.</DialogDescription></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 grid-cols-3">
                <div className="space-y-1"><Label htmlFor="l-rj">Reporting jurisdiction</Label><Input id="l-rj" value={editing.reporting_jurisdiction} onChange={(e) => setEditing({ ...editing, reporting_jurisdiction: e.target.value.toUpperCase() })} /></div>
                <div className="space-y-1"><Label htmlFor="l-y">Year</Label><Input id="l-y" type="number" value={editing.year} onChange={(e) => setEditing({ ...editing, year: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor="l-v">Version</Label><Input id="l-v" value={editing.version} onChange={(e) => setEditing({ ...editing, version: e.target.value })} placeholder="CW-2027-v1" /></div>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="provisional">Provisional</SelectItem><SelectItem value="published">Published (checked against the official list)</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label htmlFor="l-c">Reportable jurisdictions ({editing.codesText.split(/[\s,;]+/).filter(Boolean).length})</Label><Textarea id="l-c" rows={5} value={editing.codesText} onChange={(e) => setEditing({ ...editing, codesText: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="l-n">Source</Label><Textarea id="l-n" rows={2} value={editing.source_note || ""} onChange={(e) => setEditing({ ...editing, source_note: e.target.value })} placeholder="Where the list comes from, e.g. the tax authority's publication and date" /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const DUP_FIELDS = ["country_name", "is_crs_country", "crs_implementation_date", "tin_issued_to_all", "crs_reporting_details"];

function Countries({ user }) {
  const qc = useQueryClient();
  const { data: countries = [], isLoading } = useQuery({ queryKey: ["rule-library-countries"], queryFn: () => base44.entities.CrsCountryInfo.filter({}, "country_code", 1000) });
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(null);
  const [remove, setRemove] = useState(null);

  const duplicates = useMemo(() => {
    const by = {};
    for (const c of countries) (by[String(c.country_code || "").toUpperCase()] ||= []).push(c);
    return Object.entries(by).filter(([, rows]) => rows.length > 1).map(([code, rows]) => ({
      code, rows, differences: DUP_FIELDS.filter((f) => new Set(rows.map((r) => JSON.stringify(r[f] ?? null))).size > 1),
    }));
  }, [countries]);

  const shown = countries.filter((c) => !term || `${c.country_code} ${c.country_name}`.toLowerCase().includes(term.toLowerCase()));

  const toggleTin = async (c, value) => {
    setBusy(c.id);
    try {
      await base44.entities.CrsCountryInfo.update(c.id, { tin_issued_to_all: value });
      await audit(user, "CrsCountryInfo", c.id, `${c.country_code} ${c.country_name}`, { field: "tin_issued_to_all", before: c.tin_issued_to_all ?? null, after: value });
      await qc.invalidateQueries({ queryKey: ["rule-library-countries"] });
      await qc.invalidateQueries({ queryKey: ["studio-countries"] });
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  const removeRow = async () => {
    const c = remove; setRemove(null); setBusy(c.id);
    try {
      await base44.entities.CrsCountryInfo.delete(c.id);
      await audit(user, "CrsCountryInfo", c.id, `${c.country_code} ${c.country_name}`, { action: "remove_duplicate", removed: Object.fromEntries(DUP_FIELDS.map((f) => [f, c[f] ?? null])) });
      toast.success(`Duplicate ${c.country_code} row removed`);
      await qc.invalidateQueries({ queryKey: ["rule-library-countries"] });
      await qc.invalidateQueries({ queryKey: ["studio-countries"] });
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Duplicate countries {duplicates.length > 0 && <Badge variant="outline" className="ml-2 border-amber-300 text-amber-800">{duplicates.length}</Badge>}</CardTitle>
          <CardDescription>
            The country table has codes that appear more than once. The studio already ignores the duplicates, but the manual workflows read this table too, so nothing is removed automatically. Compare the rows and remove the one you don't want.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : duplicates.length === 0 ? <p className="text-sm text-slate-500">No duplicates.</p> : duplicates.map((d) => (
            <div key={d.code} className="border rounded">
              <div className="px-3 py-2 bg-slate-50 border-b text-sm flex flex-wrap gap-2 items-center"><span className="font-mono font-semibold">{d.code}</span><span className="text-xs text-slate-500">{d.rows.length} rows · {d.differences.length ? `differ in ${d.differences.join(", ")}` : "identical"}</span></div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>{DUP_FIELDS.map((f) => <TableHead key={f} className="text-xs">{f}</TableHead>)}<TableHead className="text-xs">created</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>{d.rows.map((r) => (
                    <TableRow key={r.id}>
                      {DUP_FIELDS.map((f) => <TableCell key={f} className={`text-xs ${d.differences.includes(f) ? "bg-amber-50" : ""}`}>{String(r[f] ?? "—").slice(0, 60)}</TableCell>)}
                      <TableCell className="text-xs whitespace-nowrap">{(r.created_date || "").slice(0, 10)}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => setRemove(r)}><Trash2 className="w-4 h-4 text-red-600" /></Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">TIN rules per country</CardTitle>
          <CardDescription>Switch on "Issues TINs to all residents" where the OECD AEOI portal says so. A missing TIN for those countries is then treated as a reason to doubt a self-certification (FAQ II-8).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search country" className="max-w-xs" />
          <div className="max-h-96 overflow-y-auto border rounded">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Country</TableHead><TableHead>CRS participating</TableHead><TableHead>Issues TINs to all residents</TableHead></TableRow></TableHeader>
              <TableBody>{shown.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.country_code}</TableCell>
                  <TableCell className="text-sm">{c.country_name}</TableCell>
                  <TableCell className="text-xs">{c.is_crs_country ? "Yes" : "No"}</TableCell>
                  <TableCell><Switch checked={c.tin_issued_to_all === true} disabled={busy === c.id} onCheckedChange={(v) => toggleTin(c, v)} aria-label={`TINs issued to all residents in ${c.country_name}`} /></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!remove} onOpenChange={(o) => !o && setRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this {remove?.country_code} row?</DialogTitle>
            <DialogDescription>The row is deleted from the country table for every tenant, including the manual workflows. Its values are kept in the audit log.</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setRemove(null)}>Cancel</Button><Button variant="destructive" onClick={removeRow}>Remove row</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
