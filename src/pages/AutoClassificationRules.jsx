import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  Sparkles,
  AlertCircle,
  Check,
  X
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AutoClassificationRulesPage() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    rule_name: "",
    description: "",
    entity_type: "Account",
    conditions: [{ field: "", operator: "equals", value: "", logic_operator: "AND" }],
    classification_result: "reportable",
    classification_reason: "",
    entity_classification_result: "",
    priority: 0,
    is_active: true
  });

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

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['auto-classification-rules'],
    queryFn: () => base44.entities.AutoClassificationRule.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AutoClassificationRule.create({
      ...data,
      created_by: user.email,
      last_modified_by: user.email
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['auto-classification-rules']);
      setShowForm(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AutoClassificationRule.update(id, {
      ...data,
      last_modified_by: user.email
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['auto-classification-rules']);
      setShowForm(false);
      setEditingRule(null);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AutoClassificationRule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['auto-classification-rules']);
    }
  });

  const resetForm = () => {
    setFormData({
      rule_name: "",
      description: "",
      entity_type: "Account",
      conditions: [{ field: "", operator: "equals", value: "", logic_operator: "AND" }],
      classification_result: "reportable",
      classification_reason: "",
      entity_classification_result: "",
      priority: 0,
      is_active: true
    });
    setEditingRule(null);
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      description: rule.description || "",
      entity_type: rule.entity_type,
      conditions: rule.conditions || [{ field: "", operator: "equals", value: "", logic_operator: "AND" }],
      classification_result: rule.classification_result,
      classification_reason: rule.classification_reason,
      entity_classification_result: rule.entity_classification_result || "",
      priority: rule.priority || 0,
      is_active: rule.is_active !== false
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Filter out empty conditions
    const validConditions = formData.conditions.filter(c => c.field && c.value);
    
    if (validConditions.length === 0) {
      alert("Please add at least one valid condition");
      return;
    }

    const submitData = {
      ...formData,
      conditions: validConditions
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { field: "", operator: "equals", value: "", logic_operator: "AND" }]
    });
  };

  const removeCondition = (index) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index)
    });
  };

  const updateCondition = (index, field, value) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setFormData({ ...formData, conditions: newConditions });
  };

  const accountFields = [
    { value: "account_holder_type", label: "Account Holder Type", type: "select", options: ["individual", "entity"] },
    { value: "account_type", label: "Account Type", type: "select", options: ["depository", "custodial", "equity_debt_interest", "cash_value_insurance", "annuity"] },
    { value: "account_holder_is_alive", label: "Account Holder Alive", type: "select", options: ["true", "false"] },
    { value: "account_holder_deceased_during_period", label: "Deceased During Period", type: "select", options: ["true", "false"] },
    { value: "is_pre_existing", label: "Pre-existing Account", type: "select", options: ["true", "false"] },
    { value: "account_closed_during_period", label: "Account Closed", type: "select", options: ["true", "false"] },
    { value: "death_certificate_requested", label: "Death Certificate Requested", type: "select", options: ["true", "false"] },
    { value: "death_certificate_received", label: "Death Certificate Received", type: "select", options: ["true", "false"] },
    { value: "will_or_inheritance_requested", label: "Will/Inheritance Requested", type: "select", options: ["true", "false"] },
    { value: "will_or_inheritance_received", label: "Will/Inheritance Received", type: "select", options: ["true", "false"] },
    { value: "legacy_of_deceased_settled", label: "Legacy Settled", type: "select", options: ["true", "false"] },
    { value: "entity_managed_by_fiduciary_trust", label: "Managed by Fiduciary Trust", type: "select", options: ["true", "false"] },
    { value: "entity_managed_by_asset_manager", label: "Managed by Asset Manager", type: "select", options: ["true", "false"] },
    { value: "gross_income_from_financial_assets", label: "Gross Income from Financial Assets", type: "select", options: ["true", "false"] },
    { value: "year_end_cash_value", label: "Year-end Cash Value", type: "number" },
    { value: "gross_payments", label: "Gross Payments", type: "number" },
    { value: "country_of_residence", label: "Country of Residence", type: "text" },
    { value: "place_of_birth", label: "Place of Birth", type: "text" },
    { value: "entity_classification", label: "Entity Classification", type: "select", options: ["financial_institution", "active_nfe", "passive_nfe", "not_applicable"] },
    { value: "reportability_status", label: "Reportability Status", type: "select", options: ["pending_review", "reportable", "non_reportable", "excluded"] },
    { value: "us_person_indic", label: "US Person Indicator", type: "select", options: ["true", "false"] },
    { value: "self_certification_obtained", label: "Self Certification Obtained", type: "select", options: ["true", "false"] },
    { value: "status", label: "Account Status", type: "select", options: ["active", "closed", "dormant"] },
  ];

  const operators = [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not Equals" },
    { value: "greater_than", label: "Greater Than" },
    { value: "less_than", label: "Less Than" },
    { value: "greater_than_or_equal", label: "Greater Than or Equal" },
    { value: "less_than_or_equal", label: "Less Than or Equal" },
    { value: "contains", label: "Contains" },
    { value: "in", label: "In (comma-separated)" },
    { value: "not_in", label: "Not In (comma-separated)" }
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Auto Classification Rules</h1>
            <p className="text-slate-600">
              Configure automatic account classification based on field conditions
            </p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </Button>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>How it works:</strong> When accounts are created or updated, these rules are evaluated in priority order (highest first). 
            The first matching rule automatically sets the account's reportability status and reason.
          </AlertDescription>
        </Alert>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Classification Rules ({rules.length})
            </CardTitle>
            <CardDescription>
              {rules.filter(r => r.is_active).length} active, {rules.filter(r => !r.is_active).length} inactive
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : rules.length === 0 ? (
              <div className="p-12 text-center">
                <Sparkles className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No rules configured</h3>
                <p className="text-slate-600 mb-6">
                  Create your first auto-classification rule to get started
                </p>
                <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Rule
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.sort((a, b) => (b.priority || 0) - (a.priority || 0)).map((rule) => (
                      <TableRow key={rule.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div>
                            <p className="font-semibold text-slate-900">{rule.rule_name}</p>
                            {rule.description && (
                              <p className="text-xs text-slate-500">{rule.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            {rule.conditions?.slice(0, 2).map((condition, idx) => (
                              <div key={idx} className="text-slate-600">
                                <span className="font-medium">{condition.field}</span> {condition.operator} "{condition.value}"
                                {idx < rule.conditions.length - 1 && (
                                  <span className="text-slate-400 ml-1">{condition.logic_operator}</span>
                                )}
                              </div>
                            ))}
                            {rule.conditions?.length > 2 && (
                              <p className="text-xs text-slate-400">+{rule.conditions.length - 2} more</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              rule.classification_result === "reportable"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-slate-100 text-slate-800 border-slate-200"
                            }
                          >
                            {rule.classification_result}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {rule.priority || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rule.is_active ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <Check className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                              <X className="w-3 h-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(rule.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Add New Rule"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Rule Name *</Label>
                <Input
                  value={formData.rule_name}
                  onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                  placeholder="e.g., High Value Accounts"
                  required
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What does this rule do?"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority *</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    placeholder="0"
                  />
                  <p className="text-xs text-slate-500 mt-1">Higher numbers = higher priority</p>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>

              <div>
                <Label className="flex items-center justify-between mb-2">
                  <span>Conditions *</span>
                  <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add Condition
                  </Button>
                </Label>
                <div className="space-y-3 border rounded-lg p-4 bg-slate-50">
                  {formData.conditions.map((condition, index) => (
                    <div key={index} className="space-y-2 p-3 bg-white rounded-lg border">
                      <div className="grid grid-cols-3 gap-2">
                        <Select
                          value={condition.field}
                          onValueChange={(value) => {
                            updateCondition(index, "field", value);
                            // Clear value when field changes
                            updateCondition(index, "value", "");
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {accountFields.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={condition.operator}
                          onValueChange={(value) => updateCondition(index, "operator", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {(() => {
                          const selectedField = accountFields.find(f => f.value === condition.field);
                          if (selectedField?.type === "select" && selectedField?.options) {
                            return (
                              <Select
                                value={condition.value}
                                onValueChange={(value) => updateCondition(index, "value", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select value" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedField.options.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          }
                          return (
                            <Input
                              type={selectedField?.type === "number" ? "number" : "text"}
                              value={condition.value}
                              onChange={(e) => updateCondition(index, "value", e.target.value)}
                              placeholder="Value"
                            />
                          );
                        })()}
                      </div>

                      <div className="flex items-center justify-between">
                        {index < formData.conditions.length - 1 && (
                          <Select
                            value={condition.logic_operator}
                            onValueChange={(value) => updateCondition(index, "logic_operator", value)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AND">AND</SelectItem>
                              <SelectItem value="OR">OR</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {formData.conditions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCondition(index)}
                            className="text-red-600 ml-auto"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Classification Result *</Label>
                    <Select
                      value={formData.classification_result}
                      onValueChange={(value) => setFormData({ ...formData, classification_result: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reportable">Reportable</SelectItem>
                        <SelectItem value="non_reportable">Non-Reportable</SelectItem>
                        <SelectItem value="pending_review">Pending Review</SelectItem>
                        <SelectItem value="excluded">Excluded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Classification Reason *</Label>
                    <Input
                      value={formData.classification_reason}
                      onChange={(e) => setFormData({ ...formData, classification_reason: e.target.value })}
                      placeholder="e.g., High value threshold exceeded"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Entity Classification Result (Optional)</Label>
                  <Select
                    value={formData.entity_classification_result}
                    onValueChange={(value) => setFormData({ ...formData, entity_classification_result: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select entity classification (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      <SelectItem value="financial_institution">Financial Institution</SelectItem>
                      <SelectItem value="active_nfe">Active NFE</SelectItem>
                      <SelectItem value="passive_nfe">Passive NFE</SelectItem>
                      <SelectItem value="not_applicable">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    For entity accounts, optionally set the entity classification
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                {editingRule ? "Update Rule" : "Create Rule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}