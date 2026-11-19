import { describe, it, expect } from "vitest";
import { buildTimeline, previousDecision, snapshotChanges, changesFor, decisionRows, stepRows, aiRows } from "../../base44/shared/crs/index.js";

const snap = (over = {}) => ({
  account: { account_holder_name: "Anna", country_of_residence: "NL", year_end_cash_value: 1000, ...(over.account || {}) },
  controlling_persons: over.controlling_persons || [],
  evidence: over.evidence || {},
  linked_balances: [],
  settings: { reporting_jurisdiction: "CW", preexisting_cutoff: "2015-12-31", ...(over.settings || {}) },
  reportable_list_version: over.reportable_list_version ?? "CW-2026-v1",
  rule_pack_version: over.rule_pack_version ?? "1.0.0",
});
const d1 = { id: "d1", target_id: "a1", sequence: 1, status: "superseded", superseded_by_id: "d2", decided_at: "2026-11-01T10:00:00Z", outcome: "non_reportable", input_snapshot: snap(),
  step_trace: [{ step_id: "GEN.EXCLUDED", question: "Excluded?", answer: "No", source: "data", evidence: "none", crs_ref: "VIII(C)(17)", hb_ref: "¶129" }] };
const d2 = { id: "d2", target_id: "a1", sequence: 2, status: "confirmed", supersedes_id: "d1", decided_at: "2026-11-10T10:00:00Z", outcome: "reportable", reportable_jurisdictions: ["DE"],
  reportable_persons: [{ name: "Anna", role: "Account holder", jurisdictions: ["DE"] }],
  input_snapshot: snap({ account: { country_of_residence: "DE" }, rule_pack_version: "1.1.0" }),
  step_trace: [{ step_id: "GEN.EXCLUDED", question: "Excluded?", answer: "No", source: "data" }, { step_id: "IND_PRE.CURE", question: "Cured?", answer: "No", source: "ai", evidence: "AI accepted" }],
  ai_suggestions: [{ question: "IND_PRE.CURE", answer: "not_cured", confidence: 0.734, accepted: true, rationale: "No self-cert on file" }] };
const legacy = [
  { id: "h1", account_id: "a1", classification_date: "2026-05-01T08:00:00Z", classification_source: "workflow", entry_type: "classification", reportability_status: "non_reportable" },
  { id: "h2", account_id: "a1", classification_date: "2026-11-10T10:00:01Z", classification_source: "studio", studio_decision_id: "d2", reportability_status: "reportable" },
  { id: "h3", account_id: "a1", classification_date: "2026-05-01T07:00:00Z", entry_type: "workflow_transition" },
];

describe("buildTimeline", () => {
  it("merges decisions and legacy rows newest first, without studio history rows or transitions", () => {
    const t = buildTimeline([d1, d2], legacy);
    expect(t.map((e) => e.id)).toEqual(["d2", "d1", "h1"]);
    expect(t.map((e) => e.kind)).toEqual(["decision", "decision", "legacy"]);
  });
  it("links the supersede chain", () => {
    const t = buildTimeline([d1, d2], []);
    expect(t[0].supersedes.id).toBe("d1");
    expect(t[1].supersededBy.id).toBe("d2");
  });
});

describe("what changed", () => {
  it("finds the previous decision and the changed fields", () => {
    expect(previousDecision(d2, [d1, d2]).id).toBe("d1");
    expect(previousDecision(d1, [d1, d2])).toBeNull();
    const c = changesFor(d2, [d1, d2]);
    expect(c).toEqual(expect.arrayContaining([
      { section: "Account", field: "country_of_residence", before: "NL", after: "DE" },
      { section: "Versions", field: "rule_pack_version", before: "1.0.0", after: "1.1.0" },
    ]));
    expect(c).toHaveLength(2);
    expect(changesFor(d1, [d1, d2])).toEqual([]);
  });
  it("compares controlling persons by name and evidence fields", () => {
    const a = snap({ controlling_persons: [{ full_name: "J", country_of_residence: "FR" }, { full_name: "K" }] });
    const b = snap({ controlling_persons: [{ full_name: "J", country_of_residence: "BE" }, { full_name: "L" }], evidence: { hold_mail_only: true } });
    const c = snapshotChanges(a, b);
    expect(c.map((x) => `${x.section}|${x.field}|${x.after}`)).toEqual(expect.arrayContaining([
      "Studio evidence|hold_mail_only|true", "Controlling persons|J · country_of_residence|BE", "Controlling persons|K|removed", "Controlling persons|L|added",
    ]));
  });
  it("prefers stored changed_fields", () => {
    const d = { ...d2, changed_fields: [{ field: "address", before: "x", after: "y" }] };
    expect(changesFor(d, [d1, d])).toEqual([{ section: "Account", field: "address", before: "x", after: "y" }]);
  });
});

describe("export rows", () => {
  const accounts = { a1: { id: "a1", account_number: "ACC-1", account_holder_name: "Anna Schmidt" } };
  it("flattens decisions", () => {
    const [r] = decisionRows([d2], accounts);
    expect(r).toMatchObject({ account_number: "ACC-1", holder: "Anna Schmidt", outcome: "Reportable", jurisdictions: "DE", status: "confirmed", sequence: 2, supersedes: "d1", reportable_persons: "Anna (Account holder: DE)" });
  });
  it("flattens steps and AI suggestions", () => {
    const s = stepRows([d1, d2], accounts);
    expect(s).toHaveLength(3);
    expect(s[2]).toMatchObject({ step: 2, step_id: "IND_PRE.CURE", source: "AI suggestion, accepted", evidence: "AI accepted" });
    expect(aiRows([d2], accounts)[0]).toMatchObject({ accepted: "Yes", confidence: 0.73, question: "IND_PRE.CURE" });
  });
});
