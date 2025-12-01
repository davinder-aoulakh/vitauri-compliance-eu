import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  Plus,
  Save,
  Eye,
  Trash2,
  Settings,
  GripVertical,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  List,
  CheckSquare,
  Zap,
  TrendingUp,
  FileText,
  Users,
  Wallet,
  ArrowLeft,
  Copy,
  Check
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import WidgetPreview from "@/components/dashboard/WidgetPreview";
import WidgetConfigDialog from "@/components/dashboard/WidgetConfigDialog";

const WIDGET_TYPES = [
  { type: "stats_card", label: "Stats Card", icon: TrendingUp, description: "Display a key metric with trend" },
  { type: "chart_bar", label: "Bar Chart", icon: BarChart3, description: "Bar chart visualization" },
  { type: "chart_pie", label: "Pie Chart", icon: PieChart, description: "Pie/donut chart breakdown" },
  { type: "chart_line", label: "Line Chart", icon: LineChart, description: "Trend line over time" },
  { type: "recent_activity", label: "Recent Activity", icon: Activity, description: "Latest audit log entries" },
  { type: "entity_list", label: "Entity List", icon: Users, description: "List of entities with status" },
  { type: "account_list", label: "Account List", icon: Wallet, description: "List of accounts" },
  { type: "compliance_summary", label: "Compliance Summary", icon: CheckSquare, description: "Overall compliance status" },
  { type: "reportability_breakdown", label: "Reportability", icon: FileText, description: "Account reportability breakdown" },
  { type: "pending_tasks", label: "Pending Tasks", icon: List, description: "Items requiring attention" },
  { type: "quick_actions", label: "Quick Actions", icon: Zap, description: "Shortcut buttons" },
];

export default function DashboardBuilder() {
  const [user, setUser] = useState(null);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [newDashboard, setNewDashboard] = useState({ dashboard_name: "", description: "" });
  const [previewMode, setPreviewMode] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const { data: dashboards = [], isLoading } = useQuery({
    queryKey: ['dashboard-configurations', user?.tenant_id],
    queryFn: () => base44.entities.DashboardConfiguration.filter({ tenant_id: user?.tenant_id }),
    enabled: !!user?.tenant_id
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DashboardConfiguration.create({
      ...data,
      tenant_id: user.tenant_id,
      layout: []
    }),
    onSuccess: (newDashboard) => {
      queryClient.invalidateQueries(['dashboard-configurations']);
      setShowCreateDialog(false);
      setSelectedDashboard(newDashboard);
      setNewDashboard({ dashboard_name: "", description: "" });
      toast.success("Dashboard created");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DashboardConfiguration.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard-configurations']);
      toast.success("Dashboard saved");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DashboardConfiguration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard-configurations']);
      setSelectedDashboard(null);
      toast.success("Dashboard deleted");
    }
  });

  const handleAddWidget = (widgetType) => {
    const widgetDef = WIDGET_TYPES.find(w => w.type === widgetType);
    const newWidget = {
      widget_id: `widget_${Date.now()}`,
      widget_type: widgetType,
      title: widgetDef?.label || "New Widget",
      position: { x: 0, y: (selectedDashboard.layout?.length || 0) * 2, w: 6, h: 2 },
      config: {}
    };
    
    const updatedLayout = [...(selectedDashboard.layout || []), newWidget];
    setSelectedDashboard({ ...selectedDashboard, layout: updatedLayout });
    setShowWidgetPicker(false);
    
    // Open config dialog for the new widget
    setEditingWidget(newWidget);
    setShowWidgetConfig(true);
  };

  const handleUpdateWidget = (updatedWidget) => {
    const updatedLayout = selectedDashboard.layout.map(w =>
      w.widget_id === updatedWidget.widget_id ? updatedWidget : w
    );
    setSelectedDashboard({ ...selectedDashboard, layout: updatedLayout });
    setShowWidgetConfig(false);
    setEditingWidget(null);
  };

  const handleRemoveWidget = (widgetId) => {
    const updatedLayout = selectedDashboard.layout.filter(w => w.widget_id !== widgetId);
    setSelectedDashboard({ ...selectedDashboard, layout: updatedLayout });
  };

  const handleMoveWidget = (widgetId, direction) => {
    const layout = [...selectedDashboard.layout];
    const index = layout.findIndex(w => w.widget_id === widgetId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [layout[index], layout[index - 1]] = [layout[index - 1], layout[index]];
    } else if (direction === 'down' && index < layout.length - 1) {
      [layout[index], layout[index + 1]] = [layout[index + 1], layout[index]];
    }

    setSelectedDashboard({ ...selectedDashboard, layout });
  };

  const handleSaveDashboard = () => {
    updateMutation.mutate({
      id: selectedDashboard.id,
      data: {
        dashboard_name: selectedDashboard.dashboard_name,
        description: selectedDashboard.description,
        layout: selectedDashboard.layout,
        theme: selectedDashboard.theme
      }
    });
  };

  const handlePublishDashboard = async () => {
    // If setting as default, unset other defaults first
    if (!selectedDashboard.is_default) {
      const otherDefaults = dashboards.filter(d => d.is_default && d.id !== selectedDashboard.id);
      for (const d of otherDefaults) {
        await base44.entities.DashboardConfiguration.update(d.id, { is_default: false });
      }
    }

    updateMutation.mutate({
      id: selectedDashboard.id,
      data: {
        is_published: true,
        is_default: true,
        published_date: new Date().toISOString(),
        published_by: user.email
      }
    });
  };

  const handleDuplicateDashboard = () => {
    createMutation.mutate({
      dashboard_name: `${selectedDashboard.dashboard_name} (Copy)`,
      description: selectedDashboard.description,
      layout: selectedDashboard.layout,
      theme: selectedDashboard.theme
    });
  };

  if (!user || (user.user_role !== "tenant_admin" && user.user_role !== "super_admin")) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-600">You don't have permission to access this page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Dashboard list view
  if (!selectedDashboard) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <LayoutDashboard className="w-8 h-8 text-indigo-600" />
              Dashboard Builder
            </h1>
            <p className="text-slate-600 mt-1">Create and customize dashboards for your team</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            New Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((dashboard) => (
            <Card
              key={dashboard.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-indigo-200"
              onClick={() => setSelectedDashboard(dashboard)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{dashboard.dashboard_name}</CardTitle>
                  <div className="flex gap-1">
                    {dashboard.is_published && (
                      <Badge className="bg-green-100 text-green-800">Published</Badge>
                    )}
                    {dashboard.is_default && (
                      <Badge className="bg-indigo-100 text-indigo-800">Default</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-3">
                  {dashboard.description || "No description"}
                </p>
                <p className="text-xs text-slate-500">
                  {dashboard.layout?.length || 0} widgets
                </p>
              </CardContent>
            </Card>
          ))}

          {dashboards.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="p-12 text-center">
                <LayoutDashboard className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No dashboards yet</h3>
                <p className="text-slate-600 mb-4">Create your first custom dashboard</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Dashboard
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Create Dashboard Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Dashboard</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Dashboard Name *</Label>
                <Input
                  value={newDashboard.dashboard_name}
                  onChange={(e) => setNewDashboard({ ...newDashboard, dashboard_name: e.target.value })}
                  placeholder="e.g., Executive Overview"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newDashboard.description}
                  onChange={(e) => setNewDashboard({ ...newDashboard, description: e.target.value })}
                  placeholder="What is this dashboard for?"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(newDashboard)}
                disabled={!newDashboard.dashboard_name}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Dashboard editor view
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedDashboard(null)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <Input
                  value={selectedDashboard.dashboard_name}
                  onChange={(e) => setSelectedDashboard({ ...selectedDashboard, dashboard_name: e.target.value })}
                  className="text-xl font-bold border-none p-0 h-auto focus-visible:ring-0"
                />
                <div className="flex items-center gap-2 mt-1">
                  {selectedDashboard.is_published && <Badge className="bg-green-100 text-green-800">Published</Badge>}
                  {selectedDashboard.is_default && <Badge className="bg-indigo-100 text-indigo-800">Default</Badge>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewMode(!previewMode)}>
                <Eye className="w-4 h-4 mr-2" />
                {previewMode ? "Edit" : "Preview"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDuplicateDashboard}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </Button>
              <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(selectedDashboard.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button variant="outline" size="sm" onClick={handleSaveDashboard}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button size="sm" onClick={handlePublishDashboard} className="bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-2" />
                Publish
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {previewMode ? (
          // Preview mode - render actual widgets
          <div className="grid grid-cols-12 gap-4">
            {selectedDashboard.layout?.map((widget) => (
              <div
                key={widget.widget_id}
                className={`col-span-${widget.position?.w || 6}`}
                style={{ gridColumn: `span ${widget.position?.w || 6}` }}
              >
                <WidgetPreview widget={widget} tenantId={user.tenant_id} />
              </div>
            ))}
          </div>
        ) : (
          // Edit mode
          <div className="grid grid-cols-12 gap-6">
            {/* Widget palette */}
            <div className="col-span-3">
              <Card className="sticky top-24">
                <CardHeader className="border-b">
                  <CardTitle className="text-sm">Add Widgets</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                  {WIDGET_TYPES.map((widget) => (
                    <button
                      key={widget.type}
                      onClick={() => handleAddWidget(widget.type)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left"
                    >
                      <widget.icon className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-sm font-medium">{widget.label}</p>
                        <p className="text-xs text-slate-500">{widget.description}</p>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Canvas */}
            <div className="col-span-9 space-y-3">
              {selectedDashboard.layout?.length === 0 && (
                <Card className="border-dashed border-2">
                  <CardContent className="p-12 text-center">
                    <Plus className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Add your first widget</h3>
                    <p className="text-slate-600">Select a widget from the palette on the left</p>
                  </CardContent>
                </Card>
              )}

              {selectedDashboard.layout?.map((widget, index) => (
                <Card key={widget.widget_id} className="relative group">
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveWidget(widget.widget_id, 'up')}
                        disabled={index === 0}
                      >
                        ▲
                      </Button>
                      <GripVertical className="w-4 h-4 text-slate-400 mx-auto" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveWidget(widget.widget_id, 'down')}
                        disabled={index === selectedDashboard.layout.length - 1}
                      >
                        ▼
                      </Button>
                    </div>
                  </div>
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <div className="flex items-center gap-3 pl-8">
                      {(() => {
                        const WidgetIcon = WIDGET_TYPES.find(w => w.type === widget.widget_type)?.icon || LayoutDashboard;
                        return <WidgetIcon className="w-5 h-5 text-indigo-600" />;
                      })()}
                      <div>
                        <CardTitle className="text-base">{widget.title}</CardTitle>
                        <p className="text-xs text-slate-500 capitalize">{widget.widget_type.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(widget.position?.w || 6)}
                        onValueChange={(value) => {
                          const updatedWidget = {
                            ...widget,
                            position: { ...widget.position, w: parseInt(value) }
                          };
                          handleUpdateWidget(updatedWidget);
                        }}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">4 cols</SelectItem>
                          <SelectItem value="6">6 cols</SelectItem>
                          <SelectItem value="8">8 cols</SelectItem>
                          <SelectItem value="12">Full</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingWidget(widget);
                          setShowWidgetConfig(true);
                        }}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveWidget(widget.widget_id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4 pl-12">
                    <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-500 border-2 border-dashed">
                      Widget Preview Area
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Widget Config Dialog */}
      <WidgetConfigDialog
        open={showWidgetConfig}
        onOpenChange={setShowWidgetConfig}
        widget={editingWidget}
        onSave={handleUpdateWidget}
      />
    </div>
  );
}