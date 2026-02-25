import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Save,
  Link as LinkIcon,
  HelpCircle,
  Zap,
  Sparkles,
  Info
} from "lucide-react";
import MultiFieldEditor from "./MultiFieldEditor";
import ConditionGroupsBuilder from "./ConditionGroupsBuilder";
import MultiChoiceRoutingBuilder from "./MultiChoiceRoutingBuilder";
import SelectionCountBranching from "./SelectionCountBranching";

// Helper function to determine the field type of a workflow question
const getQuestionFieldType = (questionType) => {
  switch (questionType) {
    case 'yes_no': return 'boolean';
    case 'text_input':
    case 'single_choice':
    case 'multiple_choice': return 'string'; 
    case 'number_input': return 'number';
    case 'date_input': return 'date';
    case 'address_input': return 'object';
    default: return null;
  }
};

const ACCOUNT_FIELDS_SCHEMA = [
  { value: "account_number", label: "Account Number", type: "string", isCountry: false, group: "Account Fields" },
  { value: "account_creation_date", label: "Account Creation Date", type: "date", isCountry: false, group: "Account Fields" },
  { value: "account_type", label: "Account Type", type: "string", isCountry: false, group: "Account Fields" },
  { value: "account_holder_type", label: "Account Holder Type", type: "string", isCountry: false, group: "Account Fields" },
  { value: "account_holder_name", label: "Account Holder Name", type: "string", isCountry: false, group: "Account Fields" },
  { value: "date_of_birth", label: "Date of Birth", type: "date", isCountry: false, group: "Account Fields" },
  { value: "place_of_birth", label: "Place of Birth", type: "string", isCountry: true, group: "Account Fields" },
  { value: "is_pre_existing", label: "Is Pre-existing", type: "boolean", isCountry: false, group: "Account Fields" },
  { value: "account_holder_is_alive", label: "Account Holder Is Alive", type: "boolean", isCountry: false, group: "Account Fields" },
  { value: "current_address", label: "Current Address (Object)", type: "object", isCountry: false, group: "Account Fields" },
  { value: "current_address.country", label: "Current Address Country", type: "string", isCountry: true, group: "Account Fields" },
  { value: "account_holder_address", label: "Account Holder Address (Object)", type: "object", isCountry: false, group: "Account Fields" },
  { value: "account_holder_address.country", label: "Account Holder Address Country", type: "string", isCountry: true, group: "Account Fields" },
  { value: "year_end_cash_value", label: "Year End Cash Value", type: "number", isCountry: false, group: "Account Fields" },
  { value: "gross_payments", label: "Gross Payments", type: "number", isCountry: false, group: "Account Fields" },
  { value: "reportability_status", label: "Reportability Status", type: "string", isCountry: false, group: "Account Fields" },
  { value: "status", label: "Status", type: "string", isCountry: false, group: "Account Fields" }
];

const ENTITY_FIELDS_SCHEMA = [
  { value: "entity_name", label: "Entity Name", type: "string", isCountry: false, group: "Entity Fields" },
  { value: "entity_type", label: "Entity Type", type: "string", isCountry: false, group: "Entity Fields" },
  { value: "country_of_incorporation", label: "Country of Incorporation", type: "string", isCountry: true, group: "Entity Fields" },
  { value: "rfi_status", label: "RFI Status", type: "string", isCountry: false, group: "Entity Fields" },
  { value: "status", label: "Status", type: "string", isCountry: false, group: "Entity Fields" }
];

const getFieldsForEntity = (entityType) => {
  let schema;
  switch (entityType) {
    case "Entity":
      schema = ENTITY_FIELDS_SCHEMA;
      break;
    case "Account":
      schema = ACCOUNT_FIELDS_SCHEMA;
      break;
    default:
      schema = ACCOUNT_FIELDS_SCHEMA;
  }
  return schema.reduce((acc, field) => {
    acc[field.value] = { label: field.label, type: field.type };
    return acc;
  }, {});
};

const getSuggestedValuesForField = (entityType, fieldName, referencedDataList = []) => {
  const referencedOptions = referencedDataList.filter(rd => 
    rd.entity_name === entityType && rd.field_name === fieldName
  );
  
  if (referencedOptions.length > 0) {
    return referencedOptions
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(rd => ({ value: rd.value, label: rd.label }));
  }

  const schema = getFieldsForEntity(entityType);
  const field = schema[fieldName];
  if (field?.type === "boolean") {
    return [{ value: "true", label: "True" }, { value: "false", label: "False" }];
  }
  return null;
};

export default function StepEditor({ step, allSteps, onUpdate, onClose }) {
  const normalizedConditionalLogic = step.conditional_logic ? {
    ...step.conditional_logic,
    conditions: (step.conditional_logic.conditions || []).map(c => ({
      ...c,
      value_type: c.value_type || "static"
    })),
    option_values: Array.isArray(step.conditional_logic.option_values) ? step.conditional_logic.option_values : []
  } : { conditions: [], next_step: "", else_step: "", option_values: [] };

  const [editedStep, setEditedStep] = useState({ 
    ...step,
    default_next_step: step.default_next_step || "",
    conditional_logic: normalizedConditionalLogic,
    mapped_field: step.mapped_field || { entity_type: "", field_name: "" }
  });
  const [showAdvancedLogic, setShowAdvancedLogic] = useState(
    step.conditional_logic?.conditions?.length > 0
  );

  const { data: referencedData = [] } = useQuery({
    queryKey: ['referenced-data-workflow-builder'],
    queryFn: () => base44.entities.ReferencedData.filter({ is_published: true }),
    staleTime: 60000
  });

  const accountFields = React.useMemo(() => ACCOUNT_FIELDS_SCHEMA, []);
  const entityFields = React.useMemo(() => ENTITY_FIELDS_SCHEMA, []);

  const availableConditionFields = React.useMemo(() => {
    const fields = [];
    const currentStepIndex = allSteps.findIndex(s => s.step_id === editedStep.step_id);

    allSteps.forEach((s, idx) => {
      if (idx > currentStepIndex) return;
      
      fields.push({
        value: s.step_id,
        label: `Step: ${s.step_title}`,
        type: s.question_type,
        isCountry: false,
        group: 'Workflow Steps'
      });

      if (s.question_type === 'multi_field_input' && s.multi_fields?.length > 0) {
        s.multi_fields.forEach(mf => {
          fields.push({
            value: `${s.step_id}.${mf.field_id}`,
            label: `${s.step_title} → ${mf.display_label}`,
            type: mf.field_type,
            isCountry: false,
            group: 'Multi-Field Inputs'
          });
        });
      }
    });

    accountFields.forEach(field => fields.push(field));
    entityFields.forEach(field => fields.push(field));

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
      options: [...editedStep.options, { value: "", label: "", next_step: "" }]
    });
  };

  const handleRemoveOption = (index) => {
    const newOptions = editedStep.options.filter((_, i) => i !== index);
    setEditedStep({ ...editedStep, options: newOptions });
  };

  const handleConditionalLogicChange = (field, value) => {
    console.log(`[StepEditor] handleConditionalLogicChange: ${field} = ${JSON.stringify(value)}`);
    setEditedStep(prev => ({
      ...prev,
      conditional_logic: {
        ...prev.conditional_logic,
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    // CRITICAL FIX: Default selection_count_operator to "=" if using selection count but operator is null
    const finalConditionalLogic = { ...editedStep.conditional_logic };
    
    // Auto-detect if selection count is being used
    const hasSelectionCountConfig = !!(
      finalConditionalLogic.selection_count_next_step || 
      finalConditionalLogic.selection_count_else_step ||
      (finalConditionalLogic.selection_count_value !== undefined && finalConditionalLogic.selection_count_value !== null)
    );
    
    if (hasSelectionCountConfig) {
      // Ensure use_selection_count is true
      finalConditionalLogic.use_selection_count = true;
      
      // Default operator to "=" if not set
      if (!finalConditionalLogic.selection_count_operator) {
        console.log(`[StepEditor] 🔧 FIXING: Selection count configured but operator is null, defaulting to "="`);
        finalConditionalLogic.selection_count_operator = "=";
      }
    }
    
    const finalStep = {
      ...editedStep,
      conditional_logic: finalConditionalLogic
    };
    
    console.log(`[StepEditor] 🔥 SAVING STEP ${finalStep.step_id}:`, {
      selection_count_operator: finalStep.conditional_logic?.selection_count_operator,
      selection_count_value: finalStep.conditional_logic?.selection_count_value,
      selection_count_next_step: finalStep.conditional_logic?.selection_count_next_step,
      selection_count_else_step: finalStep.conditional_logic?.selection_count_else_step,
      use_selection_count: finalStep.conditional_logic?.use_selection_count
    });
    onUpdate(finalStep);
    onClose();
  };

  const filteredMappedFields = React.useMemo(() => {
    if (!editedStep.mapped_field?.entity_type) return [];
    const allFields = editedStep.mapped_field.entity_type === "Account" ? accountFields : entityFields;
    const questionFieldType = getQuestionFieldType(editedStep.question_type);
    if (!questionFieldType) return [];

    return allFields.filter(field => {
      if (editedStep.question_type === 'address_input') {
        return field.type === 'object';
      }
      if (editedStep.question_type === 'yes_no') {
        if (field.isCountry) return true;
        const hasDropdownOptions = getSuggestedValuesForField(
          editedStep.mapped_field.entity_type,
          field.value,
          referencedData
        );
        if (hasDropdownOptions && hasDropdownOptions.length > 0) return true;
      }
      return field.type === questionFieldType;
    });
  }, [editedStep.mapped_field?.entity_type, editedStep.question_type, accountFields, entityFields, referencedData]);

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
            <SelectItem value="multi_field_input">Multi-Field Input</SelectItem>
            <SelectItem value="info">Info (Display Only)</SelectItem>
            <SelectItem value="result">Result (End Step)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Multi-Field Input Configuration */}
      {editedStep.question_type === "multi_field_input" && (
        <div className="border-t pt-4">
          <MultiFieldEditor
            fields={editedStep.multi_fields || []}
            onChange={(fields) => setEditedStep({ ...editedStep, multi_fields: fields })}
          />
        </div>
      )}

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

      {/* Next Step for input types */}
      {(editedStep.question_type === "text_input" || 
        editedStep.question_type === "multi_field_input") && (
        <div className="p-4 border rounded-lg bg-slate-50">
          <Label className="text-sm font-medium">Next Step (after input):</Label>
          <Select
            value={editedStep.default_next_step || ""}
            onValueChange={(value) => handleChange("default_next_step", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select next step..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None (End Workflow)</SelectItem>
              {allSteps.filter(s => s.step_id !== editedStep.step_id).map(s => (
                <SelectItem key={s.step_id} value={s.step_id}>{s.step_title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Advanced Conditional Logic */}
      <div className="border-t pt-4">
        <Label className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-purple-600" />
          Advanced Conditional Logic
        </Label>

        {!showAdvancedLogic ? (
          <Button size="sm" variant="outline" onClick={() => setShowAdvancedLogic(true)} className="w-full">
            <Plus className="w-3 h-3 mr-1" />
            Enable Advanced Logic
          </Button>
        ) : (
          <div className="space-y-4 p-4 border-2 border-purple-100 rounded-lg bg-purple-50/30">
            {/* Multiple Choice Branching */}
            {editedStep.question_type === "multiple_choice" && (
              <div className="bg-white p-3 rounded border border-blue-200">
                <Label className="text-xs font-semibold text-blue-700 mb-2 block">
                  Multiple Choice Branching
                </Label>
                <Tabs defaultValue="count" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-3">
                    <TabsTrigger value="count" className="text-xs">
                      By Selection Count
                    </TabsTrigger>
                    <TabsTrigger value="routing-groups" className="text-xs">
                      Routing Groups
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="count" className="space-y-3 mt-0">
                    <SelectionCountBranching
                      conditionalLogic={editedStep.conditional_logic}
                      allSteps={allSteps}
                      currentStepId={editedStep.step_id}
                      optionsCount={editedStep.options?.length || 0}
                      onConditionalLogicChange={handleConditionalLogicChange}
                    />
                  </TabsContent>

                  <TabsContent value="routing-groups" className="space-y-3 mt-0">
                    <MultiChoiceRoutingBuilder
                      routingGroups={editedStep.conditional_logic?.multi_choice_routing_groups || []}
                      defaultStep={editedStep.conditional_logic?.multi_choice_default_step || ""}
                      availableOptions={editedStep.options || []}
                      allSteps={allSteps}
                      currentStepId={editedStep.step_id}
                      availableConditionFields={availableConditionFields}
                      onGroupsChange={(groups) => handleConditionalLogicChange("multi_choice_routing_groups", groups)}
                      onDefaultStepChange={(step) => handleConditionalLogicChange("multi_choice_default_step", step)}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          Save Step
        </Button>
      </div>
    </div>
  );
}