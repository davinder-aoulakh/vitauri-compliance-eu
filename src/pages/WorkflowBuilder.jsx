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
  MoreVertical
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
import WorkflowForm from "../components/superadmin/WorkflowForm";

export default function WorkflowBuilder() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

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

  const handlePublish = async (workflow) => {
    if (confirm("Publishing will make this workflow available to all tenants. Continue?")) {
      updateMutation.mutate({
        id: workflow.id,
        data: {
          ...workflow,
          status: "published",
          published_date: new Date().toISOString().split('T')[0]
        }
      });
    }
  };

  const handleArchive = async (workflow) => {
    if (confirm("Archive this workflow? It will no longer be available to tenants.")) {
      updateMutation.mutate({
        id: workflow.id,
        data: { ...workflow, status: "archived" }
      });
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this workflow permanently?")) {
      deleteMutation.mutate(id);
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
              Configure compliance questionnaires for entity and account classification
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

        {/* Info Alert */}
        <Alert className="bg-blue-900/30 border-blue-500/50 backdrop-blur-sm">
          <GitBranch className="w-4 h-4 text-blue-300" />
          <AlertDescription className="text-blue-100">
            Workflows define the questionnaires used by tenants to classify entities and accounts for CRS compliance. 
            Published workflows are immediately available to all tenants.
          </AlertDescription>
        </Alert>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-green-400" />
              <h3 className="text-2xl font-bold text-white mb-1">
                {workflows.filter(w => w.status === "published").length}
              </h3>
              <p className="text-sm text-indigo-200">Published Workflows</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-3 text-yellow-400" />
              <h3 className="text-2xl font-bold text-white mb-1">
                {workflows.filter(w => w.status === "draft").length}
              </h3>
              <p className="text-sm text-indigo-200">Draft Workflows</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <CardContent className="p-6 text-center">
              <Archive className="w-8 h-8 mx-auto mb-3 text-slate-400" />
              <h3 className="text-2xl font-bold text-white mb-1">
                {workflows.filter(w => w.status === "archived").length}
              </h3>
              <p className="text-sm text-indigo-200">Archived Workflows</p>
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
                  Manage compliance questionnaires and classification logic
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
                  Create your first workflow to enable compliance questionnaires for tenants
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
                      <TableHead className="text-indigo-200">Published</TableHead>
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
                          <span className="text-white font-mono text-sm">v{workflow.version || "1.0"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-white">{workflow.steps?.length || 0} steps</span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(workflow.status)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-indigo-200">
                            {workflow.published_date || "—"}
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
                              <DropdownMenuItem onClick={() => handleEdit(workflow)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Workflow
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
    </div>
  );
}