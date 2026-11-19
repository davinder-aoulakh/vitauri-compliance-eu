// Classification Studio — a small, pure evaluator for condition groups built with
// src/components/rules/ConditionGroupBuilder.jsx: { logic_operator: "AND"|"OR", conditions: [{field, operator, value}], subGroups: [...] }.
// Used for extra questions in the CRS Rule Library. Unknown operators never match.

export const CONDITION_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "in_list", label: "Is one of (comma separated)" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

// Facts an extra question may test (account fields plus values the engine has worked out).
export const CONDITION_FACTS = [
  { value: "account_holder_type", label: "Account holder type", type: "select", options: ["individual", "entity"] },
  { value: "account_type", label: "Account type", type: "select", options: ["depository", "custodial", "equity_debt_interest", "cash_value_insurance", "annuity"] },
  { value: "preexisting", label: "Pre-existing account (worked out)", type: "select", options: ["true", "false"] },
  { value: "balance_usd", label: "Balance in USD (worked out)", type: "number" },
  { value: "reporting_jurisdiction", label: "Reporting jurisdiction", type: "text" },
  { value: "country_of_residence", label: "Country of residence", type: "text" },
  { value: "country_of_incorporation", label: "Country of incorporation", type: "text" },
  { value: "account_holder_entity_type", label: "Entity type", type: "text" },
  { value: "entity_classification", label: "Entity classification", type: "select", options: ["financial_institution", "active_nfe", "passive_nfe", "not_applicable"] },
  { value: "status", label: "Account status", type: "select", options: ["active", "closed", "dormant"] },
  { value: "self_certification_obtained", label: "Self-certification obtained", type: "select", options: ["true", "false"] },
  { value: "account_creation_date", label: "Account opening date", type: "date" },
];

const isEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const str = (v) => (v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).toLowerCase().trim();

export function matchesOne(cond, facts) {
  if (!cond || !cond.field) return true;
  const actual = facts?.[cond.field];
  const expected = cond.value;
  switch (cond.operator) {
    case "equals": return str(actual) === str(expected);
    case "not_equals": return str(actual) !== str(expected);
    case "contains": return str(actual).includes(str(expected));
    case "not_contains": return !str(actual).includes(str(expected));
    case "greater_than": case "less_than": {
      const a = Number(actual); const e = Number(expected);
      if (Number.isFinite(a) && Number.isFinite(e)) return cond.operator === "greater_than" ? a > e : a < e;
      if (isEmpty(actual) || isEmpty(expected)) return false;
      return cond.operator === "greater_than" ? str(actual) > str(expected) : str(actual) < str(expected);
    }
    case "in_list": return String(expected || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).includes(str(actual));
    case "is_empty": return isEmpty(actual);
    case "is_not_empty": return !isEmpty(actual);
    default: return false;
  }
}

export function matchesCondition(group, facts) {
  if (!group) return true;
  const parts = [
    ...(group.conditions || []).filter((c) => c && c.field).map((c) => matchesOne(c, facts)),
    ...(group.subGroups || []).map((g) => matchesCondition(g, facts)),
  ];
  if (!parts.length) return true;
  return String(group.logic_operator || "AND").toUpperCase() === "OR" ? parts.some(Boolean) : parts.every(Boolean);
}
