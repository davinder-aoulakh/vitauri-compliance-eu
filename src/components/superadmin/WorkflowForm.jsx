import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { XCircle, Save, Plus, Trash2, MoveUp, MoveDown, Zap, GitBranch } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ConditionalLogicBuilder from "../workflows/ConditionalLogicBuilder";

export default function WorkflowForm({ workflow, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(workflow || {
    workflow_name: "",
    workflow_type: "entity_rfi_classification",
    version: "1.0",
    status: "draft",
    jurisdiction: "",
    steps: []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addStep = () => {
    const newStep = {
      step_id: `step_${Date.now()}`,
      step_title: "",
      step_description: "",
      question_text: "",
      question_type: "yes_no",
      options: [
        { value: "yes", label: "Yes", next_step: "" },
        { value: "no", label: "No", next_step: "" }
      ],
      help_text: "",
      regulatory_reference: "",
      required: true,
      post_completion_actions: []
    };
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  const removeStep = (index) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const moveStep = (index, direction) => {
    const newSteps = [...formData.steps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const addOption = (stepIndex) => {
    const newSteps = [...formData.steps];
    const currentOptions = newSteps[stepIndex].options || [];
    newSteps[stepIndex].options = [
      ...currentOptions,
      { value: "", label: "", next_step: "" }
    ];
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const removeOption = (stepIndex, optionIndex) => {
    const newSteps = [...formData.steps];
    newSteps[stepIndex].options = newSteps[stepIndex].options.filter((_, i) => i !== optionIndex);
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const updateOption = (stepIndex, optionIndex, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[stepIndex].options[optionIndex] = {
      ...newSteps[stepIndex].options[optionIndex],
      [field]: value
    };
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const addAction = (stepIndex) => {
    const newSteps = [...formData.steps];
    const currentActions = newSteps[stepIndex].post_completion_actions || [];
    newSteps[stepIndex].post_completion_actions = [
      ...currentActions,
      {
        action_type: "update_entity_field",
        target_entity_type: "Entity",
        field_to_update: "",
        value_source: "from_step_answer",
        value: ""
      }
    ];
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const removeAction = (stepIndex, actionIndex) => {
    const newSteps = [...formData.steps];
    newSteps[stepIndex].post_completion_actions = newSteps[stepIndex].post_completion_actions.filter((_, i) => i !== actionIndex);
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const updateAction = (stepIndex, actionIndex, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[stepIndex].post_completion_actions[actionIndex] = {
      ...newSteps[stepIndex].post_completion_actions[actionIndex],
      [field]: value
    };
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workflow Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="workflow_name">Workflow Name *</Label>
              <Input
                id="workflow_name"
                value={formData.workflow_name}
                onChange={(e) => handleChange("workflow_name", e.target.value)}
                placeholder="e.g., Entity RFI Classification 2024"
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="workflow_type">Workflow Type *</Label>
              <Select
                value={formData.workflow_type}
                onValueChange={(value) => handleChange("workflow_type", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entity_rfi_classification">Entity RFI Classification</SelectItem>
                  <SelectItem value="account_reportability">Account Reportability</SelectItem>
                  <SelectItem value="custom">Custom Workflow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => handleChange("version", e.target.value)}
                placeholder="1.0"
                className="mt-1.5"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="jurisdiction">Jurisdiction (optional)</Label>
              <Input
                id="jurisdiction"
                value={formData.jurisdiction}
                onChange={(e) => handleChange("jurisdiction", e.target.value)}
                placeholder="Leave blank for global, or specify e.g., 'United States'"
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Questionnaire Steps</h3>
          <Button type="button" onClick={addStep} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Step
          </Button>
        </div>

        {formData.steps.length === 0 ? (
          <Alert>
            <AlertDescription>
              No steps defined yet. Click "Add Step" to create your first question.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {formData.steps.map((step, stepIndex) => (
              <Card key={step.step_id} className="border-2">
                <CardHeader className="bg-slate-50 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">Step {stepIndex + 1}</Badge>
                      <span className="font-semibold text-slate-900">
                        {step.step_title || "Untitled Step"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveStep(stepIndex, "up")}
                        disabled={stepIndex === 0}
                      >
                        <MoveUp className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveStep(stepIndex, "down")}
                        disabled={stepIndex === formData.steps.length - 1}
                      >
                        <MoveDown className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStep(stepIndex)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <Label>Step Title *</Label>
                    <Input
                      value={step.step_title}
                      onChange={(e) => updateStep(stepIndex, "step_title", e.target.value)}
                      placeholder="e.g., Financial Institution Check"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label>Question Text *</Label>
                    <Textarea
                      value={step.question_text}
                      onChange={(e) => updateStep(stepIndex, "question_text", e.target.value)}
                      placeholder="e.g., Is this entity a Financial Institution?"
                      className="mt-1.5"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Help Text</Label>
                    <Textarea
                      value={step.help_text}
                      onChange={(e) => updateStep(stepIndex, "help_text", e.target.value)}
                      placeholder="Additional guidance for users..."
                      className="mt-1.5"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Question Type</Label>
                    <Select
                      value={step.question_type}
                      onValueChange={(value) => updateStep(stepIndex, "question_type", value)}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes_no">Yes/No</SelectItem>
                        <SelectItem value="single_choice">Single Choice</SelectItem>
                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                        <SelectItem value="text_input">Text Input</SelectItem>
                        <SelectItem value="date_input">Date Input</SelectItem>
                        <SelectItem value="file_upload">File Upload</SelectItem>
                        <SelectItem value="address_input">Address Input</SelectItem>
                        <SelectItem value="beneficiary_input">Beneficiary Input</SelectItem>
                        <SelectItem value="controlling_person_input">Controlling Person Input</SelectItem>
                        <SelectItem value="result">Result (End Step)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(step.question_type === "yes_no" || step.question_type === "single_choice" || step.question_type === "multiple_choice") && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label>Answer Options</Label>
                        {step.question_type !== "yes_no" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOption(stepIndex)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Option
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {step.options?.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex gap-2 items-start p-3 border rounded-lg bg-slate-50">
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <Input
                                value={option.value}
                                onChange={(e) => updateOption(stepIndex, optionIndex, "value", e.target.value)}
                                placeholder="Value (e.g., yes)"
                                size="sm"
                              />
                              <Input
                                value={option.label}
                                onChange={(e) => updateOption(stepIndex, optionIndex, "label", e.target.value)}
                                placeholder="Label (e.g., Yes)"
                                size="sm"
                              />
                              <div className="col-span-2">
                                <Input
                                  value={option.next_step}
                                  onChange={(e) => updateOption(stepIndex, optionIndex, "next_step", e.target.value)}
                                  placeholder="Next step ID or leave empty if using conditional logic"
                                  size="sm"
                                />
                              </div>
                            </div>
                            {step.question_type !== "yes_no" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOption(stepIndex, optionIndex)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Advanced Conditional Logic */}
                  <div className="border-t pt-4">
                    <details className="group">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900">
                          <GitBranch className="w-4 h-4" />
                          <span>Advanced Conditional Logic (Multi-Condition Branching)</span>
                          <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700">
                            {step.conditional_logic?.conditions?.length || 0} conditions
                          </Badge>
                        </div>
                      </summary>
                      <div className="mt-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <ConditionalLogicBuilder
                          conditionalLogic={step.conditional_logic}
                          onChange={(logic) => updateStep(stepIndex, "conditional_logic", logic)}
                          availableSteps={formData.steps.filter((_, i) => i !== stepIndex)}
                        />
                      </div>
                    </details>
                  </div>

                  {/* Post-Completion Actions */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-600" />
                        Post-Completion Actions
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addAction(stepIndex)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Action
                      </Button>
                    </div>
                    {(!step.post_completion_actions || step.post_completion_actions.length === 0) ? (
                      <p className="text-xs text-slate-500 italic">No actions configured for this step</p>
                    ) : (
                      <div className="space-y-2">
                        {step.post_completion_actions.map((action, actionIndex) => (
                          <Card key={actionIndex} className="bg-amber-50 border-amber-200">
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className="bg-amber-100 text-amber-800">
                                  Action {actionIndex + 1}
                                </Badge>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAction(stepIndex, actionIndex)}
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
                                    onValueChange={(value) => updateAction(stepIndex, actionIndex, "target_entity_type", value)}
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
                                    onChange={(e) => updateAction(stepIndex, actionIndex, "field_to_update", e.target.value)}
                                    placeholder="e.g., fi_type, rfi_status"
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Value Source</Label>
                                  <Select
                                    value={action.value_source}
                                    onValueChange={(value) => updateAction(stepIndex, actionIndex, "value_source", value)}
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
                                    onChange={(e) => updateAction(stepIndex, actionIndex, "value", e.target.value)}
                                    placeholder={action.value_source === "from_step_answer" ? "step_id" : "value"}
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          {workflow ? "Update Workflow" : "Create Workflow"}
        </Button>
      </div>
    </form>
  );
}