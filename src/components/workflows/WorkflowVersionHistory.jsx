import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  History,
  CheckCircle2,
  Clock,
  Archive,
  RotateCcw,
  Eye,
  GitBranch,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";

export default function WorkflowVersionHistory({ 
  workflows, 
  currentWorkflowId,
  onViewVersion,
  onRestoreVersion,
  onCompareVersions
}) {
  if (!workflows || workflows.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>No version history available</p>
      </div>
    );
  }

  // Sort by version descending
  const sortedWorkflows = [...workflows].sort((a, b) => {
    const versionA = parseFloat(a.version || "0");
    const versionB = parseFloat(b.version || "0");
    return versionB - versionA;
  });

  const currentWorkflow = sortedWorkflows.find(w => w.id === currentWorkflowId);

  const getStatusBadge = (status) => {
    const config = {
      published: { 
        label: "Published", 
        color: "bg-green-100 text-green-800 border-green-200",
        icon: CheckCircle2
      },
      draft: { 
        label: "Draft", 
        color: "bg-amber-100 text-amber-800 border-amber-200",
        icon: Clock
      },
      archived: { 
        label: "Archived", 
        color: "bg-slate-100 text-slate-800 border-slate-200",
        icon: Archive
      }
    };
    const { label, color, icon: Icon } = config[status] || config.draft;
    return (
      <Badge variant="outline" className={`${color} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Current Version Alert */}
      {currentWorkflow && (
        <Alert className="bg-blue-50 border-blue-200">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            <strong>Current Active Version:</strong> v{currentWorkflow.version} 
            {currentWorkflow.published_date && (
              <span className="ml-2">
                (Published {format(new Date(currentWorkflow.published_date), "MMM d, yyyy")})
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Version Timeline */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5 text-slate-600" />
              Version History
            </CardTitle>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {sortedWorkflows.length} {sortedWorkflows.length === 1 ? "Version" : "Versions"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {sortedWorkflows.map((workflow, index) => {
              const isCurrent = workflow.id === currentWorkflowId;
              const changeLog = workflow.change_log && workflow.change_log.length > 0 
                ? workflow.change_log[workflow.change_log.length - 1] 
                : null;

              return (
                <div
                  key={workflow.id}
                  className={`relative border rounded-lg p-4 transition-all ${
                    isCurrent
                      ? "border-blue-200 bg-blue-50/30"
                      : "border-slate-200 bg-white hover:shadow-md"
                  }`}
                >
                  {/* Timeline connector */}
                  {index < sortedWorkflows.length - 1 && (
                    <div className="absolute left-8 -bottom-4 w-0.5 h-4 bg-slate-200"></div>
                  )}

                  <div className="flex items-start gap-4">
                    {/* Version Badge */}
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCurrent
                        ? "bg-blue-600 text-white shadow-lg"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      <div className="text-center">
                        <GitBranch className="w-5 h-5 mx-auto mb-0.5" />
                        <p className="text-xs font-bold">v{workflow.version}</p>
                      </div>
                    </div>

                    {/* Version Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-slate-900">
                              Version {workflow.version}
                            </h4>
                            {getStatusBadge(workflow.status)}
                            {isCurrent && (
                              <Badge className="bg-blue-600 text-white">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-600">
                            {workflow.published_date && (
                              <span>
                                Published: {format(new Date(workflow.published_date), "MMM d, yyyy")}
                              </span>
                            )}
                            {workflow.last_modified_by && (
                              <span>By: {workflow.last_modified_by}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Change Description */}
                      {changeLog && changeLog.changes_description && (
                        <div className="bg-slate-50 rounded p-3 mb-3">
                          <p className="text-xs font-medium text-slate-700 mb-1">Changes in this version:</p>
                          <p className="text-sm text-slate-600">{changeLog.changes_description}</p>
                        </div>
                      )}

                      {/* Stats */}
                      {workflow.usage_stats && (
                        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                          <span>
                            {workflow.usage_stats.total_executions || 0} executions
                          </span>
                          {workflow.usage_stats.avg_completion_time && (
                            <span>
                              Avg: {Math.round(workflow.usage_stats.avg_completion_time / 60)}min
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewVersion && onViewVersion(workflow)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>

                        {!isCurrent && workflow.status !== "archived" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRestoreVersion && onRestoreVersion(workflow)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Restore
                          </Button>
                        )}

                        {index < sortedWorkflows.length - 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCompareVersions && onCompareVersions(workflow, sortedWorkflows[index + 1])}
                          >
                            Compare
                            <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Full Change Log */}
      {sortedWorkflows[0]?.change_log && sortedWorkflows[0].change_log.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-sm">Complete Change Log</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {sortedWorkflows.flatMap(w => w.change_log || [])
                .sort((a, b) => new Date(b.changed_date) - new Date(a.changed_date))
                .map((log, idx) => (
                  <div key={idx} className="text-xs border-b border-slate-100 pb-2 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-900">v{log.version}</span>
                      <span className="text-slate-500">
                        {format(new Date(log.changed_date), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <p className="text-slate-600">{log.changes_description}</p>
                    <p className="text-slate-500 mt-0.5">by {log.changed_by}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}