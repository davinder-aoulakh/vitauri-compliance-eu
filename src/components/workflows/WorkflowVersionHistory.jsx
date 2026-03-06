import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  History,
  CheckCircle2,
  Save,
  Archive,
  RotateCcw,
  Eye,
  GitBranch,
  Upload
} from "lucide-react";
import { format } from "date-fns";
import WorkflowVisualizer from "./WorkflowVisualizer";

export default function WorkflowVersionHistory({ workflowId, workflowName, onRestored }) {
  const [previewSnapshot, setPreviewSnapshot] = useState(null);
  const queryClient = useQueryClient();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['workflow-versions', workflowId],
    queryFn: () => base44.entities.WorkflowVersion.filter({ workflow_id: workflowId }, '-captured_date', 50),
    enabled: !!workflowId
  });

  const restoreMutation = useMutation({
    mutationFn: ({ snapshot }) =>
      base44.entities.Workflow.update(workflowId, { ...snapshot }),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflows']);
      queryClient.invalidateQueries(['workflow-versions', workflowId]);
      onRestored?.();
    }
  });

  const getEventBadge = (eventType) => {
    const config = {
      published: { label: "Published", color: "bg-green-100 text-green-800 border-green-200", icon: Upload },
      saved: { label: "Saved", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Save },
      archived: { label: "Archived", color: "bg-gray-100 text-gray-800 border-gray-200", icon: Archive }
    };
    const { label, color, icon: Icon } = config[eventType] || config.saved;
    return (
      <Badge variant="outline" className={`${color} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>No version snapshots yet. Snapshots are created automatically when you save or publish a workflow.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 border-blue-200">
        <History className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          {versions.length} snapshot{versions.length !== 1 ? 's' : ''} recorded for <strong>{workflowName}</strong>.
          Restoring a version will overwrite the current workflow structure.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {versions.map((ver, index) => (
          <div
            key={ver.id}
            className="relative border rounded-lg p-4 bg-white hover:shadow-md transition-all border-slate-200"
          >
            {index < versions.length - 1 && (
              <div className="absolute left-8 -bottom-3 w-0.5 h-3 bg-slate-200 z-10"></div>
            )}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                <div className="text-center">
                  <GitBranch className="w-4 h-4 mx-auto mb-0.5" />
                  <p className="text-xs font-bold">v{ver.version}</p>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {getEventBadge(ver.event_type)}
                  <span className="text-xs text-slate-500">
                    {format(new Date(ver.captured_date), "MMM d, yyyy h:mm a")}
                  </span>
                  <span className="text-xs text-slate-400">by {ver.captured_by}</span>
                </div>
                {ver.description && (
                  <p className="text-sm text-slate-600 mb-2">{ver.description}</p>
                )}
                <p className="text-xs text-slate-400">
                  {ver.snapshot?.steps?.length || 0} steps
                </p>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewSnapshot(ver.snapshot)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Restore workflow to this snapshot (v${ver.version} - ${ver.event_type})? This will overwrite the current structure.`)) {
                      restoreMutation.mutate({ snapshot: ver.snapshot });
                    }
                  }}
                  disabled={restoreMutation.isPending}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Restore
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Snapshot Preview Dialog */}
      <Dialog open={!!previewSnapshot} onOpenChange={() => setPreviewSnapshot(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Snapshot Preview: {previewSnapshot?.workflow_name} v{previewSnapshot?.version}</DialogTitle>
          </DialogHeader>
          <WorkflowVisualizer workflow={previewSnapshot} />
        </DialogContent>
      </Dialog>
    </div>
  );
}