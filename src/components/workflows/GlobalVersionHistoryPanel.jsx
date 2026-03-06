import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, Eye, GitBranch, Search, Upload, Save, Archive } from "lucide-react";
import { format } from "date-fns";
import WorkflowVersionHistory from "./WorkflowVersionHistory";

export default function GlobalVersionHistoryPanel({ workflows }) {
  const [search, setSearch] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  const { data: allVersions = [], isLoading } = useQuery({
    queryKey: ['all-workflow-versions'],
    queryFn: () => base44.entities.WorkflowVersion.list('-captured_date', 100)
  });

  const eventIcon = { published: Upload, saved: Save, archived: Archive };
  const eventColor = {
    published: "bg-green-100 text-green-800 border-green-200",
    saved: "bg-blue-100 text-blue-800 border-blue-200",
    archived: "bg-gray-100 text-gray-800 border-gray-200"
  };

  const filtered = allVersions.filter(v =>
    !search || v.workflow_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <History className="w-5 h-5" />
              All Workflow Version Snapshots ({allVersions.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Filter by workflow name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white/10 text-white border-white/20 placeholder:text-white/40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-indigo-200">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No snapshots recorded yet. Save or publish a workflow to create a snapshot.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filtered.map((ver) => {
                const Icon = eventIcon[ver.event_type] || Save;
                const color = eventColor[ver.event_type] || eventColor.saved;
                return (
                  <div key={ver.id} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-4 h-4 text-indigo-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{ver.workflow_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-indigo-300 font-mono">v{ver.version}</span>
                        <Badge variant="outline" className={`${color} border text-xs`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {ver.event_type}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {format(new Date(ver.captured_date), "MMM d, yyyy h:mm a")}
                        </span>
                        <span className="text-xs text-slate-500">by {ver.captured_by}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/10 text-white border-white/20 hover:bg-white/20 flex-shrink-0"
                      onClick={() => {
                        const wf = workflows?.find(w => w.id === ver.workflow_id);
                        setSelectedWorkflow(wf || { id: ver.workflow_id, workflow_name: ver.workflow_name });
                      }}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      All Versions
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedWorkflow} onOpenChange={() => setSelectedWorkflow(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History: {selectedWorkflow?.workflow_name}</DialogTitle>
          </DialogHeader>
          {selectedWorkflow && (
            <WorkflowVersionHistory
              workflowId={selectedWorkflow.id}
              workflowName={selectedWorkflow.workflow_name}
              onRestored={() => setSelectedWorkflow(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}