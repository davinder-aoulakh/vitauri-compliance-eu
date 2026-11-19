// Classification Studio — reference cases (fixtures) for the CRS engine.
// Each case is a Handbook scenario with the outcome and path the Standard requires. They are used by the
// Rule Library test bench, by the publish gate (studioRulePack) and by the Vitest suite, so a rule change that
// breaks a Handbook outcome can't be published.

import { evaluate } from "./engine.js";

const COUNTRIES = [
  ["NL", true], ["DE", true], ["FR", true], ["BE", true], ["ES", true], ["IT", true], ["CW", true], ["US", false], ["VE", false], ["CO", true],
].map(([c, p]) => ({ country_code: c, country_name: c, is_crs_country: p, tin_issued_to_all: ["DE", "FR", "ES", "IT", "BE"].includes(c) ? true : undefined }));
const listFor = (rj, codes) => ({ reporting_jurisdiction: rj, year: 2026, version: `${rj}-FIXTURE`, status: "published", jurisdictions: codes.map((code) => ({ code })) });

const NL = {
  settings: { reporting_jurisdiction: "NL", preexisting_cutoff: "2015-12-31", residence_address_test_allowed: true, entity_250k_exemption: true, reporting_currency: "EUR", fx_rates: [{ year: 2025, currency: "EUR", usd_rate: 1.08 }] },
  reportableList: listFor("NL", ["DE", "FR", "BE", "ES", "IT", "CO"]), countries: COUNTRIES, asOf: "2026-11-19",
};
const CW = {
  settings: { reporting_jurisdiction: "CW", preexisting_cutoff: "2015-12-31", residence_address_test_allowed: true, entity_250k_exemption: true, reporting_currency: "USD" },
  reportableList: listFor("CW", ["NL", "DE", "FR", "BE", "ES", "IT", "CO"]), countries: COUNTRIES, asOf: "2026-11-19",
};

export const FIXTURES = [
  { id: "anna", title: "Lower value pre-existing · residence address test", ref: "HB ¶160–165", ctx: NL,
    parts: { account: { account_holder_type: "individual", account_holder_name: "Anna Schmidt", account_type: "depository", account_creation_date: "2014-03-11", year_end_cash_value: 84300, year_end_cash_value_currency: "EUR",
      current_address: { country: "DE" }, tax_residencies: [{ country: "DE", tin: "12345678901" }] },
    evidence: { documentary_evidence: [{ type: "Passport", id_number: "C01X00T47", date: "2021-04-02", address_country: "DE" }] } },
    expect: { status: "reportable", jurisdictions: ["DE"], gaps: [], steps: { "IND_PRE.RESIDENCE_ADDRESS_TEST": "^Yes" } } },
  { id: "pieter", title: "New individual · valid self-cert · own jurisdiction", ref: "HB ¶181–185", ctx: NL,
    parts: { account: { account_holder_type: "individual", account_holder_name: "Pieter de Vries", account_creation_date: "2025-02-03", year_end_cash_value: 12450, year_end_cash_value_currency: "EUR",
      current_address: { country: "NL" }, tax_residencies: [{ country: "NL", tin: "123456782" }], date_of_birth: "1990-05-01", self_certification_obtained: true, self_certification_date: "2025-02-03" } },
    expect: { status: "non_reportable", gaps: [] } },
  { id: "tin", title: "New individual · TIN missing for a country that issues TINs to all", ref: "FAQ II-8", ctx: NL,
    parts: { account: { account_holder_type: "individual", account_holder_name: "T", account_creation_date: "2026-10-02", year_end_cash_value: 10,
      current_address: { country: "ES" }, tax_residencies: [{ country: "ES" }], date_of_birth: "1988-03-14", self_certification_obtained: true, self_certification_date: "2026-10-02" } },
    answers: { "IND_NEW.SELF_CERT_VALID": "valid" }, expect: { status: "pending", gaps: ["IND_NEW.TIN_CHECK"] } },
  { id: "marco", title: "High value · indicia · enhanced review", ref: "HB ¶170–177", ctx: NL,
    parts: { account: { account_holder_type: "individual", account_holder_name: "Marco Rossi", account_type: "custodial", account_creation_date: "2011-06-02", year_end_cash_value: 1310000, year_end_cash_value_currency: "EUR",
      current_address: { country: "NL" }, tax_residencies: [{ country: "NL" }] }, evidence: { crs_indicia: [{ type: "c_phone", country: "IT" }] } },
    answers: { "IND_PRE.PAPER_SEARCH": "complete", "IND_PRE.RM_INQUIRY": "none", "IND_PRE.CURE": "not_cured" },
    expect: { status: "reportable", jurisdictions: ["IT"], gaps: [], steps: { "IND_PRE.RESIDENCE_ADDRESS_TEST": "Not used", "IND_PRE.RM_INQUIRY": "No actual knowledge" } } },
  { id: "sofie", title: "Just over USD 1M · paper search required", ref: "HB ¶170, ¶173", ctx: CW,
    parts: { account: { account_holder_type: "individual", account_holder_name: "Sofie", account_creation_date: "2012-01-01", year_end_cash_value: 1200000, year_end_cash_value_currency: "USD",
      current_address: { country: "CW" }, tax_residencies: [{ country: "CW" }] } },
    expect: { status: "pending", gaps: ["IND_PRE.PAPER_SEARCH"] } },
  { id: "jan", title: "Hold-mail only · no reply → undocumented", ref: "HB ¶166, ¶174", ctx: NL,
    parts: { account: { account_holder_type: "individual", account_holder_name: "Jan Vos", account_creation_date: "2009-04-09", year_end_cash_value: 22000, year_end_cash_value_currency: "EUR" }, evidence: { hold_mail_only: true } },
    answers: { "IND_PRE.HOLD_MAIL": "none" }, expect: { status: "undocumented" } },
  { id: "helios", title: "New Passive NFE · look through to controlling persons", ref: "HB ¶211–219", ctx: NL,
    parts: { account: { account_holder_type: "entity", account_holder_name: "Helios Holding B.V.", account_type: "custodial", account_creation_date: "2024-09-12", year_end_cash_value: 3100000, year_end_cash_value_currency: "EUR",
      country_of_incorporation_code: "NL", self_certification_obtained: true, entity_classification: "passive_nfe" },
    controllingPersons: [
      { full_name: "Julien Martin", control_type: "legal_person_ownership", ownership_percentage: 60, tax_residencies: [{ country: "FR", tin: "1" }], self_certification_obtained: true },
      { full_name: "Kees Jansen", control_type: "legal_person_ownership", ownership_percentage: 40, tax_residencies: [{ country: "NL" }], self_certification_obtained: true }] },
    expect: { status: "reportable", jurisdictions: ["FR"] } },
  { id: "presume", title: "Entity status can't be determined → presumed Passive NFE", ref: "HB ¶215", ctx: NL,
    parts: { account: { account_holder_type: "entity", account_holder_name: "Unknown BV", account_creation_date: "2024-09-12", year_end_cash_value: 100, year_end_cash_value_currency: "USD", country_of_incorporation_code: "NL", self_certification_obtained: true },
      controllingPersons: [{ full_name: "J", control_type: "legal_person_ownership", tax_residencies: [{ country: "FR" }], self_certification_obtained: true }] },
    answers: { "ENT.STATUS": "unknown" }, expect: { status: "reportable", jurisdictions: ["FR"] } },
  { id: "joint", title: "Joint account · each holder gets the full balance", ref: "HB ¶232", ctx: NL,
    parts: { account: { account_holder_type: "individual", account_creation_date: "2022-06-07", year_end_cash_value: 64000, year_end_cash_value_currency: "EUR" },
      evidence: { joint_holders: [
        { name: "Eva Meijer", tax_residencies: [{ country: "NL", tin: "1" }], address_country: "NL", date_of_birth: "1990-01-01", self_certification_obtained: true, self_certification_date: "2022-06-07" },
        { name: "Lucas Meijer", tax_residencies: [{ country: "FR", tin: "2" }], address_country: "FR", date_of_birth: "1989-01-01", self_certification_obtained: true, self_certification_date: "2022-06-07" }] } },
    expect: { status: "reportable", jurisdictions: ["FR"] } },
  { id: "ent250k", title: "Pre-existing entity under USD 250k · exemption elected", ref: "HB ¶189", ctx: CW,
    parts: { account: { account_holder_type: "entity", account_type: "equity_debt_interest", account_creation_date: "2014-01-01", year_end_cash_value: 180000, year_end_cash_value_currency: "USD", country_of_incorporation: "Curaçao" } },
    expect: { status: "non_reportable", steps: { "ENT_PRE.THRESHOLD_250K": "^Yes" } } },
  { id: "typeb", title: "Managed investment entity in a non-participating jurisdiction → Passive NFE", ref: "CRS VIII(D)(8)", ctx: CW,
    parts: { account: { account_holder_type: "entity", account_creation_date: "2020-01-01", year_end_cash_value: 5e6, year_end_cash_value_currency: "USD", country_of_incorporation_code: "VE",
      self_certification_obtained: true, entity_classification: "financial_institution", type_of_financial_institution: "investment_entity_type_b" },
    controllingPersons: [{ full_name: "Ana Pérez", control_type: "legal_person_ownership", ownership_percentage: 100, tax_residencies: [{ country: "CO" }], self_certification_obtained: true }] },
    expect: { status: "reportable", jurisdictions: ["CO"] } },
  { id: "cp1m", title: "Pre-existing Passive NFE ≤ USD 1M · AML/KYC reliance for controlling persons", ref: "HB ¶199", ctx: CW,
    parts: { account: { account_holder_type: "entity", account_creation_date: "2012-01-01", year_end_cash_value: 600000, year_end_cash_value_currency: "USD", country_of_incorporation_code: "CW", entity_classification: "passive_nfe" },
      controllingPersons: [{ full_name: "Y", control_type: "legal_person_ownership", country_of_residence_code: "NL" }] },
    expect: { status: "reportable", jurisdictions: ["NL"], gaps: [], steps: { "CP.SELF_CERT": "Not required" } } },
  { id: "trust", title: "Trust · residence from trustee · controlling persons by role", ref: "HB ¶150–151, Ch. 6.4", ctx: CW,
    parts: { account: { account_holder_type: "entity", account_holder_entity_type: "Trust", account_creation_date: "2024-05-06", year_end_cash_value: 2450000, year_end_cash_value_currency: "USD",
      self_certification_obtained: true, entity_classification: "passive_nfe" },
    controllingPersons: [
      { full_name: "H. de Graaf", control_type: "trust_trustee", address: { country: "CW" }, self_certification_obtained: true },
      { full_name: "P. Dumont", control_type: "trust_protector", tax_residencies: [{ country: "BE" }], self_certification_obtained: true },
      { full_name: "S. van Leeuwen", control_type: "trust_beneficiary", tax_residencies: [{ country: "DE" }], self_certification_obtained: true }] },
    expect: { status: "reportable", jurisdictions: ["BE", "DE"] } },
  { id: "phone", title: "Lower value pre-existing · foreign phone number is an indicium", ref: "CRS III(B)(2)(c), HB ¶167", ctx: CW,
    parts: { account: { account_holder_type: "individual", account_holder_name: "Phone Holder", account_type: "depository", account_creation_date: "2014-06-12", year_end_cash_value: 50000, year_end_cash_value_currency: "USD",
      current_address: { country: "CW" }, country_of_residence: "CW", current_phone: "+32 53 123 456" } },
    answers: { "IND_PRE.CURE": "not_cured" },
    expect: { status: "reportable", jurisdictions: ["BE"], steps: { "IND_PRE.INDICIA_SEARCH": "Belgium|BE" } } },
  { id: "excluded", title: "Excluded account stops at the first step", ref: "CRS VIII(C)(17)", ctx: CW,
    parts: { account: { account_holder_type: "individual", non_reportable_exception_type: "qualifying_pension" } },
    expect: { status: "excluded" } },
];

const sameSet = (a = [], b = []) => [...a].sort().join(",") === [...b].sort().join(",");

/** Evaluate one fixture with a pack (and optional jurisdiction override). */
export function runFixture(fixture, pack, overridePack) {
  const input = { ...fixture.ctx, ...fixture.parts, pack, overridePack };
  return evaluate(input, fixture.answers || {});
}

/** Run every fixture and compare with the expected Handbook outcome. */
export function runFixtures(pack, overridePack) {
  const results = FIXTURES.map((f) => {
    let r; const problems = [];
    try { r = runFixture(f, pack, overridePack); } catch (e) { return { id: f.id, title: f.title, ref: f.ref, passed: false, problems: [`Engine error: ${e.message}`] }; }
    const e = f.expect;
    if (e.status && r.outcome.status !== e.status) problems.push(`Outcome is ${r.outcome.status}, expected ${e.status}`);
    if (e.jurisdictions && !sameSet(r.outcome.jurisdictions, e.jurisdictions)) problems.push(`Jurisdictions are ${r.outcome.jurisdictions.join(", ") || "none"}, expected ${e.jurisdictions.join(", ")}`);
    if (e.gaps && !sameSet(r.gaps.map((g) => g.key), e.gaps)) problems.push(`Open questions are ${r.gaps.map((g) => g.key).join(", ") || "none"}, expected ${e.gaps.join(", ") || "none"}`);
    for (const [key, pattern] of Object.entries(e.steps || {})) {
      const st = r.steps.find((s) => s.key === key);
      if (!st) problems.push(`Step ${key} did not run`);
      else if (!new RegExp(pattern).test(String(st.answer))) problems.push(`Step ${key} answered "${st.answer}", expected ${pattern}`);
    }
    return { id: f.id, title: f.title, ref: f.ref, passed: problems.length === 0, problems, outcome: r.outcome.status, jurisdictions: r.outcome.jurisdictions, path: r.steps.map((s) => `${s.key}: ${s.gap ? "?" : s.answer}`) };
  });
  return { passed: results.every((x) => x.passed), total: results.length, failed: results.filter((x) => !x.passed).length, results };
}
