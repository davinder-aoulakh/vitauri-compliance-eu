import { describe, it, expect } from "vitest";
import { evaluate, inputHash, materialSnapshot, resolvePack, BASELINE_RULES, normalizeCountry, buildCountryIndex } from "../../base44/shared/crs/index.js";
import { normalizeWithIndex } from "../../base44/shared/crs/countries.js";

// ---- Shared reference data -------------------------------------------------------------------------------------
const COUNTRIES = [
  ["NL", true], ["NL", true], ["DE", true], ["FR", true], ["BE", true], ["ES", true], ["IT", true], ["CW", true],
  ["US", false], ["VE", false], ["CO", true], ["BVI", true],
].map(([c, p]) => ({ country_code: c, country_name: c, is_crs_country: p, tin_issued_to_all: ["DE", "FR", "ES", "IT", "BE"].includes(c) ? true : undefined }));
const listFor = (codes, version = "TEST-v1") => ({ reporting_jurisdiction: "X", year: 2026, version, status: "published", jurisdictions: codes.map((code) => ({ code })) });

const NL = { settings: { reporting_jurisdiction: "NL", preexisting_cutoff: "2015-12-31", residence_address_test_allowed: true, entity_250k_exemption: true, reporting_currency: "EUR", fx_rates: [{ year: 2025, currency: "EUR", usd_rate: 1.08 }] },
  reportableList: listFor(["DE", "FR", "BE", "ES", "IT", "CO"], "NL-2026-v1"), countries: COUNTRIES, asOf: "2026-11-19" };
const CW = { settings: { reporting_jurisdiction: "CW", preexisting_cutoff: "2015-12-31", residence_address_test_allowed: true, entity_250k_exemption: true, reporting_currency: "USD" },
  reportableList: listFor(["NL", "DE", "FR", "BE", "ES", "IT", "CO", "VG"], "CW-2026-v1"), countries: COUNTRIES, asOf: "2026-11-19" };

const run = (ctx, parts, answers) => evaluate({ ...ctx, ...parts }, answers);
const gapKeys = (r) => r.gaps.map((g) => g.key);

// ---- Mock-up accounts (Netherlands reporting FI) ----------------------------------------------------------------
describe("Mock-up accounts (NL)", () => {
  it("Anna: lower value pre-existing, residence address test → Reportable DE", () => {
    const r = run(NL, {
      account: { account_holder_type: "individual", account_holder_name: "Anna Schmidt", account_type: "depository", account_creation_date: "2014-03-11",
        year_end_cash_value: 84300, year_end_cash_value_currency: "EUR", current_address: { country: "DE" }, tax_residencies: [{ country: "DE", tin: "12345678901" }], non_reportable_exception_type: "none" },
      evidence: { documentary_evidence: [{ type: "Passport", id_number: "C01X00T47", date: "2021-04-02", address_country: "DE" }] },
    });
    expect(r.outcome.status).toBe("reportable");
    expect(r.outcome.jurisdictions).toEqual(["DE"]);
    expect(r.gaps).toHaveLength(0);
    expect(r.steps.find((s) => s.key === "IND_PRE.RESIDENCE_ADDRESS_TEST").answer).toMatch(/^Yes/);
    expect(r.steps.find((s) => s.key === "GEN.BALANCE").answer).toBe("USD 91,044");
  });

  it("Pieter: new account, valid self-cert, NL only → Non-reportable", () => {
    const r = run(NL, { account: { account_holder_type: "individual", account_holder_name: "Pieter de Vries", account_type: "depository", account_creation_date: "2025-02-03",
      year_end_cash_value: 12450, year_end_cash_value_currency: "EUR", current_address: { country: "NL" }, tax_residencies: [{ country: "NL", tin: "123456782" }],
      date_of_birth: "1990-05-01", self_certification_obtained: true, self_certification_date: "2025-02-03" } });
    expect(r.outcome.status).toBe("non_reportable");
    expect(r.gaps).toHaveLength(0);
  });

  it("Tomás: new account, ES self-cert with TIN → Reportable ES (TIN check passes)", () => {
    const r = run(NL, { account: { account_holder_type: "individual", account_holder_name: "Tomás García", account_creation_date: "2026-10-02", year_end_cash_value: 5870, year_end_cash_value_currency: "EUR",
      current_address: { country: "ES" }, tax_residencies: [{ country: "ES", tin: "X1234567L" }], date_of_birth: "1988-03-14", self_certification_obtained: true, self_certification_date: "2026-10-02" } });
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["ES"] });
    expect(r.steps.find((s) => s.key === "IND_NEW.TIN_CHECK").answer).toBe("No");
  });

  it("New account with missing ES TIN asks the TIN question (FAQ II-8)", () => {
    const r = run(NL, { account: { account_holder_type: "individual", account_holder_name: "T", account_creation_date: "2026-10-02", year_end_cash_value: 10,
      current_address: { country: "ES" }, tax_residencies: [{ country: "ES" }], date_of_birth: "1988-03-14", self_certification_obtained: true, self_certification_date: "2026-10-02" } },
    { "IND_NEW.SELF_CERT_VALID": "valid" });
    expect(gapKeys(r)).toEqual(["IND_NEW.TIN_CHECK"]);
  });

  it("Marco: high value with IT indicia → paper search, RM inquiry, cure; not cured → Reportable IT", () => {
    const parts = { account: { account_holder_type: "individual", account_holder_name: "Marco Rossi", account_type: "custodial", account_creation_date: "2011-06-02",
      year_end_cash_value: 1310000, year_end_cash_value_currency: "EUR", current_address: { country: "NL" }, tax_residencies: [{ country: "NL" }] },
      evidence: { crs_indicia: [{ type: "c_phone", country: "IT" }, { type: "d_standing_instruction", country: "IT" }] } };
    expect(gapKeys(run(NL, parts))).toEqual(["IND_PRE.PAPER_SEARCH"]);
    expect(gapKeys(run(NL, parts, { "IND_PRE.PAPER_SEARCH": "complete" }))).toEqual(["IND_PRE.RM_INQUIRY"]);
    expect(gapKeys(run(NL, parts, { "IND_PRE.PAPER_SEARCH": "complete", "IND_PRE.RM_INQUIRY": "none" }))).toEqual(["IND_PRE.CURE"]);
    const r = run(NL, parts, { "IND_PRE.PAPER_SEARCH": "complete", "IND_PRE.RM_INQUIRY": "none", "IND_PRE.CURE": "not_cured" });
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["IT"] });
    // Residence address test is never used for high value accounts
    expect(r.steps.find((s) => s.key === "IND_PRE.RESIDENCE_ADDRESS_TEST").evidence).toMatch(/High value/);
    const cured = run(NL, parts, { "IND_PRE.PAPER_SEARCH": "complete", "IND_PRE.RM_INQUIRY": "none", "IND_PRE.CURE": "cured" });
    expect(cured.outcome.status).toBe("non_reportable");
  });

  it("Marco: an RM attestation for the year answers the RM inquiry from data", () => {
    const r = run(NL, { account: { account_holder_type: "individual", account_holder_name: "M", account_creation_date: "2011-06-02", year_end_cash_value: 2000000, year_end_cash_value_currency: "USD",
      current_address: { country: "NL" }, tax_residencies: [{ country: "NL" }] }, evidence: { rm_attestations: [{ year: 2026, knowledge: "none", relationship_manager: "j.peters" }] } },
    { "IND_PRE.PAPER_SEARCH": "complete" });
    expect(r.steps.find((s) => s.key === "IND_PRE.RM_INQUIRY").source).toBe("data");
    expect(r.outcome.status).toBe("non_reportable");
  });

  it("Jan: hold-mail only, no reply → Undocumented", () => {
    const parts = { account: { account_holder_type: "individual", account_holder_name: "Jan Vos", account_creation_date: "2009-04-09", year_end_cash_value: 22000, year_end_cash_value_currency: "EUR" },
      evidence: { hold_mail_only: true } };
    expect(gapKeys(run(NL, parts))).toEqual(["IND_PRE.HOLD_MAIL"]);
    expect(run(NL, parts, { "IND_PRE.HOLD_MAIL": "none" }).outcome.status).toBe("undocumented");
  });

  it("Helios: new Passive NFE with FR controlling person → Reportable FR", () => {
    const r = run(NL, { account: { account_holder_type: "entity", account_holder_name: "Helios Holding B.V.", account_type: "custodial", account_creation_date: "2024-09-12",
      year_end_cash_value: 3100000, year_end_cash_value_currency: "EUR", country_of_incorporation_code: "NL", self_certification_obtained: true, entity_classification: "passive_nfe" },
    controllingPersons: [
      { full_name: "Julien Martin", control_type: "legal_person_ownership", ownership_percentage: 60, tax_residencies: [{ country: "FR", tin: "1" }], self_certification_obtained: true },
      { full_name: "Kees Jansen", control_type: "legal_person_ownership", ownership_percentage: 40, tax_residencies: [{ country: "NL" }], self_certification_obtained: true }] });
    expect(r.outcome.status).toBe("reportable");
    expect(r.outcome.jurisdictions).toEqual(["FR"]);
    expect(r.outcome.persons[0]).toMatchObject({ name: "Julien Martin", jurisdictions: ["FR"] });
  });

  it("Helios: unknown status → asks, and 'Can't determine' presumes Passive NFE (¶215)", () => {
    const parts = { account: { account_holder_type: "entity", account_holder_name: "Helios", account_creation_date: "2024-09-12", year_end_cash_value: 100, year_end_cash_value_currency: "USD",
      country_of_incorporation_code: "NL", self_certification_obtained: true }, controllingPersons: [{ full_name: "J", control_type: "legal_person_ownership", tax_residencies: [{ country: "FR" }], self_certification_obtained: true }] };
    expect(gapKeys(run(NL, parts))).toEqual(["ENT.STATUS"]);
    expect(run(NL, parts, { "ENT.STATUS": "unknown" }).outcome).toMatchObject({ status: "reportable", jurisdictions: ["FR"] });
    expect(run(NL, parts, { "ENT.STATUS": "active_nfe" }).outcome.status).toBe("non_reportable");
  });

  it("Joint account: each holder checked, full balance to each", () => {
    const r = run(NL, { account: { account_holder_type: "individual", account_creation_date: "2022-06-07", year_end_cash_value: 64000, year_end_cash_value_currency: "EUR" },
      evidence: { joint_holders: [
        { name: "Eva Meijer", tax_residencies: [{ country: "NL", tin: "1" }], address_country: "NL", date_of_birth: "1990-01-01", self_certification_obtained: true, self_certification_date: "2022-06-07" },
        { name: "Lucas Meijer", tax_residencies: [{ country: "FR", tin: "2" }], address_country: "FR", date_of_birth: "1989-01-01", self_certification_obtained: true, self_certification_date: "2022-06-07" }] } });
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["FR"] });
    expect(r.outcome.persons.map((p) => p.name)).toEqual(["Lucas Meijer"]);
    expect(r.outcome.reason).toMatch(/full balance/);
  });
});

// ---- ACME-style accounts (Curaçao reporting FI, USD) ------------------------------------------------------------
describe("ACME-style accounts (CW)", () => {
  it("Pre-existing entity under USD 250k with exemption elected → not reviewed", () => {
    const r = run(CW, { account: { account_holder_type: "entity", account_type: "equity_debt_interest", account_creation_date: "2014-01-01", year_end_cash_value: 180000, year_end_cash_value_currency: "USD", country_of_incorporation: "Curaçao" } });
    expect(r.outcome.status).toBe("non_reportable");
    expect(r.outcome.reason).toMatch(/250,000 exemption/);
  });

  it("Pre-existing entity above 250k, incorporated in NL (reportable for CW), active NFE → Reportable NL", () => {
    const r = run(CW, { account: { account_holder_type: "entity", account_holder_name: "Dutch BV", account_type: "equity_debt_interest", account_creation_date: "2014-01-01",
      year_end_cash_value: 900000, year_end_cash_value_currency: "USD", country_of_incorporation_code: "NL", entity_classification: "active_nfe" } });
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["NL"] });
  });

  it("Managed investment entity in Curaçao → financial institution, not reportable", () => {
    const r = run(CW, { account: { account_holder_type: "entity", account_creation_date: "2020-01-01", year_end_cash_value: 5e6, year_end_cash_value_currency: "USD", country_of_incorporation: "Curacao",
      self_certification_obtained: true, gross_income_from_financial_assets: true, entity_managed_by_asset_manager: true } });
    expect(r.outcome.status).toBe("non_reportable");
    expect(r.steps.find((s) => s.key === "ENT.STATUS").answer).toMatch(/Financial institution/);
  });

  it("Managed investment entity in a non-participating jurisdiction → Passive NFE, look-through (VIII(D)(8))", () => {
    const r = run(CW, { account: { account_holder_type: "entity", account_creation_date: "2020-01-01", year_end_cash_value: 5e6, year_end_cash_value_currency: "USD", country_of_incorporation_code: "VE",
      self_certification_obtained: true, entity_classification: "financial_institution", type_of_financial_institution: "investment_entity_type_b" },
    controllingPersons: [{ full_name: "Ana Pérez", control_type: "legal_person_ownership", ownership_percentage: 100, tax_residencies: [{ country: "CO" }], self_certification_obtained: true }] });
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["CO"] });
  });

  it("New Passive NFE without controlling-person self-certs → asks; 'not yet' stops (¶217)", () => {
    const parts = { account: { account_holder_type: "entity", account_creation_date: "2023-01-01", year_end_cash_value: 50000, year_end_cash_value_currency: "USD", country_of_incorporation_code: "CW",
      self_certification_obtained: true, crs_entity_classification: "CRS101" }, controllingPersons: [{ full_name: "X", control_type: "legal_person_ownership", country_of_residence_code: "NL" }] };
    expect(gapKeys(run(CW, parts))).toEqual(["CP.SELF_CERT"]);
    const r = run(CW, parts, { "CP.SELF_CERT": "not_yet" });
    expect(r.outcome.status).toBe("pending");
    expect(r.outcome.action_required).toBe(true);
  });

  it("Pre-existing Passive NFE ≤ USD 1M relies on AML/KYC for controlling persons (¶199)", () => {
    const r = run(CW, { account: { account_holder_type: "entity", account_creation_date: "2012-01-01", year_end_cash_value: 600000, year_end_cash_value_currency: "USD", country_of_incorporation_code: "CW",
      entity_classification: "passive_nfe" }, controllingPersons: [{ full_name: "Y", control_type: "legal_person_ownership", country_of_residence_code: "NL" }] });
    expect(r.gaps).toHaveLength(0);
    expect(r.steps.find((s) => s.key === "CP.SELF_CERT").answer).toBe("Not required");
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["NL"] });
  });

  it("Trust: residence from the trustee; controlling persons by role", () => {
    const r = run(CW, { account: { account_holder_type: "entity", account_holder_entity_type: "Trust", account_creation_date: "2024-05-06", year_end_cash_value: 2450000, year_end_cash_value_currency: "USD",
      self_certification_obtained: true, entity_classification: "passive_nfe" },
    controllingPersons: [
      { full_name: "H. de Graaf", control_type: "trust_trustee", address: { country: "CW" }, self_certification_obtained: true },
      { full_name: "P. Dumont", control_type: "trust_protector", tax_residencies: [{ country: "BE" }], self_certification_obtained: true },
      { full_name: "S. van Leeuwen", control_type: "trust_beneficiary", tax_residencies: [{ country: "DE" }], self_certification_obtained: true }] });
    expect(r.steps.find((s) => s.key === "ENT.RESIDENCE").evidence).toMatch(/trustee/);
    expect(r.outcome.jurisdictions.sort()).toEqual(["BE", "DE"]);
    expect(r.outcome.persons.map((p) => p.role)).toEqual(["Protector", "Beneficiary"]);
  });

  it("Pre-existing individual cash value insurance with a legal sales bar → not reported (¶158)", () => {
    const r = run(CW, { account: { account_holder_type: "individual", account_type: "cash_value_insurance", account_creation_date: "2010-01-01", year_end_cash_value: 50000, year_end_cash_value_currency: "USD",
      tax_residencies: [{ country: "NL" }] }, evidence: { insurance_sale_prohibited: true } });
    expect(r.outcome.status).toBe("non_reportable");
    expect(r.outcome.reason).toMatch(/¶158/);
  });

  it("Pre-existing individual annuity with an NL residence, no documentary evidence → identified resident → Reportable NL", () => {
    const r = run(CW, { account: { account_holder_type: "individual", account_holder_name: "Annuitant", account_type: "annuity", account_creation_date: "2010-01-01", year_end_cash_value: 50000,
      year_end_cash_value_currency: "USD", tax_residencies: [{ country: "NL" }], current_address: { country: "NL" } } });
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["NL"] });
  });

  it("Excluded account stops at the first step", () => {
    const r = run(CW, { account: { account_holder_type: "individual", non_reportable_exception_type: "qualifying_pension" } });
    expect(r.outcome.status).toBe("excluded");
    expect(r.steps).toHaveLength(1);
  });

  it("Missing balance asks for the band instead of guessing", () => {
    const r = run(CW, { account: { account_holder_type: "individual", account_creation_date: "2010-01-01" } });
    expect(gapKeys(r)).toEqual(["GEN.BALANCE"]);
  });

  it("Missing creation date falls back to the is_pre_existing flag", () => {
    const r = run(CW, { account: { account_holder_type: "individual", is_pre_existing: false, year_end_cash_value: 10, tax_residencies: [{ country: "CW" }] } });
    expect(r.steps.find((s) => s.key === "GEN.PREEXISTING").evidence).toMatch(/is_pre_existing/);
  });
});

// ---- Settings, rule pack and helpers ----------------------------------------------------------------------------
describe("Settings and rule pack", () => {
  it("Wider approach makes any foreign residence reportable", () => {
    const parts = { account: { account_holder_type: "individual", account_holder_name: "U", account_creation_date: "2026-01-01", year_end_cash_value: 1, current_address: { country: "US" },
      tax_residencies: [{ country: "US", tin: "1" }], date_of_birth: "1980-01-01", self_certification_obtained: true, self_certification_date: "2026-01-01" } };
    expect(run(CW, parts).outcome.status).toBe("non_reportable");
    expect(run({ ...CW, settings: { ...CW.settings, wider_approach: true } }, parts).outcome).toMatchObject({ status: "reportable", jurisdictions: ["US"] });
  });

  it("A published pack can change a parameter (USD 1M threshold)", () => {
    const parts = { account: { account_holder_type: "individual", account_creation_date: "2010-01-01", year_end_cash_value: 600000, year_end_cash_value_currency: "USD", current_address: { country: "CW" } } };
    expect(gapKeys(run(CW, parts))).toEqual([]);
    const pack = { version: "1.1.0", rules: [{ rule_key: "GEN.BALANCE", params: { high_value_threshold_usd: 500000 } }] };
    expect(gapKeys(run({ ...CW, pack }, parts))).toEqual(["IND_PRE.PAPER_SEARCH"]);
    expect(run({ ...CW, pack }, parts).rule_pack_version).toBe("1.1.0");
  });

  it("Locked rules can't be disabled by a published pack", () => {
    const pack = resolvePack({ version: "9", rules: [{ rule_key: "IND_PRE.INDICIA_SEARCH", enabled: false, question: "Reworded" }] });
    const rule = pack.rules.find((r) => r.rule_key === "IND_PRE.INDICIA_SEARCH");
    expect(rule.enabled).toBe(true);
    expect(rule.question).toBe("Reworded");
  });

  it("Every baseline rule has CRS and Handbook references", () => {
    for (const r of BASELINE_RULES) {
      expect(r.crs_ref, r.rule_key).toBeTruthy();
      expect(r.hb_ref, r.rule_key).toBeTruthy();
    }
  });

  it("Country normalisation and de-duplication", () => {
    expect(normalizeCountry("Curaçao")).toBe("CW");
    expect(normalizeCountry("BVI")).toBe("VG");
    expect(normalizeCountry("nl")).toBe("NL");
    expect(Object.keys(buildCountryIndex(COUNTRIES).byCode).filter((c) => c === "NL")).toHaveLength(1);
  });

  it("Input hash ignores non-material fields and changes on material ones", async () => {
    const base = { ...CW, account: { account_holder_type: "individual", current_address: { country: "CW" }, year_end_cash_value: 10, current_email: "a@x.test" } };
    const h1 = await inputHash(base);
    const h2 = await inputHash({ ...base, account: { ...base.account, current_email: "b@x.test" } });
    const h3 = await inputHash({ ...base, account: { ...base.account, current_address: { country: "NL" } } });
    expect(h1).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(h2).toBe(h1);
    expect(h3).not.toBe(h1);
    expect(materialSnapshot(base).account.current_email).toBeUndefined();
  });
});

// ---- Regressions found in the ACME dry run (19 Nov 2026) -------------------------------------------------------
describe("ACME dry-run regressions", () => {
  const NAMED = [
    { country_code: "SR", country_name: "Suriname", is_crs_country: false },
    { country_code: "GD", country_name: "Grenada", is_crs_country: true },
    { country_code: "CL", country_name: "Chile", is_crs_country: true },
    { country_code: "IN", country_name: "India", is_crs_country: true },
    { country_code: "BE", country_name: "Belgium", is_crs_country: true },
    { country_code: "CW", country_name: "Curaçao", is_crs_country: true },
  ];
  const CWN = { ...CW, countries: NAMED, reportableList: listFor(["GD", "CL", "IN", "BE"], "CW-2026-v1") };

  it("Recognises full country names from the country table", () => {
    const idx = buildCountryIndex(NAMED);
    expect(normalizeWithIndex(idx, "Suriname")).toBe("SR");
    expect(normalizeWithIndex(idx, "grenada")).toBe("GD");
    expect(normalizeWithIndex(idx, "Atlantis")).toBeNull();
  });

  it("Uses named tax residences (Chile, Grenada) before the place of incorporation", () => {
    const r = run(CWN, { account: { account_holder_type: "entity", account_holder_name: "X", account_creation_date: "2004-06-17", year_end_cash_value: 1000050, year_end_cash_value_currency: "USD",
      tax_residencies: [{ country: "Chile" }, { country: "Grenada" }], country_of_incorporation: "India", entity_classification: "active_nfe" } });
    expect(r.outcome.jurisdictions.sort()).toEqual(["CL", "GD"]);
    expect(r.steps.find((s) => s.key === "ENT.RESIDENCE").evidence).toMatch(/self-certified tax residence/);
  });

  it("A default type_of_financial_institution does not override an explicit Passive NFE classification", () => {
    const r = run(CWN, { account: { account_holder_type: "entity", account_creation_date: "2017-07-03", year_end_cash_value: 4000000, year_end_cash_value_currency: "USD",
      tax_residencies: [{ country: "Curaçao" }], entity_classification: "passive_nfe", type_of_financial_institution: "investment_entity_type_b", gross_income_from_financial_assets: true, self_certification_obtained: true },
    controllingPersons: [{ full_name: "B", control_type: "legal_arrangement_beneficiary_equivalent", tax_residencies: [{ country: "Belgium" }], self_certification_obtained: true }] });
    expect(r.steps.find((s) => s.key === "ENT.STATUS").answer).toBe("Passive NFE");
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["BE"] });
  });

  it("FI-type field alone is a hint, not a classification: asks the status", () => {
    const r = run(CWN, { account: { account_holder_type: "entity", account_creation_date: "2026-10-01", year_end_cash_value: 1500000, year_end_cash_value_currency: "USD",
      tax_residencies: [{ country: "Curaçao" }], type_of_financial_institution: "investment_entity_type_b", gross_income_from_financial_assets: true, entity_managed_by_asset_manager: false, self_certification_obtained: true } });
    expect(gapKeys(r)).toEqual(["ENT.STATUS"]);
    expect(r.gaps[0].help).toMatch(/investment_entity_type_b/);
  });

  it("Explicit FI classification with type (b) outside participating jurisdictions → Passive NFE", () => {
    const r = run(CWN, { account: { account_holder_type: "entity", account_creation_date: "2020-01-01", year_end_cash_value: 5e6, year_end_cash_value_currency: "USD",
      tax_residencies: [{ country: "Suriname" }], entity_classification: "financial_institution", type_of_financial_institution: "investment_entity_type_b", self_certification_obtained: true },
    controllingPersons: [{ full_name: "B", control_type: "legal_person_ownership", tax_residencies: [{ country: "Belgium" }], self_certification_obtained: true }] });
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["BE"] });
  });
});
