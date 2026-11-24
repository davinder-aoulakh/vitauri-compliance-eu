import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, FlaskConical, Loader2, Rocket, Search, XCircle, BarChart3 } from "lucide-react";
import { evaluate, runFixtures, loadStudioInput } from "../../../base44/shared/crs/index.js";
import { callLibrary, scopeOf, useInvalidateLibrary } from "./useRuleLibrary";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");
const summary = (r) => `${r.outcome.status}${r.outcome.jurisdictions?.length ? ` · ${r.outcome.jurisdictions.join(", ")}` : ""}${r.gaps.length ? ` · asks ${r.gaps.map((g) => g.key).join(", ")}` : ""}`;
const sameResult = (a, b) => summary(a) === summary(b);

/** Packs to evaluate with for a tenant in a given reporting jurisdiction: "published" (today) and "draft" (after publishing). */
function packsFor(pack, draftRules, globalPublished, overridesByScope, jurisdiction) {
  const scope = scopeOf(pack);
  const draft = { ...pack, rules: draftRules };
  const publishedOverride = overridesByScope[jurisdiction] || null;
  if (scope === "global") return { published: { pack: globalPublished, overridePack: publishedOverride }, draft: { pack: draft, overridePack: publishedOverride } };
  return { published: { pack: globalPublished, overridePack: publishedOverride }, draft: { pack: globalPublished, overridePack: draft } };
}

export default function TestPublish({ pack, rules, globalPublished, overridesByScope }) {
  const invalidate = useInvalidateLibrary();
  const isDraft = pack.status === "draft";
  const scope = scopeOf(pack);
  const fp = pack.rules_fingerprint;
  const testsCurrent = pack.test_run_result && pack.test_run_result.fingerprint === fp;
  const impactCurrent = pack.impact_report && pack.impact_report.fingerprint === fp;
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState(null);
  const [note, setNote] = useState(pack.change_note || "");

  // Local comparison of the reference cases: published vs draft paths.
  const local = useMemo(() => {
    const p = packsFor(pack, rules, globalPublished, overridesByScope, scope === "global" ? null : scope);
    const before = runFixtures(p.published.pack, p.published.overridePack);
    const after = runFixtures(p.draft.pack, p.draft.overridePack);
    return after.results.map((r, i) => ({ ...r, before: before.results[i], changed: before.results[i].path.join("|") !== r.path.join("|") }));
  }, [pack, rules, globalPublished, overridesByScope, scope]);

  const runTests = async () => {
    setBusy("tests");
    try { const out = await callLibrary("run_tests", { pack_id: pack.id }); toast[out.result.passed ? "success" : "error"](out.result.passed ? "All reference cases pass" : `${out.result.failed} reference case(s) fail`); await invalidate(); }
    catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  const runImpact = async () => {
    setBusy("impact");
    try {
      const tenants = (await base44.entities.Tenant.filter({}, "name", 500)).filter((t) => t.enabled_features?.classification_studio === true);
      const settingsRows = await base44.entities.StudioSettings.filter({}, "-updated_date", 1000);
      const targets = tenants.map((t) => ({ tenant: t, settings: settingsRows.find((s) => s.tenant_id === t.id) }))
        .filter((x) => x.settings && (scope === "global" || x.settings.reporting_jurisdiction === scope));
      const countries = await base44.entities.CrsCountryInfo.filter({}, "country_code", 1000);
      const lists = await base44.entities.ReportableJurisdictionList.filter({}, "-year", 500);
      const report = { fingerprint: fp, tenants: [], totals: { tenants: targets.length, accounts: 0, changed: 0, outcome_changed: 0, questions_changed: 0, confirmed_affected: 0 }, changed: [] };
      let done = 0;
      setProgress({ done: 0, total: targets.length });
      for (const { tenant, settings } of targets) {
        const [accounts, cps, evidence, decisions, bens] = await Promise.all([
          base44.entities.Account.filter({ tenant_id: tenant.id }, "-updated_date", 5000),
          base44.entities.ControllingPerson.filter({ tenant_id: tenant.id }, "-updated_date", 5000),
          base44.entities.StudioEvidence.filter({ tenant_id: tenant.id }, "-updated_date", 5000),
          base44.entities.ClassificationDecision.filter({ tenant_id: tenant.id, status: "confirmed" }, "-created_date", 5000),
          base44.entities.Beneficiary.filter({ tenant_id: tenant.id }, "-updated_date", 5000).catch(() => []),
        ]);
        const bensBy = {}; for (const b of bens) (bensBy[b.account_id] ||= []).push(b);
        const list = lists.filter((l) => l.reporting_jurisdiction === settings.reporting_jurisdiction && l.status !== "retired").sort((a, b) => (b.year || 0) - (a.year || 0))[0] || null;
        const p = packsFor(pack, rules, globalPublished, overridesByScope, settings.reporting_jurisdiction);
        const cpsBy = {}; for (const c of cps) (cpsBy[c.account_id] ||= []).push(c);
        const evBy = Object.fromEntries(evidence.map((e) => [e.account_id, e]));
        const confirmedIds = new Set(decisions.map((d) => d.target_id));
        let changed = 0;
        for (const account of accounts) {
          const ev = evBy[account.id] || {};
          const base = { settings, reportableList: list, countries, account, controllingPersons: cpsBy[account.id] || [], beneficiaries: bensBy[account.id] || [], evidence: ev, linkedAccounts: [] };
          const a = evaluate({ ...base, ...p.published }, ev.draft_gap_answers || {});
          const b = evaluate({ ...base, ...p.draft }, ev.draft_gap_answers || {});
          report.totals.accounts++;
          if (!sameResult(a, b)) {
            changed++; report.totals.changed++;
            const outcomeChanged = a.outcome.status !== b.outcome.status || (a.outcome.jurisdictions || []).join(",") !== (b.outcome.jurisdictions || []).join(",");
            if (outcomeChanged) report.totals.outcome_changed++; else report.totals.questions_changed++;
            if (confirmedIds.has(account.id)) report.totals.confirmed_affected++;
            if (report.changed.length < 300) report.changed.push({ tenant: tenant.name, account_id: account.id, holder: account.account_holder_name || [account.first_name, account.last_name].filter(Boolean).join(" ") || account.account_number || account.id,
              before: summary(a), after: summary(b), outcome_changed: outcomeChanged, confirmed: confirmedIds.has(account.id) });
          }
        }
        report.tenants.push({ tenant_id: tenant.id, name: tenant.name, jurisdiction: settings.reporting_jurisdiction, accounts: accounts.length, changed });
        done++; setProgress({ done, total: targets.length });
      }
      await callLibrary("record_impact", { pack_id: pack.id, report });
      toast.success(`Impact report saved: ${report.totals.changed} of ${report.totals.accounts} accounts would change`);
      await invalidate();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); setProgress(null); }
  };

  const publish = async () => {
    setBusy("publish");
    try { const out = await callLibrary("publish", { pack_id: pack.id, change_note: note }); toast.success(`Version ${out.published} published${out.retired?.length ? `; ${out.retired.join(", ")} retired` : ""}`); await invalidate(); }
    catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  const testResult = pack.test_run_result;
  const impact = pack.impact_report;
  const changedCases = local.filter((r) => r.changed);

  return (
    <div className="space-y-4">
      {/* Reference cases */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><FlaskConical className="w-4 h-4 text-indigo-600" />1. Handbook reference cases</CardTitle>
            <CardDescription>{local.length} cases with the outcome the Standard requires. Every case must pass before a draft can be published. The server runs them again when you publish.</CardDescription>
          </div>
          {isDraft && <Button onClick={runTests} disabled={!!busy}>{busy === "tests" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-1" />}Run tests</Button>}
        </CardHeader>
        <CardContent className="space-y-3">
          {testResult && (
            <Alert className={testResult.passed && testsCurrent ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}>
              <AlertDescription className="text-sm">
                {testsCurrent ? (testResult.passed ? `All ${testResult.total} cases pass` : `${testResult.failed} of ${testResult.total} cases fail`) : "The draft changed since the last test run. Run the tests again."}
                <span className="text-xs text-slate-500"> · {fmt(testResult.run_at)} by {testResult.run_by}</span>
                {testResult.validation_errors?.length > 0 && <ul className="mt-1 text-xs text-red-800 list-disc pl-4">{testResult.validation_errors.map((e, i) => <li key={i}>{e.rule_key}: {e.message}</li>)}</ul>}
              </AlertDescription>
            </Alert>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Case</TableHead><TableHead>Result with this version</TableHead><TableHead>Path vs published</TableHead></TableRow></TableHeader>
              <TableBody>
                {local.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><div className="text-sm font-medium flex items-center gap-1">{r.passed ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}{r.title}</div><div className="text-xs text-slate-500">{r.ref}</div></TableCell>
                    <TableCell className="text-xs">{r.passed ? <span className="text-green-700">Pass · {r.outcome}{r.jurisdictions?.length ? ` · ${r.jurisdictions.join(", ")}` : ""}</span> : <span className="text-red-700">{r.problems.join("; ")}</span>}</TableCell>
                    <TableCell className="text-xs">{r.changed ? <Badge variant="outline" className="border-amber-300 text-amber-800">Path changes</Badge> : <span className="text-slate-400">Same</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {changedCases.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-700">Show changed paths ({changedCases.length})</summary>
              <div className="mt-2 space-y-3">
                {changedCases.map((r) => (
                  <div key={r.id} className="grid gap-2 md:grid-cols-2">
                    <div><p className="font-semibold">{r.title} · published</p><ol className="list-decimal pl-5 font-mono text-[11px] text-slate-600">{r.before.path.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
                    <div><p className="font-semibold">{r.title} · this version</p><ol className="list-decimal pl-5 font-mono text-[11px] text-slate-600">{r.path.map((s, i) => <li key={i} className={r.before.path[i] !== s ? "bg-amber-100" : ""}>{s}</li>)}</ol></div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <TryOnAccounts pack={pack} rules={rules} globalPublished={globalPublished} overridesByScope={overridesByScope} />

      {/* Impact report */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-600" />3. Impact report</CardTitle>
            <CardDescription>Runs every account of the tenants in scope ({scope === "global" ? "all pilot tenants" : `tenants reporting in ${scope}`}) with the published rules and with this version. Read-only: nothing is saved to any account.</CardDescription>
          </div>
          {isDraft && <Button onClick={runImpact} disabled={!!busy}>{busy === "impact" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-1" />}Run impact report</Button>}
        </CardHeader>
        <CardContent className="space-y-3">
          {progress && <div className="space-y-1"><Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} /><p className="text-xs text-slate-500">{progress.done} of {progress.total} tenants</p></div>}
          {impact ? (
            <>
              {!impactCurrent && <Alert className="border-amber-300 bg-amber-50"><AlertDescription className="text-sm">The draft changed since this report. Run it again before publishing.</AlertDescription></Alert>}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                {[["Accounts checked", impact.totals?.accounts], ["Would change", impact.totals?.changed], ["Outcome changes", impact.totals?.outcome_changed], ["Question changes only", impact.totals?.questions_changed], ["Already confirmed", impact.totals?.confirmed_affected]].map(([l, v]) => (
                  <div key={l} className="rounded-lg border p-3"><p className="text-2xl font-bold tabular-nums">{v ?? 0}</p><p className="text-xs text-slate-500">{l}</p></div>
                ))}
              </div>
              <p className="text-xs text-slate-500">{fmt(impact.run_at)} by {impact.run_by} · {(impact.tenants || []).map((t) => `${t.name} (${t.changed}/${t.accounts})`).join(", ") || "no tenants in scope"}</p>
              {impact.totals?.confirmed_affected > 0 && <p className="text-xs text-amber-800">Confirmed decisions keep the rule version they were made with. After publishing, the studio shows these accounts as "data changed since confirmation" so someone can review them.</p>}
              {(impact.changed || []).length > 0 && (
                <div className="overflow-x-auto max-h-80 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader><TableRow><TableHead>Tenant</TableHead><TableHead>Account</TableHead><TableHead>Published rules</TableHead><TableHead>This version</TableHead></TableRow></TableHeader>
                    <TableBody>{impact.changed.map((c) => (
                      <TableRow key={c.account_id}><TableCell className="text-xs">{c.tenant}</TableCell><TableCell className="text-xs">{c.holder}{c.confirmed && <Badge variant="outline" className="ml-1 text-[10px]">confirmed</Badge>}</TableCell>
                        <TableCell className="text-xs font-mono">{c.before}</TableCell><TableCell className={`text-xs font-mono ${c.outcome_changed ? "text-amber-800" : ""}`}>{c.after}</TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : <p className="text-sm text-slate-500">No impact report yet.</p>}
        </CardContent>
      </Card>

      {/* Publish */}
      {isDraft && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Rocket className="w-4 h-4 text-indigo-600" />4. Publish</CardTitle>
            <CardDescription>Publishing makes this version the one the studio uses{scope === "global" ? "" : ` for tenants reporting in ${scope}`} and retires the current one. It doesn't change any account status or confirmed decision.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-sm space-y-1">
              <li className="flex items-center gap-2">{testsCurrent && testResult?.passed ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-slate-400" />}Every reference case passes on the current draft</li>
              <li className="flex items-center gap-2">{impactCurrent ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-slate-400" />}Impact report run on the current draft</li>
              <li className="flex items-center gap-2">{note.trim() ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-slate-400" />}Change note</li>
            </ul>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why (shown in the version list and the audit log)" rows={3} />
            <Button onClick={publish} disabled={!!busy || !(testsCurrent && testResult?.passed && impactCurrent && note.trim())} className="bg-indigo-600 hover:bg-indigo-700">
              {busy === "publish" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Rocket className="w-4 h-4 mr-1" />}Publish version {pack.version}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Pick a pilot tenant and accounts, and compare the published path with this version's path (read-only). */
function TryOnAccounts({ pack, rules, globalPublished, overridesByScope }) {
  const [tenantId, setTenantId] = useState("");
  const [term, setTerm] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data: tenants = [] } = useQuery({
    queryKey: ["rule-library-pilot-tenants"],
    queryFn: async () => (await base44.entities.Tenant.filter({}, "name", 500)).filter((t) => t.enabled_features?.classification_studio === true),
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["rule-library-accounts", tenantId],
    queryFn: () => base44.entities.Account.filter({ tenant_id: tenantId }, "account_holder_name", 5000),
    enabled: !!tenantId,
  });
  const matches = accounts.filter((a) => !term || `${a.account_holder_name || ""} ${a.first_name || ""} ${a.last_name || ""} ${a.account_number || ""}`.toLowerCase().includes(term.toLowerCase())).slice(0, 8);

  const tryAccount = async (account) => {
    setBusy(true);
    try {
      const { input } = await loadStudioInput(base44.entities, account);
      const p = packsFor(pack, rules, globalPublished, overridesByScope, input.settings.reporting_jurisdiction);
      const answers = input.evidence?.draft_gap_answers || {};
      const a = evaluate({ ...input, ...p.published }, answers);
      const b = evaluate({ ...input, ...p.draft }, answers);
      setResult({ account, a, b });
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const path = (r) => r.steps.map((s) => `${s.key}: ${s.gap ? "? " + s.question : s.answer}`);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Search className="w-4 h-4 text-indigo-600" />2. Try on real accounts</CardTitle>
        <CardDescription>Read-only. Compares the published rules with this version on one account, using the tenant's saved studio answers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={tenantId} onValueChange={(v) => { setTenantId(v); setResult(null); }}>
            <SelectTrigger className="w-64"><SelectValue placeholder={tenants.length ? "Choose a pilot tenant" : "No pilot tenants"} /></SelectTrigger>
            <SelectContent>{tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="w-64" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search holder or account number" disabled={!tenantId} />
        </div>
        {tenantId && (
          <div className="flex flex-wrap gap-2">
            {matches.map((a) => (
              <Button key={a.id} size="sm" variant="outline" disabled={busy} onClick={() => tryAccount(a)}>{a.account_holder_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || a.account_number}</Button>
            ))}
            {busy && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
          </div>
        )}
        {result && (
          <div className="grid gap-3 md:grid-cols-2">
            {[["Published rules", result.a], [`This version (${pack.version})`, result.b]].map(([label, r]) => (
              <div key={label} className="border rounded p-3">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs font-mono text-slate-700 mb-2">{summary(r)}</p>
                <ol className="list-decimal pl-5 text-[11px] font-mono text-slate-600 space-y-0.5">{path(r).map((s, i) => <li key={i} className={label !== "Published rules" && path(result.a)[i] !== s ? "bg-amber-100" : ""}>{s}</li>)}</ol>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
