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
  GitCompare,
  Package, // New import
  Globe, // New import
  Calculator, // New import
  Plug, // New import
  BarChart3, // New import
  Wand2, // New import
  Copy
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
import WorkflowDragDropBuilder from "../components/workflows/WorkflowDragDropBuilder"; // New import
import ComponentLibrary from "../components/workflows/ComponentLibrary"; // New import
import WorkflowAnalyticsDashboard from "../components/workflows/WorkflowAnalyticsDashboard"; // New import
import JurisdictionOverrides from "../components/workflows/JurisdictionOverrides"; // New import
import FormulaBuilder from "../components/workflows/FormulaBuilder"; // New import
import IntegrationManager from "../components/workflows/IntegrationManager"; // New import
import WorkflowTriggerConfig from "../components/workflows/WorkflowTriggerConfig";
import { Zap } from "lucide-react";

export default function WorkflowBuilder() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showTestRunner, setShowTestRunner] = useState(false);
  const [showDragDropBuilder, setShowDragDropBuilder] = useState(false); // New state
  // const [showComponentLibrary, setShowComponentLibrary] = useState(false); // Not used for dialogs, rendered in Tabs
  const [showAnalytics, setShowAnalytics] = useState(false); // New state
  const [showJurisdictionOverrides, setShowJurisdictionOverrides] = useState(false); // New state
  const [showFormulaBuilder, setShowFormulaBuilder] = useState(false); // New state
  // const [showIntegrationManager, setShowIntegrationManager] = useState(false); // Not used for dialogs, rendered in Tabs
  const [selectedWorkflowForVersions, setSelectedWorkflowForVersions] = useState(null);
  const [activeTab, setActiveTab] = useState("workflows"); // New state
  const [showTriggerConfig, setShowTriggerConfig] = useState(false);

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
      setShowDragDropBuilder(false); // New: Close builder on success
      setSelectedWorkflow(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Workflow.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflows']);
      setShowForm(false);
      setShowDragDropBuilder(false); // New: Close builder on success
      setShowJurisdictionOverrides(false); // New: Close jurisdiction overrides on success
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

  const handleVisualEdit = async (workflow) => { // New handler - refetch to get latest data
    try {
      // Refetch the workflow to ensure we have the latest data including outcome_rules
      const freshWorkflows = await base44.entities.Workflow.filter({ id: workflow.id });
      const freshWorkflow = freshWorkflows[0] || workflow;
      console.log("Fresh workflow data for visual editor:", freshWorkflow);
      console.log("Fresh workflow steps conditions:", JSON.stringify(freshWorkflow.steps?.map(s => s.conditional_logic?.conditions), null, 2));
      setSelectedWorkflow(freshWorkflow);
      setShowDragDropBuilder(true);
    } catch (error) {
      console.error("Error fetching workflow:", error);
      setSelectedWorkflow(workflow);
      setShowDragDropBuilder(true);
    }
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

  const handleViewAnalytics = (workflow) => { // New handler
    setSelectedWorkflow(workflow);
    setShowAnalytics(true);
  };

  const handleManageJurisdictions = (workflow) => { // New handler
    setSelectedWorkflow(workflow);
    setShowJurisdictionOverrides(true);
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

  const handleDuplicateWorkflow = async (baseWorkflow) => {
    const newWorkflow = {
      ...baseWorkflow,
      workflow_name: `${baseWorkflow.workflow_name} (Copy)`,
      version: "1.0",
      parent_workflow_id: null,
      status: "draft",
      published_date: null,
      change_log: [
        {
          version: "1.0",
          changed_by: user.email,
          changed_date: new Date().toISOString(),
          changes_description: `Duplicated from "${baseWorkflow.workflow_name}" v${baseWorkflow.version}`
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
              Advanced workflow management with drag-drop builder, analytics & integrations
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedWorkflow(null);
              setShowDragDropBuilder(true); // Changed to open drag-drop builder
            }}
            className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
          >
            <Wand2 className="w-4 h-4" /> {/* New icon */}
            Build Workflow
          </Button>
        </div>

        {/* Phase 2 & 3 Features Alert */}
        <Alert className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/50 backdrop-blur-sm">
          <Wand2 className="w-4 h-4 text-purple-300" /> {/* New icon */}
          <AlertDescription className="text-purple-100">
            <strong>New Advanced Features:</strong> Drag-drop builder • Component library • Analytics dashboard • 
            Jurisdiction overrides • Formula builder • External integrations
          </AlertDescription>
        </Alert>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/10 backdrop-blur-sm">
            <TabsTrigger value="workflows" className="text-white data-[state=active]:bg-white/20">
              <GitBranch className="w-4 h-4 mr-2" />
              Workflows
            </TabsTrigger>
            <TabsTrigger value="components" className="text-white data-[state=active]:bg-white/20">
              <Package className="w-4 h-4 mr-2" />
              Components
            </TabsTrigger>
            <TabsTrigger value="integrations" className="text-white data-[state=active]:bg-white/20">
              <Plug className="w-4 h-4 mr-2" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-white data-[state=active]:bg-white/20">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflows" className="space-y-6">
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
                <CardTitle className="text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Workflows ({workflows.length})
                </CardTitle>
                {/* CardDescription removed based on outline */}
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                  </div>
                ) : workflows.length === 0 ? (
                  <div className="p-12 text-center">
                    <GitBranch className="w-16 h-16 mx-auto mb-4 text-indigo-300" />
                    <h3 className="text-lg font-semibold text-white mb-2">No workflows</h3>
                    <Button onClick={() => setShowDragDropBuilder(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                      <Wand2 className="w-4 h-4 mr-2" /> {/* New icon */}
                      Build First Workflow
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-white/5">
                          <TableHead className="text-indigo-200">Name</TableHead>
                          <TableHead className="text-indigo-200">Type</TableHead>
                          <TableHead className="text-indigo-200">Version</TableHead>
                          <TableHead className="text-indigo-200">Steps</TableHead>
                          <TableHead className="text-indigo-200">Status</TableHead>
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
                            <TableCell>{getWorkflowTypeBadge(workflow.workflow_type)}</TableCell>
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
                            <TableCell>{getStatusBadge(workflow.status)}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleVisualEdit(workflow)}> {/* New item */}
                                    <Wand2 className="w-4 h-4 mr-2" />
                                    Visual Editor
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewFlow(workflow)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Diagram
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleTestWorkflow(workflow)}>
                                    <PlayCircle className="w-4 h-4 mr-2" />
                                    Test Workflow
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewAnalytics(workflow)}> {/* New item */}
                                    <BarChart3 className="w-4 h-4 mr-2" />
                                    View Analytics
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewVersions(workflow)}>
                                    <History className="w-4 h-4 mr-2" />
                                    Version History
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleManageJurisdictions(workflow)}> {/* New item */}
                                    <Globe className="w-4 h-4 mr-2" />
                                    Jurisdictions
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedWorkflow(workflow);
                                    setShowTriggerConfig(true);
                                  }}>
                                    <Zap className="w-4 h-4 mr-2" />
                                    Auto-Trigger Config
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEdit(workflow)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Details {/* Renamed */}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCreateNewVersion(workflow)}>
                                    <GitCompare className="w-4 h-4 mr-2" />
                                    New Version
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDuplicateWorkflow(workflow)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Duplicate Workflow
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
          </TabsContent>

          <TabsContent value="components">
            <ComponentLibrary />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationManager />
          </TabsContent>

          <TabsContent value="analytics">
            <WorkflowAnalyticsDashboard />
          </TabsContent>
        </Tabs>
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

      {/* Visual Workflow Drag-Drop Builder Dialog (New) */}
      <Dialog open={showDragDropBuilder} onOpenChange={setShowDragDropBuilder}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visual Workflow Builder</DialogTitle>
          </DialogHeader>
          <WorkflowDragDropBuilder
            workflow={selectedWorkflow}
            onSave={(data) => {
              if (selectedWorkflow) {
                updateMutation.mutate({ id: selectedWorkflow.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowDragDropBuilder(false);
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
              Flow Diagram: {selectedWorkflow?.workflow_name}
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

      {/* Analytics Dashboard Dialog (New) */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analytics: {selectedWorkflow?.workflow_name}</DialogTitle>
          </DialogHeader>
          <WorkflowAnalyticsDashboard workflowId={selectedWorkflow?.id} />
        </DialogContent>
      </Dialog>

      {/* Jurisdiction Overrides Dialog (New) */}
      <Dialog open={showJurisdictionOverrides} onOpenChange={setShowJurisdictionOverrides}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Jurisdiction Overrides: {selectedWorkflow?.workflow_name}</DialogTitle>
          </DialogHeader>
          <JurisdictionOverrides
            workflow={selectedWorkflow}
            onSave={(data) => {
              updateMutation.mutate({ id: selectedWorkflow.id, data });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Formula Builder Dialog (New) */}
      <Dialog open={showFormulaBuilder} onOpenChange={setShowFormulaBuilder}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Formula Builder</DialogTitle>
          </DialogHeader>
          <FormulaBuilder onSave={(formula) => {
            console.log("Formula saved:", formula);
            setShowFormulaBuilder(false);
          }} />
        </DialogContent>
      </Dialog>

      {/* Workflow Auto-Trigger Configuration Dialog */}
      <Dialog open={showTriggerConfig} onOpenChange={setShowTriggerConfig}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auto-Trigger Configuration: {selectedWorkflow?.workflow_name}</DialogTitle>
          </DialogHeader>
          <WorkflowTriggerConfig
            triggerConditions={selectedWorkflow?.trigger_conditions}
            onUpdate={async (triggerConfig) => {
              if (selectedWorkflow) {
                await base44.entities.Workflow.update(selectedWorkflow.id, {
                  trigger_conditions: triggerConfig
                });
                queryClient.invalidateQueries(['workflows']);
                setShowTriggerConfig(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}