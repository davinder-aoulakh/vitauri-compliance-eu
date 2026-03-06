import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Copy } from "lucide-react";

export default function CopyWorkflowStepsDialog({ isOpen, onClose, onCopySteps, currentWorkflowId }) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [selectedStepIds, setSelectedStepIds] = useState([]);

  const { data: workflows = [], isLoading: isLoadingWorkflows } = useQuery({
    queryKey: ["all-workflows-for-copy"],
    queryFn: () => base44.entities.Workflow.list(),
    enabled: isOpen,
  });

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);
  const sourceSteps = selectedWorkflow?.steps || [];

  useEffect(() => {
    if (!isOpen) {
      setSelectedWorkflowId("");
      setSelectedStepIds([]);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedStepIds([]);
  }, [selectedWorkflowId]);

  const toggleStep = (stepId) => {
    setSelectedStepIds(prev =>
      prev.includes(stepId) ? prev.filter(id => id !== stepId) : [...prev, stepId]
    );
  };

  const toggleAll = () => {
    if (selectedStepIds.length === sourceSteps.length) {
      setSelectedStepIds([]);
    } else {
      setSelectedStepIds(sourceSteps.map(s => s.step_id));
    }
  };

  const handleCopy = () => {
    const stepsToCopy = sourceSteps.filter(s => selectedStepIds.includes(s.step_id));
    onCopySteps(stepsToCopy);
    onClose();
  };

  const otherWorkflows = workflows.filter(w => w.id !== currentWorkflowId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-4 h-4" />
            Copy Steps from Another Workflow
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          <p className="text-sm text-slate-600">
            Select a workflow and pick which steps to copy into your current workflow.
          </p>

          <div>
            <Label className="mb-1.5 block">Source Workflow</Label>
            <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId} disabled={isLoadingWorkflows}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingWorkflows ? "Loading..." : "Select a workflow..."} />
              </SelectTrigger>
              <SelectContent>
                {otherWorkflows.map(w => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.workflow_name}
                    {w.version && <span className="text-slate-400 ml-1">v{w.version}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingWorkflows && (
            <div className="flex items-center justify-center py-6 text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading workflows...
            </div>
          )}

          {selectedWorkflowId && sourceSteps.length === 0 && (
            <div className="flex items-center gap-2 text-slate-500 text-sm p-4 bg-slate-50 rounded-lg border">
              <AlertCircle className="w-4 h-4" />
              This workflow has no steps.
            </div>
          )}

          {sourceSteps.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Select Steps to Copy</Label>
                <button onClick={toggleAll} className="text-xs text-indigo-600 hover:underline">
                  {selectedStepIds.length === sourceSteps.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="border rounded-lg divide-y overflow-hidden">
                {sourceSteps.map((step, idx) => (
                  <label
                    key={step.step_id}
                    htmlFor={`copy-step-${step.step_id}`}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Checkbox
                      id={`copy-step-${step.step_id}`}
                      checked={selectedStepIds.includes(step.step_id)}
                      onCheckedChange={() => toggleStep(step.step_id)}
                    />
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{step.step_title}</p>
                      {step.question_text && (
                        <p className="text-xs text-slate-500 truncate">{step.question_text}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {step.question_type?.replace(/_/g, " ")}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleCopy}
            disabled={selectedStepIds.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy {selectedStepIds.length > 0 ? `${selectedStepIds.length} Step${selectedStepIds.length > 1 ? "s" : ""}` : "Steps"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}