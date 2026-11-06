// Computed (multi-field arithmetic) conditions for workflow transitions.
// Same shape and semantics as the auto-trigger computed_conditions: { expression, operator, value }.
export const COMPUTED_OPERATORS = [
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "greater_than_or_equal", label: "≥" },
  { value: "less_than_or_equal", label: "≤" },
  { value: "equals", label: "=" },
];

export const COMPUTED_FIELD_HINT = ["year_end_cash_value", "gross_payments", "beneficiaries_count", "controlling_persons_count"];

// Safe arithmetic evaluator (+ - * / parentheses, numbers, field names). No eval.
// Returns NaN on any parse error or divide-by-zero.
function evaluateExpression(expression, getValue) {
  const tokens = String(expression || "").match(/[A-Za-z_][A-Za-z0-9_.]*|\d+\.?\d*|\.\d+|[()+\-*/]|\S/g) || [];
  let pos = 0;
  const peek = () => tokens[pos];

  const parsePrimary = () => {
    const tok = tokens[pos++];
    if (tok === undefined) return NaN;
    if (tok === "(") {
      const v = parseSum();
      if (tokens[pos++] !== ")") return NaN;
      return v;
    }
    if (tok === "-") return -parsePrimary();
    if (tok === "+") return parsePrimary();
    if (/^[\d.]/.test(tok)) return parseFloat(tok);
    if (/^[A-Za-z_]/.test(tok)) {
      const n = parseFloat(getValue(tok));
      return Number.isFinite(n) ? n : 0;
    }
    return NaN;
  };
  const parseProduct = () => {
    let v = parsePrimary();
    while (peek() === "*" || peek() === "/") {
      const op = tokens[pos++];
      const r = parsePrimary();
      v = op === "*" ? v * r : (r === 0 ? NaN : v / r);
    }
    return v;
  };
  function parseSum() {
    let v = parseProduct();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[pos++];
      const r = parseProduct();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  const result = parseSum();
  return pos < tokens.length ? NaN : result;
}

// True only when the expression yields a finite number that satisfies the comparison.
export function evaluateComputedCondition(cond, getValue) {
  const result = evaluateExpression(cond?.expression, getValue);
  const threshold = parseFloat(cond?.value);
  if (!Number.isFinite(result) || !Number.isFinite(threshold)) return false;
  switch (cond.operator) {
    case "greater_than": case ">": return result > threshold;
    case "less_than": case "<": return result < threshold;
    case "greater_than_or_equal": case ">=": return result >= threshold;
    case "less_than_or_equal": case "<=": return result <= threshold;
    case "equals": case "=": return result === threshold;
    default: return false;
  }
}