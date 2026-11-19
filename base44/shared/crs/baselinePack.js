// Classification Studio — baseline CRS rule pack v1.0, based on the OECD CRS Implementation Handbook (2nd ed.).
// The engine reads parameters, wording and references from here. A published CrsRulePack in the Rule Library
// (Phase 5) overrides these by rule_key. Rules marked `locked` are core Handbook steps: their wording can change,
// but they can't be disabled.

export const BASELINE_PACK_VERSION = "1.0.0";

const R = (rule_key, procedure, order, tier, fields) => ({ rule_key, procedure, order, tier, locked: false, enabled: true, ...fields });

export const BASELINE_RULES = [
  // ---------- General ----------
  R("GEN.EXCLUDED", "general", 10, "logic", { locked: true,
    question: "Is this an excluded account?",
    crs_ref: "VIII(C)(17)", hb_ref: "Fig. 8, ¶129–130",
    help: "Retirement and pension accounts, tax-favoured accounts, estate and escrow accounts, overpayment deposits and low-risk accounts listed in domestic law are not reviewed or reported." }),
  R("GEN.PREEXISTING", "general", 20, "logic", { locked: true,
    question: "Was the account open on the pre-existing cut-off date?",
    crs_ref: "VIII(C)(9)", hb_ref: "¶154–156",
    help: "Accounts maintained on the cut-off date follow the pre-existing procedures; later accounts follow the new-account procedures.",
    options: [{ value: "yes", label: "Yes · pre-existing" }, { value: "no", label: "No · new account" }] }),
  R("GEN.BALANCE", "general", 30, "parameter", { locked: true,
    params: { high_value_threshold_usd: 1000000, entity_threshold_usd: 250000 },
    question: "What is the aggregated balance in USD?",
    crs_ref: "VII(C)", hb_ref: "¶159, ¶170, ¶226, FAQ II-2",
    help: "Aggregate all accounts of the holder that the systems link (and, for high value accounts, those the relationship manager knows of). Excluded accounts are left out. Convert at the spot rate on the last day of the period.",
    options: [{ value: "above_1m", label: "Above USD 1,000,000" }, { value: "between", label: "Between USD 250,000 and 1,000,000" }, { value: "below_250k", label: "USD 250,000 or less" }] }),

  // ---------- Pre-existing individual (Fig. 13) ----------
  R("IND_PRE.INSURANCE_BAR", "individual_preexisting", 10, "logic", {
    question: "Is this insurance or annuity contract legally barred from sale to residents of reportable jurisdictions?",
    crs_ref: "III(A)", hb_ref: "¶158" }),
  R("IND_PRE.RESIDENCE_ADDRESS_TEST", "individual_preexisting", 20, "logic", {
    question: "Is the current residence address backed by documentary evidence?",
    crs_ref: "III(B)(1)", hb_ref: "¶160–165, FAQ II-1–3",
    help: "Lower value accounts only, where the jurisdiction allows it. Government-issued evidence may be noted by type, date and ID number." }),
  R("IND_PRE.INDICIA_SEARCH", "individual_preexisting", 30, "logic", { locked: true,
    question: "Which indicia did the electronic record search find?",
    crs_ref: "III(B)(2)", hb_ref: "¶167–168",
    help: "(a) identified as resident, (b) mailing or residence address, (c) phone with no phone in the FI's jurisdiction, (d) standing instructions (not depository accounts), (e) power of attorney or signatory, (f) hold-mail or in-care-of address as the only address — each in a reportable jurisdiction." }),
  R("IND_PRE.HOLD_MAIL", "individual_preexisting", 40, "logic", { locked: true,
    question: "Did the paper record search or outreach establish where the holder is resident?",
    crs_ref: "III(B)(5)", hb_ref: "¶166, ¶174",
    help: "With only a hold-mail or in-care-of address, search paper records or obtain a self-certification or documentary evidence. If neither works, report the account as undocumented.",
    options: [{ value: "none", label: "No · nothing found and no reply" }, { value: "resolved", label: "Yes · residence recorded on the account" }],
    ai_guidance: "Look for outreach dates, replies and documents on file. Suggest 'none' only when outreach is recorded without a reply." }),
  R("IND_PRE.PAPER_SEARCH", "individual_preexisting", 50, "logic", { locked: true,
    question: "Do your electronic records hold every indicia field, or has a paper record search been done?",
    crs_ref: "III(C)(2)–(3)", hb_ref: "¶172–173",
    options: [{ value: "complete", label: "Electronic records hold every field" }, { value: "paper_done", label: "Paper search done · no further indicia" }, { value: "paper_new", label: "Paper search found further indicia" }] }),
  R("IND_PRE.RM_INQUIRY", "individual_preexisting", 60, "logic", { locked: true,
    question: "Does the relationship manager know the holder is resident in another jurisdiction?",
    crs_ref: "III(C)(4)", hb_ref: "¶175, FAQ II-15",
    help: "Required for high value accounts and repeated every year as the RM attestation.",
    options: [{ value: "none", label: "No actual knowledge" }, { value: "knows", label: "Yes · residence recorded on the account" }],
    ai_guidance: "Use RM notes and contact history. Never suggest 'knows' without a recorded statement." }),
  R("IND_PRE.CURE", "individual_preexisting", 70, "logic", { locked: true,
    question: "Have the indicia been cured?",
    crs_ref: "III(B)(6)", hb_ref: "¶169, ¶176, FAQ II-19",
    help: "Indicia are cured by a self-certification and/or documentary evidence showing residence elsewhere. Keep making reasonable efforts to obtain a TIN.",
    options: [{ value: "not_cured", label: "No · treat as resident in each indicated jurisdiction" }, { value: "cured", label: "Yes · self-cert / evidence on file shows the residences" }],
    ai_guidance: "Suggest 'cured' only when a self-certification or documentary evidence dated after the indicia is on file." }),

  // ---------- New individual (Fig. 14) ----------
  R("IND_NEW.SELF_CERT", "individual_new", 10, "logic", { locked: true,
    question: "Has a self-certification been obtained?",
    crs_ref: "IV(A)", hb_ref: "¶181",
    options: [{ value: "yes", label: "Yes · on file" }, { value: "no", label: "No · request it" }] }),
  R("IND_NEW.SELF_CERT_VALID", "individual_new", 20, "logic", { locked: true,
    params: { required_elements: ["name", "residence_address", "tax_residence", "tin", "date_of_birth", "date"] },
    question: "Is the self-certification valid?",
    crs_ref: "IV(A)", hb_ref: "¶183, FAQ II-9–11",
    help: "Signed or positively affirmed, dated, with name, residence address, every tax residence, TIN(s) and date of birth. Residence must not be prefilled.",
    options: [{ value: "valid", label: "Yes · the signed form has every element" }, { value: "invalid", label: "No · request a complete self-certification" }] }),
  R("IND_NEW.TIN_CHECK", "individual_new", 30, "logic", {
    question: "Is a TIN missing for a jurisdiction that issues TINs to all residents?",
    crs_ref: "IV(A)", hb_ref: "FAQ II-8",
    options: [{ value: "explained", label: "TIN obtained or reason recorded" }, { value: "missing", label: "Still missing · request it" }] }),
  R("IND_NEW.REASONABLENESS", "individual_new", 40, "logic", { locked: true,
    question: "Is the self-certification reasonable against the AML/KYC data?",
    crs_ref: "IV(A)", hb_ref: "¶184–185, FAQ II-7",
    options: [{ value: "explained", label: "Yes · reasonable explanation on file" }, { value: "new_cert", label: "No · obtain a new self-certification" }] }),

  // ---------- Entities (Fig. 15–18) ----------
  R("ENT_PRE.THRESHOLD_250K", "entity_preexisting", 10, "parameter", {
    params: { threshold_usd: 250000 },
    question: "Is the aggregated balance USD 250,000 or less (exemption elected)?",
    crs_ref: "V(A)", hb_ref: "¶189" }),
  R("ENT.RESIDENCE", "entity_new", 20, "logic", { locked: true,
    question: "Where is the entity resident?",
    crs_ref: "V(D)(1), VI(A)(1)", hb_ref: "Table 3, ¶190",
    help: "Most taxable entities: place of incorporation. Fiscally transparent entities: address. Trusts: address of one or more trustees." }),
  R("ENT.REPORTABLE_PERSON", "entity_new", 30, "logic", { locked: true,
    question: "Is the entity itself a reportable person?",
    crs_ref: "VIII(D)(2)", hb_ref: "¶137, ¶191, ¶206, FAQ II-20",
    help: "Listed corporations and their related entities, governmental entities, international organisations, central banks and financial institutions are not reportable persons." }),
  R("ENT.SELF_CERT", "entity_new", 35, "logic", { locked: true,
    question: "Has a valid entity self-certification been obtained?",
    crs_ref: "VI(A)(1)", hb_ref: "¶192, ¶209",
    help: "Signed by an authorised person, dated, with name, address, tax residence(s) and TIN(s).",
    options: [{ value: "yes", label: "Yes · on file" }, { value: "no", label: "No · request it" }] }),
  R("ENT.STATUS", "entity_new", 40, "logic", { locked: true,
    question: "How is the entity classified?",
    crs_ref: "VIII(A), VIII(D)(8)–(9)", hb_ref: "¶196–197, ¶212–215",
    help: "Use held or public information first. A type (b) investment entity resident in a non-participating jurisdiction is a Passive NFE. If the status can't be determined, presume Passive NFE.",
    options: [{ value: "fi", label: "Financial institution" }, { value: "active_nfe", label: "Active NFE" }, { value: "passive_nfe", label: "Passive NFE" }, { value: "unknown", label: "Can't determine · presume Passive NFE" }],
    ai_guidance: "Use the self-certification box ticked, the entity's business, income mix and whether an FI manages it." }),
  R("CP.IDENTIFY", "controlling_persons", 10, "logic", { locked: true,
    params: { ownership_threshold_pct: 25 },
    question: "Who are the controlling persons?",
    crs_ref: "VIII(D)(6)", hb_ref: "¶144–151, FAQ II-5",
    help: "FATF R.10: controlling ownership (25% is indicative), then control through other means, then the senior managing official. For trusts: settlor, trustee, protector, beneficiaries and anyone with ultimate control.",
    options: [{ value: "recorded", label: "Recorded now · re-run" }, { value: "none_identifiable", label: "None identifiable (listed parent)" }] }),
  R("CP.SELF_CERT", "controlling_persons", 20, "logic", { locked: true,
    params: { aml_reliance_limit_usd: 1000000 },
    question: "Have self-certifications been obtained for the controlling persons?",
    crs_ref: "V(D)(2)(c), VI(A)(2)(b)", hb_ref: "¶199–201, ¶217–218, FAQ II-4",
    help: "Pre-existing accounts up to USD 1,000,000 may rely on AML/KYC data. Above that, and for all new accounts, a self-certification is needed. Without it, pre-existing accounts use the indicia search on the controlling persons.",
    options: [{ value: "obtained", label: "Yes · on file" }, { value: "not_yet", label: "Not yet · requested" }] }),
  R("CP.RESIDENCE", "controlling_persons", 30, "logic", { locked: true,
    question: "Are any controlling persons resident in a reportable jurisdiction?",
    crs_ref: "VIII(D)(2), VI(A)(2)(b)", hb_ref: "¶143, ¶219, ¶269" }),

  // ---------- Outcome ----------
  R("OUT.REPORTABLE_JURISDICTION", "general", 90, "logic", { locked: true,
    question: "Is the jurisdiction on the reportable list?",
    crs_ref: "VIII(D)(4)", hb_ref: "¶135, Part I ¶23–28" }),
];

export const BASELINE_PACK = {
  version: BASELINE_PACK_VERSION,
  title: "OECD CRS Handbook baseline",
  status: "published",
  jurisdiction_scope: "global",
  rules: BASELINE_RULES,
};

/** Merge a published pack's rules over the baseline by rule_key (locked rules can't be disabled). */
export function resolvePack(published) {
  if (!published || !Array.isArray(published.rules) || published.rules.length === 0) return BASELINE_PACK;
  const byKey = new Map(BASELINE_RULES.map((r) => [r.rule_key, r]));
  for (const r of published.rules) {
    const base = byKey.get(r.rule_key);
    const merged = { ...(base || {}), ...r, params: { ...(base?.params || {}), ...(r.params || {}) } };
    if (base?.locked) { merged.locked = true; merged.enabled = true; }
    byKey.set(r.rule_key, merged);
  }
  return { ...BASELINE_PACK, ...published, rules: [...byKey.values()] };
}

export function getRule(pack, key) {
  return (pack?.rules || []).find((r) => r.rule_key === key) || BASELINE_RULES.find((r) => r.rule_key === key);
}
