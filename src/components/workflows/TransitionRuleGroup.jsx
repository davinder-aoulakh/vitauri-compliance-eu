import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import TransitionConditionRow from "./TransitionConditionRow";
import TransitionComputedRow from "./TransitionComputedRow";
import { normalizeTransitionRule } from "@/lib/workflowTransitions";

const NONE = "__none__";

export default function TransitionRuleGroup({ rule, index, fields, workflows, onChange, onRemove }) {
  const group = normalizeTransitionRule(rule);
  const conditions = group.conditions;
  const computed = group.computed_conditions;
  const emit = (patch) => onChange({ group_name: group.group_name, group_operator: group.group_operator, conditions, computed_conditions: computed, target_workflow_id: group.target_workflow_id, ...patch });
  const setCondition = (i, patch) => emit({ conditions: conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });

  return (
    <div className="bg-white border border-indigo-200 rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="bg-indigo-50 text-indigo-800">Group {index + 1}</Badge>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Match</span>
          <Select value={group.group_operator} onValueChange={(v) => emit({ group_operator: v })}>
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">ALL (AND)</SelectItem>
              <SelectItem value="OR">ANY (OR)</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove}><Trash2 className="w-4 h-4 text-red-500" /></Button>
        </div>
      </div>

      {conditions.map((c, i) => (
        <TransitionConditionRow
          key={i}
          condition={c}
          fields={fields}
          onChange={(patch) => setCondition(i, patch)}
          onRemove={() => emit({ conditions: conditions.filter((_, idx) => idx !== i) })}
        />
      ))}
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => emit({ conditions: [...conditions, { field: "", operator: "=", value: "", value_type: "static" }] })}>
        <Plus className="w-3 h-3 mr-1" />Add condition
      </Button>

      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-700">Computed Conditions</p>
            <p className="text-xs text-slate-500">For conditions using multiple fields (e.g., field1 + field2 &gt; 100000)</p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => emit({ computed_conditions: [...computed, { expression: "", operator: "greater_than", value: "" }] })}>
            <Plus className="w-3 h-3 mr-1" />Add Computed
          </Button>
        </div>
        {computed.map((c, i) => (
          <TransitionComputedRow
            key={i}
            condition={c}
            onChange={(patch) => emit({ computed_conditions: computed.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) })}
            onRemove={() => emit({ computed_conditions: computed.filter((_, idx) => idx !== i) })}
          />
        ))}
      </div>

      <div>
        <p className="text-xs text-slate-600 mb-1">Then go to workflow</p>
        <Select value={group.target_workflow_id || NONE} onValueChange={(v) => emit({ target_workflow_id: v === NONE ? "" : v })}>
          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Select target workflow</SelectItem>
            {workflows.map(w => <SelectItem key={w.id} value={w.id}>{w.workflow_name} (v{w.version || "1"})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}