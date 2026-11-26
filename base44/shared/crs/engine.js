// Classification Studio — CRS engine (pure; runs in the browser and in Deno backend functions).
//
// evaluate(input, answers) walks the OECD CRS due-diligence procedures (Implementation Handbook, 2nd ed.,
// Ch. 4, Fig. 13–18) over the data already held. Every step records its answer, where the answer came from
// (data, rule, reference, user) and its CRS / Handbook reference. When the data can't answer a step, the engine
// returns a "gap" question and stops; `answers` (keyed by gap key) resume the walk.
//
// input = {
//   account, controllingPersons[], evidence (StudioEvidence), linkedAccounts[], settings (StudioSettings),
//   reportableList (ReportableJurisdictionList), countries (CrsCountryInfo rows), pack (published CrsRulePack + rules),
//   overridePack (published pack scoped to the reporting jurisdiction, optional), asOf (ISO date)
// }

import { normalizeCountry, normalizeWithIndex, buildCountryIndex, countryName } from "./countries.js";
import { resolvePack, getRule } from "./baselinePack.js";
import { matchesCondition } from "./conditions.js";
import { phoneCountry } from "./phones.js";

export const ENGINE_VERSION = "1.3.0";

const EXCLUDED_TYPES = {
  inheritance_estate: "Estate account",
  escrow_court_decree: "Escrow account",
  qualifying_pension: "Retirement or pension account",
  overdraft_deposit: "Depository account from a not-returned overpayment",
  pre_existing_dormant_below_1k: "Low-risk dormant account (USD 1,000 or less)",
};
const NOT_REPORTABLE_PERSON = {
  publicly_traded: "listed corporation or a related entity",
  international_organization: "international organisation",
};
const INSURANCE_TYPES = ["cash_value_insurance", "annuity"];
const CP_ROLE_LABELS = {
  legal_person_ownership: "Owner",
  legal_person_other_means: "Control by other means",
  legal_person_senior_managing_official: "Senior managing official",
  trust_settlor: "Settlor",
  trust_trustee: "Trustee",
  trust_protector: "Protector",
  trust_beneficiary: "Beneficiary",
  trust_other: "Other person in control of the trust",
  legal_arrangement_settlor_equivalent: "Settlor-equivalent",
};

const fmtUsd = (n) => `USD ${Math.round(n).toLocaleString("en-US")}`;
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

class Pending extends Error {}

function makeContext(input = {}, answers = {}) {
  const pack = resolvePack(input.pack, input.overridePack);
  const settings = input.settings || {};
  const index = buildCountryIndex(input.countries || []);
  const norm = (v) => normalizeWithIndex(index, v);
  const fiJur = norm(settings.reporting_jurisdiction);
  const list = input.reportableList || null;
  const listCodes = new Set((list?.jurisdictions || []).map((j) => norm(j.code)).filter(Boolean));
  const listSource = settings.wider_approach ? "wider approach" : list ? `${list.version} (${list.status})` : "participating jurisdictions (no reportable list found)";
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  const steps = [];
  const gaps = [];

  const isReportable = (code) => {
    if (!code || code === fiJur) return false;
    if (settings.wider_approach) return true;
    if (list) return listCodes.has(code);
    return index.participating.has(code);
  };

  const rule = (key) => getRule(pack, key) || { rule_key: key };
  // Optional (unlocked) rules can be switched off pack-wide in the Rule Library.
  const enabled = (key) => rule(key).enabled !== false;

  const step = (key, answer, source, evidence, extra = {}) => {
    const r = rule(key);
    steps.push({ key, question: extra.question || r.question, answer, source, evidence: evidence || "", crs_ref: r.crs_ref || "", hb_ref: r.hb_ref || "", ...(extra.holder ? { holder: extra.holder } : {}) });
  };

  // Ask a question the data can't answer. Returns the chosen option value, or throws Pending.
  const ask = (key, { question, help, options, holder } = {}) => {
    const r = rule(key);
    const gapKey = holder ? `${key}@${holder}` : key;
    const opts = options || r.options || [];
    const value = answers[gapKey];
    if (value !== undefined && value !== null && value !== "") {
      const label = opts.find((o) => o.value === value)?.label || String(value);
      steps.push({ key: gapKey, question: question || r.question, answer: label, value, source: "user", evidence: "", crs_ref: r.crs_ref || "", hb_ref: r.hb_ref || "", ...(holder ? { holder } : {}) });
      return value;
    }
    const gap = { key: gapKey, gap: true, question: question || r.question, help: help || r.help || "", options: opts, crs_ref: r.crs_ref || "", hb_ref: r.hb_ref || "", ai_guidance: r.ai_guidance || "", ...(holder ? { holder } : {}) };
    steps.push(gap);
    gaps.push(gap);
    throw new Pending();
  };

  return { input, answers, pack, settings, index, norm, fiJur, list, listSource, asOf, steps, gaps, isReportable, rule, enabled, step, ask,
    account: input.account || {}, evidence: input.evidence || {}, cps: input.controllingPersons || [],
    beneficiaries: (input.beneficiaries || []).filter((b) => !input.account?.id || !b.account_id || b.account_id === input.account.id),
    info: {} };
}

// ---------------------------------------------------------------------------------------------------------------
// General steps

function excludedAccount(ctx) {
  const ex = ctx.account.non_reportable_exception_type;
  if (ex && EXCLUDED_TYPES[ex]) {
    ctx.step("GEN.EXCLUDED", `Yes · ${EXCLUDED_TYPES[ex]}`, "data", `non_reportable_exception_type = ${ex}`);
    return { status: "excluded", jurisdictions: [], persons: [], reason: `${EXCLUDED_TYPES[ex]}. Excluded accounts are not reviewed or reported (CRS VIII(C)(17)).` };
  }
  ctx.step("GEN.EXCLUDED", "No", "data", ex ? `non_reportable_exception_type = ${ex} (not an excluded-account category)` : "No excluded-account category recorded on the account");
  return null;
}

function preexisting(ctx) {
  const cutoff = ctx.settings.preexisting_cutoff || "2015-12-31";
  const created = ctx.account.account_creation_date;
  const q = `Was the account open on ${cutoff}?`;
  if (created) {
    const pre = String(created).slice(0, 10) <= String(cutoff).slice(0, 10);
    ctx.step("GEN.PREEXISTING", pre ? "Yes · pre-existing" : "No · new account", "rule", `account_creation_date ${created} vs cut-off ${cutoff}`, { question: q });
    return pre;
  }
  if (typeof ctx.account.is_pre_existing === "boolean") {
    ctx.step("GEN.PREEXISTING", ctx.account.is_pre_existing ? "Yes · pre-existing" : "No · new account", "data", "No creation date on file · used is_pre_existing flag", { question: q });
    return ctx.account.is_pre_existing;
  }
  return ctx.ask("GEN.PREEXISTING", { question: q }) === "yes";
}

function fxRate(ctx, currency) {
  if (!currency || currency === "USD") return 1;
  const year = ctx.asOf.getFullYear();
  const rates = (ctx.settings.fx_rates || []).filter((r) => r.currency === currency && r.usd_rate > 0 && (!r.year || r.year <= year));
  rates.sort((a, b) => (b.year || 0) - (a.year || 0));
  return rates[0]?.usd_rate ?? null;
}

function balance(ctx) {
  const params = ctx.rule("GEN.BALANCE").params || {};
  const hv = params.high_value_threshold_usd ?? 1000000;
  const accounts = [ctx.account, ...(ctx.input.linkedAccounts || []).filter((a) => !EXCLUDED_TYPES[a.non_reportable_exception_type])];
  let total = 0; const parts = []; let unknown = false;
  for (const a of accounts) {
    const v = a.year_end_cash_value;
    if (v === null || v === undefined || v === "") { unknown = true; continue; }
    const cur = a.year_end_cash_value_currency || ctx.settings.reporting_currency || "USD";
    const rate = fxRate(ctx, cur);
    if (rate === null) { unknown = true; parts.push(`${cur} ${v} (no FX rate)`); continue; }
    const usd = Math.max(0, Number(v)) * rate;
    total += usd;
    parts.push(cur === "USD" ? fmtUsd(usd) : `${cur} ${Number(v).toLocaleString("en-US")} × ${rate}`);
  }
  if (!unknown) {
    const ev = `${accounts.length} account${accounts.length > 1 ? "s" : ""} in aggregation group · ${parts.join(" + ")}`;
    ctx.step("GEN.BALANCE", `${fmtUsd(total)}${total > hv ? " (high value)" : ""}`, "rule", ev);
    return total;
  }
  const v = ctx.ask("GEN.BALANCE", { help: `The balance or an exchange rate is missing (${parts.join(", ") || "no balance on file"}).` });
  return v === "above_1m" ? hv + 1 : v === "between" ? (params.entity_threshold_usd ?? 250000) + 1 : 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Holders

function residencesOf(ctx, obj) {
  const codes = [];
  for (const r of obj?.tax_residencies || []) codes.push(ctx.norm(r.country));
  for (const c of obj?.multiple_residencies || []) codes.push(ctx.norm(c));
  return uniq(codes);
}

function individualHolders(ctx) {
  if (ctx.holderOverride?.length) return ctx.holderOverride;
  const joint = ctx.evidence.joint_holders || [];
  if (joint.length > 0) {
    return joint.map((h, i) => ({
      id: `h${i + 1}`, name: h.name || `Holder ${i + 1}`, joint: true,
      residences: uniq([...(h.tax_residencies || []).map((r) => ctx.norm(r.country)), ctx.norm(h.country_of_residence)]),
      tins: h.tax_residencies || [],
      addressCountry: ctx.norm(h.address_country || h.address?.country),
      dob: h.date_of_birth, selfCert: h.self_certification_obtained, selfCertDate: h.self_certification_date,
    }));
  }
  const a = ctx.account;
  const name = a.account_holder_name || [a.first_name, a.last_name].filter(Boolean).join(" ");
  return [{
    id: null, name, joint: false,
    residences: uniq([...residencesOf(ctx, a), ctx.norm(a.country_of_residence)]),
    tins: a.tax_residencies || [],
    addressCountry: ctx.norm(a.current_address?.country),
    otherAddressCountry: ctx.norm(a.account_holder_address?.country),
    phoneCountry: phoneCountry(a.current_phone),
    phone: a.current_phone,
    dob: a.date_of_birth,
    selfCert: a.self_certification_obtained === true || (a.documents || []).some((d) => d.document_type === "self_certification") ? true : undefined,
    selfCertDate: a.self_certification_date,
  }];
}

// Deceased holders and beneficiaries (CRS VIII(E)(1) Account Holder; VIII(C)(17)(e) estate accounts)
const personName = (p) => p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed";

function beneficiaryHolder(ctx, b, i, role) {
  const residences = uniq([...(b.tax_residencies || []).map((r) => ctx.norm(r.country)), ctx.norm(b.country_of_residence)]);
  return {
    id: `b${i + 1}`, name: personName(b), joint: true, role,
    residences, tins: b.tax_residencies || [],
    addressCountry: ctx.norm(b.address?.country), otherAddressCountry: null, phoneCountry: null,
    dob: b.date_of_birth, selfCert: b.self_certification_obtained === true ? true : undefined, selfCertDate: b.self_certification_date,
  };
}

/** Beneficiaries entitled to the account become its holders: each needs a residence on record. */
function useBeneficiariesAsHolders(ctx, role, label) {
  const holders = ctx.beneficiaries.map((b, i) => beneficiaryHolder(ctx, b, i, role));
  ctx.info.holders = { label, role, names: holders.map((h) => h.name) };
  for (const h of holders) {
    if (!h.residences.length && !h.addressCountry) {
      ctx.ask("IND.BENEFICIARIES", { holder: h.id, question: `No residence is recorded for ${h.name}. Record their address or tax residence on the beneficiary.` });
      throw new Pending(`Record where ${h.name} is resident, then re-run.`);
    }
  }
  ctx.holderOverride = holders;
}

function deceasedAndBeneficiaries(ctx) {
  const a = ctx.account;
  const bens = ctx.beneficiaries;
  const deceased = a.account_holder_is_alive === false || a.account_holder_deceased_during_period === true;
  const insurance = INSURANCE_TYPES.includes(a.account_type);
  const list = bens.map((b) => personName(b)).join(", ");
  if (!deceased) {
    if (bens.length) {
      ctx.step("IND.DECEASED", "No · the holder is alive", "data",
        `${bens.length} beneficiar${bens.length > 1 ? "ies" : "y"} recorded (${list}). ${insurance ? "On an insurance or annuity contract, beneficiaries become account holders only when they are entitled to a payment" : "Beneficiaries are not account holders while the holder is alive"} (CRS VIII(E)(1)).`);
    }
    return null;
  }
  if (insurance) {
    ctx.step("IND.DECEASED", "Yes · insurance or annuity contract", "data",
      "account_holder_is_alive = false · each person entitled to receive a payment under the contract is treated as an account holder (CRS VIII(E)(1))");
    if (!bens.length) {
      ctx.ask("IND.BENEFICIARIES", { question: "The insured holder has died. Record the beneficiaries entitled to the payment on the account." });
      throw new Pending("Record the beneficiaries entitled to the payment, then re-run.");
    }
    useBeneficiariesAsHolders(ctx, "Beneficiary entitled to payment", `Insurance or annuity paid to ${bens.length} beneficiar${bens.length > 1 ? "ies" : "y"}`);
    return null;
  }
  // Other accounts: the deceased stays the holder until the estate holds it (excluded) or it passes to the heirs.
  const docs = a.death_certificate_received === true || a.will_or_inheritance_received === true;
  let v;
  if (a.legacy_of_deceased_settled === true && bens.length) v = "heirs";
  else if (!docs && a.legacy_of_deceased_settled !== true) v = "deceased";
  if (v) {
    ctx.step("IND.DECEASED", v === "heirs" ? "Yes · passed to the heirs" : "Yes · still in the deceased's name", "data",
      v === "heirs" ? `legacy_of_deceased_settled = true · heirs recorded: ${list}` : "No will or death certificate on file and the legacy isn't settled, so the deceased remains the account holder");
  } else {
    v = ctx.ask("IND.DECEASED", {
      question: `The holder has died${docs ? " and the will or death certificate is on file" : ""}. Who holds the account now?`,
      help: `An account held solely by the estate, with the will or death certificate on file, is an excluded account (CRS VIII(C)(17)(e)). Once it passes to the heirs, each heir is an account holder.${bens.length ? ` Heirs recorded: ${list}.` : ""}`,
    });
  }
  if (v === "estate") {
    return { outcome: { status: "excluded", jurisdictions: [], persons: [], reason: "Estate account: held solely by the estate of a deceased holder, with the will or death certificate on file. Excluded accounts are not reviewed or reported (CRS VIII(C)(17)(e))." } };
  }
  if (v === "heirs") {
    if (!bens.length) {
      ctx.ask("IND.BENEFICIARIES", { question: "The account has passed to the heirs. Record them as beneficiaries on the account." });
      throw new Pending("Record the heirs on the account, then re-run.");
    }
    useBeneficiariesAsHolders(ctx, "Heir", `Account passed to ${bens.length} heir${bens.length > 1 ? "s" : ""}`);
    return null;
  }
  return null;
}

// Controlling persons as recorded, for the "look-through" step and the review screen.
function cpSummary(ctx) {
  return ctx.cps.map((c) => {
    const codes = uniq([...(c.tax_residencies || []).map((r) => ctx.norm(r.country)), ctx.norm(c.country_of_residence_code), ctx.norm(c.country_of_residence), ctx.norm(c.address?.country)]);
    return {
      name: personName(c), role: (CP_ROLE_LABELS[c.control_type] || "Controlling person") + (c.ownership_percentage ? ` · ${c.ownership_percentage}%` : ""),
      residences: codes, reportable_jurisdictions: codes.filter((x) => ctx.isReportable(x)),
      self_certification: c.self_certification_obtained === true, manual_reportable: c.is_reportable ?? null,
    };
  });
}

const cpList = (ctx, people) => people.map((p) => `${p.name} (${p.role}) · ${p.residences.map((c) => countryName(ctx.index, c)).join("/") || "residence not recorded"}${p.reportable_jurisdictions.length ? " · reportable residence" : ""}`).join(" — ");

/** Record whether the controlling persons are looked through, and why not when they aren't. */
function lookThroughStep(ctx, status, { exempt = false } = {}) {
  const a = ctx.account;
  const people = cpSummary(ctx);
  const reportableCount = people.filter((p) => p.reportable_jurisdictions.length).length;
  let applied = status === "passive_nfe"; let why;
  if (exempt) { applied = false; why = "Not reviewed: the account is under the elected USD 250,000 exemption (Handbook ¶189)."; }
  else if (applied) why = "Passive NFE: its controlling persons are looked through (CRS VIII(D)(6)).";
  else if (status === "fi" && a.type_of_financial_institution === "investment_entity_type_b") why = "Investment entity of type (b) resident in a participating jurisdiction: it is a financial institution, not a Passive NFE, so its controlling persons are not looked through on this account (Handbook ¶31). Its owners are reported as holders of equity interests under its own CRS reporting.";
  else if (status === "fi") why = "Financial institution: not a reportable person, and its controlling persons are not looked through (CRS VIII(D)(2)).";
  else if (status === "active_nfe") why = "Active NFE: only Passive NFEs are looked through, so its controlling persons are not reported (CRS VIII(D)(6), Handbook ¶196–197).";
  else why = "The holder is not a reportable entity type for look-through.";
  ctx.info.entity = { status, look_through: applied, reason: why, controlling_persons: people, reportable_count: reportableCount };
  ctx.step("CP.LOOK_THROUGH", applied ? "Yes · Passive NFE" : "No", "rule",
    `${why}${people.length ? ` Recorded: ${cpList(ctx, people)}.` : " No controlling persons recorded."}${!applied && reportableCount ? ` ${reportableCount} of them ${reportableCount > 1 ? "have" : "has"} a residence in a reportable jurisdiction, but that doesn't make this account reportable.` : ""}`);
}

function outcomeFor(ctx, holderName, role, codes, reasonIfReportable, reasonIfNot) {
  const j = uniq(codes).filter((c) => ctx.isReportable(c));
  return {
    status: j.length ? "reportable" : "non_reportable",
    jurisdictions: j,
    persons: j.length ? [{ name: holderName, role, jurisdictions: j }] : [],
    reason: j.length ? reasonIfReportable(j) : reasonIfNot,
  };
}

// Pre-existing individual accounts — Handbook Fig. 13
function individualPreexisting(ctx, h, usd) {
  const a = ctx.account; const ev = ctx.evidence; const tag = h.joint ? h.id : undefined;
  const hvLimit = ctx.rule("GEN.BALANCE").params?.high_value_threshold_usd ?? 1000000;
  const hv = usd > hvLimit || ctx.settings.alt_hv_rules_for_lv === true;
  const names = (codes) => codes.map((c) => countryName(ctx.index, c)).join(", ");

  if (INSURANCE_TYPES.includes(a.account_type) && ctx.enabled("IND_PRE.INSURANCE_BAR")) {
    if (ev.insurance_sale_prohibited === true) {
      ctx.step("IND_PRE.INSURANCE_BAR", "Yes", "data", "insurance_sale_prohibited = true");
      return { status: "non_reportable", jurisdictions: [], persons: [], reason: "Insurance or annuity contract that law bars from sale to residents of reportable jurisdictions (Handbook ¶158)." };
    }
    ctx.step("IND_PRE.INSURANCE_BAR", "No", "data", "No legal sales bar recorded for this contract");
  }

  // Residence address test (lower value only, where allowed)
  const docs = (ev.documentary_evidence || []).filter((d) => d && (d.type || d.id_number));
  const docCountries = uniq(docs.map((d) => ctx.norm(d.address_country)));
  const ratOn = ctx.enabled("IND_PRE.RESIDENCE_ADDRESS_TEST");
  const ratAllowed = ratOn && ctx.settings.residence_address_test_allowed !== false && !hv && ctx.settings.alt_new_rules_for_preexisting !== true;
  if (ratAllowed && docs.length && h.addressCountry && (docCountries.length === 0 || docCountries.includes(h.addressCountry))) {
    ctx.step("IND_PRE.RESIDENCE_ADDRESS_TEST", `Yes · ${countryName(ctx.index, h.addressCountry)}`, "data",
      `${docs.map((d) => d.type).filter(Boolean).join(" + ") || "Documentary evidence"} on file · current_address.country = ${h.addressCountry}`, { holder: tag });
    return outcomeFor(ctx, h.name, h.role || "Account holder", [h.addressCountry],
      (j) => `Lower value pre-existing account. The residence address test places the holder in ${names(j)}, backed by documentary evidence.`,
      `Lower value pre-existing account. The residence address test places the holder in ${countryName(ctx.index, h.addressCountry)}, which is not a reportable jurisdiction.`);
  }
  ctx.step("IND_PRE.RESIDENCE_ADDRESS_TEST", "Not used", "rule",
    hv ? "High value account · the residence address test is not allowed" : !ratOn ? "Switched off in the CRS Rule Library" : !ratAllowed ? "Not allowed by your settings" : "No documentary evidence of the current address on file", { holder: tag });

  // Electronic indicia search
  const recorded = (ev.crs_indicia || []).filter((i) => !i.cured);
  const indicia = [];
  for (const i of recorded) { const c = ctx.norm(i.country); if (c && ctx.isReportable(c)) indicia.push({ type: i.type, country: c, source: i.source || "recorded" }); }
  for (const c of h.residences) if (ctx.isReportable(c)) indicia.push({ type: "a_identified_resident", country: c, source: "tax_residencies" });
  for (const c of uniq([h.addressCountry, h.otherAddressCountry])) if (ctx.isReportable(c)) indicia.push({ type: "b_address", country: c, source: "address" });
  // (c) a current phone number in a reportable jurisdiction and none in the FI's jurisdiction (one phone field on the account)
  if (h.phoneCountry && h.phoneCountry !== ctx.fiJur && ctx.isReportable(h.phoneCountry) && !indicia.some((i) => i.type === "c_phone" && i.country === h.phoneCountry)) {
    indicia.push({ type: "c_phone", country: h.phoneCountry, source: `current_phone ${h.phone}` });
  }
  const holdMailOnly = ev.hold_mail_only === true || (recorded.length > 0 && recorded.every((i) => i.type === "f_hold_mail_in_care_of"));
  const realIndicia = indicia.filter((i) => i.type !== "f_hold_mail_in_care_of");
  const indiciaCountries = uniq(realIndicia.map((i) => i.country));
  ctx.step("IND_PRE.INDICIA_SEARCH", realIndicia.length ? `${realIndicia.length} indici${realIndicia.length > 1 ? "a" : "um"} · ${names(indiciaCountries)}` : holdMailOnly ? "Hold-mail / in-care-of address only" : "None",
    "data", realIndicia.map((i) => `${i.type} ${i.country} (${i.source})`).join(" · ") || "No indicia in a reportable jurisdiction", { holder: tag });

  if (hv) {
    const paper = ctx.ask("IND_PRE.PAPER_SEARCH", { holder: tag });
    if (paper === "paper_new") throw new Pending("Record the further indicia found in the paper search on the account, then re-run.");
    const year = ctx.asOf.getFullYear();
    const att = (ev.rm_attestations || []).find((r) => Number(r.year) === year);
    let rm;
    if (att) { rm = att.knowledge === "knows" ? "knows" : "none"; ctx.step("IND_PRE.RM_INQUIRY", rm === "knows" ? "Yes" : "No actual knowledge", "data", `RM attestation ${year} by ${att.relationship_manager || "relationship manager"}`, { holder: tag }); }
    else rm = ctx.ask("IND_PRE.RM_INQUIRY", { holder: tag });
    if (rm === "knows") {
      const codes = uniq([...h.residences, ...indiciaCountries]);
      if (!codes.length) throw new Pending("Record the residence the relationship manager knows about on the account, then re-run.");
      return outcomeFor(ctx, h.name, h.role || "Account holder", codes,
        (j) => `High value account. The relationship manager knows the holder is resident in ${names(j)}.`,
        "High value account. The relationship manager's knowledge points to no reportable jurisdiction.");
    }
  }

  if (!realIndicia.length) {
    if (holdMailOnly) {
      const r = ctx.ask("IND_PRE.HOLD_MAIL", { holder: tag });
      if (r === "none") return { status: "undocumented", jurisdictions: [], persons: [], reason: "Hold-mail or in-care-of address only, no indicia, and neither the paper record search nor outreach established residence. Report as an undocumented account (Handbook ¶166)." };
      return outcomeFor(ctx, h.name, h.role || "Account holder", h.residences,
        (j) => `Residence established through outreach: ${names(j)}.`, "Residence established through outreach is not in a reportable jurisdiction.");
    }
    return { status: "non_reportable", jurisdictions: [], persons: [], reason: `${hv ? "High value" : "Lower value"} pre-existing account with no indicia of residence in a reportable jurisdiction. Not reported until a change in circumstances.` };
  }

  // Indicia that are not the holder's own recorded tax residences can be cured.
  const curable = indiciaCountries.filter((c) => !h.residences.includes(c));
  if (curable.length === 0) {
    return outcomeFor(ctx, h.name, h.role || "Account holder", indiciaCountries,
      (j) => `Pre-existing account. The holder is identified as resident in ${names(j)}.`, "No reportable residence.");
  }
  const cure = ctx.ask("IND_PRE.CURE", { holder: tag, question: `Have the indicia for ${names(curable)} been cured?` });
  if (cure === "cured") {
    return outcomeFor(ctx, h.name, h.role || "Account holder", h.residences,
      (j) => `Indicia for ${names(curable)} are cured. The self-certification and evidence show residence in ${names(j)}.`,
      `Indicia for ${names(curable)} are cured. The holder's recorded residences are not reportable.`);
  }
  return outcomeFor(ctx, h.name, h.role || "Account holder", indiciaCountries,
    (j) => `Pre-existing account with indicia for ${names(j)} that are not cured, so the holder is treated as resident there (Handbook ¶168).`, "No reportable indicia.");
}

// New individual accounts — Handbook Fig. 14
function individualNew(ctx, h) {
  const tag = h.joint ? h.id : undefined;
  const names = (codes) => codes.map((c) => countryName(ctx.index, c)).join(", ");
  if (h.selfCert === true) ctx.step("IND_NEW.SELF_CERT", `Yes${h.selfCertDate ? ` · dated ${h.selfCertDate}` : ""}`, "data", "self_certification_obtained = true", { holder: tag });
  else if (ctx.ask("IND_NEW.SELF_CERT", { holder: tag }) === "no") throw new Pending("Obtain a self-certification from the account holder (Handbook ¶181).");

  const missing = [];
  if (!h.name) missing.push("name");
  if (!h.addressCountry) missing.push("residence address");
  if (!h.residences.length) missing.push("tax residence");
  const tinGaps = h.residences.filter((c) => c !== ctx.fiJur && !(h.tins.find((t) => ctx.norm(t.country) === c && (t.tin || t.tin_unavailable_reason))));
  if (tinGaps.length) missing.push(`TIN for ${tinGaps.join(", ")}`);
  if (!h.dob) missing.push("date of birth");
  if (!h.selfCertDate) missing.push("date signed");
  if (!missing.length) ctx.step("IND_NEW.SELF_CERT_VALID", "Yes · all required elements present", "data", "name, residence address, tax residence, TIN, date of birth and date are on file", { holder: tag });
  else if (ctx.ask("IND_NEW.SELF_CERT_VALID", { holder: tag, question: `The record is missing: ${missing.join(", ")}. Does the signed self-certification have every element?` }) === "invalid") {
    throw new Pending("Obtain a complete self-certification (Handbook ¶183).");
  }

  const tinRisk = tinGaps.filter((c) => ctx.isReportable(c) && ctx.index.byCode[c]?.tinIssuedToAll === true);
  if (tinRisk.length && ctx.enabled("IND_NEW.TIN_CHECK")) {
    if (ctx.ask("IND_NEW.TIN_CHECK", { holder: tag, question: `${names(tinRisk)} issue${tinRisk.length > 1 ? "" : "s"} TINs to all residents, but no TIN is on file. Has it been obtained or explained?` }) === "missing") {
      throw new Pending("Request the missing TIN. Its absence is a reason to doubt the self-certification (FAQ II-8).");
    }
  } else if (!ctx.enabled("IND_NEW.TIN_CHECK")) ctx.step("IND_NEW.TIN_CHECK", "Not applied", "rule", "Switched off in the CRS Rule Library", { holder: tag });
  else ctx.step("IND_NEW.TIN_CHECK", "No", "reference", tinGaps.length ? "TIN missing, but not for a jurisdiction recorded as issuing TINs to all residents" : "TIN on file for every tax residence", { holder: tag });

  if (h.addressCountry && h.residences.length && !h.residences.includes(h.addressCountry)) {
    if (ctx.ask("IND_NEW.REASONABLENESS", { holder: tag, question: `The address on file is in ${countryName(ctx.index, h.addressCountry)}, which is not among the self-certified residences (${names(h.residences)}). Is there a reasonable explanation?` }) === "new_cert") {
      throw new Pending("Obtain a new self-certification or a reasonable explanation (Handbook ¶185).");
    }
  } else ctx.step("IND_NEW.REASONABLENESS", "Yes", "rule", h.addressCountry ? `Address ${h.addressCountry} matches self-certified residence` : "No conflicting KYC address on file", { holder: tag });

  return outcomeFor(ctx, h.name, h.role || (h.joint ? "Joint account holder" : "Account holder"), h.residences,
    (j) => `New individual account. The self-certification confirms tax residence in ${names(j)}.`,
    `New individual account. The self-certified residence${h.residences.length > 1 ? "s are" : " is"} ${names(h.residences) || "not recorded"}, not a reportable jurisdiction.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Entities — Handbook Fig. 15–18, controlling persons, trusts

function entityStatus(ctx, residences) {
  const a = ctx.account;
  const participating = (c) => c && (c === ctx.fiJur || ctx.index.participating.has(c));
  const anyParticipating = residences.some(participating);
  // Managed by a financial institution: a fiduciary / trust office or an asset manager (VIII(A)(6)(b)).
  const managedByFI = a.entity_managed_by_fiduciary_trust === true || a.entity_managed_by_asset_manager === true;
  // Recorded as NOT managed by any financial institution (both flags explicitly false; a missing flag is unknown).
  const notManagedByFI = a.entity_managed_by_fiduciary_trust === false && a.entity_managed_by_asset_manager === false;
  const managedInvestment = a.gross_income_from_financial_assets === true && managedByFI;
  const fiTypeNote = a.type_of_financial_institution ? ` · type_of_financial_institution = ${a.type_of_financial_institution}` : "";
  const managementNote = `entity_managed_by_fiduciary_trust = ${a.entity_managed_by_fiduciary_trust} · entity_managed_by_asset_manager = ${a.entity_managed_by_asset_manager}`;
  const unclassified = !a.entity_classification || a.entity_classification === "not_applicable";

  // 0. A type (b) investment entity must be managed by a financial institution. Recorded as type (b) but managed by no FI,
  //    it is not an investment entity: with its mainly passive income it is a Passive NFE (VIII(A)(6)(b), VIII(D)(9)).
  if (a.type_of_financial_institution === "investment_entity_type_b" && notManagedByFI && (unclassified || a.entity_classification === "financial_institution")) {
    ctx.step("ENT.STATUS", "Passive NFE · type (b) investment entity not managed by a financial institution", "rule",
      `type_of_financial_institution = investment_entity_type_b · ${managementNote}${a.entity_classification ? ` · entity_classification = ${a.entity_classification}` : ""} (VIII(A)(6)(b), VIII(D)(8)–(9))`);
    return "passive_nfe";
  }

  // 1. Explicit classification on the account wins (the FI-type field alone is often a form default).
  if (a.entity_classification === "financial_institution") {
    if (a.type_of_financial_institution === "investment_entity_type_b" && !anyParticipating && residences.length) {
      ctx.step("ENT.STATUS", "Passive NFE · managed investment entity in a non-participating jurisdiction", "rule", `entity_classification = financial_institution${fiTypeNote} · resident outside participating jurisdictions (VIII(D)(8))`);
      return "passive_nfe";
    }
    ctx.step("ENT.STATUS", "Financial institution", "data", `entity_classification = financial_institution${fiTypeNote}`);
    return "fi";
  }
  if (a.entity_classification === "active_nfe" || a.entity_classification === "passive_nfe") {
    const label = a.entity_classification === "active_nfe" ? "Active NFE" : "Passive NFE";
    const conflict = managedInvestment ? " · note: income mainly from financial assets and managed by an asset manager — check it isn't an investment entity" : "";
    ctx.step("ENT.STATUS", label, "data", `entity_classification = ${a.entity_classification}${conflict}`);
    return a.entity_classification;
  }
  if (a.crs_entity_classification === "CRS101" || a.crs_entity_classification === "CRS103") {
    ctx.step("ENT.STATUS", "Passive NFE", "data", `crs_entity_classification = ${a.crs_entity_classification}`); return "passive_nfe";
  }
  // 2. Derived from the investment-entity facts (VIII(A)(6)(b)).
  if (managedInvestment) {
    const src = `gross_income_from_financial_assets = true and managed by a financial institution (${managementNote})`;
    if (anyParticipating) { ctx.step("ENT.STATUS", "Financial institution · managed investment entity", "rule", `${src} · resident in a participating jurisdiction`); return "fi"; }
    ctx.step("ENT.STATUS", "Passive NFE · managed investment entity in a non-participating jurisdiction", "rule", `${src} (VIII(D)(8))`); return "passive_nfe";
  }
  if (a.potential_exception_type === "HoldCo" || a.potential_exception_type === "TreasuryCtr") {
    ctx.step("ENT.STATUS", "Active NFE", "data", `potential_exception_type = ${a.potential_exception_type} (VIII(D)(9)(${a.potential_exception_type === "HoldCo" ? "d" : "g"}))`); return "active_nfe";
  }
  if (a.non_reportable_exception_type === "liquidation_dissolution") { ctx.step("ENT.STATUS", "Active NFE · in liquidation", "data", "non_reportable_exception_type = liquidation_dissolution (VIII(D)(9)(f))"); return "active_nfe"; }
  // Not classified, income mainly from financial assets and managed by no financial institution: a Passive NFE (VIII(D)(9)).
  if (unclassified && a.gross_income_from_financial_assets === true && notManagedByFI) {
    ctx.step("ENT.STATUS", "Passive NFE · mainly passive income, not managed by a financial institution", "rule", `gross_income_from_financial_assets = true · ${managementNote} (VIII(D)(9))`);
    return "passive_nfe";
  }
  // 3. Ask. (CRS102 and the FI-type field alone are hints, not a classification.)
  const hint = [a.crs_entity_classification ? `crs_entity_classification = ${a.crs_entity_classification}` : "", a.type_of_financial_institution ? `type_of_financial_institution = ${a.type_of_financial_institution}` : "", a.entity_classification ? `entity_classification = ${a.entity_classification}` : ""].filter(Boolean).join(" · ");
  const people = cpSummary(ctx);
  const rep = people.filter((p) => p.reportable_jurisdictions.length);
  const preview = people.length
    ? ` If this is a Passive NFE, its ${people.length} controlling person${people.length > 1 ? "s are" : " is"} looked through: ${rep.length ? `${rep.length} ${rep.length > 1 ? "have" : "has"} a residence in a reportable jurisdiction (${uniq(rep.flatMap((p) => p.reportable_jurisdictions)).map((c) => countryName(ctx.index, c)).join(", ")}), so the account would be reportable` : "none has a residence in a reportable jurisdiction"}.`
    : " No controlling persons are recorded yet.";
  ctx.info.entity = { status: null, look_through: null, reason: "Entity status not determined yet.", controlling_persons: people, reportable_count: rep.length };
  const v = ctx.ask("ENT.STATUS", { help: `${getRuleHelp(ctx)}${hint ? ` Recorded so far: ${hint}.` : ""}${preview}` });
  return v === "fi" ? "fi" : v === "active_nfe" ? "active_nfe" : "passive_nfe";
}

function getRuleHelp(ctx) { return ctx.rule("ENT.STATUS").help || ""; }

function controllingPersons(ctx, { pre, usd }) {
  const names = (codes) => codes.map((c) => countryName(ctx.index, c)).join(", ");
  const cps = ctx.cps;
  if (!cps.length) {
    if (ctx.ask("CP.IDENTIFY", { question: "No controlling persons are recorded for this Passive NFE. Identify them under FATF R.10." }) === "none_identifiable") {
      return { persons: [], note: "No controlling persons identifiable (FAQ / FATF listed-entity exemption)." };
    }
    throw new Pending("Record the controlling persons on the account, then re-run.");
  }
  const limit = ctx.rule("CP.SELF_CERT").params?.aml_reliance_limit_usd ?? 1000000;
  const needSC = !pre || usd > limit;
  const withoutSC = cps.filter((c) => c.self_certification_obtained !== true);
  let basis = needSC ? "self-certification" : "AML/KYC records (USD 1,000,000 or less)";
  if (needSC && withoutSC.length) {
    const v = ctx.ask("CP.SELF_CERT", { question: `${withoutSC.length} of ${cps.length} controlling person${cps.length > 1 ? "s have" : " has"} no self-certification on file. Have they been obtained?` });
    if (v === "not_yet") {
      if (!pre) throw new Pending("Obtain self-certifications from the controlling persons (Handbook ¶217).");
      basis = "indicia search on the controlling persons (no self-certification, Handbook ¶201)";
    }
  } else if (needSC) ctx.step("CP.SELF_CERT", "Yes · on file for all", "data", `${cps.length} controlling person${cps.length > 1 ? "s" : ""} with self_certification_obtained = true`);
  else ctx.step("CP.SELF_CERT", "Not required", "rule", "Pre-existing account of USD 1,000,000 or less · AML/KYC records may be relied on (Handbook ¶199)");

  const persons = cps.map((c) => {
    const name = c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
    const role = CP_ROLE_LABELS[c.control_type] || "Controlling person";
    const codes = uniq([...(c.tax_residencies || []).map((r) => ctx.norm(r.country)), ctx.norm(c.country_of_residence_code), ctx.norm(c.country_of_residence), ctx.norm(c.address?.country)]);
    return { name, role: c.ownership_percentage ? `${role} · ${c.ownership_percentage}%` : role, codes, jurisdictions: codes.filter((x) => ctx.isReportable(x)) };
  });
  ctx.step("CP.IDENTIFY", `${persons.length} controlling person${persons.length > 1 ? "s" : ""}`, "data", persons.map((p) => `${p.name} (${p.role}) · ${p.codes.join("/") || "residence not recorded"}`).join(" — "));
  const reportable = persons.filter((p) => p.jurisdictions.length);
  ctx.step("CP.RESIDENCE", reportable.length ? `Yes · ${reportable.map((p) => `${p.name} (${p.jurisdictions.join(", ")})`).join(", ")}` : "No", "rule", `Basis: ${basis} · list ${ctx.listSource}`);
  const unknown = persons.filter((p) => !p.codes.length);
  return { persons: reportable.map((p) => ({ name: p.name, role: p.role, jurisdictions: p.jurisdictions })), note: unknown.length ? `${unknown.length} controlling person(s) have no residence recorded.` : "" , names };
}

function entityAccount(ctx, pre, usd) {
  const a = ctx.account;
  const names = (codes) => codes.map((c) => countryName(ctx.index, c)).join(", ");
  const exemptionLimit = ctx.rule("ENT_PRE.THRESHOLD_250K").params?.threshold_usd ?? 250000;
  const exemptionOn = ctx.enabled("ENT_PRE.THRESHOLD_250K") && ctx.settings.entity_250k_exemption === true;
  if (pre && exemptionOn && usd <= exemptionLimit) {
    ctx.step("ENT_PRE.THRESHOLD_250K", "Yes · not reviewed", "rule", `${fmtUsd(usd)} ≤ ${fmtUsd(exemptionLimit)} · exemption elected in settings`);
    lookThroughStep(ctx, null, { exempt: true });
    return { status: "non_reportable", jurisdictions: [], persons: [], reason: `Pre-existing entity account of ${fmtUsd(usd)}. Under the elected USD 250,000 exemption it is not reviewed until it exceeds the threshold at a year end (Handbook ¶189).` };
  }
  if (pre) ctx.step("ENT_PRE.THRESHOLD_250K", "No", "rule", exemptionOn ? `${fmtUsd(usd)} > ${fmtUsd(exemptionLimit)}` : !ctx.enabled("ENT_PRE.THRESHOLD_250K") ? "Exemption switched off in the CRS Rule Library" : "Exemption not elected");

  // Residence (Table 3)
  const type = String(a.account_holder_entity_type || "").toLowerCase();
  const isTrust = type.includes("trust") || ctx.cps.some((c) => String(c.control_type || "").startsWith("trust_"));
  let residences = residencesOf(ctx, a); let basis = "self-certified tax residence";
  if (!residences.length && isTrust) {
    residences = uniq(ctx.cps.filter((c) => c.control_type === "trust_trustee").map((c) => ctx.norm(c.address?.country) || ctx.norm(c.country_of_residence_code) || ctx.norm(c.country_of_residence)));
    basis = "trustee address (trusts)";
  }
  if (!residences.length) { residences = uniq([ctx.norm(a.country_of_incorporation_code), ctx.norm(a.country_of_incorporation)]); basis = "place of incorporation"; }
  if (!residences.length) { residences = uniq([ctx.norm(a.current_address?.country)]); basis = "address"; }
  if (residences.length) ctx.step("ENT.RESIDENCE", names(residences), "data", `By ${basis}`);
  else if (isTrust) ctx.step("ENT.RESIDENCE", "No tax residence", "data", "Trust with no residence recorded · a trust without tax residence is not a reportable person (Handbook ¶265)");
  else throw (ctx.ask("ENT.RESIDENCE", { question: "Where is the entity resident? No incorporation country or address is recorded.", options: [{ value: "recorded", label: "Recorded now · re-run" }] }), new Pending("Record the entity's residence, then re-run."));

  if (!pre) {
    if (a.self_certification_obtained === true) ctx.step("ENT.SELF_CERT", `Yes${a.self_certification_date ? ` · dated ${a.self_certification_date}` : ""}`, "data", "self_certification_obtained = true");
    else if (!NOT_REPORTABLE_PERSON[a.non_reportable_exception_type] && ctx.ask("ENT.SELF_CERT") === "no") throw new Pending("Obtain an entity self-certification (Handbook ¶209).");
  }

  const status = entityStatus(ctx, residences);

  // Test 1 — the account holder
  let holder = { persons: [], jurisdictions: [] };
  if (NOT_REPORTABLE_PERSON[a.non_reportable_exception_type]) {
    ctx.step("ENT.REPORTABLE_PERSON", `No · ${NOT_REPORTABLE_PERSON[a.non_reportable_exception_type]}`, "data", `non_reportable_exception_type = ${a.non_reportable_exception_type}`);
  } else if (status === "fi") {
    ctx.step("ENT.REPORTABLE_PERSON", "No · financial institution", "rule", "Financial institutions are not reportable persons (VIII(D)(2))");
  } else {
    const j = residences.filter((c) => ctx.isReportable(c));
    ctx.step("ENT.REPORTABLE_PERSON", j.length ? `Yes · ${names(j)}` : "No", "rule", j.length ? `Resident in a reportable jurisdiction (list ${ctx.listSource})` : `Resident in ${names(residences) || "no jurisdiction"} · not on the reportable list`);
    if (j.length) holder = { persons: [{ name: a.account_holder_name || "Entity", role: "Account holder", jurisdictions: j }], jurisdictions: j };
  }

  // Test 2 — controlling persons of a Passive NFE (the step records why they are or aren't looked through)
  lookThroughStep(ctx, status);
  let cp = { persons: [] };
  if (status === "passive_nfe") cp = controllingPersons(ctx, { pre, usd });

  const jurisdictions = uniq([...holder.jurisdictions, ...cp.persons.flatMap((p) => p.jurisdictions)]);
  const persons = [...holder.persons, ...cp.persons];
  const label = { fi: "Financial institution", active_nfe: "Active NFE", passive_nfe: "Passive NFE" }[status];
  if (!jurisdictions.length) {
    const lt = status !== "passive_nfe" && ctx.info.entity?.controlling_persons?.length ? ` ${ctx.info.entity.reason}` : "";
    return { status: "non_reportable", jurisdictions: [], persons: [], reason: `${pre ? "Pre-existing" : "New"} entity account. ${label}${status === "passive_nfe" ? " with no reportable controlling persons" : ""}; the entity is not resident in a reportable jurisdiction.${lt}${cp.note ? " " + cp.note : ""}` };
  }
  const parts = [];
  if (holder.jurisdictions.length) parts.push(`the entity is resident in ${names(holder.jurisdictions)}`);
  if (cp.persons.length) parts.push(`controlling person${cp.persons.length > 1 ? "s" : ""} ${cp.persons.map((p) => `${p.name} (${p.jurisdictions.join(", ")})`).join(", ")}`);
  return { status: "reportable", jurisdictions, persons, reason: `${pre ? "Pre-existing" : "New"} entity account. ${label}: ${parts.join("; ")}.${cp.note ? " " + cp.note : ""}` };
}

// ---------------------------------------------------------------------------------------------------------------

/** Evaluate one account. Pure and synchronous. */
export function evaluate(input, answers = {}) {
  const ctx = makeContext(input, answers);
  let outcome;
  try {
    outcome = excludedAccount(ctx);
    if (!outcome) {
      const pre = preexisting(ctx);
      const usd = balance(ctx);
      extraQuestions(ctx, "after_general", { preexisting: pre, balance_usd: usd });
      if (ctx.account.account_holder_type === "entity") {
        extraQuestions(ctx, "entity", { preexisting: pre, balance_usd: usd });
        outcome = entityAccount(ctx, pre, usd);
      } else {
        extraQuestions(ctx, "individual", { preexisting: pre, balance_usd: usd });
        const holderStep = deceasedAndBeneficiaries(ctx);
        if (holderStep?.outcome) outcome = holderStep.outcome;
      }
      if (!outcome && ctx.account.account_holder_type !== "entity") {
        const results = individualHolders(ctx).map((h) => (pre && ctx.settings.alt_new_rules_for_preexisting !== true ? individualPreexisting(ctx, h, usd) : individualNew(ctx, h)));
        if (results.length === 1) outcome = results[0];
        else {
          const j = uniq(results.flatMap((r) => r.jurisdictions));
          const undocumented = results.some((r) => r.status === "undocumented");
          outcome = { status: j.length ? "reportable" : undocumented ? "undocumented" : "non_reportable", jurisdictions: j, persons: results.flatMap((r) => r.persons),
            reason: `${ctx.info.holders ? `${ctx.info.holders.label}: each was checked separately as an account holder (CRS VIII(E)(1)).` : "Joint account: each holder was checked separately and is attributed the full balance (Handbook ¶232)."} ${results.map((r) => r.reason).join(" ")}` };
        }
      }
    }
  } catch (e) {
    if (!(e instanceof Pending)) throw e;
    const open = ctx.gaps.length;
    outcome = { status: "pending", jurisdictions: [], persons: [], reason: e.message || `Answer the open question${open > 1 ? "s" : ""} to finish the classification.`, action_required: !!e.message && open === 0 };
  }
  if (outcome.status === "reportable") {
    ctx.step("OUT.REPORTABLE_JURISDICTION", `Yes · ${outcome.jurisdictions.join(", ")}`, "reference", `Reportable list: ${ctx.listSource}`);
  }
  return {
    engine_version: ENGINE_VERSION,
    rule_pack_version: ctx.pack.version,
    reportable_list_version: ctx.list?.version || null,
    reporting_jurisdiction: ctx.fiJur,
    steps: ctx.steps,
    gaps: ctx.gaps,
    outcome,
    ...(ctx.info.entity ? { entity: ctx.info.entity } : {}),
    ...(ctx.info.holders ? { holders: ctx.info.holders } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Extra questions (custom rules added in the CRS Rule Library). They can only pause an account ("Action needed");
// they can never make it non-reportable or change its jurisdictions, so a local check can't weaken the Handbook steps.

export const EXTRA_QUESTION_HOOKS = ["after_general", "individual", "entity"];

function extraQuestions(ctx, hook, derived) {
  const custom = (ctx.pack.rules || []).filter((r) => r.custom && r.hook === hook && r.enabled !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!custom.length) return;
  const facts = { ...ctx.account, ...derived, reporting_jurisdiction: ctx.fiJur };
  for (const r of custom) {
    if (r.condition && !matchesCondition(r.condition, facts)) continue;
    const value = ctx.ask(r.rule_key);
    const option = (r.options || []).find((o) => o.value === value);
    if (option?.effect === "hold") throw new Pending(option.reason || `Action needed: ${r.question}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Material-field snapshot and hash (used to decide whether a change needs re-evaluation)

const ACCOUNT_MATERIAL = [
  "account_type", "account_holder_type", "account_holder_entity_type", "account_creation_date", "is_pre_existing", "status",
  "non_reportable_exception_type", "potential_exception_type", "country_of_residence", "country_of_incorporation", "country_of_incorporation_code",
  "tax_residencies", "multiple_residencies", "current_address", "account_holder_address", "current_phone", "date_of_birth",
  "self_certification_obtained", "self_certification_date", "year_end_cash_value", "year_end_cash_value_currency",
  "entity_classification", "crs_entity_classification", "type_of_financial_institution", "gross_income_from_financial_assets",
  "entity_managed_by_asset_manager", "account_holder_name", "first_name", "last_name",
];
const CP_MATERIAL = ["full_name", "first_name", "last_name", "control_type", "ownership_percentage", "tax_residencies", "country_of_residence", "country_of_residence_code", "address", "self_certification_obtained", "date_of_birth"];
const BENEFICIARY_MATERIAL = ["full_name", "first_name", "last_name", "tax_residencies", "country_of_residence", "address", "date_of_birth", "self_certification_obtained"];
const DECEASED_FIELDS = ["account_holder_is_alive", "account_holder_deceased_during_period", "death_certificate_received", "will_or_inheritance_received", "legacy_of_deceased_settled"];
function deceasedInfo(a) {
  if (!a) return null;
  const relevant = a.account_holder_is_alive === false || DECEASED_FIELDS.slice(1).some((f) => a[f] === true);
  return relevant ? pick(a, DECEASED_FIELDS) : null;
}
const EVIDENCE_MATERIAL = ["crs_indicia", "hold_mail_only", "insurance_sale_prohibited", "documentary_evidence", "aggregation_group", "rm_attestations", "joint_holders", "trust_parties", "entity_status"];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "").map((k) => [k, obj[k]]));

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** The inputs a decision depends on. Stored on the decision record as input_snapshot. */
export function materialSnapshot(input) {
  return {
    account: pick(input.account, ACCOUNT_MATERIAL),
    controlling_persons: (input.controllingPersons || []).map((c) => pick(c, CP_MATERIAL)).sort((x, y) => stable(x).localeCompare(stable(y))),
    evidence: pick(input.evidence, EVIDENCE_MATERIAL),
    linked_balances: (input.linkedAccounts || []).map((a) => pick(a, ["id", "year_end_cash_value", "year_end_cash_value_currency", "non_reportable_exception_type"])),
    settings: pick(input.settings, ["reporting_jurisdiction", "preexisting_cutoff", "residence_address_test_allowed", "entity_250k_exemption", "wider_approach", "alt_new_rules_for_preexisting", "alt_hv_rules_for_lv", "fx_rates"]),
    // Only present when the account has them, so accounts without them keep their earlier fingerprint.
    ...(deceasedInfo(input.account) ? { deceased: deceasedInfo(input.account) } : {}),
    ...((input.beneficiaries || []).length ? { beneficiaries: input.beneficiaries.map((b) => pick(b, BENEFICIARY_MATERIAL)).sort((x, y) => stable(x).localeCompare(stable(y))) } : {}),
    reportable_list_version: input.reportableList?.version || null,
    rule_pack_version: input.pack?.version || null,
    ...(input.overridePack?.version ? { override_pack: `${input.overridePack.jurisdiction_scope}.${input.overridePack.version}` } : {}),
  };
}

/** SHA-256 of the material snapshot (Web Crypto; available in browsers and Deno). */
export async function inputHash(input) {
  const text = stable(materialSnapshot(input));
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return "sha256:" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
