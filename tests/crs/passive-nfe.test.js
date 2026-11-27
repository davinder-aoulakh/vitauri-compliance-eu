import { describe, it, expect } from "vitest";
import { evaluate, inputHash, buildDecision } from "../../base44/shared/crs/index.js";

// Passive NFE detection for type (b) entities not managed by a financial institution, and per-controlling-person results.
const COUNTRIES = ["CW", "NL", "DE", "FR", "MC"].map((c) => ({ country_code: c, country_name: c, is_crs_country: true }));
const CW = {
  settings: { reporting_jurisdiction: "CW", preexisting_cutoff: "2015-12-31", residence_address_test_allowed: true, entity_250k_exemption: true, reporting_currency: "USD", retention_years: 10 },
  reportableList: { reporting_jurisdiction: "CW", year: 2026, version: "CW-2026-v1", status: "published", jurisdictions: [{ code: "NL" }, { code: "DE" }, { code: "FR" }] },
  countries: COUNTRIES, asOf: "2026-11-19",
};
const spf = (over = {}) => ({ id: "acc1", tenant_id: "t1", account_holder_type: "entity", account_holder_name: "Test Private Foundation", account_type: "equity_debt_interest",
  account_creation_date: "2020-01-01", year_end_cash_value: 4442117, year_end_cash_value_currency: "USD", country_of_incorporation_code: "CW",
  tax_residencies: [{ country: "CW", tin: "1" }], self_certification_obtained: true, type_of_financial_institution: "investment_entity_type_b",
  entity_classification: "financial_institution", gross_income_from_financial_assets: true, entity_managed_by_fiduciary_trust: false, entity_managed_by_asset_manager: false, ...over });
const cps = [
  { id: "cp1", full_name: "Reportable Person", control_type: "legal_arrangement_beneficiary_equivalent", tax_residencies: [{ country: "DE", tin: "9" }], self_certification_obtained: true },
  { id: "cp2", full_name: "Local Person", control_type: "legal_arrangement_settlor_equivalent", tax_residencies: [{ country: "CW", tin: "8" }], self_certification_obtained: true },
];
const run = (account, controllingPersons = cps) => evaluate({ ...CW, account, controllingPersons });
const status = (r) => r.steps.find((s) => s.key === "ENT.STATUS").answer;

describe("Type (b) entity not managed by a financial institution", () => {
  it("explicit FI, both management flags false → Passive NFE; reportable CP makes the account reportable", () => {
    const r = run(spf());
    expect(status(r)).toMatch(/^Passive NFE · type \(b\)/);
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["DE"] });
    expect(r.outcome.persons.map((p) => p.name)).toEqual(["Reportable Person"]);
    const byId = Object.fromEntries(r.entity.cp_results.map((c) => [c.id, c]));
    expect(byId.cp1).toMatchObject({ looked_through: true, reportable: true, jurisdictions: ["DE"] });
    expect(byId.cp2).toMatchObject({ looked_through: true, reportable: false, jurisdictions: [] });
  });

  it("managed by a fiduciary / trust office → stays a financial institution, not looked through", () => {
    const r = run(spf({ entity_managed_by_fiduciary_trust: true }));
    expect(status(r)).toBe("Financial institution");
    expect(r.outcome.status).toBe("non_reportable");
    expect(r.entity.cp_results.every((c) => c.looked_through === false && c.reportable === false)).toBe(true);
    expect(r.entity.cp_results[0].reason).toMatch(/^Not looked through/);
  });

  it("missing management flags are unknown: an explicit FI stays FI", () => {
    const r = run(spf({ entity_managed_by_fiduciary_trust: undefined, entity_managed_by_asset_manager: undefined }));
    expect(status(r)).toBe("Financial institution");
  });

  it("unclassified, passive income, not managed by an FI → Passive NFE", () => {
    const r = run(spf({ entity_classification: null, type_of_financial_institution: undefined }));
    expect(status(r)).toMatch(/^Passive NFE · mainly passive income/);
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["DE"] });
  });

  it("unclassified type (b) managed by a fiduciary in a participating jurisdiction → FI (managed investment entity)", () => {
    const r = run(spf({ entity_classification: "", entity_managed_by_fiduciary_trust: true }));
    expect(status(r)).toMatch(/^Financial institution · managed investment entity/);
    expect(r.outcome.status).toBe("non_reportable");
  });

  it("explicit Active NFE is kept even with the type (b) field and no manager; CPs are not looked through", () => {
    const r = run(spf({ entity_classification: "active_nfe" }));
    expect(status(r)).toBe("Active NFE");
    expect(r.outcome.status).toBe("non_reportable");
    expect(r.entity.cp_results.find((c) => c.id === "cp1")).toMatchObject({ looked_through: false, reportable: false });
  });

  it("the fiduciary flag is a material input (changing it changes the fingerprint)", async () => {
    const a = await inputHash({ ...CW, account: spf(), controllingPersons: cps });
    const b = await inputHash({ ...CW, account: spf({ entity_managed_by_fiduciary_trust: true }), controllingPersons: cps });
    expect(a).not.toBe(b);
  });
});

describe("buildDecision stores controlling-person results", () => {
  it("includes cp_results with ids, reportability and reasons", async () => {
    const input = { ...CW, account: spf(), controllingPersons: cps };
    const result = evaluate(input);
    const d = buildDecision({ input, result, user: { email: "a@b.test" }, hash: await inputHash(input), now: new Date("2026-11-19T10:00:00Z") });
    expect(d.cp_results).toHaveLength(2);
    expect(d.cp_results[0]).toMatchObject({ controlling_person_id: "cp1", reportable: true, looked_through: true, jurisdictions: ["DE"] });
    expect(d.cp_results[1]).toMatchObject({ controlling_person_id: "cp2", reportable: false });
    expect(d.cp_results[0].reason).toMatch(/Passive NFE/);
  });

  it("individual accounts have no cp_results", async () => {
    const input = { ...CW, account: { id: "i1", tenant_id: "t1", account_holder_type: "individual", account_holder_name: "P", account_creation_date: "2025-02-03", year_end_cash_value: 10,
      current_address: { country: "NL" }, tax_residencies: [{ country: "NL", tin: "1" }], date_of_birth: "1990-01-01", self_certification_obtained: true, self_certification_date: "2025-02-03" } };
    const d = buildDecision({ input, result: evaluate(input), user: { email: "a@b.test" }, hash: await inputHash(input) });
    expect(d.cp_results).toEqual([]);
  });
});
