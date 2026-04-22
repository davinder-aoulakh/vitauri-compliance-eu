import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FlaskConical, CheckCircle2, XCircle, ChevronRight, Loader2, AlertTriangle } from "lucide-react";

// Mirrors the condition evaluation logic from the backend
function getNestedValue(obj, path) {
  if (!path) return undefined;
  return path.split(".").reduce((curr, key) => (curr != null ? curr[key] : undefined), obj);
}

function evaluateCondition(condition, account, entity) {
  const { field, operator, value } = condition;

  let actualValue;
  if (field?.startsWith("entity.")) {
    const entityField = field.replace("entity.", "");
    actualValue = entity ? getNestedValue(entity, entityField) : undefined;
  } else {
    actualValue = getNestedValue(account, field);
  }

  // Normalize booleans
  let compareValue = value;
  if (compareValue === "true") compareValue = true;
  if (compareValue === "false") compareValue = false;
  if (typeof actualValue === "boolean" && (compareValue === "true" || compareValue === "false")) {
    compareValue = compareValue === "true" || compareValue === true;
  }

  const isEmptyOp = operator === "is_empty" || operator === "is_not_empty";
  const isDateAgoOp = typeof operator === "string" && operator.includes("ago");

  let result = false;
  let displayActual = actualValue === undefined || actualValue === null ? "(empty)" : String(actualValue);

  if (operator === "is_empty") {
    result = actualValue === undefined || actualValue === null || actualValue === "";
  } else if (operator === "is_not_empty") {
    result = actualValue !== undefined && actualValue !== null && actualValue !== "";
  } else if (isDateAgoOp) {
    const daysAgo = Math.floor((Date.now() - new Date(actualValue)) / 86400000);
    const monthsAgo = Math.floor(daysAgo / 30);
    const yearsAgo = Math.floor(daysAgo / 365);
    const num = parseFloat(value);
    const unit = operator.startsWith("days") ? daysAgo : operator.startsWith("months") ? monthsAgo : yearsAgo;
    if (operator.includes("greater_than")) result = unit > num;
    else result = unit < num;
    displayActual = `${daysAgo} days ago`;
  } else {
    switch (operator) {
      case "equals": result = String(actualValue) === String(compareValue); break;
      case "not_equals": result = String(actualValue) !== String(compareValue); break;
      case "greater_than": result = parseFloat(actualValue) > parseFloat(value); break;
      case "less_than": result = parseFloat(actualValue) < parseFloat(value); break;
      case "greater_than_or_equal": result = parseFloat(actualValue) >= parseFloat(value); break;
      case "less_than_or_equal": result = parseFloat(actualValue) <= parseFloat(value); break;
      case "contains": result = String(actualValue).toLowerCase().includes(String(value).toLowerCase()); break;
      case "in": result = value.split(",").map(v => v.trim()).includes(String(actualValue)); break;
      case "not_in": result = !value.split(",").map(v => v.trim()).includes(String(actualValue)); break;
      default: result = false;
    }
  }

  return { result, displayActual, field, operator, value: isEmptyOp ? "(none)" : value };
}

function evaluateGroup(group, account, entity) {
  const conditionResults = (group.conditions || []).map(c => ({
    ...evaluateCondition(c, account, entity),
    type: "condition",
    raw: c,
  }));

  const subGroupResults = (group.subGroups || []).map(sg => ({
    type: "group",
    ...evaluateGroup(sg, account, entity),
    raw: sg,
  }));

  const allResults = [...conditionResults, ...subGroupResults];
  const logic = group.logic_operator || "AND";

  let groupPassed;
  if (logic === "AND") {
    groupPassed = allResults.every(r => r.result);
  } else {
    groupPassed = allResults.some(r => r.result);
  }

  return { result: groupPassed, logic, items: allResults };
}

function evaluateRule(rule, account, entity) {
  // Grouped conditions
  if (rule.condition_group && (rule.condition_group.conditions?.length > 0 || rule.condition_group.subGroups?.length > 0)) {
    return evaluateGroup(rule.condition_group, account, entity);
  }

  // Flat conditions (legacy)
  if (rule.conditions?.length > 0) {
    const valid = rule.conditions.filter(c => c.field && (c.operator === "is_empty" || c.operator === "is_not_empty" || c.value !== undefined));
    const items = valid.map(c => ({ ...evaluateCondition(c, account, entity), type: "condition", raw: c }));

    // Evaluate with logic_operator chaining
    let result = items[0]?.result ?? false;
    for (let i = 1; i < items.length; i++) {
      const logic = valid[i - 1].logic_operator || "AND";
      if (logic === "AND") result = result && items[i].result;
      else result = result || items[i].result;
    }

    return { result, logic: "FLAT", items };
  }

  return { result: false, logic: "NONE", items: [] };
}

function ConditionRow({ item, depth = 0 }) {
  if (item.type === "group") {
    return (
      <div className={`border-l-2 ${item.result ? "border-green-400" : "border-red-300"} pl-3 space-y-1`}>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
          <span>Group ({item.logic})</span>
          {item.result
            ? <Badge className="bg-green-100 text-green-700 text-xs">PASS</Badge>
            : <Badge className="bg-red-100 text-red-700 text-xs">FAIL</Badge>}
        </div>
        {item.items?.map((child, i) => (
          <ConditionRow key={i} item={child} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 py-1.5 px-3 rounded-lg ${item.result ? "bg-green-50" : "bg-red-50"}`}>
      {item.result
        ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
        : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
      <div className="flex-1 text-sm">
        <span className="font-mono text-slate-700">{item.field}</span>
        <span className="text-slate-500 mx-1">{item.operator}</span>
        <span className="font-mono text-slate-700">"{item.value}"</span>
        <ChevronRight className="inline w-3 h-3 mx-1 text-slate-400" />
        <span className={`font-semibold ${item.result ? "text-green-700" : "text-red-600"}`}>
          actual: "{item.displayActual}"
        </span>
      </div>
      <Badge className={`text-xs shrink-0 ${item.result ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
        {item.result ? "PASS" : "FAIL"}
      </Badge>
    </div>
  );
}

export default function RuleSimulator({ rules, formData, editingRule }) {
  const [simTenantId, setSimTenantId] = useState("");
  const [simEntityId, setSimEntityId] = useState("");
  const [simAccountId, setSimAccountId] = useState("");
  const [simResults, setSimResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: tenants = [] } = useQuery({
    queryKey: ["sim-tenants"],
    queryFn: () => base44.entities.Tenant.list(),
  });

  const { data: entities = [] } = useQuery({
    queryKey: ["sim-entities", simTenantId],
    queryFn: () => simTenantId ? base44.entities.Entity.filter({ tenant_id: simTenantId }) : Promise.resolve([]),
    enabled: !!simTenantId,
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ["sim-accounts", simEntityId],
    queryFn: () => simEntityId ? base44.entities.Account.filter({ entity_id: simEntityId }) : Promise.resolve([]),
    enabled: !!simEntityId,
  });

  const runSimulation = async () => {
    if (!simAccountId) return;
    setLoading(true);

    const account = accounts.find(a => a.id === simAccountId);
    const entity = entities.find(e => e.id === simEntityId);

    // Build the rule to simulate: prefer the current form state if editing
    const currentFormRule = {
      ...formData,
      id: editingRule?.id || "draft",
      rule_name: formData.rule_name || "Current Rule (draft)",
    };

    // All saved rules sorted by priority
    const savedRules = [...rules]
      .filter(r => r.is_active)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Replace the edited rule in the list with the current form version
    const ruleList = editingRule
      ? savedRules.map(r => r.id === editingRule.id ? currentFormRule : r)
      : [currentFormRule, ...savedRules];

    const ruleEvals = ruleList.map(rule => {
      const evaluation = evaluateRule(rule, account, entity);
      return { rule, evaluation };
    });

    // First matching rule wins
    const matchedIndex = ruleEvals.findIndex(r => r.evaluation.result);

    setSimResults({ account, ruleEvals, matchedIndex });
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <FlaskConical className="w-4 h-4 text-violet-600" />
        Select an account to simulate rule evaluation
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Tenant</Label>
          <Select value={simTenantId} onValueChange={v => { setSimTenantId(v); setSimEntityId(""); setSimAccountId(""); setSimResults(null); }}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder="Select tenant..." />
            </SelectTrigger>
            <SelectContent>
              {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Entity</Label>
          <Select value={simEntityId} onValueChange={v => { setSimEntityId(v); setSimAccountId(""); setSimResults(null); }} disabled={!simTenantId}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder={simTenantId ? "Select entity..." : "Select tenant first"} />
            </SelectTrigger>
            <SelectContent>
              {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Account</Label>
          <Select value={simAccountId} onValueChange={v => { setSimAccountId(v); setSimResults(null); }} disabled={!simEntityId}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder={simEntityId ? (accountsLoading ? "Loading..." : "Select account...") : "Select entity first"} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_number} — {a.account_holder_name || a.first_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={runSimulation}
        disabled={!simAccountId || loading}
        className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
        Run Simulation
      </Button>

      {simResults && (
        <div className="space-y-3 mt-2">
          {/* Account summary */}
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 border">
            <span className="font-semibold">Account:</span> {simResults.account.account_number} &nbsp;|&nbsp;
            <span className="font-semibold">Holder:</span> {simResults.account.account_holder_name || `${simResults.account.first_name || ""} ${simResults.account.last_name || ""}`.trim() || "(unnamed)"} &nbsp;|&nbsp;
            <span className="font-semibold">Status:</span> {simResults.account.reportability_status || "N/A"}
          </div>

          {/* Overall result */}
          {simResults.matchedIndex === -1 ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-800 font-medium">No rule matched this account — it would remain unchanged.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">
                  Matched: "{simResults.ruleEvals[simResults.matchedIndex].rule.rule_name}"
                </p>
                <p className="text-xs text-green-700">
                  Result: <strong>{simResults.ruleEvals[simResults.matchedIndex].rule.classification_result}</strong>
                  &nbsp;— {simResults.ruleEvals[simResults.matchedIndex].rule.classification_reason}
                </p>
              </div>
            </div>
          )}

          {/* Per-rule breakdown */}
          <div className="space-y-2">
            {simResults.ruleEvals.map(({ rule, evaluation }, idx) => {
              const isMatch = idx === simResults.matchedIndex;
              const isSkippedAfterMatch = simResults.matchedIndex !== -1 && idx > simResults.matchedIndex;

              return (
                <details key={rule.id || idx} open={isMatch} className={`rounded-lg border ${isMatch ? "border-green-400 bg-green-50/30" : isSkippedAfterMatch ? "border-slate-200 bg-slate-50/30 opacity-50" : "border-slate-200"}`}>
                  <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm font-medium select-none">
                    {evaluation.result
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                    <span className="flex-1">{rule.rule_name}</span>
                    <Badge variant="outline" className="text-xs font-mono">Priority {rule.priority || 0}</Badge>
                    {isMatch && <Badge className="bg-green-600 text-white text-xs">MATCHED</Badge>}
                    {isSkippedAfterMatch && <Badge variant="outline" className="text-xs text-slate-400">skipped</Badge>}
                  </summary>
                  {!isSkippedAfterMatch && (
                    <div className="px-3 pb-3 space-y-1.5">
                      <p className="text-xs text-slate-500 font-semibold mt-1 mb-1">
                        Logic: <span className="text-slate-700">{evaluation.logic}</span> —
                        Overall: <span className={evaluation.result ? "text-green-700" : "text-red-600"}>{evaluation.result ? "PASS" : "FAIL"}</span>
                      </p>
                      {evaluation.items?.map((item, i) => (
                        <ConditionRow key={i} item={item} />
                      ))}
                      {evaluation.items?.length === 0 && (
                        <p className="text-xs text-slate-400 italic">No conditions defined.</p>
                      )}
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}