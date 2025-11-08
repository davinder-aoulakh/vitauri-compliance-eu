import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  History, 
  MoreVertical, 
  Eye, 
  Copy, 
  Archive, 
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  Play,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";

export default function WorkflowVersionManager({ workflowName, currentVersion, onVersionSelect }) {
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [newVersionNumber, setNewVersionNumber] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const queryClient = useQueryClient();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['workflow-versions', workflowName],
    queryFn: () => workflowName 
      ? base44.entities.Workflow.filter({ workflow_name: workflowName })
      : [],
    enabled: !!workflowName
  });

  const publishMutation = useMutation({
    mutationFn: (id) => base44.entities.Workflow.update(id, { 
      status: 'published',
      published_date: new Date().toISOString().split('T')[0]
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-versions']);
    }
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => base44.entities.Workflow.update(id, { status: 'archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-versions']);
    }
  });

  const cloneMutation = useMutation({
    mutationFn: async ({ workflow, newVersion }) => {
      const clonedWorkflow = {
        ...workflow,
        version: newVersion,
        status: 'draft',
        published_date: null,
        id: undefined,
        created_date: undefined,
        updated_date: undefined
      };
      delete clonedWorkflow.id;
      delete clonedWorkflow.created_date;
      delete clonedWorkflow.updated_date;
      
      return base44.entities.Workflow.create(clonedWorkflow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-versions']);
      setShowNewVersionDialog(false);
      setNewVersionNumber("");
    }
  });

  const handleCreateNewVersion = () => {
    if (!newVersionNumber || !selectedWorkflow) return;
    cloneMutation.mutate({ workflow: selectedWorkflow, newVersion: newVersionNumber });
  };

  const handlePublish = (workflow) => {
    if (confirm(`Publish version ${workflow.version}? This will make it active for use.`)) {
      publishMutation.mutate(workflow.id);
    }
  };

  const handleArchive = (workflow) => {
    if (confirm(`Archive version ${workflow.version}? It will no longer be accessible.`)) {
      archiveMutation.mutate(workflow.id);
    }
  };

  const handleClone = (workflow) => {
    setSelectedWorkflow(workflow);
    const versionParts = workflow.version.split('.');
    const nextMinor = parseInt(versionParts[1] || 0) + 1;
    setNewVersionNumber(`${versionParts[0]}.${nextMinor}.0`);
    setShowNewVersionDialog(true);
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { 
        label: "Draft", 
        color: "bg-amber-100 text-amber-800 border-amber-200",
        icon: Clock
      },
      published: { 
        label: "Published", 
        color: "bg-green-100 text-green-800 border-green-200",
        icon: CheckCircle2
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

  const sortedVersions = [...versions].sort((a, b) => {
    const aVersion = a.version.split('.').map(Number);
    const bVersion = b.version.split('.').map(Number);
    for (let i = 0; i < Math.max(aVersion.length, bVersion.length); i++) {
      if ((aVersion[i] || 0) !== (bVersion[i] || 0)) {
        return (bVersion[i] || 0) - (aVersion[i] || 0);
      }
    }
    return 0;
  });

  const activeVersion = sortedVersions.find(v => v.status === 'published');
  const draftVersions = sortedVersions.filter(v => v.status === 'draft');
  const archivedVersions = sortedVersions.filter(v => v.status === 'archived');

  return (
    <div className="space-y-6">
      {/* Current Active Version Alert */}
      {activeVersion && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-sm text-green-900">
            <strong>Active Version:</strong> v{activeVersion.version} 
            {activeVersion.published_date && ` • Published ${format(new Date(activeVersion.published_date), 'MMM d, yyyy')}`}
          </AlertDescription>
        </Alert>
      )}

      {/* Version Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600">Published</p>
                <p className="text-2xl font-bold text-slate-900">
                  {versions.filter(v => v.status === 'published').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600">Draft</p>
                <p className="text-2xl font-bold text-slate-900">{draftVersions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Archive className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600">Archived</p>
                <p className="text-2xl font-bold text-slate-900">{archivedVersions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Version History Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5 text-indigo-600" />
              Version History
            </CardTitle>
            {activeVersion && (
              <Button
                onClick={() => handleClone(activeVersion)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <GitBranch className="w-4 h-4" />
                Create New Version
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          ) : sortedVersions.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Versions Found</h3>
              <p className="text-slate-600">This workflow doesn't have any versions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Last Modified</TableHead>
                    <TableHead>Modified By</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedVersions.map((version) => (
                    <TableRow 
                      key={version.id} 
                      className={`hover:bg-slate-50/50 ${
                        version.id === currentVersion?.id ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-900">
                            v{version.version}
                          </span>
                          {version.id === currentVersion?.id && (
                            <Badge className="bg-indigo-600 text-white text-xs">Current</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(version.status)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize text-slate-700">
                          {version.workflow_type?.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {version.updated_date 
                            ? format(new Date(version.updated_date), 'MMM d, yyyy HH:mm')
                            : '—'
                          }
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {version.last_modified_by || version.created_by || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-700">
                          {version.steps?.length || 0} steps
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onVersionSelect(version)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            
                            {version.status === 'draft' && (
                              <DropdownMenuItem onClick={() => handlePublish(version)}>
                                <Play className="w-4 h-4 mr-2" />
                                Publish Version
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuItem onClick={() => handleClone(version)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Clone as New Version
                            </DropdownMenuItem>
                            
                            {version.status !== 'archived' && (
                              <DropdownMenuItem 
                                onClick={() => handleArchive(version)}
                                className="text-red-600"
                              >
                                <Archive className="w-4 h-4 mr-2" />
                                Archive Version
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Version Dialog */}
      <Dialog open={showNewVersionDialog} onOpenChange={setShowNewVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Version</DialogTitle>
            <DialogDescription>
              Clone the selected workflow to create a new version. This will create a draft copy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedWorkflow && (
              <Alert className="bg-blue-50 border-blue-200">
                <FileText className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-900">
                  Cloning from: <strong>v{selectedWorkflow.version}</strong> ({selectedWorkflow.steps?.length || 0} steps)
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="version">New Version Number</Label>
              <Input
                id="version"
                value={newVersionNumber}
                onChange={(e) => setNewVersionNumber(e.target.value)}
                placeholder="e.g., 2.0.0"
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1">
                Follow semantic versioning: MAJOR.MINOR.PATCH
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowNewVersionDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateNewVersion}
              disabled={!newVersionNumber || cloneMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {cloneMutation.isPending ? "Creating..." : "Create Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}