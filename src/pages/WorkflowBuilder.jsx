import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  GitBranch,
  Edit,
  Trash2,
  Eye,
  Upload,
  CheckCircle2,
  Clock,
  Archive,
  MoreVertical,
  History,
  PlayCircle,
  GitCompare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WorkflowForm from "../components/superadmin/WorkflowForm";
import WorkflowVisualizer from "../components/workflows/WorkflowVisualizer";
import WorkflowVersionHistory from "../components/workflows/WorkflowVersionHistory";
import WorkflowTestRunner from "../components/workflows/WorkflowTestRunner";

export default function WorkflowBuilder() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showTestRunner, setShowTestRunner] = useState(false);
  const [selectedWorkflowForVersions, setSelectedWorkflowForVersions] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.user_role !== "super_admin") {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => base44.entities.Workflow.list(),
    enabled: !!user
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Workflow.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflows']);
      setShowForm(false);
      setSelectedWorkflow(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Workflow.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflows']);
      setShowForm(false);
      setSelectedWorkflow(null);
      setShowVersionHistory(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Workflow.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflows']);
    }
  });

  const handleEdit = (workflow) => {
    setSelectedWorkflow(workflow);
    setShowForm(true);
  };

  const handleViewFlow = (workflow) => {
    setSelectedWorkflow(workflow);
    setShowVisualizer(true);
  };

  const handleViewVersions = (workflow) => {
    setSelectedWorkflowForVersions(workflow);
    setShowVersionHistory(true);
  };

  const handleTestWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
    setShowTestRunner(true);
  };

  const handlePublish = async (workflow) => {
    if (confirm("Publishing will make this workflow available to all tenants. Continue?")) {
      const changeLog = workflow.change_log || [];
      changeLog.push({
        version: workflow.version || "1.0",
        changed_by: user.email,
        changed_date: new Date().toISOString(),
        changes_description: "Workflow published"
      });

      updateMutation.mutate({
        id: workflow.id,
        data: {
          ...workflow,
          status: "published",
          published_date: new Date().toISOString().split('T')[0],
          change_log: changeLog
        }
      });
    }
  };

  const handleArchive = async (workflow) => {
    if (confirm("Archive this workflow? It will no longer be available to tenants.")) {
      updateMutation.mutate({
        id: workflow.id,
        data: { 
          ...workflow, 
          status: "archived",
          archived_date: new Date().toISOString().split('T')[0]
        }
      });
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this workflow permanently?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCreateNewVersion = async (baseWorkflow) => {
    const currentVersion = parseFloat(baseWorkflow.version || "1.0");
    const newVersion = (currentVersion + 0.1).toFixed(1);
    
    const newWorkflow = {
      ...baseWorkflow,
      version: newVersion,
      parent_workflow_id: baseWorkflow.id,
      status: "draft",
      published_date: null,
      change_log: [
        ...(baseWorkflow.change_log || []),
        {
          version: newVersion,
          changed_by: user.email,
          changed_date: new Date().toISOString(),
          changes_description: `Created new version ${newVersion} based on v${baseWorkflow.version}`
        }
      ]
    };
    
    delete newWorkflow.id;
    delete newWorkflow.created_date;
    delete newWorkflow.updated_date;
    delete newWorkflow.created_by;
    
    createMutation.mutate(newWorkflow);
  };

  const handleRestoreVersion = async (versionWorkflow) => {
    if (confirm(`Restore version ${versionWorkflow.version} as the current active version?`)) {
      // Create a new version based on the old one
      const currentMaxVersion = Math.max(
        ...workflows
          .filter(w => w.workflow_name === versionWorkflow.workflow_name)
          .map(w => parseFloat(w.version || "1.0"))
      );
      const newVersion = (currentMaxVersion + 0.1).toFixed(1);
      
      const restoredWorkflow = {
        ...versionWorkflow,
        version: newVersion,
        parent_workflow_id: versionWorkflow.id,
        status: "draft",
        published_date: null,
        change_log: [
          ...(versionWorkflow.change_log || []),
          {
            version: newVersion,
            changed_by: user.email,
            changed_date: new Date().toISOString(),
            changes_description: `Restored from version ${versionWorkflow.version}`
          }
        ]
      };
      
      delete restoredWorkflow.id;
      delete restoredWorkflow.created_date;
      delete restoredWorkflow.updated_date;
      delete restoredWorkflow.created_by;
      
      createMutation.mutate(restoredWorkflow);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      published: { label: "Published", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
      draft: { label: "Draft", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
      archived: { label: "Archived", color: "bg-gray-100 text-gray-800 border-gray-200", icon: Archive }
    };
    const { label, color, icon: Icon } = config[status] || config.draft;
    return (
      <Badge variant="outline" className={`${color} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const getWorkflowTypeBadge = (type) => {
    const config = {
      entity_rfi_classification: { label: "Entity RFI", color: "bg-blue-100 text-blue-800" },
      account_reportability: { label: "Account Reportability", color: "bg-purple-100 text-purple-800" },
      custom: { label: "Custom", color: "bg-slate-100 text-slate-800" }
    };
    const { label, color } = config[type] || config.custom;
    return <Badge variant="secondary" className={color}>{label}</Badge>;
  };

  // Get workflow family (all versions of same workflow)
  const getWorkflowVersions = (workflowName) => {
    return workflows.filter(w => w.workflow_name === workflowName);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Workflow Builder</h1>
            <p className="text-indigo-200">
              Configure and manage compliance questionnaires with visual tools
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedWorkflow(null);
              setShowForm(true);
            }}
            className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </Button>
        </div>

        {/* Phase 1 Features Alert */}
        <Alert className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/50 backdrop-blur-sm">
          <GitBranch className="w-4 h-4 text-blue-300" />
          <AlertDescription className="text-blue-100">
            <strong>New:</strong> Visual flow viewer • Version history & rollback • Advanced branching logic • Test mode preview
          </AlertDescription>
        </Alert>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-green-400" />
              <h3 className="text-2xl font-bold text-white mb-1">
                {workflows.filter(w => w.status === "published").length}
              </h3>
              <p className="text-sm text-indigo-200">Published</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-3 text-yellow-400" />
              <h3 className="text-2xl font-bold text-white mb-1">
                {workflows.filter(w => w.status === "draft").length}
              </h3>
              <p className="text-sm text-indigo-200">Drafts</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <CardContent className="p-6 text-center">
              <GitBranch className="w-8 h-8 mx-auto mb-3 text-purple-400" />
              <h3 className="text-2xl font-bold text-white mb-1">
                {workflows.length}
              </h3>
              <p className="text-sm text-indigo-200">Total Versions</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <CardContent className="p-6 text-center">
              <Archive className="w-8 h-8 mx-auto mb-3 text-slate-400" />
              <h3 className="text-2xl font-bold text-white mb-1">
                {workflows.filter(w => w.status === "archived").length}
              </h3>
              <p className="text-sm text-indigo-200">Archived</p>
            </CardContent>
          </Card>
        </div>

        {/* Workflows Table */}
        <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
          <CardHeader className="border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <GitBranch className="w-5 h-5" />
                  Workflows ({workflows.length})
                </CardTitle>
                <CardDescription className="text-indigo-200">
                  Manage compliance questionnaires with advanced features
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              </div>
            ) : workflows.length === 0 ? (
              <div className="p-12 text-center">
                <GitBranch className="w-16 h-16 mx-auto mb-4 text-indigo-300" />
                <h3 className="text-lg font-semibold text-white mb-2">No workflows configured</h3>
                <p className="text-indigo-200 mb-6">
                  Create your first workflow to enable compliance questionnaires
                </p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Workflow
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="text-indigo-200">Workflow Name</TableHead>
                      <TableHead className="text-indigo-200">Type</TableHead>
                      <TableHead className="text-indigo-200">Version</TableHead>
                      <TableHead className="text-indigo-200">Steps</TableHead>
                      <TableHead className="text-indigo-200">Status</TableHead>
                      <TableHead className="text-indigo-200">Last Modified</TableHead>
                      <TableHead className="text-right text-indigo-200">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflows.map((workflow) => (
                      <TableRow key={workflow.id} className="border-white/10 hover:bg-white/5">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                              <GitBranch className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-white">{workflow.workflow_name}</p>
                              {workflow.jurisdiction && (
                                <p className="text-xs text-indigo-300">{workflow.jurisdiction}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getWorkflowTypeBadge(workflow.workflow_type)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono text-sm">v{workflow.version || "1.0"}</span>
                            {workflow.parent_workflow_id && (
                              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                                Updated
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-white">{workflow.steps?.length || 0} steps</span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(workflow.status)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-indigo-200">
                            {workflow.updated_date 
                              ? new Date(workflow.updated_date).toLocaleDateString()
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewFlow(workflow)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Flow Diagram
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleTestWorkflow(workflow)}>
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Test Workflow
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewVersions(workflow)}>
                                <History className="w-4 h-4 mr-2" />
                                Version History
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(workflow)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Workflow
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCreateNewVersion(workflow)}>
                                <GitCompare className="w-4 h-4 mr-2" />
                                Create New Version
                              </DropdownMenuItem>
                              {workflow.status === "draft" && (
                                <DropdownMenuItem onClick={() => handlePublish(workflow)}>
                                  <Upload className="w-4 h-4 mr-2" />
                                  Publish
                                </DropdownMenuItem>
                              )}
                              {workflow.status === "published" && (
                                <DropdownMenuItem onClick={() => handleArchive(workflow)}>
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDelete(workflow.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
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
      </div>

      {/* Workflow Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedWorkflow ? "Edit Workflow" : "Create New Workflow"}
            </DialogTitle>
          </DialogHeader>
          <WorkflowForm
            workflow={selectedWorkflow}
            onSubmit={(data) => {
              if (selectedWorkflow) {
                updateMutation.mutate({ id: selectedWorkflow.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setSelectedWorkflow(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Visual Flow Diagram Dialog */}
      <Dialog open={showVisualizer} onOpenChange={setShowVisualizer}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Workflow Flow Diagram: {selectedWorkflow?.workflow_name}
            </DialogTitle>
          </DialogHeader>
          <WorkflowVisualizer workflow={selectedWorkflow} />
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Version History: {selectedWorkflowForVersions?.workflow_name}
            </DialogTitle>
          </DialogHeader>
          <WorkflowVersionHistory
            workflows={selectedWorkflowForVersions ? getWorkflowVersions(selectedWorkflowForVersions.workflow_name) : []}
            currentWorkflowId={selectedWorkflowForVersions?.id}
            onViewVersion={handleViewFlow}
            onRestoreVersion={handleRestoreVersion}
          />
        </DialogContent>
      </Dialog>

      {/* Test Runner Dialog */}
      <Dialog open={showTestRunner} onOpenChange={setShowTestRunner}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Test Workflow: {selectedWorkflow?.workflow_name}
            </DialogTitle>
          </DialogHeader>
          <WorkflowTestRunner
            workflow={selectedWorkflow}
            onClose={() => setShowTestRunner(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}