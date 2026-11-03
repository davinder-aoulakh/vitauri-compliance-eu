// Helpers for step-level workflow transitions (hand-off from one workflow to another).
export const MAX_TRANSITIONS = 4;

export const TRANSITION_OPERATORS = [
  { value: "=", label: "equals" },
  { value: "!=", label: "does not equal" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "contains", label: "contains" },
];

// Returns { targetId, mode } or null when the step has no active transition / nothing matches.
export async function resolveTransitionTarget(step, evalCondition) {
  const t = step?.workflow_transition;
  if (!t?.enabled) return null;
  if (t.mode === "conditional") {
    for (const rule of t.rules || []) {
      if (!rule.field || !rule.target_workflow_id) continue;
      const met = await evalCondition({
        field: rule.field,
        operator: rule.operator || "=",
        value: rule.value,
        value_type: "static",
      });
      if (met) return { targetId: rule.target_workflow_id, mode: "conditional" };
    }
    return t.default_target_workflow_id
      ? { targetId: t.default_target_workflow_id, mode: "conditional" }
      : null;
  }
  return t.target_workflow_id ? { targetId: t.target_workflow_id, mode: "direct" } : null;
}

// Returns an error message string, or null if the transition is allowed.
export function validateTransition({ target, chainIds }) {
  if (!target) return "The target workflow is missing or not published.";
  if (chainIds.includes(target.id)) {
    return `Workflow "${target.workflow_name}" was already used in this classification. Transition loops are not allowed.`;
  }
  if (chainIds.length > MAX_TRANSITIONS) {
    return `Too many workflow transitions (maximum ${MAX_TRANSITIONS}).`;
  }
  return null;
}

// All target workflow ids referenced by a step (for editor validation).
export function getTransitionTargetIds(step) {
  const t = step?.workflow_transition;
  if (!t?.enabled) return [];
  if (t.mode === "conditional") {
    return [...(t.rules || []).map(r => r.target_workflow_id), t.default_target_workflow_id].filter(Boolean);
  }
  return t.target_workflow_id ? [t.target_workflow_id] : [];
}