import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Zap
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MultiFieldEditor from "./MultiFieldEditor";

export default function WorkflowDragDropBuilder({ workflow, onSave, onCancel }) {
  // Ensure all steps have default_next_step initialized from saved data
  const initialSteps = (workflow?.steps || []).map(step => ({
    ...step,
    default_next_step: step.default_next_step || ""
  }));
  const [steps, setSteps] = useState(initialSteps);
  const [selectedStep, setSelectedStep] = useState(null);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [workflowName, setWorkflowName] = useState(workflow?.workflow_name || "");
  const [workflowType, setWorkflowType] = useState(workflow?.workflow_type || "custom");

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
    setSteps(steps.map(s => s.step_id === updatedStep.step_id ? updatedStep : s));
    setSelectedStep(updatedStep);
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

  const handleSave = () => {
    const workflowData = {
      ...workflow,
      workflow_name: workflowName,
      workflow_type: workflowType,
      steps: steps,
      last_modified_by: "current_user"
    };
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Workflow Steps ({steps.length})</CardTitle>
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Save className="w-4 h-4 mr-2" />
                    Save Workflow
                  </Button>
                  <Button onClick={onCancel} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
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

// Helper to generate field paths from schema
const generateFieldPaths = (schema, prefix = '') => {
  const paths = [];
  
  console.log('generateFieldPaths called with:', { schema, prefix });
  
  if (!schema) {
    console.log('No schema provided');
    return paths;
  }
  
  // Handle both direct properties and nested schema structure
  const properties = schema.properties || schema;
  
  if (!properties || typeof properties !== 'object') {
    console.log('No properties found in schema');
    return paths;
  }
  
  Object.keys(properties).forEach(key => {
    const field = properties[key];
    const fullPath = prefix ? `${prefix}.${key}` : key;
    
    // Add the field itself
    paths.push({
      value: fullPath,
      label: fullPath,
      type: field.type,
      isCountry: key.includes('country') || key === 'place_of_birth' || key === 'country_of_residence'
    });
    
    // If it's an object with nested properties, recurse
    if (field.type === 'object' && field.properties) {
      paths.push(...generateFieldPaths(field, fullPath));
    }
  });
  
  console.log('Generated paths:', paths);
  return paths;
};

// Step Editor Component
function StepEditor({ step, allSteps, onUpdate, onClose }) {
  const [editedStep, setEditedStep] = useState({ 
    ...step,
    default_next_step: step.default_next_step || "",
    conditional_logic: step.conditional_logic || { conditions: [], next_step: "", else_step: "" }
  });
  const [showAdvancedLogic, setShowAdvancedLogic] = useState(
    step.conditional_logic?.conditions?.length > 0
  );

  // Load Account and Entity schemas directly
  const [isLoadingFields, setIsLoadingFields] = React.useState(false);

  // Account schema fields
  const accountFields = React.useMemo(() => {
    return [
      { value: "account_number", label: "Account Number", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_type", label: "Account Type", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_holder_type", label: "Account Holder Type", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_holder_name", label: "Account Holder Name", type: "string", isCountry: false, group: "Account Fields" },
      { value: "date_of_birth", label: "Date of Birth", type: "string", isCountry: false, group: "Account Fields" },
      { value: "place_of_birth", label: "Place of Birth", type: "string", isCountry: true, group: "Account Fields" },
      { value: "is_pre_existing", label: "Is Pre-existing", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "account_holder_is_alive", label: "Account Holder Is Alive", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "account_closed_during_period", label: "Account Closed During Period", type: "boolean", isCountry: false, group: "Account Fields" },
      { value: "country_of_residence", label: "Country of Residence", type: "string", isCountry: true, group: "Account Fields" },
      { value: "year_end_cash_value", label: "Year End Cash Value", type: "number", isCountry: false, group: "Account Fields" },
      { value: "gross_payments", label: "Gross Payments", type: "number", isCountry: false, group: "Account Fields" },
      { value: "reportability_status", label: "Reportability Status", type: "string", isCountry: false, group: "Account Fields" },
      { value: "account_holder_address.country", label: "Account Holder Address Country", type: "string", isCountry: true, group: "Account Fields" },
      { value: "current_address.country", label: "Current Address Country", type: "string", isCountry: true, group: "Account Fields" },
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
      { value: "address.country", label: "Address Country", type: "string", isCountry: true, group: "Entity Fields" },
      { value: "status", label: "Status", type: "string", isCountry: false, group: "Entity Fields" },
    ];
  }, []);

  // Generate consolidated available condition fields including multi-field sub-fields from previous steps
  const availableConditionFields = React.useMemo(() => {
    const fields = [];
    const currentStepIndex = allSteps.findIndex(s => s.step_id === editedStep.step_id);

    // 1. Add answers from all workflow steps (including current step for self-referencing address fields)
    allSteps.forEach((s, idx) => {
      // Skip steps that come after the current step (except for address_input which we want to include for current step)
      if (idx > currentStepIndex && s.question_type !== 'address_input') return;
      // For the current step itself, only include if it's an address_input (for self-referencing)
      if (idx === currentStepIndex && s.question_type !== 'address_input') return;
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

  const handleActionChange = (index, field, value) => {
    const newActions = [...editedStep.post_completion_actions];
    newActions[index] = { ...newActions[index], [field]: value };
    setEditedStep({ ...editedStep, post_completion_actions: newActions });
  };

  const handleAddCondition = () => {
    const newConditions = [
      ...(editedStep.conditional_logic?.conditions || []),
      { field: "", operator: "=", value: "", logic_operator: "AND" }
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
    newConditions[index] = { ...newConditions[index], [field]: value };
    
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

  const handleSave = () => {
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
        editedStep.question_type === "address_input") && (
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

            {/* Selection Count Condition for Multiple Choice */}
            {editedStep.question_type === "multiple_choice" && (
              <div className="bg-white p-3 rounded border border-blue-200">
                <Label className="text-xs font-semibold text-blue-700 mb-2 block">
                  Selection Count Branching (for Multiple Choice)
                </Label>
                <p className="text-xs text-slate-600 mb-3">
                  Navigate based on how many options the user selects
                </p>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={editedStep.conditional_logic?.use_selection_count || false}
                    onCheckedChange={(checked) => handleConditionalLogicChange("use_selection_count", checked)}
                    id="use-selection-count"
                  />
                  <Label htmlFor="use-selection-count" className="text-xs cursor-pointer">
                    Enable selection count branching
                  </Label>
                </div>
                
                {editedStep.conditional_logic?.use_selection_count && (
                  <div className="mt-3 space-y-3">
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
                    
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
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
                )}
              </div>
            )}

            {/* Conditions */}
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

                    // Group fields by their group property
                    const groupedFields = availableConditionFields.reduce((acc, field) => {
                      if (!acc[field.group]) acc[field.group] = [];
                      acc[field.group].push(field);
                      return acc;
                    }, {});

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
                                {Object.entries(groupedFields).map(([group, fields]) => (
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
                            <RadioGroup
                              value={condition.value_type || 'static'}
                              onValueChange={(value) => handleConditionChange(index, "value_type", value)}
                              className="flex gap-2 mt-1"
                            >
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="static" id={`static-${index}`} className="h-3 w-3" />
                                <Label htmlFor={`static-${index}`} className="text-xs font-normal cursor-pointer">
                                  Static
                                </Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="field_reference" id={`field-${index}`} className="h-3 w-3" />
                                <Label htmlFor={`field-${index}`} className="text-xs font-normal cursor-pointer">
                                  Field
                                </Label>
                              </div>
                            </RadioGroup>
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
                                {Object.entries(groupedFields).map(([group, fields]) => (
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

            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => {
                setShowAdvancedLogic(false);
                setEditedStep({
                  ...editedStep,
                  conditional_logic: { conditions: [], next_step: "", else_step: "" }
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
            {editedStep.post_completion_actions.map((action, index) => (
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Target Entity</Label>
                    <Select
                      value={action.target_entity_type}
                      onValueChange={(value) => handleActionChange(index, "target_entity_type", value)}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Entity">Entity</SelectItem>
                        <SelectItem value="Account">Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Field to Update</Label>
                    <Input
                      value={action.field_to_update}
                      onChange={(e) => handleActionChange(index, "field_to_update", e.target.value)}
                      placeholder="e.g., fi_type, rfi_status"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Value Source</Label>
                    <Select
                      value={action.value_source}
                      onValueChange={(value) => handleActionChange(index, "value_source", value)}
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
                    <Input
                      value={action.value}
                      onChange={(e) => handleActionChange(index, "value", e.target.value)}
                      placeholder={action.value_source === "from_step_answer" ? "step_id" : "value"}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
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