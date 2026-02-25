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
import StepEditorComponent from "./StepEditor";

// Schema definitions for workflow introduction fields
const ACCOUNT_FIELDS_SCHEMA = [
  { value: "account_number", label: "Account Number", type: "string", isCountry: false },
  { value: "account_creation_date", label: "Account Creation Date", type: "date", isCountry: false },
  { value: "account_type", label: "Account Type", type: "string", isCountry: false },
  { value: "account_holder_type", label: "Account Holder Type", type: "string", isCountry: false },
  { value: "account_holder_name", label: "Account Holder Name", type: "string", isCountry: false },
  { value: "is_pre_existing", label: "Is Pre-existing", type: "boolean", isCountry: false },
  { value: "account_holder_is_alive", label: "Account Holder Is Alive", type: "boolean", isCountry: false },
  { value: "year_end_cash_value", label: "Year End Cash Value", type: "number", isCountry: false },
  { value: "gross_payments", label: "Gross Payments", type: "number", isCountry: false },
  { value: "reportability_status", label: "Reportability Status", type: "string", isCountry: false },
  { value: "status", label: "Status", type: "string", isCountry: false }
];

const ENTITY_FIELDS_SCHEMA = [
  { value: "entity_name", label: "Entity Name", type: "string", isCountry: false },
  { value: "entity_type", label: "Entity Type", type: "string", isCountry: false },
  { value: "country_of_incorporation", label: "Country of Incorporation", type: "string", isCountry: true },
  { value: "rfi_status", label: "RFI Status", type: "string", isCountry: false },
  { value: "status", label: "Status", type: "string", isCountry: false }
];

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
  const [displayIntro, setDisplayIntro] = useState(workflow?.display_workflow_introduction || false);
  const [introText, setIntroText] = useState(workflow?.workflow_introduction_text || "");
  const [introFields, setIntroFields] = useState(workflow?.workflow_introduction_fields || []);
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
        // Automatically set use_selection_count to true if any selection count routing is configured
        use_selection_count: !!(
          step.conditional_logic.selection_count_next_step || 
          step.conditional_logic.selection_count_else_step ||
          (step.conditional_logic.selection_count_value !== undefined && step.conditional_logic.selection_count_value !== null)
        ),
        selection_count_operator: step.conditional_logic.selection_count_operator || null,
        selection_count_value: step.conditional_logic.selection_count_value !== undefined ? step.conditional_logic.selection_count_value : null,
        selection_count_next_step: step.conditional_logic.selection_count_next_step || null,
        selection_count_else_step: step.conditional_logic.selection_count_else_step || null,
        option_values: Array.isArray(step.conditional_logic.option_values) && step.conditional_logic.option_values.length > 0 ? step.conditional_logic.option_values : null,
        option_values_next_step: step.conditional_logic.option_values_next_step || null,
        option_values_else_step: step.conditional_logic.option_values_else_step || null,
        multi_choice_routing_groups: step.conditional_logic.multi_choice_routing_groups && step.conditional_logic.multi_choice_routing_groups.length > 0 ? step.conditional_logic.multi_choice_routing_groups : null,
        multi_choice_default_step: step.conditional_logic.multi_choice_default_step || null,
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
      display_workflow_introduction: displayIntro,
      workflow_introduction_text: introText,
      workflow_introduction_fields: introFields,
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

          {/* Workflow Introduction Configuration */}
          <div className="mt-6 pt-6 border-t space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="display_intro"
                checked={displayIntro}
                onCheckedChange={setDisplayIntro}
              />
              <Label htmlFor="display_intro" className="text-sm font-semibold cursor-pointer">
                Show Workflow Introduction
              </Label>
            </div>

            {displayIntro && (
              <div className="space-y-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div>
                  <Label htmlFor="intro_text">Introduction Text</Label>
                  <Textarea
                    id="intro_text"
                    value={introText}
                    onChange={(e) => setIntroText(e.target.value)}
                    placeholder="e.g., This workflow follows CRS due diligence procedures for individual accounts."
                    rows={2}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Dynamic Fields to Display</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIntroFields([...introFields, { field_type: "simple_field", field_name: "", display_label: "", value_formatter: "default" }])}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Field
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIntroFields([...introFields, { field_type: "computed_condition", display_label: "", computation_field_1: "", computation_field_2: "", computation_operator: "add", comparison_operator: "greater_than", threshold_value: 0, true_text: "", false_text: "" }])}
                        className="bg-purple-50 text-purple-700 border-purple-300"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        Add Computed Condition
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Select fields from Account/Entity to show in the introduction (e.g., Account Type, Holder Status)
                  </p>

                  {introFields.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-3 bg-white rounded border">
                      No fields configured. Add fields to display dynamic information.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {introFields.map((field, idx) => {
                        const isComputedCondition = field.field_type === "computed_condition";
                        
                        return (
                          <div key={idx} className={`p-3 border rounded-lg space-y-3 ${isComputedCondition ? 'bg-purple-50 border-purple-300' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-xs ${isComputedCondition ? 'bg-purple-100 text-purple-800' : ''}`}>
                                  {isComputedCondition ? 'Computed' : 'Field'} {idx + 1}
                                </Badge>
                                <Select
                                  value={field.field_type || "simple_field"}
                                  onValueChange={(value) => {
                                    const newFields = [...introFields];
                                    if (value === "computed_condition") {
                                      newFields[idx] = {
                                        field_type: "computed_condition",
                                        display_label: field.display_label || "",
                                        computation_field_1: "",
                                        computation_field_2: "",
                                        computation_operator: "add",
                                        comparison_operator: "greater_than",
                                        threshold_value: 0,
                                        true_text: "",
                                        false_text: ""
                                      };
                                    } else {
                                      newFields[idx] = {
                                        field_type: "simple_field",
                                        field_name: "",
                                        display_label: field.display_label || "",
                                        value_formatter: "default"
                                      };
                                    }
                                    setIntroFields(newFields);
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="simple_field">Simple Field</SelectItem>
                                    <SelectItem value="computed_condition">Computed Condition</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setIntroFields(introFields.filter((_, i) => i !== idx))}
                                className="h-6 w-6 text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>

                            {isComputedCondition ? (
                              /* Computed Condition Configuration */
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs">Label (Optional)</Label>
                                  <Input
                                    value={field.display_label}
                                    onChange={(e) => {
                                      const newFields = [...introFields];
                                      newFields[idx] = { ...newFields[idx], display_label: e.target.value };
                                      setIntroFields(newFields);
                                    }}
                                    placeholder="e.g., Reporting Threshold Check"
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>

                                <div className="grid grid-cols-5 gap-2 items-end">
                                  <div className="col-span-2">
                                    <Label className="text-xs">Field 1</Label>
                                    <Select
                                      value={field.computation_field_1}
                                      onValueChange={(value) => {
                                        const newFields = [...introFields];
                                        newFields[idx] = { ...newFields[idx], computation_field_1: value };
                                        setIntroFields(newFields);
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs mt-1">
                                        <SelectValue placeholder="Select..." />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[200px]">
                                        <div className="px-2 py-1 text-xs font-semibold text-slate-500">Account</div>
                                        {ACCOUNT_FIELDS_SCHEMA.filter(f => f.type === "number").map(f => (
                                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                        ))}
                                        <div className="px-2 py-1 text-xs font-semibold text-slate-500 border-t mt-1">Entity</div>
                                        {ENTITY_FIELDS_SCHEMA.filter(f => f.type === "number").map(f => (
                                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Select
                                      value={field.computation_operator || "add"}
                                      onValueChange={(value) => {
                                        const newFields = [...introFields];
                                        newFields[idx] = { ...newFields[idx], computation_operator: value };
                                        setIntroFields(newFields);
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="add">+</SelectItem>
                                        <SelectItem value="subtract">−</SelectItem>
                                        <SelectItem value="multiply">×</SelectItem>
                                        <SelectItem value="divide">÷</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="col-span-2">
                                    <Label className="text-xs">Field 2</Label>
                                    <Select
                                      value={field.computation_field_2}
                                      onValueChange={(value) => {
                                        const newFields = [...introFields];
                                        newFields[idx] = { ...newFields[idx], computation_field_2: value };
                                        setIntroFields(newFields);
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs mt-1">
                                        <SelectValue placeholder="Select..." />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[200px]">
                                        <div className="px-2 py-1 text-xs font-semibold text-slate-500">Account</div>
                                        {ACCOUNT_FIELDS_SCHEMA.filter(f => f.type === "number").map(f => (
                                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                        ))}
                                        <div className="px-2 py-1 text-xs font-semibold text-slate-500 border-t mt-1">Entity</div>
                                        {ENTITY_FIELDS_SCHEMA.filter(f => f.type === "number").map(f => (
                                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">Comparison</Label>
                                    <Select
                                      value={field.comparison_operator || "greater_than"}
                                      onValueChange={(value) => {
                                        const newFields = [...introFields];
                                        newFields[idx] = { ...newFields[idx], comparison_operator: value };
                                        setIntroFields(newFields);
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="greater_than">&gt;</SelectItem>
                                        <SelectItem value="less_than">&lt;</SelectItem>
                                        <SelectItem value="equals">=</SelectItem>
                                        <SelectItem value="greater_than_or_equal">≥</SelectItem>
                                        <SelectItem value="less_than_or_equal">≤</SelectItem>
                                        <SelectItem value="not_equals">≠</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="col-span-2">
                                    <Label className="text-xs">Threshold Value</Label>
                                    <Input
                                      type="number"
                                      value={field.threshold_value || 0}
                                      onChange={(e) => {
                                        const newFields = [...introFields];
                                        newFields[idx] = { ...newFields[idx], threshold_value: Number(e.target.value) };
                                        setIntroFields(newFields);
                                      }}
                                      placeholder="e.g., 250000"
                                      className="h-8 text-xs mt-1"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <Label className="text-xs text-green-700">Text when TRUE</Label>
                                  <Textarea
                                    value={field.true_text || ""}
                                    onChange={(e) => {
                                      const newFields = [...introFields];
                                      newFields[idx] = { ...newFields[idx], true_text: e.target.value };
                                      setIntroFields(newFields);
                                    }}
                                    placeholder="e.g., Account value exceeds reporting threshold"
                                    rows={2}
                                    className="text-xs mt-1"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs text-red-700">Text when FALSE</Label>
                                  <Textarea
                                    value={field.false_text || ""}
                                    onChange={(e) => {
                                      const newFields = [...introFields];
                                      newFields[idx] = { ...newFields[idx], false_text: e.target.value };
                                      setIntroFields(newFields);
                                    }}
                                    placeholder="e.g., Account value is below reporting threshold"
                                    rows={2}
                                    className="text-xs mt-1"
                                  />
                                </div>
                              </div>
                            ) : (
                              /* Simple Field Configuration */
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">Field Name</Label>
                                  <Select
                                    value={field.field_name}
                                    onValueChange={(value) => {
                                      const newFields = [...introFields];
                                      const allFields = [...ACCOUNT_FIELDS_SCHEMA, ...ENTITY_FIELDS_SCHEMA];
                                      const selectedField = allFields.find(f => f.value === value);
                                      newFields[idx] = { 
                                        ...newFields[idx], 
                                        field_name: value,
                                        display_label: newFields[idx].display_label || selectedField?.label || ""
                                      };
                                      setIntroFields(newFields);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs mt-1">
                                      <SelectValue placeholder="Select field..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[250px]">
                                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                                        Account Fields
                                      </div>
                                      {ACCOUNT_FIELDS_SCHEMA.map(f => (
                                        <SelectItem key={f.value} value={f.value}>
                                          {f.label}
                                        </SelectItem>
                                      ))}
                                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1">
                                        Entity Fields
                                      </div>
                                      {ENTITY_FIELDS_SCHEMA.map(f => (
                                        <SelectItem key={f.value} value={f.value}>
                                          {f.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Display Label</Label>
                                  <Input
                                    value={field.display_label}
                                    onChange={(e) => {
                                      const newFields = [...introFields];
                                      newFields[idx] = { ...newFields[idx], display_label: e.target.value };
                                      setIntroFields(newFields);
                                    }}
                                    placeholder="e.g., Account Type"
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Format</Label>
                                  <Select
                                    value={field.value_formatter || "default"}
                                    onValueChange={(value) => {
                                      const newFields = [...introFields];
                                      newFields[idx] = { ...newFields[idx], value_formatter: value };
                                      setIntroFields(newFields);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="default">Default</SelectItem>
                                      <SelectItem value="boolean_alive_deceased">Alive/Deceased</SelectItem>
                                      <SelectItem value="pre_existing_new">Pre-existing/New</SelectItem>
                                      <SelectItem value="capitalize">Capitalize</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
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
            <StepEditorComponent
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