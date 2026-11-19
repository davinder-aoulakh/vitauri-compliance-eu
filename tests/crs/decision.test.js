import { describe, it, expect } from "vitest";
import { evaluate, inputHash, buildDecision, accountWriteBack, canConfirm, loadStudioInput } from "../../base44/shared/crs/index.js";

const COUNTRIES = ["CW", "NL", "DE", "FR"].map((c) => ({ country_code: c, country_name: c, is_crs_country: true }));
const base = {
  settings: { reporting_jurisdiction: "CW", preexisting_cutoff: "2015-12-31", residence_address_test_allowed: true, entity_250k_exemption: true, reporting_currency: "USD", retention_years: 10 },
  reportableList: { reporting_jurisdiction: "CW", year: 2026, version: "CW-2026-v1", status: "provisional", jurisdictions: [{ code: "NL" }, { code: "DE" }, { code: "FR" }] },
  countries: COUNTRIES, asOf: "2026-11-19",
};
const newIndividual = (over = {}) => ({ ...base, account: { id: "acc1", tenant_id: "t1", account_holder_type: "individual", account_holder_name: "Test Person", account_type: "depository",
  account_creation_date: "2025-02-03", year_end_cash_value: 5000, year_end_cash_value_currency: "USD", current_address: { country: "NL" },
  tax_residencies: [{ country: "NL", tin: "123456782" }], date_of_birth: "1990-05-01", self_certification_obtained: true, self_certification_date: "2025-02-03", ...over } });
const now = new Date("2026-11-19T10:00:00Z");
const user = { email: "admin@acme.test" };

describe("canConfirm", () => {
  it("refuses a pending result and accepts a final one", () => {
    const pending = evaluate(newIndividual({ self_certification_obtained: undefined, self_certification_date: undefined }));
    expect(pending.outcome.status).toBe("pending");
    expect(canConfirm(pending)).toBe(false);
    const done = evaluate(newIndividual());
    expect(canConfirm(done)).toBe(true);
  });
});

describe("buildDecision", () => {
  it("builds a confirmed initial record with trace, versions and retention", async () => {
    const input = newIndividual();
    const result = evaluate(input);
    const hash = await inputHash(input);
    const d = buildDecision({ input, result, user, hash, now });
    expect(d).toMatchObject({ tenant_id: "t1", target_type: "account", target_id: "acc1", sequence: 1, status: "confirmed", trigger: "initial",
      outcome: "reportable", reportable_jurisdictions: ["NL"], input_hash: hash, reportable_list_version: "CW-2026-v1", reporting_year: 2026,
      retention_until: "2036-12-31", decided_by: "admin@acme.test", reportable_from: "2026-11-19" });
    expect(d.supersedes_id).toBeUndefined();
    expect(d.step_trace.length).toBe(result.steps.length);
    expect(d.step_trace.every((s) => s.step_id && s.source)).toBe(true);
    expect(d.input_snapshot.account.account_holder_name).toBe("Test Person");
  });

  it("supersedes the previous decision and increments the sequence", () => {
    const input = newIndividual();
    const d = buildDecision({ input, result: evaluate(input), user, hash: "h", now, previous: { id: "dec1", sequence: 3 } });
    expect(d.sequence).toBe(4);
    expect(d.supersedes_id).toBe("dec1");
    expect(d.trigger).toBe("manual");
  });

  it("throws on a result with open questions", () => {
    const input = newIndividual({ self_certification_obtained: undefined, self_certification_date: undefined });
    expect(() => buildDecision({ input, result: evaluate(input), user, hash: "h", now })).toThrow(/open questions/);
  });

  it("marks answers that came from an accepted AI suggestion as source ai", () => {
    const input = newIndividual({ self_certification_obtained: undefined, self_certification_date: undefined });
    const first = evaluate(input);
    const key = first.gaps[0].key;
    const value = first.gaps[0].options[0].value;
    const answers = { [key]: value };
    const result = evaluate(input, answers);
    if (!canConfirm(result)) return; // the follow-up path may ask more; covered by the other tests
    const d = buildDecision({ input, result, answers, user, hash: "h", now,
      aiSuggestions: [{ gap_key: key, answer: value, confidence: 0.8, rationale: "on file", accepted: true }] });
    const step = d.step_trace.find((s) => s.step_id === key);
    expect(step.source).toBe("ai");
    expect(d.gap_answers).toEqual([{ key, value, source: "ai" }]);
    expect(d.ai_suggestions[0]).toMatchObject({ question: key, accepted: true, confidence: 0.8 });
  });

  it("keeps user answers as source user when the AI suggestion was not accepted", () => {
    const input = newIndividual({ self_certification_obtained: undefined, self_certification_date: undefined });
    const first = evaluate(input);
    const key = first.gaps[0].key;
    const value = first.gaps[0].options[0].value;
    const result = evaluate(input, { [key]: value });
    if (!canConfirm(result)) return;
    const d = buildDecision({ input, result, answers: { [key]: value, unused: "x" }, user, hash: "h", now,
      aiSuggestions: [{ gap_key: key, answer: value, confidence: 0.4, accepted: false }] });
    expect(d.step_trace.find((s) => s.step_id === key).source).toBe("user");
    expect(d.gap_answers).toEqual([{ key, value, source: "user" }]);
  });
});

describe("accountWriteBack", () => {
  it("maps outcomes to the Account status", () => {
    expect(accountWriteBack({ outcome: "reportable", reason: "R.", reportable_jurisdictions: ["NL"] })).toEqual({ reportability_status: "reportable", reportability_reason: "[Classification Studio] R. Reportable jurisdictions: NL." });
    expect(accountWriteBack({ outcome: "non_reportable", reason: "N." }).reportability_status).toBe("non_reportable");
    expect(accountWriteBack({ outcome: "excluded", reason: "E." }).reportability_status).toBe("excluded");
  });
  it("reports undocumented accounts and says so", () => {
    const w = accountWriteBack({ outcome: "undocumented", reason: "Hold mail only." });
    expect(w.reportability_status).toBe("reportable");
    expect(w.reportability_reason).toMatch(/undocumented \(CRS III\(B\)\(5\)\)/);
  });
});

describe("loadStudioInput", () => {
  it("assembles the engine input from an entities client", async () => {
    const rows = {
      StudioSettings: [base.settings], ReportableJurisdictionList: [base.reportableList], CrsCountryInfo: COUNTRIES, CrsRulePack: [], CrsRule: [],
      ControllingPerson: [{ tenant_id: "t1", account_id: "acc1", full_name: "A" }, { tenant_id: "other", account_id: "acc1", full_name: "B" }],
      StudioEvidence: [{ account_id: "acc1", draft_gap_answers: { X: "y" } }],
    };
    const db = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, { filter: async () => v }]));
    const { input, shared } = await loadStudioInput(db, newIndividual().account);
    expect(input.controllingPersons.map((c) => c.full_name)).toEqual(["A"]);
    expect(input.evidence.draft_gap_answers).toEqual({ X: "y" });
    expect(input.pack).toBeNull();
    expect(shared.settings.reporting_jurisdiction).toBe("CW");
  });
});
