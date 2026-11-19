// Manual classification — the outcome of one workflow run, worked out from the run itself.
//
// Before this, the result screen and the completion preferred whatever reportability status and reason were
// already on the account (unless "pending_review"), so re-classifying an account kept its old result.
// Now the outcome comes from this run's path: the last status/reason set by a post-completion action on a
// visited step, otherwise the final step's configured result. Pure functions; tested in tests/manual.

/** Status implied by a step's configured result (result_status, or a result_action keyword). */
export function deriveStepStatus(step) {
  if (step?.result_status) return step.result_status;
  if (step?.result_action) {
    if (step.result_action.includes("non_reportable") || step.result_action.includes("excluded")) return "non_reportable";
    if (step.result_action.includes("reportable")) return "reportable";
  }
  return "pending_review";
}

/**
 * The status and reason of a workflow run.
 * @param {string[]} path - visited step ids, in order
 * @param {Object} stepMap - step_id → step
 * @param {Object} answers - final answers of the run
 * @param {(action, answers) => Object|null} resolveActionUpdate - the component's resolver (returns {field: value} or null)
 * @returns {{ status: string, reason: string, statusSource: "action"|"final_step", reasonSource: "action"|"final_step"|"none" }}
 */
export function resolveRunOutcome(path, stepMap, answers, resolveActionUpdate) {
  let actionStatus; let actionReason;
  for (const stepId of path || []) {
    const actions = stepMap?.[stepId]?.post_completion_actions || [];
    for (const action of actions) {
      const update = resolveActionUpdate(action, answers || {});
      if (!update) continue;
      if (update.reportability_status !== undefined && update.reportability_status !== null && update.reportability_status !== "") actionStatus = update.reportability_status;
      if (update.reportability_reason !== undefined && update.reportability_reason !== null && update.reportability_reason !== "") actionReason = update.reportability_reason;
    }
  }
  const finalStep = stepMap?.[path?.[path.length - 1]];
  const finalReason = finalStep?.result_description || finalStep?.question_text || "";
  return {
    status: actionStatus || deriveStepStatus(finalStep),
    reason: actionReason || finalReason,
    statusSource: actionStatus ? "action" : "final_step",
    reasonSource: actionReason ? "action" : finalReason ? "final_step" : "none",
  };
}

/** Default pre-existing cut-off when a tenant has none configured (the app's previous behaviour). */
export const DEFAULT_PREEXISTING_CUTOFF = "2017-12-31";

/** The tenant's pre-existing cut-off date: tenant setting, then the Classification Studio settings, then the default. */
export function preexistingCutoff(tenant, studioSettings) {
  const valid = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (valid(tenant?.preexisting_cutoff)) return tenant.preexisting_cutoff;
  if (valid(studioSettings?.preexisting_cutoff)) return studioSettings.preexisting_cutoff;
  return DEFAULT_PREEXISTING_CUTOFF;
}

/** Is an account opened on `creationDate` pre-existing for this cut-off? (open on or before the cut-off date) */
export function isPreExistingOn(creationDate, cutoff) {
  if (!creationDate) return null;
  const opened = String(creationDate).slice(0, 10);
  return opened <= cutoff;
}
