import React from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, GitBranch } from "lucide-react";
import { toDisplayDateTime } from "@/lib/dateUtils";

export default function WorkflowTransitionEntry({ record }) {
  return (
    <div className="border border-dashed border-violet-300 bg-violet-50/40 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
          <GitBranch className="w-4 h-4" />
          Workflow transition #{record.transition_sequence || 1}
        </div>
        <span className="text-xs text-slate-500">{toDisplayDateTime(record.classification_date)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className="bg-white">{record.from_workflow_name}</Badge>
        <ArrowRight className="w-4 h-4 text-violet-600" />
        <Badge variant="outline" className="bg-white">{record.to_workflow_name}</Badge>
        {record.transition_mode && (
          <Badge variant="outline" className="text-xs capitalize">{record.transition_mode}</Badge>
        )}
      </div>
      <p className="text-xs text-slate-600">
        Origin workflow ended at step "{record.transition_step_title}" (by {record.performed_by}).
      </p>
    </div>
  );
}