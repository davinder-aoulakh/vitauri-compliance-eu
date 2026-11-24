// Classification Studio — decision history ("Why this outcome"), pure helpers.
// Used by the studio timeline, the Accounts history panel, the PDF and the Excel export, and by the tests.
import { formatCrsRef, parseHandbookRef, deglyph } from "./references.js";

const SECTION_LABELS = { account: "Account", evidence: "Studio evidence", settings: "Settings", linked_balances: "Linked accounts" };

const isBlank = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
};
export const showValue = (v) => (isBlank(v) ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

const dateOf = (e) => e.decided_at || e.classification_date || e.created_date || "";

/**
 * Merge studio decisions and legacy (manual workflow) history rows into one timeline, newest first.
 * History rows written by the studio itself (classification_source "studio") are left out: their decision record is shown instead.
 */
export function buildTimeline(decisions = [], legacyRows = []) {
  const byId = Object.fromEntries(decisions.map((d) => [d.id, d]));
  const studio = decisions.map((d) => ({
    kind: "decision", id: d.id, date: dateOf(d), record: d,
    supersedes: d.supersedes_id ? byId[d.supersedes_id] || { id: d.supersedes_id } : null,
    supersededBy: d.superseded_by_id ? byId[d.superseded_by_id] || { id: d.superseded_by_id } : null,
  }));
  const legacy = legacyRows
    .filter((r) => r.classification_source !== "studio" && r.entry_type !== "workflow_transition")
    .map((r) => ({ kind: "legacy", id: r.id, date: dateOf(r), record: r }));
  return [...studio, ...legacy].sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.record.sequence || 0) - (a.record.sequence || 0));
}

/** The decision a studio decision replaced, for "what changed": the one it supersedes, else the previous by sequence. */
export function previousDecision(decision, decisions = []) {
  if (decision.supersedes_id) return decisions.find((d) => d.id === decision.supersedes_id) || null;
  return decisions.filter((d) => d.target_id === decision.target_id && (d.sequence || 0) < (decision.sequence || 0))
    .sort((a, b) => (b.sequence || 0) - (a.sequence || 0))[0] || null;
}

/**
 * Material fields that changed between two input snapshots: [{section, field, before, after}].
 * Controlling persons are compared by name; versions of the reportable list and rule pack are reported too.
 */
export function snapshotChanges(prev, next) {
  if (!prev || !next) return [];
  const out = [];
  for (const section of ["account", "evidence", "settings"]) {
    const a = prev[section] || {}; const b = next[section] || {};
    for (const field of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (stable(a[field]) !== stable(b[field])) out.push({ section: SECTION_LABELS[section], field, before: a[field], after: b[field] });
    }
  }
  const cpName = (c) => c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
  const cpA = Object.fromEntries((prev.controlling_persons || []).map((c) => [cpName(c), c]));
  const cpB = Object.fromEntries((next.controlling_persons || []).map((c) => [cpName(c), c]));
  for (const name of [...new Set([...Object.keys(cpA), ...Object.keys(cpB)])].sort()) {
    if (!cpA[name]) out.push({ section: "Controlling persons", field: name, before: null, after: "added" });
    else if (!cpB[name]) out.push({ section: "Controlling persons", field: name, before: "present", after: "removed" });
    else {
      for (const field of [...new Set([...Object.keys(cpA[name]), ...Object.keys(cpB[name])])].sort()) {
        if (stable(cpA[name][field]) !== stable(cpB[name][field])) out.push({ section: "Controlling persons", field: `${name} · ${field}`, before: cpA[name][field], after: cpB[name][field] });
      }
    }
  }
  if (stable(prev.linked_balances) !== stable(next.linked_balances)) out.push({ section: SECTION_LABELS.linked_balances, field: "balances", before: prev.linked_balances, after: next.linked_balances });
  for (const field of ["reportable_list_version", "rule_pack_version", "override_pack"]) {
    if ((prev[field] ?? null) !== (next[field] ?? null)) out.push({ section: "Versions", field, before: prev[field] ?? null, after: next[field] ?? null });
  }
  return out;
}

/** "What changed" for a decision: its stored changed_fields when present, else computed from the input snapshots. */
export function changesFor(decision, decisions = []) {
  if (decision.changed_fields?.length) return decision.changed_fields.map((c) => ({ section: "Account", field: c.field, before: c.before, after: c.after }));
  const prev = previousDecision(decision, decisions);
  return prev ? snapshotChanges(prev.input_snapshot, decision.input_snapshot) : [];
}

export const OUTCOME_TEXT = { reportable: "Reportable", non_reportable: "Non-reportable", excluded: "Excluded", undocumented: "Undocumented (reported)" };
export const SOURCE_TEXT = { data: "Account data", rule: "Calculated", reference: "Reference data", user: "User answer", ai: "AI suggestion, accepted" };
export const TRIGGER_TEXT = {
  initial: "First classification", manual: "Confirmed again", change_in_circumstances: "Change in circumstances", balance_threshold: "Balance threshold",
  year_end: "Year end", rm_attestation: "Relationship manager attestation", trust_distribution: "Trust distribution", rule_pack_published: "New rule version", aml_kyc_change: "AML/KYC change",
};

const holderOf = (a) => (a ? a.account_holder_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || "" : "");

/** One flat row per decision (Excel "Decisions" sheet). */
export function decisionRows(decisions = [], accountsById = {}) {
  return decisions.map((d) => {
    const a = accountsById[d.target_id];
    return {
      account_number: a?.account_number || "", holder: holderOf(a) || d.input_snapshot?.account?.account_holder_name || "", account_id: d.target_id,
      outcome: OUTCOME_TEXT[d.outcome] || d.outcome || "", jurisdictions: (d.reportable_jurisdictions || []).join(", "),
      reportable_persons: (d.reportable_persons || []).map((p) => `${p.name} (${p.role}: ${(p.jurisdictions || []).join(", ")})`).join("; "),
      reason: deglyph(d.reason || ""), status: d.status || "", sequence: d.sequence ?? "", trigger: TRIGGER_TEXT[d.trigger] || d.trigger || "",
      supersedes: d.supersedes_id || "", superseded_by: d.superseded_by_id || "", decided_by: d.decided_by || "", decided_at: d.decided_at || "",
      reviewer: d.reviewer || "", reviewed_at: d.reviewed_at || "", reporting_year: d.reporting_year ?? "", reportable_from: d.reportable_from || "",
      rule_pack_version: d.rule_pack_version || "", reportable_list_version: d.reportable_list_version || "", engine_version: d.engine_version || "",
      input_hash: d.input_hash || "", retention_until: d.retention_until || "", note: d.note || "", decision_id: d.id,
    };
  });
}

/** One flat row per step per decision (Excel "Steps" sheet). */
export function stepRows(decisions = [], accountsById = {}) {
  return decisions.flatMap((d) => (d.step_trace || []).map((s, i) => ({
    account_number: accountsById[d.target_id]?.account_number || "", decision_id: d.id, sequence: d.sequence ?? "", step: i + 1,
    step_id: s.step_id || "", question: deglyph(s.question || ""), answer: s.answer || "", source: SOURCE_TEXT[s.source] || s.source || "",
    evidence: deglyph(s.evidence || ""), crs_ref: s.crs_ref ? formatCrsRef(s.crs_ref) : "",
    hb_ref: parseHandbookRef(s.hb_ref).map((x) => (x.printed ? `${x.label} (page ${x.printed})` : x.label)).join(", "),
  })));
}

/** One flat row per AI suggestion (Excel "AI suggestions" sheet). */
export function aiRows(decisions = [], accountsById = {}) {
  return decisions.flatMap((d) => (d.ai_suggestions || []).map((s) => ({
    account_number: accountsById[d.target_id]?.account_number || "", decision_id: d.id, sequence: d.sequence ?? "",
    question: s.question || "", answer: s.answer || "", confidence: typeof s.confidence === "number" ? Math.round(s.confidence * 100) / 100 : "",
    accepted: s.accepted ? "Yes" : "No", rationale: s.rationale || "",
  })));
}
