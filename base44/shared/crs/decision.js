// Classification Studio — building the permanent decision record from an engine result.
// Pure functions: used by the studioConfirmDecision backend function and by the tests.

import { materialSnapshot } from "./engine.js";

/** An engine result can be confirmed only when every question is answered and the outcome is final. */
export function canConfirm(result) {
  return !!result && result.outcome?.status !== "pending" && (result.gaps || []).length === 0;
}

/** The status and reason written back to the Account (D2). Undocumented accounts are reported. */
export function accountWriteBack(decision) {
  const map = { reportable: "reportable", undocumented: "reportable", non_reportable: "non_reportable", excluded: "excluded" };
  const status = map[decision.outcome];
  if (!status) throw new Error(`Unknown studio outcome: ${decision.outcome}`);
  let reason = decision.reason || "";
  if (decision.outcome === "undocumented") reason = `Reported as undocumented (CRS III(B)(5)). ${reason}`.trim();
  if (decision.reportable_jurisdictions?.length) reason = `${reason} Reportable jurisdictions: ${decision.reportable_jurisdictions.join(", ")}.`.trim();
  return { reportability_status: status, reportability_reason: `[Classification Studio] ${reason}`.trim() };
}

const isoDate = (d) => d.toISOString().slice(0, 10);

/**
 * Build the ClassificationDecision record.
 * @param {object} args
 *  - input, result: engine input and evaluate() output (must satisfy canConfirm)
 *  - answers: the gap answers used ({gapKey: value})
 *  - aiSuggestions: draft_ai_suggestions from StudioEvidence
 *  - previous: the latest confirmed decision for the account (or null)
 *  - user: {email}
 *  - hash: inputHash(input)
 *  - now: Date
 *  - status: "confirmed" (default) or "proposed" (awaiting second sign-off)
 *  - note, trigger
 */
export function buildDecision({ input, result, answers = {}, aiSuggestions = [], previous = null, user, hash, now = new Date(), status = "confirmed", note = "", trigger }) {
  if (!canConfirm(result)) throw new Error("This account still has open questions and can't be confirmed.");
  const account = input.account || {};
  const settings = input.settings || {};
  const accepted = Object.fromEntries((aiSuggestions || []).filter((s) => s.accepted).map((s) => [s.gap_key, s]));

  const step_trace = result.steps.map((s) => {
    const fromAi = s.source === "user" && accepted[s.key] && String(accepted[s.key].answer) === String(s.value);
    return {
      step_id: s.key,
      question: s.question || "",
      answer: String(s.answer ?? ""),
      source: fromAi ? "ai" : s.source,
      evidence: fromAi ? `AI suggestion accepted by ${user?.email || "user"} (confidence ${Math.round((accepted[s.key].confidence || 0) * 100)}%)` : s.evidence || "",
      crs_ref: s.crs_ref || "",
      hb_ref: s.hb_ref || "",
    };
  });

  const usedKeys = new Set(result.steps.filter((s) => s.source === "user").map((s) => s.key));
  const gap_answers = Object.entries(answers || {}).filter(([k]) => usedKeys.has(k)).map(([key, value]) => ({ key, value, source: accepted[key] && String(accepted[key].answer) === String(value) ? "ai" : "user" }));
  const ai_suggestions = (aiSuggestions || []).map((s) => ({ question: s.gap_key, answer: String(s.answer ?? ""), confidence: s.confidence ?? null, rationale: s.rationale || "", accepted: !!s.accepted }));

  const reporting_year = now.getUTCFullYear();
  const retentionYears = Number(settings.retention_years) || 5;
  const retention_until = `${reporting_year + retentionYears}-12-31`;

  return {
    tenant_id: account.tenant_id,
    target_type: "account",
    target_id: account.id,
    sequence: (previous?.sequence || 0) + 1,
    ...(previous ? { supersedes_id: previous.id } : {}),
    status,
    trigger: trigger || (previous ? "manual" : "initial"),
    input_snapshot: materialSnapshot(input),
    input_hash: hash,
    engine_version: result.engine_version,
    rule_pack_version: result.rule_pack_version,
    ...(input.pack?.id ? { rule_pack_id: input.pack.id } : {}),
    reportable_list_version: result.reportable_list_version || "",
    step_trace,
    gap_answers,
    ai_suggestions,
    outcome: result.outcome.status,
    reportable_jurisdictions: result.outcome.jurisdictions || [],
    reportable_persons: (result.outcome.persons || []).map((p) => ({ name: p.name || "", role: p.role || "", jurisdictions: p.jurisdictions || [] })),
    // Each controlling person's classification (entity accounts); written back to ControllingPerson on confirm.
    cp_results: (result.entity?.cp_results || []).map((c) => ({ controlling_person_id: c.id || "", name: c.name || "", role: c.role || "", residences: c.residences || [],
      jurisdictions: c.jurisdictions || [], looked_through: !!c.looked_through, reportable: !!c.reportable, reason: c.reason || "" })),
    reason: result.outcome.reason || "",
    ...(result.outcome.status === "reportable" || result.outcome.status === "undocumented" ? { reportable_from: isoDate(now) } : {}),
    reporting_year,
    retention_until,
    decided_by: user?.email || "",
    decided_at: now.toISOString(),
    ...(note ? { note } : {}),
  };
}

/**
 * Load everything the engine needs for one account, using any entities client
 * (the browser SDK or base44.asServiceRole.entities in a backend function).
 */
export async function loadStudioInput(db, account, shared = {}) {
  const tenantId = account.tenant_id;
  const settings = shared.settings ?? ((await db.StudioSettings.filter({ tenant_id: tenantId }))[0] || null);
  if (!settings) throw new Error("Studio settings are not set up for this tenant.");
  const reportableList = shared.reportableList !== undefined ? shared.reportableList : (await db.ReportableJurisdictionList.filter({ reporting_jurisdiction: settings.reporting_jurisdiction }))
    .filter((r) => r.status !== "retired").sort((a, b) => (b.year || 0) - (a.year || 0))[0] || null;
  const countries = shared.countries ?? (await db.CrsCountryInfo.filter({}, "country_code", 1000));
  let pack = shared.pack;
  let overridePack = shared.overridePack;
  if (pack === undefined || overridePack === undefined) {
    const loaded = await loadPublishedPacks(db, settings.reporting_jurisdiction);
    pack = loaded.pack; overridePack = loaded.overridePack;
  }
  const controllingPersons = await db.ControllingPerson.filter({ account_id: account.id }, "-updated_date", 500);
  const evidence = (await db.StudioEvidence.filter({ account_id: account.id }))[0] || {};
  let beneficiaries = [];
  try { beneficiaries = (await db.Beneficiary.filter({ account_id: account.id }, "-updated_date", 200)).filter((b) => !b.tenant_id || b.tenant_id === tenantId); } catch (_e) { /* no Beneficiary table */ }
  return {
    input: { settings, reportableList, countries, pack, overridePack, account, controllingPersons: controllingPersons.filter((c) => c.tenant_id === tenantId), beneficiaries, evidence, linkedAccounts: [] },
    shared: { settings, reportableList, countries, pack, overridePack },
  };
}

/** The published global pack and the published pack for a reporting jurisdiction (if any), each with its rules. */
export async function loadPublishedPacks(db, jurisdiction) {
  const packs = await db.CrsRulePack.filter({ status: "published" }, "-published_at", 50);
  const g = packs.find((x) => !x.jurisdiction_scope || x.jurisdiction_scope === "global") || null;
  const o = jurisdiction ? packs.find((x) => x.jurisdiction_scope === jurisdiction) || null : null;
  const withRules = async (p) => (p ? { ...p, rules: await db.CrsRule.filter({ pack_id: p.id }, "order", 500) } : null);
  return { pack: await withRules(g), overridePack: await withRules(o) };
}
