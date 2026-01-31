import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Circle,
  Diamond,
  Square,
  Plus,
  Trash2,
  Save,
  Settings,
  Copy,
  Link as LinkIcon,
  ChevronRight,
  HelpCircle,
  Zap,
  Target,
  Sparkles,
  Info
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MultiFieldEditor from "./MultiFieldEditor";
import OutcomeRulesConfig from "./OutcomeRulesConfig";
import ConditionGroupsBuilder from "./ConditionGroupsBuilder";

export default function WorkflowDragDropBuilder({ workflow, onSave, onCancel }) {
  // Ensure all steps have default_next_step and conditional_logic.conditions.value_type initialized from saved data
  const initialSteps = (workflow?.steps || []).map(step => {
    const normalizedConditions = (step.conditional_logic?.conditions || []).map(c => {
      // IMPORTANT: Preserve the exact value_type from saved data - only default if truly undefined
      const valueType = c.value_type !== undefined ? c.value_type : "static";
      console.log(`Init condition value_type for step ${step.step_id}:`, c.value_type, "->", valueType);
      return {
        ...c,
        value_type: valueType
      };
    });

    // Normalize condition_groups to ensure all fields are preserved
    const normalizedConditionGroups = (step.conditional_logic?.condition_groups || []).map(group => ({
      ...group,
      conditions: (group.conditions || []).map(c => ({
        ...c,
        value_type: c.value_type !== undefined ? c.value_type : "static"
      }))
    }));
    
    return {
      ...step,
      default_next_step: step.default_next_step || "",
      // Normalize conditional_logic to ensure value_type is preserved and option_values is always an array
      conditional_logic: step.conditional_logic ? {
        ...step.conditional_logic,
        conditions: normalizedConditions,
        option_values: Array.isArray(step.conditional_logic.option_values) ? step.conditional_logic.option_values : [],
        condition_groups: normalizedConditionGroups,
        overall_logic_operator: step.conditional_logic.overall_logic_operator || null,
        overall_true_step: step.conditional_logic.overall_true_step || null,
        overall_false_step: step.conditional_logic.overall_false_step || null
      } : { conditions: [], next_step: "", else_step: "", option_values: [], condition_groups: [] }
    };
  });
  
  console.log("WorkflowDragDropBuilder initialSteps conditions:", JSON.stringify(initialSteps.map(s => ({ id: s.step_id, conditions: s.conditional_logic?.conditions?.map(c => ({ field: c.field, value_type: c.value_type })) })), null, 2));
  
  const [steps, setSteps] = useState(initialSteps);
  const [selectedStep, setSelectedStep] = useState(null);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [workflowName, setWorkflowName] = useState(workflow?.workflow_name || "");
  const [workflowType, setWorkflowType] = useState(workflow?.workflow_type || "custom");
  const [outcomeRules, setOutcomeRules] = useState(() => {
    // Initialize from workflow prop, ensuring all fields have defaults
    console.log("Initializing outcomeRules from workflow:", workflow?.outcome_rules);
    const rules = workflow?.outcome_rules || [];
    return rules.map(rule => ({
      condition: rule.condition || "",
      result_classification: rule.result_classification || "",
      result_description: rule.result_description || "",
      account_context_items: rule.account_context_items || [],
      status_color: rule.status_color || "green"
    }));
  });
  
  // Debug: Log outcome rules on mount
  React.useEffect(() => {
    console.log("WorkflowDragDropBuilder mounted with workflow:", workflow);
    console.log("Current outcomeRules state:", outcomeRules);
  }, []);

  const nodeTypes = [
    { 
      id: "question", 
      label: "Question", 
      icon: Circle, 
      color: "bg-blue-100 text-blue-700 border-blue-300",
      questionType: "yes_no"
    },
    { 
      id: "decision", 
      label: "Decision", 
      icon: Diamond, 
      color: "bg-purple-100 text-purple-700 border-purple-300",
      questionType: "single_choice"
    },
    { 
      id: "action", 
      label: "Action", 
      icon: Square, 
      color: "bg-green-100 text-green-700 border-green-300"
    }
  ];

  const handleAddStep = (nodeType) => {
    const newStep = {
      step_id: `step_${Date.now()}`,
      step_title: `New ${nodeType.label}`,
      step_description: "",
      question_text: "",
      question_type: nodeType.questionType || "yes_no",
      options: nodeType.questionType ? [
        { value: "YES", label: "Yes", next_step: "" },
        { value: "NO", label: "No", next_step: "" }
      ] : [],
      help_text: "",
      required: true,
      post_completion_actions: []
    };
    setSteps([...steps, newStep]);
    setSelectedStep(newStep);
    setShowStepEditor(true);
  };

  const handleUpdateStep = (updatedStep) => {
    console.log(`[WorkflowDragDropBuilder] handleUpdateStep called for ${updatedStep.step_id}:`, {
      option_values: updatedStep.conditional_logic?.option_values,
      option_values_next_step: updatedStep.conditional_logic?.option_values_next_step,
      option_values_else_step: updatedStep.conditional_logic?.option_values_else_step
    });
    const newSteps = steps.map(s => s.step_id === updatedStep.step_id ? updatedStep : s);
    setSteps(newSteps);
    console.log(`[WorkflowDragDropBuilder] Updated steps state:`, newSteps.map(s => ({ 
      id: s.step_id, 
      option_values: s.conditional_logic?.option_values 
    })));
    // Update selectedStep with the new reference to ensure editor re-renders with fresh data
    setSelectedStep(newSteps.find(s => s.step_id === updatedStep.step_id) || updatedStep);
  };

  const handleDeleteStep = (stepId) => {
    if (confirm("Delete this step?")) {
      setSteps(steps.filter(s => s.step_id !== stepId));
      if (selectedStep?.step_id === stepId) {
        setSelectedStep(null);
        setShowStepEditor(false);
      }
    }
  };

  const handleDuplicateStep = (step) => {
    const newStep = {
      ...step,
      step_id: `step_${Date.now()}`,
      step_title: `${step.step_title} (Copy)`
    };
    setSteps([...steps, newStep]);
  };

  const handleAddOutcomeRule = () => {
    setOutcomeRules(prev => [
      ...prev,
      { 
        condition: "", 
        result_classification: "", 
        result_description: "",
        account_context_items: [],
        status_color: "green"
      }
    ]);
  };

  const handleRemoveOutcomeRule = (index) => {
    setOutcomeRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleOutcomeRuleChange = (index, field, value) => {
    setOutcomeRules(prev => {
      const newRules = [...prev];
      newRules[index] = { ...newRules[index], [field]: value };
      return newRules;
    });
  };

  const handleSave = () => {
    console.log(`[WorkflowDragDropBuilder] handleSave - Current steps state before processing:`, steps.map(s => ({ 
      id: s.step_id, 
      option_values: s.conditional_logic?.option_values,
      option_values_next: s.conditional_logic?.option_values_next_step,
      option_values_else: s.conditional_logic?.option_values_else_step
    })));
    
    // Ensure all steps have properly formatted conditional_logic with value_type preserved
    const processedSteps = steps.map(step => {
      const processedConditionalLogic = step.conditional_logic ? {
        trigger_field: step.conditional_logic.trigger_field || null,
        trigger_value: step.conditional_logic.trigger_value || null,
        conditions: (step.conditional_logic.conditions || []).map(c => ({
          field: c.field || "",
          operator: c.operator || "=",
          value: c.value || "",
          value_type: c.value_type || "static", // Ensure value_type is ALWAYS saved
          logic_operator: c.logic_operator || "AND"
        })),
        next_step: step.conditional_logic.next_step || "",
        else_step: step.conditional_logic.else_step || "",
        use_selection_count: step.conditional_logic.use_selection_count || false,
        selection_count_operator: step.conditional_logic.selection_count_operator || null,
        selection_count_value: step.conditional_logic.selection_count_value || null,
        selection_count_next_step: step.conditional_logic.selection_count_next_step || null,
        selection_count_else_step: step.conditional_logic.selection_count_else_step || null,
        option_values: Array.isArray(step.conditional_logic.option_values) && step.conditional_logic.option_values.length > 0 ? step.conditional_logic.option_values : null,
        option_values_next_step: step.conditional_logic.option_values_next_step || null,
        option_values_else_step: step.conditional_logic.option_values_else_step || null,
        // NEW: Preserve condition_groups and overall logic fields
        condition_groups: step.conditional_logic.condition_groups && step.conditional_logic.condition_groups.length > 0 
          ? step.conditional_logic.condition_groups.map(group => ({
              group_id: group.group_id || `group_${Date.now()}`,
              group_name: group.group_name || "",
              group_operator: group.group_operator || "AND",
              conditions: (group.conditions || []).map(c => ({
                condition_id: c.condition_id || `cond_${Date.now()}`,
                field: c.field || "",
                operator: c.operator || "=",
                value: c.value || "",
                value_type: c.value_type || "static"
              })),
              true_step: group.true_step || "",
              false_step: group.false_step || ""
            }))
          : null,
        overall_logic_operator: step.conditional_logic.overall_logic_operator || null,
        overall_true_step: step.conditional_logic.overall_true_step || null,
        overall_false_step: step.conditional_logic.overall_false_step || null
      } : { conditions: [], next_step: "", else_step: "", option_values: null };
      
      console.log(`[WorkflowDragDropBuilder] Processing step ${step.step_id}:`, {
        original_option_values: step.conditional_logic?.option_values,
        processed_option_values: processedConditionalLogic.option_values,
        processed_option_values_next_step: processedConditionalLogic.option_values_next_step,
        processed_option_values_else_step: processedConditionalLogic.option_values_else_step
      });
      
      return {
        ...step,
        conditional_logic: processedConditionalLogic
      };
    });

    const workflowData = {
      ...workflow,
      workflow_name: workflowName,
      workflow_type: workflowType,
      steps: processedSteps,
      outcome_rules: outcomeRules,
      last_modified_by: "current_user"
    };
    console.log("[WorkflowDragDropBuilder] Final workflow data being saved:", JSON.stringify(workflowData.steps?.map(s => ({ 
      id: s.step_id, 
      option_values: s.conditional_logic?.option_values,
      option_values_next_step: s.conditional_logic?.option_values_next_step,
      option_values_else_step: s.conditional_logic?.option_values_else_step
    })), null, 2));
    onSave(workflowData);
  };

  return (
    <div className="space-y-6">
      {/* Workflow Settings */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="text-lg">Workflow Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="workflow_name">Workflow Name *</Label>
              <Input
                id="workflow_name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g., Entity Classification"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="workflow_type">Workflow Type *</Label>
              <Select value={workflowType} onValueChange={setWorkflowType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entity_rfi_classification">Entity RFI Classification</SelectItem>
                  <SelectItem value="account_reportability">Account Reportability</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Steps and Outcome Rules */}
      <Tabs defaultValue="steps" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="steps" className="flex items-center gap-2">
            <Circle className="w-4 h-4" />
            Workflow Steps ({steps.length})
          </TabsTrigger>
          <TabsTrigger value="outcomes" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Outcome Rules ({outcomeRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="steps">
          {/* Builder Interface */}
          <div className="grid grid-cols-12 gap-6">
            {/* Node Palette */}
            <div className="col-span-3">
              <Card className="border-0 shadow-lg sticky top-6">
                <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
                  <CardTitle className="text-sm">Node Palette</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {nodeTypes.map((nodeType) => (
                      <button
                        key={nodeType.id}
                        onClick={() => handleAddStep(nodeType)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 ${nodeType.color} hover:shadow-md transition-all`}
                      >
                        <nodeType.icon className="w-5 h-5" />
                        <span className="font-medium text-sm">{nodeType.label}</span>
                        <Plus className="w-4 h-4 ml-auto" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-xs text-slate-600 mb-2">Quick Actions</p>
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Copy className="w-3 h-3 mr-2" />
                        Import Component
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Canvas */}
            <div className="col-span-9">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle className="text-lg">Workflow Steps ({steps.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {steps.length === 0 ? (
                <div className="text-center py-12">
                  <Circle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No Steps Yet
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Start building your workflow by adding steps from the palette
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, index) => {
                    const nodeType = nodeTypes.find(nt => 
                      step.step_title?.includes(nt.label) || 
                      (step.options?.length > 0 && nt.id === "decision") ||
                      (step.question_type === "yes_no" && nt.id === "question")
                    ) || nodeTypes[0];

                    return (
                      <div
                        key={step.step_id}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedStep?.step_id === step.step_id
                            ? "border-indigo-400 bg-indigo-50 shadow-md"
                            : "border-slate-200 hover:border-slate-300 hover:shadow"
                        }`}
                        onClick={() => {
                          setSelectedStep(step);
                          setShowStepEditor(true);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Step Number */}
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {index + 1}
                          </div>

                          {/* Step Icon */}
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 ${nodeType.color} flex-shrink-0`}>
                            <nodeType.icon className="w-5 h-5" />
                          </div>

                          {/* Step Content */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-900 mb-1">
                              {step.step_title}
                            </h4>
                            {step.question_text && (
                              <p className="text-sm text-slate-600 line-clamp-2">
                                {step.question_text}
                              </p>
                            )}
                            {step.options && step.options.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {step.options.map((opt, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {opt.label}
                                    {opt.next_step && (
                                      <ChevronRight className="w-3 h-3 ml-1" />
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStep(step);
                                setShowStepEditor(true);
                              }}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateStep(step);
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStep(step.step_id);
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TabsContent>

        <TabsContent value="outcomes">
          <OutcomeRulesConfig
            outcomeRules={outcomeRules}
            steps={steps}
            onChange={setOutcomeRules}
          />
        </TabsContent>
      </Tabs>

      {/* Save/Cancel Buttons - Always visible */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button onClick={onCancel} variant="outline">
          Cancel
        </Button>
        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          Save Workflow
        </Button>
      </div>

      {/* Step Editor Dialog */}
      <Dialog open={showStepEditor} onOpenChange={setShowStepEditor}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Step: {selectedStep?.step_title}</DialogTitle>
          </DialogHeader>
          {selectedStep && (
            <StepEditor
              key={`step-editor-${selectedStep.step_id}`}
              step={steps.find(s => s.step_id === selectedStep.step_id) || selectedStep}
              allSteps={steps}
              onUpdate={handleUpdateStep}
              onClose={() => setShowStepEditor(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to determine the field type of a workflow question
const getQuestionFieldType = (questionType) => {
  switch (questionType) {
    case 'yes_no': return 'boolean';
    case 'text_input':
    case 'single_choice':
    case 'multiple_choice': return 'string'; 
    case 'number_input': return 'number';
    case 'date_input': return 'date';
    case 'address_input': return 'object'; // Address input is an object with sub-fields
    default: return null;
  }
};

// Define Entity and Account field schemas with their possible values
const ENTITY_FIELDS_SCHEMA = {
  rfi_status: {
    label: "RFI Status",
    type: "enum",
    enum: ["pending_classification", "reporting_fi", "non_reporting_fi", "nfe_active", "nfe_passive"]
  },
  fi_type: {
    label: "FI Type",
    type: "enum",
    enum: ["custodial_institution", "depository_institution", "investment_entity", "specified_insurance_company", "not_applicable"]
  },
  entity_type: {
    label: "Entity Type",
    type: "enum",
    enum: ["corporation", "trust", "partnership", "fund", "branch", "other"]
  },
  status: {
    label: "Status",
    type: "enum",
    enum: ["active", "inactive"]
  },
  entity_name: { label: "Entity Name", type: "string" },
  country_of_incorporation: { label: "Country of Incorporation", type: "string" },
  tax_id: { label: "Tax ID", type: "string" },
  giin: { label: "GIIN", type: "string" },
  non_reporting_reason: { label: "Non-Reporting Reason", type: "string" },
  classification_completed_date: { label: "Classification Completed Date", type: "date" }
};

const ACCOUNT_FIELDS_SCHEMA = {
  reportability_status: {
    label: "Reportability Status",
    type: "enum",
    enum: ["pending_review", "reportable", "non_reportable", "excluded"]
  },
  account_type: {
    label: "Account Type",
    type: "enum",
    enum: ["depository", "custodial", "equity_debt_interest", "cash_value_insurance", "annuity"]
  },
  account_holder_type: {
    label: "Account Holder Type",
    type: "enum",
    enum: ["individual", "entity"]
  },
  entity_classification: {
    label: "Entity Classification",
    type: "enum",
    enum: ["financial_institution", "active_nfe", "passive_nfe", "not_applicable"]
  },
  status: {
    label: "Status",
    type: "enum",
    enum: ["active", "closed", "dormant"]
  },
  account_number: { label: "Account Number", type: "string" },
  account_holder_name: { label: "Account Holder Name", type: "string" },
  date_of_birth: { label: "Date of Birth", type: "date" },
  place_of_birth: { label: "Place of Birth", type: "string" },
  country_of_residence: { label: "Country of Residence", type: "string" },
  reporting_year: { label: "Reporting Year", type: "string" },
  reportability_reason: { label: "Reportability Reason", type: "string" },
  year_end_cash_value: { label: "Year End Cash Value", type: "number" },
  gross_payments: { label: "Gross Payments", type: "number" },
  is_pre_existing: { label: "Is Pre-existing", type: "boolean" },
  account_holder_is_alive: { label: "Account Holder Is Alive", type: "boolean" },
  account_closed_during_period: { label: "Account Closed During Period", type: "boolean" },
  self_certification_obtained: { label: "Self-Certification Obtained", type: "boolean" },
  self_certification_date: { label: "Self-Certification Date", type: "date" },
  needs_reclassification: { label: "Needs Reclassification", type: "boolean" }
};

// Helper function to get fields for a target entity type
const getFieldsForEntity = (entityType) => {
  return entityType === "Entity" ? ENTITY_FIELDS_SCHEMA : ACCOUNT_FIELDS_SCHEMA;
};

// Helper function to get suggested values for a field - now using ReferencedData
const getSuggestedValuesForField = (entityType, fieldName, referencedDataList = []) => {
  // First, check ReferencedData for this field
  const referencedOptions = referencedDataList.filter(rd => 
    rd.entity_name === entityType && rd.field_name === fieldName
  );
  
  if (referencedOptions.length > 0) {
    // Sort by order and return
    return referencedOptions
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(rd => ({
        value: rd.value,
        label: rd.label
      }));
  }

  // Fallback to hardcoded schema if no ReferencedData found
  const schema = getFieldsForEntity(entityType);
  const field = schema[fieldName];
  if (field?.enum) {
    return field.enum.map(val => ({
      value: val,
      label: val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }));
  }
  if (field?.type === "boolean") {
    return [
      { value: "true", label: "True" },
      { value: "false", label: "False" }
    ];
  }
  return null; // No suggestions - free text input
};

// Step Editor Component
function StepEditor({ step, allSteps, onUpdate, onClose }) {
  // Ensure all conditions have value_type defaulted and option_values is always an array
  const normalizedConditionalLogic = step.conditional_logic ? {
    ...step.conditional_logic,
    conditions: (step.conditional_logic.conditions || []).map(c => ({
      ...c,
      value_type: c.value_type || "static"
    })),
    option_values: Array.isArray(step.conditional_logic.option_values) ? step.conditional_logic.option_values : (step.conditional_logic.option_values ? [step.conditional_logic.option_values] : [])
  } : { conditions: [], next_step: "", else_step: "", option_values: [] };

  console.log(`[StepEditor] Initializing StepEditor for ${step.step_id}:`, {
    original_option_values: step.conditional_logic?.option_values,
    normalized_option_values: normalizedConditionalLogic.option_values,
    option_values_next_step: step.conditional_logic?.option_values_next_step,
    option_values_else_step: step.conditional_logic?.option_values_else_step
  });

  const [editedStep, setEditedStep] = useState({ 
    ...step,
    default_next_step: step.default_next_step || "",
    conditional_logic: normalizedConditionalLogic,
    mapped_field: step.mapped_field || { entity_type: "", field_name: "" }
  });
  const [showAdvancedLogic, setShowAdvancedLogic] = useState(
    step.conditional_logic?.conditions?.length > 0
  );

  // Load Account and Entity schemas directly
  const [isLoadingFields, setIsLoadingFields] = React.useState(false);

  // Fetch ReferencedData for dynamic field options
  const { data: referencedData = [] } = useQuery({
    queryKey: ['referenced-data-workflow-builder'],
    queryFn: () => base44.entities.ReferencedData.filter({ is_published: true }),
    staleTime: 60000
  });

  // Account schema fields
  const accountFields = React.useMemo(() => {
    return [
      { value: "account_number", label: "Account Number", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_creation_date", label: "Account Creation Date", type: "date", isCountry: false, group: "Account Fields" },
      { value: "account_type", label: "Account Type", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_holder_type", label: "Account Holder Type", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_holder_name", label: "Account Holder Name", type: "string", isCountry: false, group: "Account Fields" },
      { value: "date_of_birth", label: "Date of Birth", type: "date", isCountry: false, group: "Account Fields" },
      { value: "place_of_birth", label: "Place of Birth", type: "string", isCountry: true, group: "Account Fields" },
      { value: "is_pre_existing", label: "Is Pre-existing", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "account_holder_is_alive", label: "Account Holder Is Alive", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "account_holder_deceased_during_period", label: "Account Holder Deceased During Period", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "death_certificate_requested", label: "Death Certificate Requested", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "death_certificate_received", label: "Death Certificate Received", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "will_or_inheritance_requested", label: "Will or Inheritance Requested", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "will_or_inheritance_received", label: "Will or Inheritance Received", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "legacy_of_deceased_settled", label: "Legacy of Deceased Settled", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "entity_managed_by_fiduciary_trust", label: "Entity Managed by Fiduciary Trust", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "entity_managed_by_asset_manager", label: "Entity Managed by Asset Manager", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "gross_income_from_financial_assets", label: "Gross Income From Financial Assets", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "account_closed_during_period", label: "Account Closed During Period", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "current_address", label: "Current Address (Object)", type: "object", isCountry: false, group: "Account Fields" },
      { value: "current_address.street", label: "Current Address Street", type: "string", isCountry: false, group: "Account Fields" },
      { value: "current_address.city", label: "Current Address City", type: "string", isCountry: false, group: "Account Fields" },
      { value: "current_address.state", label: "Current Address State", type: "string", isCountry: false, group: "Account Fields" },
      { value: "current_address.postal_code", label: "Current Address Postal Code", type: "string", isCountry: false, group: "Account Fields" },
      { value: "current_address.country", label: "Current Address Country", type: "string", isCountry: true, group: "Account Fields" },
      { value: "account_holder_address", label: "Account Holder Address (Object)", type: "object", isCountry: false, group: "Account Fields" },
      { value: "account_holder_address.street", label: "Account Holder Address Street", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_holder_address.city", label: "Account Holder Address City", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_holder_address.state", label: "Account Holder Address State", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_holder_address.postal_code", label: "Account Holder Address Postal Code", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_holder_address.country", label: "Account Holder Address Country", type: "string", isCountry: true, group: "Account Fields" },
      { value: "country_of_residence", label: "Country of Residence", type: "string", isCountry: true, group: "Account Fields" },
      { value: "current_email", label: "Current Email", type: "string", isCountry: false, group: "Account Fields" },
      { value: "current_phone", label: "Current Phone", type: "string", isCountry: false, group: "Account Fields" },
      { value: "entity_classification", label: "Entity Classification", type: "string", isCountry: false, group: "Account Fields" },
      { value: "year_end_cash_value", label: "Year End Cash Value", type: "number", isCountry: false, group: "Account Fields" },
      { value: "gross_payments", label: "Gross Payments", type: "number", isCountry: false, group: "Account Fields" },
      { value: "reporting_year", label: "Reporting Year", type: "string", isCountry: false, group: "Account Fields" },
      { value: "reportability_status", label: "Reportability Status", type: "string", isCountry: false, group: "Account Fields" },
      { value: "us_person_indic", label: "US Person Indicia", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "self_certification_obtained", label: "Self-Certification Obtained", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "self_certification_date", label: "Self-Certification Date", type: "date", isCountry: false, group: "Account Fields" },
      { value: "needs_reclassification", label: "Needs Reclassification", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "status", label: "Status", type: "string", isCountry: false, group: "Account Fields" }
    ];
  }, []);

  // Entity schema fields
  const entityFields = React.useMemo(() => {
    return [
      { value: "entity_name", label: "Entity Name", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "entity_type", label: "Entity Type", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "country_of_incorporation", label: "Country of Incorporation", type: "string", isCountry: true, group: "Entity Fields" },
      { value: "tax_id", label: "Tax ID", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "giin", label: "GIIN", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "rfi_status", label: "RFI Status", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "fi_type", label: "FI Type", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "non_reporting_reason", label: "Non-Reporting Reason", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "classification_completed_date", label: "Classification Completed Date", type: "date", isCountry: false, group: "Entity Fields" },
      { value: "address", label: "Address (Object)", type: "object", isCountry: false, group: "Entity Fields" },
      { value: "address.street", label: "Address Street", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "address.city", label: "Address City", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "address.state", label: "Address State", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "address.postal_code", label: "Address Postal Code", type: "string", isCountry: false, group: "Entity Fields" },
      { value: "address.country", label: "Address Country", type: "string", isCountry: true, group: "Entity Fields" },
      { value: "status", label: "Status", type: "string", isCountry: false, group: "Entity Fields" }
    ];
  }, []);

  // Generate consolidated available condition fields including multi-field sub-fields from previous steps
  const availableConditionFields = React.useMemo(() => {
    const fields = [];
    const currentStepIndex = allSteps.findIndex(s => s.step_id === editedStep.step_id);

    // 1. Add answers from all workflow steps (including current step for self-referencing address/multi-field)
    allSteps.forEach((s, idx) => {
      // Skip steps that come after the current step (except for address_input and multi_field_input)
      if (idx > currentStepIndex && s.question_type !== 'address_input' && s.question_type !== 'multi_field_input') return;
      // For the current step itself, only include if it's an address_input or multi_field_input (for self-referencing)
      if (idx === currentStepIndex && s.question_type !== 'address_input' && s.question_type !== 'multi_field_input') return;
      // Add step ID itself as a field (for simple question types)
      fields.push({
        value: s.step_id,
        label: `Step: ${s.step_title}`,
        type: s.question_type,
        isCountry: false,
        group: 'Workflow Steps'
      });

      // If it's a multi_field_input, add its sub-fields
      if (s.question_type === 'multi_field_input' && s.multi_fields?.length > 0) {
        s.multi_fields.forEach(mf => {
          const isCountryField = mf.field_type === 'select' && (
            mf.referenced_data_key?.toLowerCase().includes('country') ||
            mf.display_label?.toLowerCase().includes('country')
          );
          
          fields.push({
            value: `${s.step_id}.${mf.field_id}`,
            label: `${s.step_title} → ${mf.display_label}`,
            type: mf.field_type,
            isCountry: isCountryField,
            group: 'Multi-Field Inputs'
          });
        });
      }

      // If it's an address_input, add its sub-fields (street, city, state, postal_code, country)
      if (s.question_type === 'address_input') {
        const addressSubFields = [
          { id: 'street', label: 'Street Address', isCountry: false },
          { id: 'city', label: 'City', isCountry: false },
          { id: 'state', label: 'State/Province', isCountry: false },
          { id: 'postal_code', label: 'Postal Code', isCountry: false },
          { id: 'country', label: 'Country', isCountry: true },
        ];
        addressSubFields.forEach(subField => {
          fields.push({
            value: `${s.step_id}.${subField.id}`,
            label: `${s.step_title} → ${subField.label}`,
            type: 'string',
            isCountry: subField.isCountry,
            group: 'Address Inputs'
          });
        });
      }
    });

    // Also add all address_input steps' sub-fields (regardless of position) for flexible branching
    allSteps.forEach(s => {
      if (s.question_type === 'address_input') {
        // Check if we already added this step's fields
        const alreadyAdded = fields.some(f => f.value === `${s.step_id}.country`);
        if (!alreadyAdded) {
          const addressSubFields = [
            { id: 'street', label: 'Street Address', isCountry: false },
            { id: 'city', label: 'City', isCountry: false },
            { id: 'state', label: 'State/Province', isCountry: false },
            { id: 'postal_code', label: 'Postal Code', isCountry: false },
            { id: 'country', label: 'Country', isCountry: true },
          ];
          addressSubFields.forEach(subField => {
            fields.push({
              value: `${s.step_id}.${subField.id}`,
              label: `${s.step_title} → ${subField.label}`,
              type: 'string',
              isCountry: subField.isCountry,
              group: 'Address Inputs'
            });
          });
        }
      }
    });

    // 2. Add Account fields
    accountFields.forEach(field => {
      fields.push({ ...field, group: 'Account Fields' });
    });

    // 3. Add Entity fields
    entityFields.forEach(field => {
      fields.push({ ...field, group: 'Entity Fields' });
    });

    return fields;
  }, [allSteps, editedStep.step_id, accountFields, entityFields]);

  const handleChange = (field, value) => {
    setEditedStep({ ...editedStep, [field]: value });
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...editedStep.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setEditedStep({ ...editedStep, options: newOptions });
  };

  const handleAddOption = () => {
    setEditedStep({
      ...editedStep,
      options: [
        ...editedStep.options,
        { value: "", label: "", next_step: "" }
      ]
    });
  };

  const handleRemoveOption = (index) => {
    const newOptions = editedStep.options.filter((_, i) => i !== index);
    setEditedStep({ ...editedStep, options: newOptions });
  };

  const handleAddAction = () => {
    const currentActions = editedStep.post_completion_actions || [];
    setEditedStep({
      ...editedStep,
      post_completion_actions: [
        ...currentActions,
        {
          action_type: "update_entity_field",
          target_entity_type: "Entity",
          field_to_update: "",
          value_source: "from_step_answer",
          value: ""
        }
      ]
    });
  };

  const handleRemoveAction = (index) => {
    const newActions = editedStep.post_completion_actions.filter((_, i) => i !== index);
    setEditedStep({ ...editedStep, post_completion_actions: newActions });
  };

  const handleActionChange = (index, field, value, additionalUpdates = {}) => {
    const newActions = [...editedStep.post_completion_actions];
    newActions[index] = { ...newActions[index], [field]: value, ...additionalUpdates };
    setEditedStep({ ...editedStep, post_completion_actions: newActions });
  };

  const handleAddCondition = () => {
    const newConditions = [
      ...(editedStep.conditional_logic?.conditions || []),
      { field: "", operator: "=", value: "", value_type: "static", logic_operator: "AND" }
    ];
    setEditedStep({
      ...editedStep,
      conditional_logic: {
        ...editedStep.conditional_logic,
        conditions: newConditions
      }
    });
  };

  const handleRemoveCondition = (index) => {
    const newConditions = editedStep.conditional_logic.conditions.filter((_, i) => i !== index);
    setEditedStep({
      ...editedStep,
      conditional_logic: {
        ...editedStep.conditional_logic,
        conditions: newConditions
      }
    });
  };

  const handleConditionChange = (index, field, value) => {
    const newConditions = [...editedStep.conditional_logic.conditions];
    // Ensure value_type is always preserved - default to "static" if not set
    const currentCondition = newConditions[index];
    newConditions[index] = { 
      ...currentCondition, 
      value_type: currentCondition.value_type || "static", // Preserve value_type
      [field]: value 
    };
    
    // Reset operator if field changes and it's a CRS-specific operator
    if (field === 'field') {
      const selectedField = availableConditionFields.find(f => f.value === value);
      const currentOperator = newConditions[index].operator;
      
      // If switching away from a country field and operator is CRS-specific, reset operator
      if (!selectedField?.isCountry && (currentOperator === 'is_crs' || currentOperator === 'is_not_crs')) {
        newConditions[index].operator = '=';
      }
    }
    
    setEditedStep({
      ...editedStep,
      conditional_logic: {
        ...editedStep.conditional_logic,
        conditions: newConditions
      }
    });
  };

  const handleConditionalLogicChange = (field, value) => {
    setEditedStep({
      ...editedStep,
      conditional_logic: {
        ...editedStep.conditional_logic,
        [field]: value
      }
    });
  };

  const handleMappedFieldChange = (field, value) => {
    setEditedStep(prev => ({
      ...prev,
      mapped_field: {
        ...prev.mapped_field,
        [field]: value
      }
    }));
  };

  const filteredMappedFields = React.useMemo(() => {
    if (!editedStep.mapped_field?.entity_type) return [];
    const allFields = editedStep.mapped_field.entity_type === "Account" ? accountFields : entityFields;
    const questionFieldType = getQuestionFieldType(editedStep.question_type);
    
    if (!questionFieldType) return [];

    // Filter fields based on type compatibility
    return allFields.filter(field => {
      // Special handling for address_input - can only map to address object fields
      if (editedStep.question_type === 'address_input') {
        return field.type === 'object' && (field.value === 'current_address' || field.value === 'account_holder_address');
      }

      // NEW: Allow dropdown/enum fields to map to yes_no questions
      // This enables smart pre-filling based on dropdown value matching
      if (editedStep.question_type === 'yes_no') {
        // Allow country fields
        if (field.isCountry) {
          return true;
        }
        // Allow fields that have dropdown options (from ReferencedData or schema enum)
        const hasDropdownOptions = getSuggestedValuesForField(
          editedStep.mapped_field.entity_type,
          field.value,
          referencedData
        );
        if (hasDropdownOptions && hasDropdownOptions.length > 0) {
          return true;
        }
      }

      // Match field types
      if (field.type === questionFieldType) {
        return true;
      }
      return false;
    });
  }, [editedStep.mapped_field?.entity_type, editedStep.question_type, accountFields, entityFields, referencedData]);

  const handleSave = () => {
    console.log(`[StepEditor] Saving step ${editedStep.step_id}:`, {
      option_values: editedStep.conditional_logic?.option_values,
      option_values_next_step: editedStep.conditional_logic?.option_values_next_step,
      option_values_else_step: editedStep.conditional_logic?.option_values_else_step,
      full_conditional_logic: editedStep.conditional_logic,
      mapped_field: editedStep.mapped_field
    });
    onUpdate(editedStep);
    onClose();
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="step_title">Step Title *</Label>
        <Input
          id="step_title"
          value={editedStep.step_title}
          onChange={(e) => handleChange("step_title", e.target.value)}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="question_text">Question Text</Label>
        <Textarea
          id="question_text"
          value={editedStep.question_text}
          onChange={(e) => handleChange("question_text", e.target.value)}
          rows={3}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="question_type">Question Type</Label>
        <Select
          value={editedStep.question_type}
          onValueChange={(value) => handleChange("question_type", value)}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes_no">Yes/No</SelectItem>
            <SelectItem value="single_choice">Single Choice</SelectItem>
            <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
            <SelectItem value="text_input">Text Input</SelectItem>
            <SelectItem value="number_input">Number Input</SelectItem>
            <SelectItem value="date_input">Date Input</SelectItem>
            <SelectItem value="file_upload">File Upload</SelectItem>
            <SelectItem value="multi_field_input">Multi-Field Input</SelectItem>
            <SelectItem value="address_input">Address Input</SelectItem>
            <SelectItem value="beneficiary_input">Beneficiary Input</SelectItem>
            <SelectItem value="controlling_person_input">Controlling Person Input</SelectItem>
            <SelectItem value="info">Info (Display Only)</SelectItem>
            <SelectItem value="result">Result (End Step)</SelectItem>
              </SelectContent>
              </Select>
              </div>

      {/* Address Input Configuration */}
      {editedStep.question_type === "address_input" && (
        <div className="p-4 border-2 border-teal-100 rounded-lg bg-teal-50/30">
          <div className="flex items-start gap-2 text-xs text-slate-600 bg-white p-3 rounded border border-teal-200 mb-4">
            <HelpCircle className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Address Input:</strong> This step will display fields for Street, City, State/Province, Postal Code, and Country. 
              The collected address will update the Account's address field and create an audit log entry with the previous and new values.
            </p>
          </div>
          <div>
            <Label className="text-sm">Target Address Field</Label>
            <Select
              value={editedStep.address_config?.target_field || "current_address"}
              onValueChange={(value) => setEditedStep({
                ...editedStep,
                address_config: { ...editedStep.address_config, target_field: value }
              })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_address">Current Address</SelectItem>
                <SelectItem value="account_holder_address">Account Holder Address</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              Select which address field on the Account will be updated with the collected address.
            </p>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={editedStep.address_config?.track_changes !== false}
                onCheckedChange={(checked) => setEditedStep({
                  ...editedStep,
                  address_config: { ...editedStep.address_config, track_changes: checked }
                })}
                id="track-address-changes"
              />
              <Label htmlFor="track-address-changes" className="text-sm cursor-pointer">
                Track address changes in audit log
              </Label>
            </div>
            <p className="text-xs text-slate-500 mt-1 ml-6">
              When enabled, an audit log entry will be created showing the previous and new address values.
            </p>
          </div>
        </div>
      )}

            <div>
            <Label htmlFor="help_text">Help Text</Label>
        <Textarea
          id="help_text"
          value={editedStep.help_text}
          onChange={(e) => handleChange("help_text", e.target.value)}
          rows={2}
          placeholder="Additional guidance for users..."
          className="mt-1.5"
        />
      </div>

      {/* Answer Options */}
      {(editedStep.question_type === "yes_no" || 
        editedStep.question_type === "single_choice" || 
        editedStep.question_type === "multiple_choice") && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Answer Options</Label>
            <Button size="sm" onClick={handleAddOption} variant="outline">
              <Plus className="w-3 h-3 mr-1" />
              Add Option
            </Button>
          </div>
          <div className="space-y-3">
            {editedStep.options?.map((option, index) => (
              <div key={index} className="p-3 border rounded-lg space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Value"
                    value={option.value}
                    onChange={(e) => handleOptionChange(index, "value", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Label"
                    value={option.label}
                    onChange={(e) => handleOptionChange(index, "label", e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(index)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-slate-400" />
                  <Label className="text-xs text-slate-600">Next Step:</Label>
                  <Select
                    value={option.next_step || ""}
                    onValueChange={(value) => handleOptionChange(index, "next_step", value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select next step..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None (End)</SelectItem>
                      {allSteps
                        .filter(s => s.step_id !== editedStep.step_id)
                        .map(s => (
                          <SelectItem key={s.step_id} value={s.step_id}>
                            {s.step_title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Field Input Configuration */}
      {editedStep.question_type === "multi_field_input" && (
        <div className="border-t pt-4">
          <MultiFieldEditor
            fields={editedStep.multi_fields || []}
            onChange={(fields) => setEditedStep({ ...editedStep, multi_fields: fields })}
          />
        </div>
      )}

      {/* Next Step for non-option question types */}
      {(editedStep.question_type === "text_input" || 
        editedStep.question_type === "number_input" || 
        editedStep.question_type === "date_input" || 
        editedStep.question_type === "file_upload" ||
        editedStep.question_type === "multi_field_input" ||
        editedStep.question_type === "address_input" ||
        editedStep.question_type === "beneficiary_input" ||
        editedStep.question_type === "controlling_person_input") && (
        <div className="p-4 border rounded-lg bg-slate-50">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-slate-400" />
            <Label className="text-sm font-medium text-slate-700">Next Step (after this input is completed):</Label>
          </div>
          <Select
            value={editedStep.default_next_step || ""}
            onValueChange={(value) => handleChange("default_next_step", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select next step..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None (End Workflow)</SelectItem>
              {allSteps
                .filter(s => s.step_id !== editedStep.step_id)
                .map(s => (
                  <SelectItem key={s.step_id} value={s.step_id}>
                    {s.step_title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Advanced Conditional Logic */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-600" />
            Advanced Conditional Logic (Multi-Condition Branching)
          </Label>
          <Badge variant="outline" className="text-xs">
            {editedStep.conditional_logic?.conditions?.length || 0} conditions
          </Badge>
        </div>

        {!showAdvancedLogic ? (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setShowAdvancedLogic(true)}
            className="w-full"
          >
            <Plus className="w-3 h-3 mr-1" />
            Enable Advanced Conditional Logic
          </Button>
        ) : (
          <div className="space-y-4 p-4 border-2 border-purple-100 rounded-lg bg-purple-50/30">
            <div className="flex items-start gap-2 text-xs text-slate-600 bg-white p-3 rounded border border-purple-200">
              <HelpCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Conditional Logic:</strong> Define complex branching rules based on multiple conditions. 
                Use AND/OR operators to combine conditions. If all conditions match, go to "Then" step, 
                otherwise go to "Else" step.
              </p>
            </div>

            {/* Trigger Configuration */}
            <div className="bg-white p-3 rounded border border-purple-200">
              <Label className="text-xs font-semibold text-purple-700 mb-2 block">
                Trigger (Optional)
              </Label>
              <p className="text-xs text-slate-600 mb-3">
                Only evaluate advanced conditions when a specific answer is selected
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Trigger on Step</Label>
                  <Select
                    value={editedStep.conditional_logic?.trigger_field || ""}
                    onValueChange={(value) => handleConditionalLogicChange("trigger_field", value)}
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="Select step..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None (Always Evaluate)</SelectItem>
                      {allSteps.map(s => (
                        <SelectItem key={s.step_id} value={s.step_id}>
                          {s.step_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">When Answer Equals</Label>
                  <Input
                    value={editedStep.conditional_logic?.trigger_value || ""}
                    onChange={(e) => handleConditionalLogicChange("trigger_value", e.target.value)}
                    placeholder="e.g., NO, YES"
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Multiple Choice Advanced Branching */}
            {editedStep.question_type === "multiple_choice" && (
              <div className="bg-white p-3 rounded border border-blue-200">
                <Label className="text-xs font-semibold text-blue-700 mb-2 block">
                  Multiple Choice Branching
                </Label>
                <p className="text-xs text-slate-600 mb-3">
                  Navigate based on which options or how many options the user selects
                </p>

                <Tabs defaultValue="options" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-3">
                    <TabsTrigger value="options" className="text-xs">
                      By Selected Options
                    </TabsTrigger>
                    <TabsTrigger value="count" className="text-xs">
                      By Selection Count
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="options" className="space-y-3 mt-0">
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-blue-900 mb-3">
                        <strong>Option-based branching:</strong> Define which step to navigate to based on which specific options the user selects
                      </p>

                      <div>
                        <Label className="text-xs mb-2 block">
                          If user selects ANY of these options:
                        </Label>
                        <div className="space-y-2">
                          {editedStep.options?.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Checkbox
                              id={`opt-branch-${idx}`}
                              checked={editedStep.conditional_logic?.option_values?.includes(opt.value) || false}
                              onCheckedChange={(checked) => {
                                const currentValues = editedStep.conditional_logic?.option_values || [];
                                const newValues = checked 
                                  ? [...currentValues, opt.value]
                                  : currentValues.filter(v => v !== opt.value);
                                console.log(`[StepEditor] Checkbox changed for ${opt.value}:`, { checked, currentValues, newValues });
                                handleConditionalLogicChange("option_values", newValues);
                              }}
                              />
                              <Label htmlFor={`opt-branch-${idx}`} className="text-xs cursor-pointer">
                                {opt.label} ({opt.value})
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {(editedStep.conditional_logic?.option_values?.length > 0) && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-slate-600 mb-2">
                            Selected: <strong>{editedStep.conditional_logic.option_values.join(', ')}</strong>
                          </p>
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <Label className="text-xs text-green-700 font-semibold">
                                If ANY selected → Go to:
                              </Label>
                              <Select
                                value={editedStep.conditional_logic?.option_values_next_step || ""}
                                onValueChange={(value) => handleConditionalLogicChange("option_values_next_step", value)}
                              >
                                <SelectTrigger className="h-8 text-xs mt-1 border-green-300">
                                  <SelectValue placeholder="Select step..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={null}>None (End)</SelectItem>
                                  {allSteps
                                    .filter(s => s.step_id !== editedStep.step_id)
                                    .map(s => (
                                      <SelectItem key={s.step_id} value={s.step_id}>
                                        {s.step_title}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-red-700 font-semibold">
                                Otherwise → Go to:
                              </Label>
                              <Select
                                value={editedStep.conditional_logic?.option_values_else_step || ""}
                                onValueChange={(value) => handleConditionalLogicChange("option_values_else_step", value)}
                              >
                                <SelectTrigger className="h-8 text-xs mt-1 border-red-300">
                                  <SelectValue placeholder="Select step..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={null}>None (End)</SelectItem>
                                  {allSteps
                                    .filter(s => s.step_id !== editedStep.step_id)
                                    .map(s => (
                                      <SelectItem key={s.step_id} value={s.step_id}>
                                        {s.step_title}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="count" className="space-y-3 mt-0">
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-blue-900 mb-3">
                        <strong>Count-based branching:</strong> Navigate based on how many total options the user selects
                      </p>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Operator</Label>
                          <Select
                            value={editedStep.conditional_logic?.selection_count_operator || "="}
                            onValueChange={(value) => handleConditionalLogicChange("selection_count_operator", value)}
                          >
                            <SelectTrigger className="h-8 text-xs mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="=">Equals (=)</SelectItem>
                              <SelectItem value="!=">Not Equals (≠)</SelectItem>
                              <SelectItem value=">">Greater Than (&gt;)</SelectItem>
                              <SelectItem value="<">Less Than (&lt;)</SelectItem>
                              <SelectItem value=">=">Greater or Equal (≥)</SelectItem>
                              <SelectItem value="<=">Less or Equal (≤)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Count</Label>
                          <Input
                            type="number"
                            min="0"
                            value={editedStep.conditional_logic?.selection_count_value || ""}
                            onChange={(e) => handleConditionalLogicChange("selection_count_value", parseInt(e.target.value) || 0)}
                            placeholder="e.g., 3"
                            className="h-8 text-xs mt-1"
                          />
                        </div>
                        <div className="text-xs text-slate-500 flex items-end pb-2">
                          of {editedStep.options?.length || 0} total options
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t">
                        <div>
                          <Label className="text-xs text-green-700 font-semibold">
                            If condition met → Go to:
                          </Label>
                          <Select
                            value={editedStep.conditional_logic?.selection_count_next_step || ""}
                            onValueChange={(value) => handleConditionalLogicChange("selection_count_next_step", value)}
                          >
                            <SelectTrigger className="h-8 text-xs mt-1 border-green-300">
                              <SelectValue placeholder="Select step..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={null}>None (End)</SelectItem>
                              {allSteps
                                .filter(s => s.step_id !== editedStep.step_id)
                                .map(s => (
                                  <SelectItem key={s.step_id} value={s.step_id}>
                                    {s.step_title}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-red-700 font-semibold">
                            Otherwise → Go to:
                          </Label>
                          <Select
                            value={editedStep.conditional_logic?.selection_count_else_step || ""}
                            onValueChange={(value) => handleConditionalLogicChange("selection_count_else_step", value)}
                          >
                            <SelectTrigger className="h-8 text-xs mt-1 border-red-300">
                              <SelectValue placeholder="Select step..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={null}>None (End)</SelectItem>
                              {allSteps
                                .filter(s => s.step_id !== editedStep.step_id)
                                .map(s => (
                                  <SelectItem key={s.step_id} value={s.step_id}>
                                    {s.step_title}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* NEW: Condition Groups (Multi-Group Logic) */}
            <Tabs defaultValue="simple" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-3">
                <TabsTrigger value="simple" className="text-xs">
                  Simple Conditions
                </TabsTrigger>
                <TabsTrigger value="groups" className="text-xs">
                  Condition Groups
                </TabsTrigger>
              </TabsList>

              {/* Simple Conditions Tab (Legacy) */}
              <TabsContent value="simple" className="space-y-4 mt-0">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm">Conditions ({editedStep.conditional_logic?.conditions?.length || 0})</Label>
                    <Button size="sm" onClick={handleAddCondition} variant="outline">
                      <Plus className="w-3 h-3 mr-1" />
                      Add Condition
                    </Button>
                  </div>

                  {(!editedStep.conditional_logic?.conditions || editedStep.conditional_logic.conditions.length === 0) ? (
                    <p className="text-xs text-slate-500 italic p-3 bg-white rounded border">
                      No conditions defined. Add a condition to enable multi-condition branching.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {editedStep.conditional_logic.conditions.map((condition, index) => {
                        const selectedField = availableConditionFields.find(f => f.value === condition.field);
                        const isCountryField = selectedField?.isCountry;

                        return (
                          <div key={index} className="p-3 bg-white border-2 border-purple-200 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="bg-purple-100 text-purple-800">
                                Condition {index + 1}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveCondition(index)}
                                className="h-6 w-6 text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Step ID / Field</Label>
                                <Select
                                  value={condition.field}
                                  onValueChange={(value) => handleConditionChange(index, "field", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue placeholder={isLoadingFields ? "Loading fields..." : "Select field..."} />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px]">
                                    {Object.entries(availableConditionFields.reduce((acc, field) => {
                                      if (!acc[field.group]) acc[field.group] = [];
                                      acc[field.group].push(field);
                                      return acc;
                                    }, {})).map(([group, fields]) => (
                                      <React.Fragment key={group}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1 first:border-t-0 first:mt-0">
                                          {group}
                                        </div>
                                        {fields.map(field => (
                                          <SelectItem key={`field-${field.value}`} value={field.value}>
                                            {field.label} {field.isCountry && '🌍'}
                                          </SelectItem>
                                        ))}
                                      </React.Fragment>
                                    ))}
                                    {isLoadingFields && (
                                      <div className="px-2 py-1.5 text-xs text-slate-500 italic">Loading fields...</div>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs">Operator</Label>
                                <Select
                                  value={condition.operator}
                                  onValueChange={(value) => handleConditionChange(index, "operator", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="=">Equals (=)</SelectItem>
                                    <SelectItem value="!=">Not Equals (≠)</SelectItem>
                                    <SelectItem value=">">Greater Than (&gt;)</SelectItem>
                                    <SelectItem value="<">Less Than (&lt;)</SelectItem>
                                    <SelectItem value=">=">Greater or Equal (≥)</SelectItem>
                                    <SelectItem value="<=">Less or Equal (≤)</SelectItem>
                                    <SelectItem value="contains">Contains</SelectItem>
                                    <SelectItem value="in">In</SelectItem>
                                    <SelectItem value="not_in">Not In</SelectItem>
                                    {isCountryField && (
                                      <>
                                        <SelectItem value="is_crs">Is CRS Country 🌍</SelectItem>
                                        <SelectItem value="is_not_crs">Is Not CRS Country 🌍</SelectItem>
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs">Value Type</Label>
                                <Select
                                  value={condition.value_type || "static"}
                                  onValueChange={(value) => {
                                    // When switching value type, clear the value and update type in one operation
                                    const newConditions = [...editedStep.conditional_logic.conditions];
                                    newConditions[index] = { 
                                      ...newConditions[index], 
                                      value_type: value,
                                      value: "" // Clear value when switching types
                                    };
                                    setEditedStep({
                                      ...editedStep,
                                      conditional_logic: {
                                        ...editedStep.conditional_logic,
                                        conditions: newConditions
                                      }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="static">Static Value</SelectItem>
                                    <SelectItem value="field_reference">Field Reference</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs">
                                {condition.value_type === 'field_reference' ? 'Reference Field' : 'Value'}
                              </Label>
                              {condition.value_type === 'field_reference' ? (
                                <Select
                                  value={condition.value}
                                  onValueChange={(value) => handleConditionChange(index, "value", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue placeholder={isLoadingFields ? "Loading fields..." : "Select field to compare..."} />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px]">
                                    {Object.entries(availableConditionFields.reduce((acc, field) => {
                                      if (!acc[field.group]) acc[field.group] = [];
                                      acc[field.group].push(field);
                                      return acc;
                                    }, {})).map(([group, fields]) => (
                                      <React.Fragment key={`ref-${group}`}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1 first:border-t-0 first:mt-0">
                                          {group}
                                        </div>
                                        {fields.map(field => (
                                          <SelectItem key={`ref-${field.value}`} value={field.value}>
                                            {field.label} {field.isCountry && '🌍'}
                                          </SelectItem>
                                        ))}
                                      </React.Fragment>
                                    ))}
                                    {isLoadingFields && (
                                      <div className="px-2 py-1.5 text-xs text-slate-500 italic">Loading fields...</div>
                                    )}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  type={selectedField?.type === 'number' ? 'number' : 'text'}
                                  value={condition.value}
                                  onChange={(e) => handleConditionChange(index, "value", e.target.value)}
                                  placeholder={condition.operator === 'is_crs' || condition.operator === 'is_not_crs' ? 'N/A (CRS lookup)' : 'value or values'}
                                  className="h-8 text-xs mt-1"
                                  disabled={condition.operator === 'is_crs' || condition.operator === 'is_not_crs'}
                                />
                              )}
                            </div>

                            {index < editedStep.conditional_logic.conditions.length - 1 && (
                              <div>
                                <Label className="text-xs">Logic Operator (with next condition)</Label>
                                <Select
                                  value={condition.logic_operator || "AND"}
                                  onValueChange={(value) => handleConditionChange(index, "logic_operator", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AND">AND</SelectItem>
                                    <SelectItem value="OR">OR</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Then/Else Steps */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-green-700 font-semibold">
                      Then (conditions match)
                    </Label>
                    <Select
                      value={editedStep.conditional_logic?.next_step || ""}
                      onValueChange={(value) => handleConditionalLogicChange("next_step", value)}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1 border-green-300 focus:ring-green-500">
                        <SelectValue placeholder="Select next step..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>None (End)</SelectItem>
                        {allSteps
                          .filter(s => s.step_id !== editedStep.step_id)
                          .map(s => (
                            <SelectItem key={s.step_id} value={s.step_id}>
                              {s.step_title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-red-700 font-semibold">
                      Else (conditions don't match)
                    </Label>
                    <Select
                      value={editedStep.conditional_logic?.else_step || ""}
                      onValueChange={(value) => handleConditionalLogicChange("else_step", value)}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1 border-red-300 focus:ring-red-500">
                        <SelectValue placeholder="Select next step..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>None (End)</SelectItem>
                        {allSteps
                          .filter(s => s.step_id !== editedStep.step_id)
                          .map(s => (
                            <SelectItem key={s.step_id} value={s.step_id}>
                              {s.step_title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Condition Groups Tab (New Multi-Group Logic) */}
              <TabsContent value="groups" className="space-y-4 mt-0">
                <ConditionGroupsBuilder
                  conditionGroups={editedStep.conditional_logic?.condition_groups || []}
                  overallLogicOperator={editedStep.conditional_logic?.overall_logic_operator || "OR"}
                  overallTrueStep={editedStep.conditional_logic?.overall_true_step || ""}
                  overallFalseStep={editedStep.conditional_logic?.overall_false_step || ""}
                  availableConditionFields={availableConditionFields}
                  allSteps={allSteps}
                  currentStepId={editedStep.step_id}
                  onGroupsChange={(groups) => {
                    setEditedStep({
                      ...editedStep,
                      conditional_logic: {
                        ...editedStep.conditional_logic,
                        condition_groups: groups
                      }
                    });
                  }}
                  onOverallOperatorChange={(operator) => {
                    setEditedStep({
                      ...editedStep,
                      conditional_logic: {
                        ...editedStep.conditional_logic,
                        overall_logic_operator: operator
                      }
                    });
                  }}
                  onOverallTrueStepChange={(step) => {
                    setEditedStep({
                      ...editedStep,
                      conditional_logic: {
                        ...editedStep.conditional_logic,
                        overall_true_step: step
                      }
                    });
                  }}
                  onOverallFalseStepChange={(step) => {
                    setEditedStep({
                      ...editedStep,
                      conditional_logic: {
                        ...editedStep.conditional_logic,
                        overall_false_step: step
                      }
                    });
                  }}
                  isLoadingFields={isLoadingFields}
                />
              </TabsContent>
            </Tabs>

            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => {
                setShowAdvancedLogic(false);
                setEditedStep({
                  ...editedStep,
                  conditional_logic: { 
                    conditions: [], 
                    condition_groups: [], 
                    next_step: "", 
                    else_step: "",
                    overall_logic_operator: "OR",
                    overall_true_step: "",
                    overall_false_step: ""
                  }
                });
              }}
              className="w-full text-xs text-slate-600"
            >
              Disable Advanced Logic
            </Button>
          </div>
        )}
      </div>

      {/* Post-Completion Actions */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            Post-Completion Actions
          </Label>
          <Button size="sm" onClick={handleAddAction} variant="outline">
            <Plus className="w-3 h-3 mr-1" />
            Add Action
          </Button>
        </div>
        {(!editedStep.post_completion_actions || editedStep.post_completion_actions.length === 0) ? (
          <p className="text-xs text-slate-500 italic">No actions configured for this step</p>
        ) : (
          <div className="space-y-3">
            {editedStep.post_completion_actions.map((action, index) => {
              const fieldsSchema = getFieldsForEntity(action.target_entity_type);
              const fieldOptions = Object.entries(fieldsSchema).map(([key, val]) => ({
                value: key,
                label: val.label
              }));
              const suggestedValues = action.value_source === "static_value" 
                ? getSuggestedValuesForField(action.target_entity_type, action.field_to_update, referencedData)
                : null;

              return (
                <div key={index} className="p-3 border rounded-lg bg-amber-50 border-amber-200 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="bg-amber-100 text-amber-800">
                      Action {index + 1}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAction(index)}
                      className="h-6 w-6 text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Target Entity</Label>
                        <Select
                          value={action.target_entity_type || "Entity"}
                          onValueChange={(value) => {
                            handleActionChange(index, "target_entity_type", value, { field_to_update: "", value: "" });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue placeholder="Select entity..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Entity">Entity</SelectItem>
                            <SelectItem value="Account">Account</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Field to Update</Label>
                        <Select
                          value={action.field_to_update || ""}
                          onValueChange={(value) => {
                            handleActionChange(index, "field_to_update", value, { value: "" });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue placeholder="Select field..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {fieldOptions.map(opt => (
                              <SelectItem key={`field-${opt.value}`} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-indigo-700">Execution Timing</Label>
                      <Select
                        value={action.execution_timing || "after_step"}
                        onValueChange={(value) => handleActionChange(index, "execution_timing", value)}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="after_step">After This Step (when clicking Next)</SelectItem>
                          <SelectItem value="after_workflow">After Entire Workflow (when completing)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 mt-1">
                        {action.execution_timing === "after_workflow" 
                          ? "⏱️ Updates when the entire workflow is completed" 
                          : "⚡ Updates immediately when user clicks Next on this step"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Value Source</Label>
                        <Select
                          value={action.value_source || "from_step_answer"}
                          onValueChange={(value) => {
                            handleActionChange(index, "value_source", value, { value: "" });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="from_step_answer">From Step Answer</SelectItem>
                            <SelectItem value="static_value">Static Value</SelectItem>
                            <SelectItem value="from_workflow_outcome">From Workflow Outcome</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">
                          {action.value_source === "from_step_answer" ? "Step ID" : "Value"}
                        </Label>
                        {action.value_source === "from_step_answer" ? (
                          <Select
                            value={action.value || ""}
                            onValueChange={(value) => handleActionChange(index, "value", value)}
                          >
                            <SelectTrigger className="h-8 text-xs mt-1">
                              <SelectValue placeholder="Select step..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allSteps.map(s => (
                                <SelectItem key={`step-${s.step_id}`} value={s.step_id}>
                                  {s.step_title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : suggestedValues ? (
                          <Select
                            value={action.value || ""}
                            onValueChange={(value) => handleActionChange(index, "value", value)}
                          >
                            <SelectTrigger className="h-8 text-xs mt-1">
                              <SelectValue placeholder="Select value..." />
                            </SelectTrigger>
                            <SelectContent>
                              {suggestedValues.map(opt => (
                                <SelectItem key={`val-${opt.value}`} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={action.value || ""}
                            onChange={(e) => handleActionChange(index, "value", e.target.value)}
                            placeholder="Enter value..."
                            className="h-8 text-xs mt-1"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mapped Field Configuration */}
      <div className="border-t pt-4">
        <Label className="flex items-center gap-2 mb-2">
          <LinkIcon className="w-4 h-4 text-emerald-600" />
          Map to Entity/Account Field (Optional)
        </Label>
        <p className="text-xs text-slate-600 mb-3">
          Link this question to an entity or account field for pre-filling and automated updates.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Target Entity Type</Label>
            <Select
              value={editedStep.mapped_field?.entity_type || ""}
              onValueChange={(value) => handleMappedFieldChange("entity_type", value)}
            >
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue placeholder="Select entity type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                <SelectItem value="Account">Account</SelectItem>
                <SelectItem value="Entity">Entity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Target Field</Label>
            <Select
              value={editedStep.mapped_field?.field_name || ""}
              onValueChange={(value) => {
                handleMappedFieldChange("field_name", value);
                // Clear prefill_config when field changes
                handleMappedFieldChange("prefill_config", null);
              }}
              disabled={!editedStep.mapped_field?.entity_type}
            >
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {filteredMappedFields.length === 0 ? (
                  <div className="p-2 text-xs text-slate-500 italic">
                    {editedStep.mapped_field?.entity_type ? "No compatible fields for this question type" : "Select entity type first"}
                  </div>
                ) : (
                  filteredMappedFields.map(field => (
                    <SelectItem key={`mapped-field-${field.value}`} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {editedStep.mapped_field?.entity_type && editedStep.mapped_field?.field_name && (
          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
            <LinkIcon className="w-3 h-3" />
            This question will pre-fill from and update: {editedStep.mapped_field.entity_type}.{editedStep.mapped_field.field_name}
          </p>
        )}

        {/* Pre-fill Configuration for Yes/No Questions with Dropdown Fields */}
        {editedStep.question_type === 'yes_no' && 
         editedStep.mapped_field?.entity_type && 
         editedStep.mapped_field?.field_name && (
          <div className="mt-4 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg space-y-3">
            <div>
              <Label className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Smart Pre-fill Rules
              </Label>
              <p className="text-xs text-slate-600 mb-3">
                Automatically pre-fill this Yes/No question based on the mapped field's value
              </p>

              {(() => {
                const selectedMappedField = filteredMappedFields.find(f => f.value === editedStep.mapped_field.field_name);
                const isCountryField = selectedMappedField?.isCountry;
                const dropdownOptions = getSuggestedValuesForField(
                  editedStep.mapped_field.entity_type,
                  editedStep.mapped_field.field_name,
                  referencedData
                );

                if (isCountryField) {
                  // Country field - show CRS option
                  return (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Pre-fill Type</Label>
                        <Select
                          value={editedStep.mapped_field?.prefill_config?.prefill_type || ""}
                          onValueChange={(value) => {
                            handleMappedFieldChange("prefill_config", value ? {
                              prefill_type: value,
                              match_values: []
                            } : null);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue placeholder="Select pre-fill rule..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={null}>No Pre-fill Rule</SelectItem>
                            <SelectItem value="country_crs">YES if CRS Country, NO otherwise 🌍</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {editedStep.mapped_field?.prefill_config?.prefill_type === "country_crs" && (
                        <Alert className="bg-blue-50 border-blue-200">
                          <Info className="w-4 h-4 text-blue-600" />
                          <AlertDescription className="text-xs text-blue-900">
                            When this workflow runs, the question will automatically be pre-filled with:
                            <ul className="list-disc ml-4 mt-1">
                              <li><strong>YES</strong> if the country is a CRS reporting country</li>
                              <li><strong>NO</strong> if the country is not a CRS reporting country</li>
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                } else if (dropdownOptions && dropdownOptions.length > 0) {
                  // Regular dropdown field - show enum_match option
                  return (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Pre-fill Type</Label>
                        <Select
                          value={editedStep.mapped_field?.prefill_config?.prefill_type || ""}
                          onValueChange={(value) => {
                            handleMappedFieldChange("prefill_config", value ? {
                              prefill_type: value,
                              match_values: []
                            } : null);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue placeholder="Select pre-fill rule..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={null}>No Pre-fill Rule</SelectItem>
                            <SelectItem value="enum_match">YES if field value matches specific options</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {editedStep.mapped_field?.prefill_config?.prefill_type === "enum_match" && (
                        <div>
                          <Label className="text-xs mb-2 block">
                            Pre-fill as <strong>YES</strong> when field equals:
                          </Label>
                          <p className="text-xs text-slate-500 mb-2">
                            Select one or more values. If the mapped field matches any of these, pre-fill YES, otherwise NO.
                          </p>
                          <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-white rounded border">
                            {dropdownOptions.map((opt, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Checkbox
                                  id={`prefill-opt-${idx}`}
                                  checked={editedStep.mapped_field?.prefill_config?.match_values?.includes(opt.value) || false}
                                  onCheckedChange={(checked) => {
                                    const currentValues = editedStep.mapped_field?.prefill_config?.match_values || [];
                                    const newValues = checked 
                                      ? [...currentValues, opt.value]
                                      : currentValues.filter(v => v !== opt.value);
                                    handleMappedFieldChange("prefill_config", {
                                      ...editedStep.mapped_field.prefill_config,
                                      match_values: newValues
                                    });
                                  }}
                                />
                                <Label htmlFor={`prefill-opt-${idx}`} className="text-xs cursor-pointer">
                                  {opt.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                          {editedStep.mapped_field?.prefill_config?.match_values?.length > 0 && (
                            <Alert className="bg-blue-50 border-blue-200 mt-3">
                              <Info className="w-4 h-4 text-blue-600" />
                              <AlertDescription className="text-xs text-blue-900">
                                Pre-fill rule: Answer as <strong>YES</strong> if field value is <strong>{editedStep.mapped_field.prefill_config.match_values.join(', ')}</strong>, otherwise <strong>NO</strong>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                    </div>
                  );
                } else {
                  // No dropdown options - not eligible for prefill rules
                  return (
                    <p className="text-xs text-slate-500 italic">
                      Pre-fill rules are only available for dropdown/enum fields
                    </p>
                  );
                }
              })()}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          Save Step
        </Button>
      </div>
    </div>
  );
}