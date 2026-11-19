import { describe, it, expect } from "vitest";
import { resolveRunOutcome, deriveStepStatus, preexistingCutoff, isPreExistingOn, DEFAULT_PREEXISTING_CUTOFF } from "../../src/lib/classificationOutcome.js";

// Same shape as AccountClassification's resolveActionUpdate (static values, optional condition on an answer).
const resolveActionUpdate = (action, answers) => {
  const value = action.value_source === "static_value" ? action.value : action.value_source === "from_step_answer" ? answers[action.value] : null;
  if (action.condition) {
    const v = answers[action.condition.field];
    const ok = action.condition.operator === "=" ? v === action.condition.value : action.condition.operator === "!=" ? v !== action.condition.value : false;
    if (!ok) return null;
  }
  return action.target_entity_type === "Account" ? { [action.field_to_update]: value } : null;
};
const setStatus = (value, extra = {}) => ({ target_entity_type: "Account", field_to_update: "reportability_status", value_source: "static_value", value, ...extra });
const setReason = (value) => ({ target_entity_type: "Account", field_to_update: "reportability_reason", value_source: "static_value", value });

const steps = {
  s1: { step_id: "s1", question_text: "Is the holder resident in a reportable jurisdiction?" },
  rep: { step_id: "rep", question_text: "Reportable", result_status: "reportable", result_description: "Resident in a reportable jurisdiction." },
  non: { step_id: "non", question_text: "Not reportable", result_action: "mark_non_reportable", result_description: "No reportable residence." },
  info: { step_id: "info", question_text: "Info step", post_completion_actions: [setStatus("non_reportable", { execution_timing: "after_step" }), setReason("Set by the info step.")] },
  cond: { step_id: "cond", question_text: "Conditional", post_completion_actions: [setStatus("reportable", { condition: { field: "s1", operator: "=", value: "YES" } })] },
  plain: { step_id: "plain", question_text: "End without a result" },
};

describe("resolveRunOutcome (re-classify bug)", () => {
  it("uses the final step's configured result, not the account's old status", () => {
    // The account is Reportable from an earlier run; this run ends on the non-reportable step.
    const r = resolveRunOutcome(["s1", "non"], steps, { s1: "NO" }, resolveActionUpdate);
    expect(r).toMatchObject({ status: "non_reportable", reason: "No reportable residence.", statusSource: "final_step" });
  });
  it("lets an action on a visited step win over the final step", () => {
    const r = resolveRunOutcome(["s1", "info", "plain"], steps, {}, resolveActionUpdate);
    expect(r).toMatchObject({ status: "non_reportable", reason: "Set by the info step.", statusSource: "action", reasonSource: "action" });
  });
  it("takes the last action in path order and honours action conditions", () => {
    expect(resolveRunOutcome(["info", "cond", "plain"], steps, { s1: "YES" }, resolveActionUpdate).status).toBe("reportable");
    expect(resolveRunOutcome(["info", "cond", "plain"], steps, { s1: "NO" }, resolveActionUpdate).status).toBe("non_reportable");
  });
  it("ignores steps that were not visited", () => {
    expect(resolveRunOutcome(["s1", "rep"], steps, {}, resolveActionUpdate)).toMatchObject({ status: "reportable", reason: "Resident in a reportable jurisdiction." });
  });
  it("is pending review when nothing sets a result", () => {
    expect(resolveRunOutcome(["s1", "plain"], steps, {}, resolveActionUpdate)).toMatchObject({ status: "pending_review", reason: "End without a result", reasonSource: "final_step" });
    expect(deriveStepStatus(undefined)).toBe("pending_review");
  });
});

describe("pre-existing cut-off", () => {
  it("prefers the tenant setting, then the studio settings, then 31 Dec 2017", () => {
    expect(preexistingCutoff({ preexisting_cutoff: "2015-12-31" }, { preexisting_cutoff: "2016-12-31" })).toBe("2015-12-31");
    expect(preexistingCutoff({}, { preexisting_cutoff: "2016-12-31" })).toBe("2016-12-31");
    expect(preexistingCutoff(null, null)).toBe(DEFAULT_PREEXISTING_CUTOFF);
    expect(preexistingCutoff({ preexisting_cutoff: "" }, {})).toBe("2017-12-31");
  });
  it("treats an account open on the cut-off date as pre-existing", () => {
    expect(isPreExistingOn("2015-12-31", "2015-12-31")).toBe(true);
    expect(isPreExistingOn("2016-03-01", "2015-12-31")).toBe(false);
    expect(isPreExistingOn("2016-03-01", "2017-12-31")).toBe(true);
    expect(isPreExistingOn("2016-03-01T10:00:00Z", "2015-12-31")).toBe(false);
    expect(isPreExistingOn("", "2015-12-31")).toBeNull();
  });
});
