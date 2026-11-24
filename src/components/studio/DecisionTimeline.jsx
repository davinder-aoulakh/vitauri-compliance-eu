import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, FileDown, History, Loader2 } from "lucide-react";
import { buildTimeline, changesFor, showValue, OUTCOME_TEXT, SOURCE_TEXT, TRIGGER_TEXT } from "../../../base44/shared/crs/timeline.js";
import { downloadDecisionPdf } from "./decisionExports";
import References from "./References";
import { deglyph } from "../../../base44/shared/crs/references.js";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
const STATUS_CLS = {
  confirmed: "bg-green-50 text-green-800 border-green-200",
  superseded: "bg-slate-100 text-slate-600 border-slate-200",
  proposed: "bg-violet-50 text-violet-800 border-violet-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  checked_no_change: "bg-sky-50 text-sky-800 border-sky-200",
};
const STATUS_TEXT = { checked_no_change: "checked, no change", proposed: "proposed", confirmed: "confirmed", superseded: "superseded", rejected: "not used" };
const SOURCE_CLS = {
  data: "bg-teal-50 text-teal-800 border-teal-200", rule: "bg-slate-100 text-slate-700 border-slate-200", reference: "bg-amber-50 text-amber-800 border-amber-200",
  user: "bg-blue-50 text-blue-800 border-blue-200", ai: "bg-violet-50 text-violet-800 border-violet-200",
};
const LEGACY_LABEL = { workflow: "Manual workflow", auto_classification: "Auto classification", manual: "Manual" };
const STATUS_LABEL = { reportable: "Reportable", non_reportable: "Non-reportable", excluded: "Excluded", pending_review: "Pending review", work_in_progress: "In progress" };

/** Decisions (every status) and legacy history rows for one account. */
export function useAccountDecisions(accountId) {
  const decisionsQ = useQuery({
    queryKey: ["studio-account-decisions", accountId],
    queryFn: () => base44.entities.ClassificationDecision.filter({ target_id: accountId, target_type: "account" }, "-sequence", 200),
    enabled: !!accountId,
  });
  const legacyQ = useQuery({
    queryKey: ["studio-account-legacy-history", accountId],
    queryFn: () => base44.entities.AccountClassificationHistory.filter({ account_id: accountId }, "-classification_date", 200),
    enabled: !!accountId,
  });
  return { decisions: decisionsQ.data || [], legacy: legacyQ.data || [], isLoading: decisionsQ.isLoading || legacyQ.isLoading };
}

/** "Why this outcome": every decision record for the account, plus the older manual history marked as legacy. */
export default function DecisionTimeline({ account, tenantName, user }) {
  const { decisions, legacy, isLoading } = useAccountDecisions(account?.id);
  const entries = buildTimeline(decisions, legacy);
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3 flex items-center gap-1.5"><History className="w-3.5 h-3.5" />Why this outcome · history</p>
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-teal-700" /> : entries.length === 0 ? (
        <p className="text-sm text-slate-500">No decisions yet. Once a decision is confirmed, its full record appears here.</p>
      ) : (
        <ol className="relative border-l border-slate-200 ml-2 space-y-3">
          {entries.map((e) => (
            <li key={`${e.kind}-${e.id}`} className="ml-4">
              <span className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border ${e.kind === "legacy" ? "bg-white border-slate-300" : e.record.status === "confirmed" ? "bg-green-600 border-green-600" : "bg-slate-300 border-slate-300"}`} />
              {e.kind === "legacy" ? <LegacyEntry row={e.record} /> : (
                <DecisionEntry entry={e} decisions={decisions} account={account} tenantName={tenantName} user={user} expanded={open.has(e.id)} onToggle={() => toggle(e.id)} />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LegacyEntry({ row }) {
  return (
    <div className="rounded border border-dashed border-slate-300 p-2.5 text-xs text-slate-600">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">Legacy · {LEGACY_LABEL[row.classification_source] || row.classification_source || "manual"}</Badge>
        <span className="font-semibold text-slate-800">{STATUS_LABEL[row.reportability_status] || row.reportability_status}</span>
        {row.reportable_jurisdictions?.length > 0 && <span>· {row.reportable_jurisdictions.join(", ")}</span>}
        <span className="text-slate-400">{fmt(row.classification_date)}{row.performed_by ? ` · ${row.performed_by}` : ""}</span>
      </div>
      {row.workflow_name && <p className="mt-1">Workflow: {row.workflow_name}</p>}
      {row.classification_reason && <p className="mt-1 line-clamp-3">{row.classification_reason}</p>}
    </div>
  );
}

function DecisionEntry({ entry, decisions, account, tenantName, user, expanded, onToggle }) {
  const d = entry.record;
  const [busy, setBusy] = useState(false);
  const changes = changesFor(d, decisions);
  const pdf = async () => {
    setBusy(true);
    try { await downloadDecisionPdf({ decision: d, account, tenantName, changes, generatedBy: user?.email }); }
    catch (err) { toast.error(`Couldn't create the PDF: ${err.message || err}`); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        <button type="button" onClick={onToggle} className="flex flex-1 min-w-0 flex-wrap items-center gap-2 text-left" aria-expanded={expanded}>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="text-sm font-semibold text-slate-900">#{d.sequence} · {d.status === "checked_no_change" ? "Checked, no change" : `${OUTCOME_TEXT[d.outcome] || d.outcome}${d.reportable_jurisdictions?.length ? ` · ${d.reportable_jurisdictions.join(", ")}` : ""}`}</span>
          <Badge variant="outline" className={`text-[10px] ${STATUS_CLS[d.status] || ""}`}>{STATUS_TEXT[d.status] || d.status}</Badge>
          <span className="text-xs text-slate-500">{TRIGGER_TEXT[d.trigger] || d.trigger} · {d.decided_by === "system" ? "automatic re-check" : d.decided_by} · {fmt(d.decided_at)}</span>
        </button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={pdf} disabled={busy}>{busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1" />}PDF</Button>
      </div>
      {expanded && (
        <div className="border-t p-3 space-y-4 text-xs">
          {d.reason && <p className="text-sm text-slate-700">{deglyph(d.reason)}</p>}
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {[
              ["Decided by", `${d.decided_by || "—"} · ${fmt(d.decided_at)}`],
              ["Second sign-off", d.reviewer ? `${d.reviewer} · ${fmt(d.reviewed_at)}` : "—"],
              ["Supersedes", entry.supersedes ? `#${entry.supersedes.sequence ?? "?"}` : "—"],
              ["Superseded by", entry.supersededBy ? `#${entry.supersededBy.sequence ?? "?"}` : "—"],
              ["Rule pack", d.rule_pack_version || "—"],
              ["Reportable list", d.reportable_list_version || "—"],
              ["Engine", d.engine_version || "—"],
              ["Reporting year", d.reporting_year ?? "—"],
              ["Keep until", d.retention_until || "—"],
              ["Input hash", d.input_hash || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 min-w-0"><dt className="w-28 shrink-0 text-slate-500">{k}</dt><dd className="font-mono text-slate-800 break-all">{v}</dd></div>
            ))}
          </dl>
          {d.note && <p><span className="text-slate-500">Note: </span>{d.note}</p>}
          {d.reportable_persons?.length > 0 && <p><span className="text-slate-500">Reportable persons: </span>{d.reportable_persons.map((p) => `${p.name} (${p.role}: ${(p.jurisdictions || []).join(", ")})`).join("; ")}</p>}

          <div>
            <p className="font-semibold text-slate-700 mb-1">What changed since the previous decision</p>
            {changes.length === 0 ? <p className="text-slate-500">{d.supersedes_id ? "No material input changed." : "First decision for this account."}</p> : (
              <ul className="space-y-0.5">{changes.map((c, i) => <li key={i}><span className="text-slate-500">{c.section} · {c.field}:</span> <span className="line-through text-slate-400 break-all">{showValue(c.before)}</span> → <span className="text-slate-800 break-all">{showValue(c.after)}</span></li>)}</ul>
            )}
          </div>

          <div>
            <p className="font-semibold text-slate-700 mb-1">Decision path · {(d.step_trace || []).length} steps</p>
            <ol className="space-y-2">
              {(d.step_trace || []).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex-none w-5 h-5 rounded-full border text-[10px] font-mono grid place-items-center text-slate-500">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-slate-800">{deglyph(s.question)}</p>
                    <p className="flex flex-wrap items-center gap-1.5 mt-0.5"><span className="font-semibold">{s.answer}</span>
                      <span className={`text-[10px] font-semibold border rounded px-1 ${SOURCE_CLS[s.source] || ""}`}>{SOURCE_TEXT[s.source] || s.source}</span>

                    </p>
                    <References crsRef={s.crs_ref} hbRef={s.hb_ref} />
                    {s.evidence && <p className="font-mono text-[11px] text-slate-500 break-words">{deglyph(s.evidence)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {d.ai_suggestions?.length > 0 && (
            <div>
              <p className="font-semibold text-slate-700 mb-1">AI suggestions</p>
              <ul className="space-y-1">{d.ai_suggestions.map((s, i) => (
                <li key={i}><span className="font-mono">{s.question}</span>: {s.answer} · {typeof s.confidence === "number" ? `${Math.round(s.confidence * 100)}%` : "—"} · {s.accepted ? <span className="text-violet-800">accepted</span> : <span className="text-slate-500">not used</span>}{s.rationale ? <span className="text-slate-600"> — {s.rationale}</span> : null}</li>
              ))}</ul>
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-slate-600">Input snapshot (the data this decision used)</summary>
            <pre className="mt-1 max-h-64 overflow-auto bg-slate-50 border rounded p-2 text-[10.5px]">{JSON.stringify(d.input_snapshot || {}, null, 1)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

/** Compact studio-decision view for the Accounts page history panel. */
export function StudioDecisionSummary({ decisionId, account }) {
  const { data: d, isLoading } = useQuery({
    queryKey: ["studio-decision", decisionId],
    queryFn: async () => (await base44.entities.ClassificationDecision.filter({ id: decisionId }))[0] || null,
    enabled: !!decisionId,
  });
  const { decisions } = useAccountDecisions(d ? account?.id : null);
  const [busy, setBusy] = useState(false);
  if (!decisionId) return null;
  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin text-teal-700" />;
  if (!d) return <p className="text-xs text-slate-500">The studio decision record isn't available.</p>;
  const pdf = async () => {
    setBusy(true);
    try { await downloadDecisionPdf({ decision: d, account, changes: changesFor(d, decisions) }); }
    catch (err) { toast.error(`Couldn't create the PDF: ${err.message || err}`); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded border border-teal-200 bg-teal-50/40 p-2.5 text-xs space-y-1">
      <p className="text-slate-800">
        Decision #{d.sequence} · <strong>{OUTCOME_TEXT[d.outcome] || d.outcome}</strong>{d.reportable_jurisdictions?.length ? ` · ${d.reportable_jurisdictions.join(", ")}` : ""}
        <Badge variant="outline" className={`ml-2 text-[10px] ${STATUS_CLS[d.status] || ""}`}>{d.status}</Badge>
      </p>
      <p className="text-slate-500">{(d.step_trace || []).length} steps · rules {d.rule_pack_version || "—"} · list {d.reportable_list_version || "—"} · kept until {d.retention_until || "—"}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link to={`${createPageUrl("ClassificationStudio")}?account=${encodeURIComponent(account?.id || d.target_id)}`} className="text-teal-800 underline">Open full record in the Studio</Link>
        <button type="button" onClick={pdf} disabled={busy} className="text-teal-800 underline inline-flex items-center gap-1">{busy && <Loader2 className="w-3 h-3 animate-spin" />}Download PDF</button>
      </div>
    </div>
  );
}
