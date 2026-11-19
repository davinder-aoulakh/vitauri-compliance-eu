import { describe, it, expect } from "vitest";
import {
  evaluate, resolvePack, BASELINE_RULES, validatePack, diffPacks, packFingerprint, nextVersion, baselineRuleRows,
  runFixtures, runFixture, FIXTURES, matchesCondition,
} from "../../base44/shared/crs/index.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const draftWith = (mutate) => { const rules = clone(baselineRuleRows()); mutate(rules); return { version: "1.1.0", rules }; };
const ruleIn = (rules, key) => rules.find((r) => r.rule_key === key);
const fx = (id) => FIXTURES.find((f) => f.id === id);

describe("fixtures", () => {
  it("are all green on the built-in baseline", () => {
    const r = runFixtures(null);
    expect(r.failed).toBe(0);
    expect(r.passed).toBe(true);
    expect(r.total).toBeGreaterThanOrEqual(14);
  });

  it("are all green on the seeded v1.0.0 pack (same rules as the baseline)", () => {
    expect(runFixtures({ version: "1.0.0", rules: baselineRuleRows() }).passed).toBe(true);
  });

  it("changing the USD 1M high-value threshold makes the high-value fixtures fail (publish gate)", () => {
    const draft = draftWith((rules) => { ruleIn(rules, "GEN.BALANCE").params.high_value_threshold_usd = 2000000; });
    const r = runFixtures(draft);
    expect(r.passed).toBe(false);
    const failed = r.results.filter((x) => !x.passed).map((x) => x.id);
    expect(failed).toContain("sofie");
    expect(failed).toContain("marco");
  });

  it("wording changes keep every fixture green", () => {
    const draft = draftWith((rules) => { ruleIn(rules, "IND_PRE.RM_INQUIRY").question = "Does the relationship manager know the holder's residence?"; });
    expect(runFixtures(draft).passed).toBe(true);
    const r = runFixture(fx("marco"), draft);
    expect(r.steps.find((s) => s.key === "IND_PRE.RM_INQUIRY").question).toBe("Does the relationship manager know the holder's residence?");
  });
});

describe("validatePack", () => {
  it("accepts the baseline", () => {
    expect(validatePack(baselineRuleRows())).toEqual({ ok: true, errors: [] });
  });
  it("refuses switching off a locked rule", () => {
    const { rules } = draftWith((r) => { ruleIn(r, "IND_PRE.INDICIA_SEARCH").enabled = false; });
    expect(validatePack(rules).errors.map((e) => e.rule_key)).toContain("IND_PRE.INDICIA_SEARCH");
  });
  it("allows switching off an optional rule", () => {
    const { rules } = draftWith((r) => { ruleIn(r, "IND_PRE.RESIDENCE_ADDRESS_TEST").enabled = false; });
    expect(validatePack(rules).ok).toBe(true);
  });
  it("refuses changed option values but allows new labels", () => {
    const bad = draftWith((r) => { ruleIn(r, "IND_PRE.CURE").options[0].value = "nope"; }).rules;
    expect(validatePack(bad).ok).toBe(false);
    const good = draftWith((r) => { ruleIn(r, "IND_PRE.CURE").options[0].label = "Not cured"; }).rules;
    expect(validatePack(good).ok).toBe(true);
  });
  it("refuses out-of-range and unknown parameters", () => {
    const pct = draftWith((r) => { ruleIn(r, "CP.IDENTIFY").params.ownership_threshold_pct = 150; }).rules;
    expect(validatePack(pct).errors[0].field).toBe("params.ownership_threshold_pct");
    const unknown = draftWith((r) => { ruleIn(r, "GEN.BALANCE").params.surprise = 1; }).rules;
    expect(validatePack(unknown).ok).toBe(false);
  });
  it("refuses removing a Handbook rule", () => {
    const rules = baselineRuleRows().filter((r) => r.rule_key !== "CP.RESIDENCE");
    expect(validatePack(rules).errors.some((e) => e.rule_key === "CP.RESIDENCE")).toBe(true);
  });
  it("checks extra questions", () => {
    const bad = [...baselineRuleRows(), { rule_key: "local", custom: true, hook: "nowhere", options: [{ value: "a", label: "A", effect: "hold" }] }];
    const msgs = validatePack(bad).errors.map((e) => e.field);
    expect(msgs).toEqual(expect.arrayContaining(["rule_key", "hook", "question", "options"]));
    const good = [...baselineRuleRows(), { rule_key: "X.LOCAL_CHECK", custom: true, hook: "individual", question: "Local check done?",
      options: [{ value: "yes", label: "Yes", effect: "continue" }, { value: "no", label: "No", effect: "hold", reason: "Do the local check." }],
      condition: { logic_operator: "AND", conditions: [{ field: "account_type", operator: "equals", value: "custodial" }] } }];
    expect(validatePack(good)).toEqual({ ok: true, errors: [] });
  });
});

describe("optional rules switched off in a pack", () => {
  it("residence address test off → indicia search is used instead", () => {
    const draft = draftWith((r) => { ruleIn(r, "IND_PRE.RESIDENCE_ADDRESS_TEST").enabled = false; });
    const r = runFixture(fx("anna"), draft);
    expect(r.steps.find((s) => s.key === "IND_PRE.RESIDENCE_ADDRESS_TEST").evidence).toMatch(/Rule Library/);
    expect(r.steps.some((s) => s.key === "IND_PRE.INDICIA_SEARCH")).toBe(true);
    expect(r.outcome).toMatchObject({ status: "reportable", jurisdictions: ["DE"] });
  });
  it("250k exemption off → the entity is reviewed even when elected in settings", () => {
    const draft = draftWith((r) => { ruleIn(r, "ENT_PRE.THRESHOLD_250K").enabled = false; });
    const r = runFixture(fx("ent250k"), draft);
    expect(r.steps.find((s) => s.key === "ENT_PRE.THRESHOLD_250K").evidence).toMatch(/switched off/);
    expect(r.outcome.reason).not.toMatch(/250,000 exemption/);
  });
  it("TIN check off → no TIN question", () => {
    const draft = draftWith((r) => { ruleIn(r, "IND_NEW.TIN_CHECK").enabled = false; });
    const r = runFixture(fx("tin"), draft);
    expect(r.gaps.map((g) => g.key)).not.toContain("IND_NEW.TIN_CHECK");
  });
  it("a pack can't switch off a locked rule even if the data says so", () => {
    const pack = resolvePack({ version: "9", rules: [{ rule_key: "IND_PRE.INDICIA_SEARCH", enabled: false }] });
    expect(pack.rules.find((r) => r.rule_key === "IND_PRE.INDICIA_SEARCH").enabled).toBe(true);
  });
});

describe("extra questions", () => {
  const extra = (condition) => draftWith((r) => r.push({ rule_key: "X.LOCAL_CHECK", custom: true, hook: "individual", order: 1, enabled: true,
    question: "Has the local sanctions check been done?",
    options: [{ value: "done", label: "Done", effect: "continue" }, { value: "not_done", label: "Not done", effect: "hold", reason: "Do the local check first." }], condition }));

  it("asks only when the condition matches", () => {
    const draft = extra({ logic_operator: "AND", conditions: [{ field: "account_type", operator: "equals", value: "custodial" }] });
    expect(runFixture(fx("marco"), draft).gaps.map((g) => g.key)).toEqual(["X.LOCAL_CHECK"]);
    expect(runFixture(fx("anna"), draft).outcome.status).toBe("reportable"); // depository: not asked
  });
  it("'hold' pauses with the reason; 'continue' gives the normal outcome", () => {
    const draft = extra(null);
    const f = fx("anna");
    const held = evaluate({ ...f.ctx, ...f.parts, pack: draft }, { "X.LOCAL_CHECK": "not_done" });
    expect(held.outcome).toMatchObject({ status: "pending", reason: "Do the local check first." });
    const ok = evaluate({ ...f.ctx, ...f.parts, pack: draft }, { "X.LOCAL_CHECK": "done" });
    expect(ok.outcome).toMatchObject({ status: "reportable", jurisdictions: ["DE"] });
  });
  it("never runs for entity accounts when hooked on individuals", () => {
    expect(runFixture(fx("helios"), extra(null)).gaps).toHaveLength(0);
  });
});

describe("jurisdiction override packs", () => {
  it("lay the override over the global pack and combine the version", () => {
    const global = { version: "1.1.0", rules: [{ rule_key: "IND_PRE.RM_INQUIRY", question: "Global wording" }] };
    const cw = { version: "1.0.0", jurisdiction_scope: "CW", rules: [{ rule_key: "IND_PRE.RM_INQUIRY", question: "Curaçao wording" }, { rule_key: "IND_PRE.CURE", hb_ref: "CW ref" }] };
    const p = resolvePack(global, cw);
    expect(p.version).toBe("1.1.0+CW.1.0.0");
    expect(p.rules.find((r) => r.rule_key === "IND_PRE.RM_INQUIRY").question).toBe("Curaçao wording");
    expect(p.rules.find((r) => r.rule_key === "IND_PRE.CURE").hb_ref).toBe("CW ref");
    const r = evaluate({ ...fx("sofie").ctx, ...fx("sofie").parts, pack: global, overridePack: cw }, { "IND_PRE.PAPER_SEARCH": "complete" });
    expect(r.rule_pack_version).toBe("1.1.0+CW.1.0.0");
    expect(r.gaps[0].question).toBe("Curaçao wording");
  });
});

describe("conditions", () => {
  it("handles AND/OR, sub-groups and operators", () => {
    const facts = { account_type: "Custodial", balance_usd: 1500000, country_of_residence: "", preexisting: true };
    expect(matchesCondition({ logic_operator: "AND", conditions: [{ field: "account_type", operator: "equals", value: "custodial" }, { field: "balance_usd", operator: "greater_than", value: "1000000" }] }, facts)).toBe(true);
    expect(matchesCondition({ logic_operator: "OR", conditions: [{ field: "account_type", operator: "equals", value: "annuity" }],
      subGroups: [{ logic_operator: "AND", conditions: [{ field: "country_of_residence", operator: "is_empty" }, { field: "preexisting", operator: "equals", value: "true" }] }] }, facts)).toBe(true);
    expect(matchesCondition({ conditions: [{ field: "account_type", operator: "in_list", value: "depository, annuity" }] }, facts)).toBe(false);
    expect(matchesCondition({ conditions: [{ field: "account_type", operator: "bogus", value: "x" }] }, facts)).toBe(false);
    expect(matchesCondition(null, facts)).toBe(true);
  });
});

describe("diff, fingerprint and versions", () => {
  it("diffPacks lists changed fields and added rules", () => {
    const before = baselineRuleRows();
    const after = draftWith((r) => { ruleIn(r, "GEN.BALANCE").params.high_value_threshold_usd = 2000000; r.push({ rule_key: "X.NEW_ONE", custom: true }); }).rules;
    const d = diffPacks(before, after);
    expect(d.find((x) => x.rule_key === "GEN.BALANCE").fields[0].field).toBe("params");
    expect(d.find((x) => x.rule_key === "X.NEW_ONE").change).toBe("added");
    expect(diffPacks(before, clone(before))).toEqual([]);
  });
  it("packFingerprint ignores ids and order, but sees content changes", () => {
    const a = baselineRuleRows();
    const b = clone(a).reverse().map((r, i) => ({ ...r, id: `row${i}`, pack_id: "p", created_date: "x" }));
    expect(packFingerprint(a)).toBe(packFingerprint(b));
    const c = draftWith((r) => { ruleIn(r, "IND_PRE.CURE").help = "changed"; }).rules;
    expect(packFingerprint(c)).not.toBe(packFingerprint(a));
  });
  it("nextVersion bumps the minor version and skips taken ones", () => {
    expect(nextVersion("1.0.0")).toBe("1.1.0");
    expect(nextVersion("1.0.0", ["1.1.0", "1.2.0"])).toBe("1.3.0");
  });
  it("every baseline rule appears exactly once", () => {
    expect(new Set(BASELINE_RULES.map((r) => r.rule_key)).size).toBe(BASELINE_RULES.length);
  });
});
