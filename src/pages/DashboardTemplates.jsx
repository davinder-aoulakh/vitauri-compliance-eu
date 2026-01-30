import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  Plus, 
  Edit, 
  Trash2, 
  Send, 
  Eye,
  CheckCircle2,
  Clock,
  Users
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DashboardTemplates() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deployConfig, setDeployConfig] = useState({
    set_as_default: false,
    deploy_to_all: true,
    selected_tenant_ids: []
  });

  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['dashboardTemplates'],
    queryFn: () => base44.entities.DashboardTemplate.list('-created_date')
  });

  // Fetch tenants for deployment
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list()
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DashboardTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboardTemplates']);
      toast.success('Template deleted successfully');
    }
  });

  // Publish/unpublish template mutation
  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }) => 
      base44.entities.DashboardTemplate.update(id, { is_published: isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboardTemplates']);
      toast.success('Template status updated');
    }
  });

  // Deploy template mutation
  const deployMutation = useMutation({
    mutationFn: async ({ template_id, tenant_ids, set_as_default }) => {
      const response = await base44.functions.invoke('deployDashboardTemplate', {
        template_id,
        tenant_ids: deployConfig.deploy_to_all ? null : tenant_ids,
        set_as_default
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['dashboardTemplates']);
      setShowDeployDialog(false);
      setSelectedTemplate(null);
      toast.success(
        `Deployed to ${data.results.success.length} tenant(s)${
          data.results.errors.length > 0 ? ` (${data.results.errors.length} failed)` : ''
        }`
      );
    }
  });

  const handleDeploy = () => {
    deployMutation.mutate({
      template_id: selectedTemplate.id,
      tenant_ids: deployConfig.selected_tenant_ids,
      set_as_default: deployConfig.set_as_default
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Templates</h1>
          <p className="text-slate-600 mt-1">
            Create and manage global dashboard templates for all tenants
          </p>
        </div>
        <Button onClick={() => window.location.href = createPageUrl("DashboardBuilder") + "?template=true"}>
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertDescription className="text-sm text-blue-900">
          <strong>How it works:</strong> Create dashboard templates using the Dashboard Builder, 
          then deploy them to all tenants. Each tenant will receive their own copy that they can customize.
        </AlertDescription>
      </Alert>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LayoutDashboard className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500 text-center">
              No templates created yet. Create one using the Dashboard Builder.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.template_name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {template.description || 'No description'}
                    </CardDescription>
                  </div>
                  {template.is_default_template && (
                    <Badge className="ml-2 bg-purple-100 text-purple-800">
                      Default
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant={template.is_published ? "default" : "secondary"}>
                    {template.is_published ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Published
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 mr-1" />
                        Draft
                      </>
                    )}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {template.layout?.length || 0} widgets
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {template.deployment_stats?.deployed_to_tenant_count > 0 && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                    <Users className="w-4 h-4" />
                    <span>
                      Deployed to {template.deployment_stats.deployed_to_tenant_count} tenant(s)
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      publishMutation.mutate({
                        id: template.id,
                        isPublished: !template.is_published
                      });
                    }}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    {template.is_published ? 'Unpublish' : 'Publish'}
                  </Button>
                  
                  {template.is_published && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowDeployDialog(true);
                      }}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Deploy
                    </Button>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = `${createPageUrl("DashboardBuilder")}?template=${template.id}`}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this template?')) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Deploy Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deploy Template to Tenants</DialogTitle>
            <DialogDescription>
              Choose which tenants should receive this dashboard template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="set_as_default"
                checked={deployConfig.set_as_default}
                onCheckedChange={(checked) =>
                  setDeployConfig({ ...deployConfig, set_as_default: checked })
                }
              />
              <Label htmlFor="set_as_default" className="cursor-pointer">
                Set as default dashboard for tenants
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="deploy_to_all"
                checked={deployConfig.deploy_to_all}
                onCheckedChange={(checked) =>
                  setDeployConfig({ ...deployConfig, deploy_to_all: checked })
                }
              />
              <Label htmlFor="deploy_to_all" className="cursor-pointer">
                Deploy to all tenants
              </Label>
            </div>

            {!deployConfig.deploy_to_all && (
              <div>
                <Label>Select Tenants</Label>
                <div className="mt-2 border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                  {tenants.map((tenant) => (
                    <div key={tenant.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tenant-${tenant.id}`}
                        checked={deployConfig.selected_tenant_ids.includes(tenant.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setDeployConfig({
                              ...deployConfig,
                              selected_tenant_ids: [...deployConfig.selected_tenant_ids, tenant.id]
                            });
                          } else {
                            setDeployConfig({
                              ...deployConfig,
                              selected_tenant_ids: deployConfig.selected_tenant_ids.filter(
                                (id) => id !== tenant.id
                              )
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`tenant-${tenant.id}`} className="cursor-pointer">
                        {tenant.name} ({tenant.jurisdiction})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeployDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={deployMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {deployMutation.isPending ? 'Deploying...' : 'Deploy Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}