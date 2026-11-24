import { describe, it, expect } from "vitest";
import { BASELINE_RULES, parseHandbookRef, formatCrsRef, formatReferencesText, handbookLink, handbookViewerLink, HANDBOOK_URL, deglyph, evaluate, materialSnapshot, FIXTURES, runFixture } from "../../base44/shared/crs/index.js";

describe("Handbook references", () => {
  it("every Handbook reference in the rules resolves to a page", () => {
    const missing = [];
    for (const r of BASELINE_RULES) for (const it of parseHandbookRef(r.hb_ref)) if (it.kind !== "chapter" && !it.pdfPage) missing.push(`${r.rule_key}: ${it.label}`);
    expect(missing).toEqual([]);
  });
  it("turns codes into words with printed pages", () => {
    expect(formatReferencesText("VIII(C)(17)", "Fig. 8, ¶129–130")).toBe("CRS Section VIII(C)(17); Handbook: Figure 8 (page 64), paragraphs 129–130 (page 63)");
    expect(parseHandbookRef("FAQ II-8")[0]).toMatchObject({ kind: "faq", label: "FAQ 8 on Sections II–VII (Annex I)", pdfPage: 153, printed: 151 });
    expect(parseHandbookRef("Part I ¶31")[0]).toMatchObject({ label: "Part I, paragraph 31", pdfPage: 28 });
    expect(parseHandbookRef("Table 3")[0].pdfPage).toBe(88);
    expect(formatCrsRef("V(D)(1), VI(A)(1)")).toBe("CRS Section V(D)(1), VI(A)(1)");
  });
  it("builds a page link only when the Handbook URL is set", () => {
    expect(handbookLink(66, "")).toBeNull();
    expect(handbookLink(66, "https://example.test/hb.pdf")).toBe("https://example.test/hb.pdf#page=66");
  });
  it("links every Handbook reference in the rules to a page of the viewer", () => {
    expect(HANDBOOK_URL).toMatch(/^https:\/\/media\.base44\.com\/.+\.pdf$/);
    expect(handbookViewerLink(66)).toBe("/HandbookViewer?page=66");
    expect(handbookViewerLink(null)).toBeNull();
    expect(handbookViewerLink(66, { url: "" })).toBeNull();
    const items = BASELINE_RULES.flatMap((r) => parseHandbookRef(r.hb_ref));
    expect(items.length).toBeGreaterThan(40);
    for (const it of items) {
      expect(it.pdfPage, it.label).toBeGreaterThanOrEqual(1);
      expect(it.pdfPage, it.label).toBeLessThanOrEqual(174);
      expect(handbookViewerLink(it.pdfPage)).toBe(`/HandbookViewer?page=${it.pdfPage}`);
    }
  });
  it("removes the paragraph sign from free text", () => {
    expect(deglyph("Not reviewed (Handbook ¶189); see ¶160–165 and HB ¶31.")).toBe("Not reviewed (Handbook paragraph 189); see paragraphs 160–165 and Handbook paragraph 31.");
  });
});

const C = ["CW", "NL", "BE", "VE", "CO"].map((c) => ({ country_code: c, country_name: c, is_crs_country: c !== "VE" }));
const ctx = { settings: { reporting_jurisdiction: "CW", preexisting_cutoff: "2015-12-31", residence_address_test_allowed: true }, reportableList: { version: "x", jurisdictions: [{ code: "NL" }, { code: "BE" }, { code: "CO" }] }, countries: C, asOf: "2026-11-24" };
const be = (n) => ({ first_name: n, last_name: "Owner", control_type: "legal_person_ownership", ownership_percentage: 50, tax_residencies: [{ country: "BE" }], is_reportable: true });
const entity = (over) => ({ account_holder_type: "entity", account_holder_name: "E", account_type: "equity_debt_interest", account_creation_date: "2019-04-05", year_end_cash_value: 1500000, year_end_cash_value_currency: "USD", country_of_incorporation: "CW", self_certification_obtained: true, ...over });

describe("controlling persons are always shown on entity accounts", () => {
  it("Friday-BV case: type (b) investment entity in a participating jurisdiction is not looked through, and the step says why", () => {
    const r = evaluate({ ...ctx, account: entity({ entity_classification: "financial_institution", type_of_financial_institution: "investment_entity_type_b" }), controllingPersons: [be("A"), be("B")] });
    expect(r.outcome.status).toBe("non_reportable");
    const st = r.steps.find((s) => s.key === "CP.LOOK_THROUGH");
    expect(st.answer).toBe("No");
    expect(st.evidence).toMatch(/participating jurisdiction/);
    expect(st.evidence).toMatch(/A Owner/);
    expect(st.evidence).toMatch(/2 of them have a residence in a reportable jurisdiction/);
    expect(r.entity).toMatchObject({ status: "fi", look_through: false, reportable_count: 2 });
    expect(r.outcome.reason).toMatch(/own CRS reporting/);
  });
  it("the same entity in a non-participating jurisdiction is looked through and reportable", () => {
    const r = evaluate({ ...ctx, account: entity({ country_of_incorporation: "VE", entity_classification: "financial_institution", type_of_financial_institution: "investment_entity_type_b" }), controllingPersons: [{ ...be("A"), self_certification_obtained: true }] });
    expect(r.steps.find((s) => s.key === "CP.LOOK_THROUGH").answer).toMatch(/^Yes/);
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["BE"] });
  });
  it("an Active NFE lists its controlling persons but doesn't look through", () => {
    const r = evaluate({ ...ctx, account: entity({ entity_classification: "active_nfe" }), controllingPersons: [be("A")] });
    expect(r.steps.find((s) => s.key === "CP.LOOK_THROUGH").evidence).toMatch(/Active NFE/);
    expect(r.outcome.status).toBe("non_reportable");
  });
  it("while the entity status is open, the question previews what the controlling persons would mean", () => {
    const r = evaluate({ ...ctx, account: entity({}), controllingPersons: [be("A")] });
    expect(r.gaps[0].key).toBe("ENT.STATUS");
    expect(r.gaps[0].help).toMatch(/If this is a Passive NFE.*BE.*reportable/);
    expect(r.entity.controlling_persons).toHaveLength(1);
  });
});

describe("deceased holders and beneficiaries", () => {
  const f = (id) => FIXTURES.find((x) => x.id === id);
  it("insurance beneficiaries of a deceased holder are checked as account holders", () => {
    const r = runFixture(f("insurance_heirs"), null);
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["NL"] });
    expect(r.outcome.persons[0]).toMatchObject({ name: "Heir One", role: "Beneficiary entitled to payment" });
    expect(r.holders.names).toEqual(["Heir One", "Heir Two"]);
  });
  it("asks for a beneficiary's residence when none is recorded", () => {
    const fx = f("insurance_heirs");
    const parts = { ...fx.parts, beneficiaries: [{ account_id: "acc-ins", full_name: "No Address" }] };
    const r = evaluate({ ...fx.ctx, ...parts });
    expect(r.gaps.map((g) => g.key)).toEqual(["IND.BENEFICIARIES@b1"]);
  });
  it("with the death certificate on file, asks who holds the account; estate → excluded, heirs → heirs checked", () => {
    const fx = f("estate");
    expect(evaluate({ ...fx.ctx, ...fx.parts }).gaps.map((g) => g.key)).toEqual(["IND.DECEASED"]);
    const heirs = evaluate({ ...fx.ctx, ...fx.parts, beneficiaries: [{ full_name: "Heir", address: { country: "BE" }, tax_residencies: [{ country: "BE" }] }] }, { "IND.DECEASED": "heirs" });
    expect(heirs.outcome).toMatchObject({ status: "reportable", jurisdictions: ["BE"] });
  });
  it("a living holder's beneficiaries are listed but are not account holders", () => {
    const r = evaluate({ ...ctx, account: { account_holder_type: "individual", account_holder_name: "Alive", account_type: "cash_value_insurance", account_creation_date: "2012-01-01", year_end_cash_value: 5000, year_end_cash_value_currency: "USD", current_address: { country: "CW" }, account_holder_is_alive: true },
      beneficiaries: [{ full_name: "Child", address: { country: "NL" } }] });
    expect(r.steps.find((s) => s.key === "IND.DECEASED").answer).toMatch(/alive/);
    expect(r.outcome.status).toBe("non_reportable");
  });
});

describe("input fingerprint", () => {
  it("is unchanged for accounts without deceased or beneficiary data", () => {
    const snap = materialSnapshot({ ...ctx, account: entity({ account_holder_is_alive: true }), controllingPersons: [] });
    expect(Object.keys(snap)).not.toContain("deceased");
    expect(Object.keys(snap)).not.toContain("beneficiaries");
    const dead = materialSnapshot({ ...ctx, account: { account_holder_is_alive: false }, beneficiaries: [{ full_name: "B" }] });
    expect(dead.deceased).toEqual({ account_holder_is_alive: false });
    expect(dead.beneficiaries).toEqual([{ full_name: "B" }]);
  });
});
