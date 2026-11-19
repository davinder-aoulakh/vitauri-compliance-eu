import { describe, it, expect } from "vitest";
import { evaluate, inputHash, materialSnapshot, buildDecision, reevaluationOutcome, changeCaseDueDate, changeCaseFields, isSystemProposal } from "../../base44/shared/crs/index.js";

const C = ["CW", "NL", "DE", "FR"].map((c) => ({ country_code: c, country_name: c, is_crs_country: true }));
const base = { settings: { reporting_jurisdiction: "CW", preexisting_cutoff: "2015-12-31", residence_address_test_allowed: true, retention_years: 10 },
  reportableList: { version: "CW-2026-v1", status: "provisional", jurisdictions: [{ code: "NL" }, { code: "DE" }, { code: "FR" }] }, countries: C, asOf: "2026-11-19" };
// New individual resident in CW only → non-reportable
const acct = (over = {}) => ({ id: "a1", tenant_id: "t1", account_holder_type: "individual", account_holder_name: "Cora", email: "cora@x.cw", account_type: "depository",
  account_creation_date: "2025-02-03", year_end_cash_value: 5000, year_end_cash_value_currency: "USD", current_address: { country: "CW" },
  tax_residencies: [{ country: "CW", tin: "1" }], date_of_birth: "1990-05-01", self_certification_obtained: true, self_certification_date: "2025-02-03", ...over });
const input = (over) => ({ ...base, account: acct(over), controllingPersons: [], evidence: {}, linkedAccounts: [] });

async function confirmedFor(inp) {
  const result = evaluate(inp);
  return { ...buildDecision({ input: inp, result, user: { email: "adm@x" }, hash: await inputHash(inp), now: new Date("2026-11-01T00:00:00Z") }), id: "d1" };
}
async function check(confirmed, inp, extra = {}) {
  const result = evaluate(inp, inp.evidence?.draft_gap_answers || {});
  return reevaluationOutcome({ confirmed, result, snapshot: materialSnapshot(inp), hash: await inputHash(inp), lastHash: confirmed.input_hash, ...extra });
}

describe("reevaluationOutcome", () => {
  it("does nothing when only a non-material field (email) changed", async () => {
    const c = await confirmedFor(input());
    expect(c.outcome).toBe("non_reportable");
    expect((await check(c, input({ email: "new@x.cw" }))).kind).toBe("none");
  });
  it("logs 'checked, no change' when the balance changes but the outcome doesn't", async () => {
    const c = await confirmedFor(input());
    const r = await check(c, input({ year_end_cash_value: 9000 }));
    expect(r).toMatchObject({ kind: "no_change", trigger: "change_in_circumstances" });
    expect(r.changes.map((x) => x.field)).toEqual(["year_end_cash_value"]);
  });
  it("flags a change when a residence address in a reportable jurisdiction is added", async () => {
    const c = await confirmedFor(input());
    const r = await check(c, input({ current_address: { country: "NL" } }));
    expect(r.kind).toBe("changed");
    expect(r.trigger).toBe("change_in_circumstances");
    expect(r.final).toBe(false); // the reasonableness question opens
    expect(changeCaseFields(r.changes)[0]).toEqual({ field: "Account · current_address", before: '{"country":"CW"}', after: '{"country":"NL"}' });
  });
  it("flags a final change when a reportable tax residence is added", async () => {
    const c = await confirmedFor(input());
    const r = await check(c, input({ tax_residencies: [{ country: "CW", tin: "1" }, { country: "NL", tin: "2" }] }));
    expect(r).toMatchObject({ kind: "changed", final: true });
  });
  it("labels a version-only change as a new rule version", async () => {
    const c = await confirmedFor(input());
    const inp = { ...input(), reportableList: { ...base.reportableList, version: "CW-2027-v1" } };
    expect(await check(c, inp)).toMatchObject({ kind: "no_change", trigger: "rule_pack_published" });
  });
  it("labels crossing USD 250k / 1M as a balance threshold", async () => {
    const c = await confirmedFor(input());
    expect((await check(c, input({ year_end_cash_value: 300000 }))).trigger).toBe("balance_threshold");
    expect((await check(c, input({ year_end_cash_value: 1200000 }))).trigger).toBe("balance_threshold");
  });
  it("re-checks when forced at the year end even if nothing changed", async () => {
    const c = await confirmedFor(input());
    expect(await check(c, input(), { forced: true })).toMatchObject({ kind: "no_change", trigger: "year_end" });
  });
  it("does nothing without a confirmed decision", async () => {
    const inp = input();
    expect(reevaluationOutcome({ confirmed: null, result: evaluate(inp), snapshot: materialSnapshot(inp), hash: "x" }).kind).toBe("none");
  });
});

describe("changeCaseDueDate", () => {
  it("is 31 December when 90 days ends earlier", () => { expect(changeCaseDueDate("2026-03-01T10:00:00Z")).toBe("2026-12-31"); });
  it("is 90 days later when that runs past the year end", () => { expect(changeCaseDueDate("2026-11-19T10:00:00Z")).toBe("2027-02-17"); });
});

describe("isSystemProposal", () => {
  it("tells studio proposals from second sign-off proposals", () => {
    expect(isSystemProposal({ status: "proposed", decided_by: "system" })).toBe(true);
    expect(isSystemProposal({ status: "proposed", decided_by: "adm@x" })).toBe(false);
    expect(isSystemProposal({ status: "confirmed", decided_by: "system" })).toBe(false);
  });
});
