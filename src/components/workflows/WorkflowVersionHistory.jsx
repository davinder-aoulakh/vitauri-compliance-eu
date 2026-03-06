import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  History,
  CheckCircle2,
  Clock,
  RotateCcw,
  Eye,
  GitBranch,
  Save,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";

export default function WorkflowVersionHistory({ workflowId, workflowName, onViewSnapshot }) {
  const [savingVersion, setSavingVersion] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [changeSummary, setChangeSummary] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [message, setMessage] = useState(null);

  const { data: versions = [], isLoading, refetch } = useQuery({
    queryKey: ['workflow-versions', workflowId],
    queryFn: () => base44.entities.WorkflowVersion.filter(
      { workflow_id: workflowId },
      '-saved_at',
      50
    ),
    enabled: !!workflowId
  });

  const handleSaveVersion = async () => {
    setSavingVersion(true);
    try {
      await base44.functions.invoke('saveWorkflowVersion', {
        workflow_id: workflowId,
        change_summary: changeSummary || 'Manual checkpoint',
        version_label: 'minor'
      });
      setMessage({ type: 'success', text: 'Version snapshot saved successfully.' });
      setChangeSummary("");
      setShowSaveDialog(false);
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save version: ' + err.message });
    } finally {
      setSavingVersion(false);
    }
  };

  const handleRestoreVersion = async () => {
    if (!selectedVersion) return;
    setRestoring(true);
    try {
      await base44.functions.invoke('restoreWorkflowVersion', {
        version_id: selectedVersion.id
      });
      setMessage({ type: 'success', text: `Restored to v${selectedVersion.version_number}. The workflow is now a draft — review and publish when ready.` });
      setShowRestoreDialog(false);
      setSelectedVersion(null);
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to restore: ' + err.message });
    } finally {
      setRestoring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Version Snapshots</h3>
          <p className="text-sm text-slate-500">
            Full snapshots of "{workflowName}" — restore any previous state at any time.
          </p>
        </div>
        <Button
          onClick={() => setShowSaveDialog(true)}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Save className="w-4 h-4" />
          Save Checkpoint
        </Button>
      </div>

      {/* Status message */}
      {message && (
        <Alert className={message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          {message.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 text-green-600" />
            : <AlertTriangle className="w-4 h-4 text-red-600" />
          }
          <AlertDescription className={message.type === 'success' ? 'text-green-900' : 'text-red-900'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Version list */}
      {versions.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-10 text-center">
            <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-medium">No version snapshots yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Click "Save Checkpoint" to create your first snapshot. Snapshots are also created automatically when you publish.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md">
          <CardHeader className="border-b bg-slate-50 py-3 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="w-4 h-4 text-slate-500" />
                {versions.length} Snapshot{versions.length !== 1 ? 's' : ''}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={`p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors ${index === 0 ? 'bg-blue-50/40' : ''}`}
              >
                {/* Version icon */}
                <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${
                  index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <GitBranch className="w-4 h-4 mb-0.5" />
                  <span className="text-xs font-bold">v{version.version_number}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-medium text-slate-900 text-sm">v{version.version_number}</span>
                    {version.is_published_snapshot && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 border text-xs py-0">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Published
                      </Badge>
                    )}
                    {index === 0 && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 border text-xs py-0">
                        Latest
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs py-0 capitalize">
                      {version.version_label}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-700 truncate">{version.change_summary}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(version.saved_at), "MMM d, yyyy h:mm a")}
                    </span>
                    <span>by {version.saved_by}</span>
                    {version.step_count !== undefined && (
                      <span>{version.step_count} steps</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {onViewSnapshot && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewSnapshot(version.snapshot)}
                      className="gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Button>
                  )}
                  {index !== 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVersion(version);
                        setShowRestoreDialog(true);
                      }}
                      className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Save checkpoint dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save Version Checkpoint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">
              This will create a full snapshot of the current workflow state. You can restore to this point at any time.
            </p>
            <Textarea
              placeholder="Describe what changed... (optional)"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSaveVersion}
              disabled={savingVersion}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {savingVersion ? "Saving..." : "Save Checkpoint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Restore Version v{selectedVersion?.version_number}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-900 text-sm">
                The current workflow will be automatically snapshotted before restoring. The restored version will be set to <strong>Draft</strong> status — you can review and publish it.
              </AlertDescription>
            </Alert>
            {selectedVersion && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p><strong>Snapshot:</strong> v{selectedVersion.version_number}</p>
                <p><strong>Saved:</strong> {selectedVersion.saved_at ? format(new Date(selectedVersion.saved_at), "MMM d, yyyy h:mm a") : '-'}</p>
                <p><strong>Description:</strong> {selectedVersion.change_summary}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>Cancel</Button>
            <Button
              onClick={handleRestoreVersion}
              disabled={restoring}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {restoring ? "Restoring..." : "Yes, Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}