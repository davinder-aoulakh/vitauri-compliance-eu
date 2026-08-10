import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Loader2, Wrench, Info } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────

function buildPatch(suggestion, workflow, formValues) {
  const steps = JSON.parse(JSON.stringify(workflow.steps || []));

  if (suggestion.type === "missing_exit") {
    const targetStepId = formValues.target_step_id;
    const exitStepId = formValues.exit_step_id;
    const exitStatus = formValues.exit_status || "non_reportable";
    const exitDescription = formValues.exit_description || "Exit step added via AI Fix";

    if (!targetStepId || !exitStepId) return null;

    // 1. Check if exit step already exists, create if not
    const existingExit = steps.find(s => s.step_id === exitStepId);
    if (!existingExit) {
      steps.push({
        step_id: exitStepId,
        step_title: formValues.exit_step_title || "Classification Result",
        question_type: "result",
        result_status: exitStatus,
        result_description: exitDescription,
        required: true,
      });
    }

    // 2. Wire the target step's default_next_step or terminal option to the exit step
    const targetStep = steps.find(s => s.step_id === targetStepId);
    if (targetStep) {
      if (targetStep.question_type === "yes_no" || targetStep.question_type === "single_choice") {
        // Add a new option or update existing null/missing next_step options
        if (!targetStep.options) targetStep.options = [];
        const missingNext = targetStep.options.find(o => !o.next_step);
        if (missingNext) {
          missingNext.next_step = exitStepId;
        } else {
          targetStep.default_next_step = exitStepId;
        }
      } else {
        targetStep.default_next_step = exitStepId;
      }
    }

    return { steps };
  }

  if (suggestion.type === "dead_end") {
    const targetStepId = formValues.target_step_id;
    const nextStepId = formValues.next_step_id;
    if (!targetStepId || !nextStepId) return null;
    const targetStep = steps.find(s => s.step_id === targetStepId);
    if (targetStep) {
      targetStep.default_next_step = nextStepId;
    }
    return { steps };
  }

  if (suggestion.type === "redundant_loop") {
    // Insert a circuit-breaker result step after N retries
    const loopStepId = formValues.loop_step_id;
    const breakerStepId = formValues.breaker_step_id || `${loopStepId}_breaker`;
    if (!loopStepId) return null;

    const existingBreaker = steps.find(s => s.step_id === breakerStepId);
    if (!existingBreaker) {
      steps.push({
        step_id: breakerStepId,
        step_title: formValues.breaker_title || "Pending Review — Maximum Retries Reached",
        question_type: "result",
        result_status: "pending_review",
        result_description: formValues.breaker_description || "Account flagged for manual review after repeated classification attempts.",
        required: true,
      });
    }
    // Set the loop step's default_next_step to the breaker if it has none
    const loopStep = steps.find(s => s.step_id === loopStepId);
    if (loopStep && !loopStep.default_next_step) {
      loopStep.default_next_step = breakerStepId;
    }
    return { steps };
  }

  // Generic fallback: just update change_log
  return null;
}

// ── Form variants per suggestion type ───────────────────────────────────

function MissingExitForm({ suggestion, workflow, values, onChange }) {
  const stepOptions = workflow.steps || [];
  const affectedSteps = suggestion.affected_steps || [];

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>This fix will add a new <strong>result step</strong> and wire it to the selected terminal step's default exit path.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Terminal Step to Fix <span className="text-red-500">*</span></Label>
        <Select value={values.target_step_id || ""} onValueChange={v => onChange("target_step_id", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select step that has no exit..." />
          </SelectTrigger>
          <SelectContent>
            {stepOptions.map(s => (
              <SelectItem key={s.step_id} value={s.step_id}>
                <span className="font-mono text-xs text-slate-500 mr-2">{s.step_id}</span>
                {s.step_title || s.step_id}
                {affectedSteps.includes(s.step_id) && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1 rounded">suggested</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>New Exit Step ID <span className="text-red-500">*</span></Label>
          <Input
            placeholder="e.g. result_non_reportable"
            value={values.exit_step_id || ""}
            onChange={e => onChange("exit_step_id", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Exit Step Title</Label>
          <Input
            placeholder="e.g. Classification Result"
            value={values.exit_step_title || ""}
            onChange={e => onChange("exit_step_title", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Classification Outcome <span className="text-red-500">*</span></Label>
          <Select value={values.exit_status || "non_reportable"} onValueChange={v => onChange("exit_status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="non_reportable">Non-Reportable</SelectItem>
              <SelectItem value="reportable">Reportable</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="excluded">Excluded</SelectItem>
              <SelectItem value="work_in_progress">Work in progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Result Description</Label>
          <Input
            placeholder="e.g. Account is non-reportable"
            value={values.exit_description || ""}
            onChange={e => onChange("exit_description", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function DeadEndForm({ suggestion, workflow, values, onChange }) {
  const stepOptions = workflow.steps || [];
  const affectedSteps = suggestion.affected_steps || [];

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>This fix sets a <strong>default_next_step</strong> on the dead-end step to point to an existing step.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Dead-End Step to Fix <span className="text-red-500">*</span></Label>
        <Select value={values.target_step_id || ""} onValueChange={v => onChange("target_step_id", v)}>
          <SelectTrigger><SelectValue placeholder="Select dead-end step..." /></SelectTrigger>
          <SelectContent>
            {stepOptions.map(s => (
              <SelectItem key={s.step_id} value={s.step_id}>
                <span className="font-mono text-xs text-slate-500 mr-2">{s.step_id}</span>
                {s.step_title || s.step_id}
                {affectedSteps.includes(s.step_id) && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1 rounded">suggested</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Route to Step <span className="text-red-500">*</span></Label>
        <Select value={values.next_step_id || ""} onValueChange={v => onChange("next_step_id", v)}>
          <SelectTrigger><SelectValue placeholder="Select target step..." /></SelectTrigger>
          <SelectContent>
            {stepOptions.map(s => (
              <SelectItem key={s.step_id} value={s.step_id}>
                <span className="font-mono text-xs text-slate-500 mr-2">{s.step_id}</span>
                {s.step_title || s.step_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function RedundantLoopForm({ suggestion, workflow, values, onChange }) {
  const stepOptions = workflow.steps || [];
  const affectedSteps = suggestion.affected_steps || [];

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>This fix inserts a <strong>Pending Review result step</strong> as a circuit-breaker exit from the loop step.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Loop Step to Break <span className="text-red-500">*</span></Label>
        <Select value={values.loop_step_id || ""} onValueChange={v => onChange("loop_step_id", v)}>
          <SelectTrigger><SelectValue placeholder="Select the step causing the loop..." /></SelectTrigger>
          <SelectContent>
            {stepOptions.map(s => (
              <SelectItem key={s.step_id} value={s.step_id}>
                <span className="font-mono text-xs text-slate-500 mr-2">{s.step_id}</span>
                {s.step_title || s.step_id}
                {affectedSteps.includes(s.step_id) && (
                  <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1 rounded">suggested</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Circuit-Breaker Step ID</Label>
          <Input
            placeholder="auto-generated if blank"
            value={values.breaker_step_id || ""}
            onChange={e => onChange("breaker_step_id", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Step Title</Label>
          <Input
            placeholder="Pending Review — Max Retries"
            value={values.breaker_title || ""}
            onChange={e => onChange("breaker_title", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Reviewer Note</Label>
        <Input
          placeholder="Reason for manual review..."
          value={values.breaker_description || ""}
          onChange={e => onChange("breaker_description", e.target.value)}
        />
      </div>
    </div>
  );
}

function GenericForm({ suggestion }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
      <p className="font-medium text-slate-800 mb-1">Manual action required</p>
      <p>This suggestion type (<strong>{suggestion.type}</strong>) requires manual edits in the Workflow Builder. Use the details below as guidance:</p>
      <p className="mt-2 text-slate-700 italic">"{suggestion.suggested_fix}"</p>
      {suggestion.affected_steps?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500">Affected:</span>
          {suggestion.affected_steps.map((s, i) => (
            <span key={i} className="font-mono text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────

const SUPPORTED_TYPES = ["missing_exit", "dead_end", "redundant_loop"];

export default function ApplyFixModal({ open, onClose, suggestion, workflow, onFixApplied }) {
  const [formValues, setFormValues] = useState({});
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const isSupported = SUPPORTED_TYPES.includes(suggestion?.type);

  const handleChange = (key, value) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    setSuccess(null);
    try {
      const patch = buildPatch(suggestion, workflow, formValues);
      if (!patch) {
        setError("Please fill in all required fields.");
        setApplying(false);
        return;
      }

      // 1. Update the workflow entity directly
      await base44.entities.Workflow.update(workflow.id, patch);

      // 2. Snapshot via saveWorkflowVersion
      await base44.functions.invoke("saveWorkflowVersion", {
        workflow_id: workflow.id,
        change_summary: `AI Fix applied: ${suggestion.title}`,
        version_label: "minor",
      });

      setSuccess(`Fix applied successfully. Workflow updated and version snapshot saved.`);
      onFixApplied && onFixApplied(patch);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to apply fix.");
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    setFormValues({});
    setSuccess(null);
    setError(null);
    onClose();
  };

  if (!suggestion) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wrench className="w-4 h-4 text-indigo-600" />
            Apply Fix: {suggestion.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            {suggestion.problem}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Priority / type badges */}
          <div className="flex items-center gap-2">
            <Badge className={
              suggestion.priority === "high" ? "bg-red-100 text-red-700 border-red-200 border" :
              suggestion.priority === "medium" ? "bg-amber-100 text-amber-700 border-amber-200 border" :
              "bg-blue-100 text-blue-700 border-blue-200 border"
            }>
              {suggestion.priority?.toUpperCase()} PRIORITY
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {suggestion.type?.replace(/_/g, " ")}
            </Badge>
          </div>

          {/* Form body */}
          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <p className="text-sm font-semibold text-green-700">Fix Applied!</p>
              <p className="text-xs text-slate-500">{success}</p>
            </div>
          ) : (
            <>
              {suggestion.type === "missing_exit" && (
                <MissingExitForm suggestion={suggestion} workflow={workflow} values={formValues} onChange={handleChange} />
              )}
              {suggestion.type === "dead_end" && (
                <DeadEndForm suggestion={suggestion} workflow={workflow} values={formValues} onChange={handleChange} />
              )}
              {suggestion.type === "redundant_loop" && (
                <RedundantLoopForm suggestion={suggestion} workflow={workflow} values={formValues} onChange={handleChange} />
              )}
              {!isSupported && (
                <GenericForm suggestion={suggestion} />
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={applying}>
            {success ? "Close" : "Cancel"}
          </Button>
          {isSupported && !success && (
            <Button
              onClick={handleApply}
              disabled={applying}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {applying ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Applying...</>
              ) : (
                <><Wrench className="w-4 h-4 mr-2" /> Apply Fix</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}