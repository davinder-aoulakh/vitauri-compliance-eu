import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plug,
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Settings,
  Clock,
  CheckCircle2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function IntegrationManager({ workflowId }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);

  const queryClient = useQueryClient();

  const { data: integrations = [] } = useQuery({
    queryKey: ['workflow-integrations'],
    queryFn: () => base44.entities.WorkflowIntegration.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkflowIntegration.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-integrations']);
      setShowForm(false);
      setSelectedIntegration(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkflowIntegration.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-integrations']);
      setShowForm(false);
      setSelectedIntegration(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkflowIntegration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-integrations']);
    }
  });

  const handleToggleActive = async (integration) => {
    updateMutation.mutate({
      id: integration.id,
      data: { ...integration, is_active: !integration.is_active }
    });
  };

  const handleEdit = (integration) => {
    setSelectedIntegration(integration);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this integration?")) {
      deleteMutation.mutate(id);
    }
  };

  const getTypeBadge = (type) => {
    const colors = {
      data_validation: "bg-blue-100 text-blue-700",
      data_enrichment: "bg-green-100 text-green-700",
      risk_scoring: "bg-amber-100 text-amber-700",
      document_generation: "bg-purple-100 text-purple-700",
      notification: "bg-pink-100 text-pink-700",
      external_api: "bg-indigo-100 text-indigo-700",
      webhook: "bg-slate-100 text-slate-700"
    };
    return colors[type] || colors.external_api;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Plug className="w-6 h-6 text-indigo-600" />
            External Integrations
          </h3>
          <p className="text-sm text-slate-600">Connect workflows to external APIs and services</p>
        </div>
        <Button
          onClick={() => {
            setSelectedIntegration(null);
            setShowForm(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Integration
        </Button>
      </div>

      {/* Integrations Grid */}
      {integrations.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Plug className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Integrations</h3>
            <p className="text-slate-600 mb-6">
              Connect external services to enhance your workflows
            </p>
            <Button onClick={() => setShowForm(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add First Integration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <Card key={integration.id} className="border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    integration.is_active ? "bg-green-100" : "bg-slate-100"
                  }`}>
                    <Plug className={`w-6 h-6 ${
                      integration.is_active ? "text-green-600" : "text-slate-400"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">
                        {integration.integration_name}
                      </h4>
                      {integration.is_active ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          <Power className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600">
                          <PowerOff className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <Badge className={getTypeBadge(integration.integration_type)}>
                      {integration.integration_type?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>

                {integration.description && (
                  <p className="text-sm text-slate-600 mb-3">
                    {integration.description}
                  </p>
                )}

                <div className="space-y-2 mb-4">
                  {integration.endpoint_url && (
                    <div className="text-xs">
                      <span className="text-slate-500">Endpoint:</span>
                      <code className="ml-2 bg-slate-100 px-2 py-1 rounded text-slate-700">
                        {integration.http_method} {integration.endpoint_url}
                      </code>
                    </div>
                  )}
                  {integration.trigger_point && (
                    <div className="text-xs">
                      <span className="text-slate-500">Trigger:</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {integration.trigger_point?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  )}
                  {integration.usage_count > 0 && (
                    <div className="text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      <span className="text-slate-500">Used {integration.usage_count} times</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(integration)}
                    className="flex-1"
                  >
                    {integration.is_active ? (
                      <>
                        <PowerOff className="w-3 h-3 mr-1" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Power className="w-3 h-3 mr-1" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(integration)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(integration.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Integration Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedIntegration ? "Edit Integration" : "Add Integration"}
            </DialogTitle>
          </DialogHeader>
          <IntegrationForm
            integration={selectedIntegration}
            onSubmit={(data) => {
              if (selectedIntegration) {
                updateMutation.mutate({ id: selectedIntegration.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setSelectedIntegration(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Integration Form Component
function IntegrationForm({ integration, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(integration || {
    integration_name: "",
    integration_type: "external_api",
    description: "",
    endpoint_url: "",
    http_method: "POST",
    authentication: { type: "none", config: {} },
    trigger_point: "step_end",
    is_active: true,
    retry_config: { max_retries: 3, retry_delay: 1000 },
    timeout: 30000
  });

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="integration_name">Integration Name *</Label>
          <Input
            id="integration_name"
            value={formData.integration_name}
            onChange={(e) => handleChange("integration_name", e.target.value)}
            placeholder="e.g., TIN Validation Service"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="integration_type">Type *</Label>
          <Select
            value={formData.integration_type}
            onValueChange={(value) => handleChange("integration_type", value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data_validation">Data Validation</SelectItem>
              <SelectItem value="data_enrichment">Data Enrichment</SelectItem>
              <SelectItem value="risk_scoring">Risk Scoring</SelectItem>
              <SelectItem value="document_generation">Document Generation</SelectItem>
              <SelectItem value="notification">Notification</SelectItem>
              <SelectItem value="external_api">External API</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          rows={2}
          className="mt-1.5"
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1">
          <Label htmlFor="http_method">Method</Label>
          <Select
            value={formData.http_method}
            onValueChange={(value) => handleChange("http_method", value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-3">
          <Label htmlFor="endpoint_url">Endpoint URL *</Label>
          <Input
            id="endpoint_url"
            value={formData.endpoint_url}
            onChange={(e) => handleChange("endpoint_url", e.target.value)}
            placeholder="https://api.example.com/validate"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="trigger_point">Trigger Point</Label>
        <Select
          value={formData.trigger_point}
          onValueChange={(value) => handleChange("trigger_point", value)}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="step_start">Step Start</SelectItem>
            <SelectItem value="step_end">Step End</SelectItem>
            <SelectItem value="workflow_start">Workflow Start</SelectItem>
            <SelectItem value="workflow_end">Workflow End</SelectItem>
            <SelectItem value="condition_met">Condition Met</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.integration_name || !formData.endpoint_url}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {integration ? "Update" : "Add"} Integration
        </Button>
      </div>
    </div>
  );
}