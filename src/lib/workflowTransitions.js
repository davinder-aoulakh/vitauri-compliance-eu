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
  { value: "in", label: "in (comma-separated)" },
  { value: "not_in", label: "not in" },
  { value: "is_crs", label: "is CRS country" },
  { value: "is_not_crs", label: "is not CRS country" },
];

// Converts a saved rule (new group shape or legacy single-condition shape) to a group.
export function normalizeTransitionRule(rule) {
  if (Array.isArray(rule?.conditions)) {
    return { group_name: rule.group_name || "", group_operator: rule.group_operator || "AND", conditions: rule.conditions, target_workflow_id: rule.target_workflow_id || "" };
  }
  return {
    group_name: "",
    group_operator: "AND",
    conditions: rule?.field ? [{ field: rule.field, operator: rule.operator || "=", value: rule.value, value_type: "static" }] : [],
    target_workflow_id: rule?.target_workflow_id || "",
  };
}

// Returns { targetId, mode } or null when the step has no active transition / nothing matches.
export async function resolveTransitionTarget(step, evalCondition, currentAnswer) {
  const t = step?.workflow_transition;
  if (!t?.enabled) return null;
  // Answer gate: only evaluate the transition when the step's answer matches a configured value.
  const gate = t.trigger_answer_values || [];
  if (gate.length > 0) {
    const given = (Array.isArray(currentAnswer) ? currentAnswer : [currentAnswer]).map(a => String(a?.value ?? a));
    if (!given.some(a => gate.includes(a))) return null;
  }
  if (t.mode === "conditional") {
    for (const rule of t.rules || []) {
      const group = normalizeTransitionRule(rule);
      const conditions = group.conditions.filter(c => c.field);
      if (!group.target_workflow_id || conditions.length === 0) continue;
      let met = group.group_operator === "AND";
      for (const c of conditions) {
        const result = await evalCondition({ ...c, operator: c.operator || "=", value_type: c.value_type || "static" });
        if (group.group_operator === "AND") { met = met && result; if (!met) break; }
        else { met = met || result; if (met) break; }
      }
      if (met) return { targetId: group.target_workflow_id, mode: "conditional" };
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