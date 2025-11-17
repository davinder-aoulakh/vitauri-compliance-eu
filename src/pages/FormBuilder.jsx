import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Plus,
  Settings,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  CheckCircle2,
  Clock,
  Info,
  FileCode
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FormConfigEditor from "../components/forms/FormConfigEditor";
import FormPreview from "../components/forms/FormPreview";

export default function FormBuilderPage() {
  const [user, setUser] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.user_role !== 'super_admin') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error("Error loading user:", error);
      window.location.href = '/';
    }
  };

  const { data: configurations = [], isLoading } = useQuery({
    queryKey: ['form-configurations'],
    queryFn: () => base44.entities.FormConfiguration.list(),
    enabled: !!user
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FormConfiguration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['form-configurations']);
    }
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FormConfiguration.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['form-configurations']);
    }
  });

  const handleCreateNew = (entityType) => {
    setSelectedConfig({
      form_name: `${entityType} Form`,
      entity_type: entityType,
      is_published: false,
      version: "1.0",
      fields_config: [],
      layout_config: {
        columns: 2,
        sections: [
          { section_name: "basic", section_label: "Basic Information", order: 1 }
        ]
      }
    });
    setShowEditor(true);
  };

  const handleEdit = (config) => {
    setSelectedConfig(config);
    setShowEditor(true);
  };

  const handlePreview = (config) => {
    setSelectedConfig(config);
    setShowPreview(true);
  };

  const handlePublish = async (config) => {
    if (confirm(`Publish this configuration? This will make it active for all tenants.`)) {
      await publishMutation.mutateAsync({
        id: config.id,
        data: {
          is_published: true,
          published_date: new Date().toISOString(),
          published_by: user?.email
        }
      });
    }
  };

  const handleUnpublish = async (config) => {
    if (confirm(`Unpublish this configuration? Tenants will revert to default forms.`)) {
      await publishMutation.mutateAsync({
        id: config.id,
        data: {
          is_published: false
        }
      });
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this form configuration?")) {
      deleteMutation.mutate(id);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-slate-50">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Form Builder</h1>
            <p className="text-slate-600">
              Configure and customize Entity and Account forms for all tenants
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create New Form
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleCreateNew('Account')}>
                <FileCode className="w-4 h-4 mr-2" />
                Account Form
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateNew('Entity')}>
                <FileCode className="w-4 h-4 mr-2" />
                Entity Form
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            <strong>Super Admin Only:</strong> Form configurations defined here will be applied to all tenants. 
            You can add custom fields, rename labels, adjust layouts, and control visibility. 
            Published configurations become active immediately.
          </AlertDescription>
        </Alert>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Total Configurations</p>
                  <p className="text-2xl font-bold text-slate-900">{configurations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Published</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {configurations.filter(c => c.is_published).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Draft</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {configurations.filter(c => !c.is_published).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configurations Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              Form Configurations ({configurations.length})
            </CardTitle>
            <CardDescription>
              Manage form structures for Account and Entity data collection
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : configurations.length === 0 ? (
              <div className="p-12 text-center">
                <Settings className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No form configurations yet</h3>
                <p className="text-slate-600 mb-6">
                  Create your first form configuration to customize data collection
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead>Form Name</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Fields</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Modified</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configurations.map((config) => (
                      <TableRow key={config.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <span className="font-semibold text-slate-900">{config.form_name}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{config.entity_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">v{config.version}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-semibold text-slate-900">
                            {config.fields_config?.length || 0} fields
                          </span>
                        </TableCell>
                        <TableCell>
                          {config.is_published ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Published
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-800 border-slate-200">
                              <Clock className="w-3 h-3 mr-1" />
                              Draft
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">
                            {new Date(config.updated_date).toLocaleDateString()}
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
                              <DropdownMenuItem onClick={() => handleEdit(config)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Configuration
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePreview(config)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Preview Form
                              </DropdownMenuItem>
                              {config.is_published ? (
                                <DropdownMenuItem onClick={() => handleUnpublish(config)}>
                                  <Clock className="w-4 h-4 mr-2" />
                                  Unpublish
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handlePublish(config)}>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Publish
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDelete(config.id)}
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

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedConfig?.id ? 'Edit' : 'Create'} Form Configuration
            </DialogTitle>
          </DialogHeader>
          <FormConfigEditor
            config={selectedConfig}
            onSave={() => {
              setShowEditor(false);
              queryClient.invalidateQueries(['form-configurations']);
            }}
            onCancel={() => setShowEditor(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Form Preview: {selectedConfig?.form_name}</DialogTitle>
          </DialogHeader>
          <FormPreview config={selectedConfig} />
        </DialogContent>
      </Dialog>
    </div>
  );
}