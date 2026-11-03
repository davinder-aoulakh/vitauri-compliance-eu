import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { TRANSITION_OPERATORS } from "@/lib/workflowTransitions";

const NONE = "__none__";

function WorkflowSelect({ value, onChange, workflows, placeholder }) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="bg-white"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {workflows.map(w => (
          <SelectItem key={w.id} value={w.id}>{w.workflow_name} (v{w.version || "1"})</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function StepTransitionConfig({ step, allSteps = [], currentWorkflowId, onChange }) {
  const t = step.workflow_transition || { enabled: false, mode: "direct", rules: [] };
  const { data: all = [] } = useQuery({
    queryKey: ["workflows-for-transition"],
    queryFn: () => base44.entities.Workflow.filter({ status: "published" }),
  });
  const workflows = all.filter(w => w.id !== currentWorkflowId);
  const update = (patch) => onChange({ ...t, ...patch });
  const rules = t.rules || [];
  const setRule = (i, patch) => update({ rules: rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });

  return (
    <div className="border-t pt-4">
      <Label className="flex items-center gap-2 mb-3">
        <WorkflowIcon className="w-4 h-4 text-indigo-600" />Workflow Transition
      </Label>
      <div className="flex items-center gap-2 mb-3">
        <Checkbox checked={!!t.enabled} onCheckedChange={(v) => update({ enabled: !!v, mode: t.mode || "direct" })} />
        <span className="text-sm text-slate-700">After this step, end this workflow and start another one</span>
      </div>
      {t.enabled && (
        <div className="space-y-3 bg-indigo-50/40 border border-indigo-100 rounded-lg p-3">
          <Select value={t.mode || "direct"} onValueChange={(v) => update({ mode: v })}>
            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Always go to one workflow</SelectItem>
              <SelectItem value="conditional">Choose workflow by condition</SelectItem>
            </SelectContent>
          </Select>

          {(t.mode || "direct") === "direct" ? (
            <WorkflowSelect value={t.target_workflow_id} onChange={(v) => update({ target_workflow_id: v })} workflows={workflows} placeholder="Select target workflow" />
          ) : (
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <div key={i} className="bg-white border rounded-md p-2 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Select value={rule.field || NONE} onValueChange={(v) => setRule(i, { field: v === NONE ? "" : v })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Step answer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Select step answer</SelectItem>
                        {allSteps.filter(s => s.question_type !== "result").map(s => (
                          <SelectItem key={s.step_id} value={s.step_id}>{s.step_title || s.step_id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={rule.operator || "="} onValueChange={(v) => setRule(i, { operator: v })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRANSITION_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="w-32" placeholder="Value" value={rule.value || ""} onChange={(e) => setRule(i, { value: e.target.value })} />
                    <Button size="icon" variant="ghost" onClick={() => update({ rules: rules.filter((_, idx) => idx !== i) })}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  <WorkflowSelect value={rule.target_workflow_id} onChange={(v) => setRule(i, { target_workflow_id: v })} workflows={workflows} placeholder="Then go to workflow" />
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => update({ rules: [...rules, { field: "", operator: "=", value: "", target_workflow_id: "" }] })}>
                <Plus className="w-3 h-3 mr-1" />Add condition
              </Button>
              <div>
                <Label className="text-xs text-slate-600">Otherwise (no condition matches)</Label>
                <WorkflowSelect value={t.default_target_workflow_id} onChange={(v) => update({ default_target_workflow_id: v })} workflows={workflows} placeholder="Continue this workflow normally" />
              </div>
            </div>
          )}

          {workflows.length === 0 && (
            <Alert><AlertDescription className="text-xs">No other published workflows available.</AlertDescription></Alert>
          )}
          <p className="text-xs text-slate-500">When triggered, this workflow ends and the transition plus both workflow results are recorded in classification history.</p>
        </div>
      )}
    </div>
  );
}