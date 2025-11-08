import React, { useState, useCallback } from "react";
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
  HelpCircle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function WorkflowDragDropBuilder({ workflow, onSave, onCancel }) {
  const [steps, setSteps] = useState(workflow?.steps || []);
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
      required: true
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Step: {selectedStep?.step_title}</DialogTitle>
          </DialogHeader>
          {selectedStep && (
            <StepEditor
              step={selectedStep}
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

// Step Editor Component
function StepEditor({ step, allSteps, onUpdate, onClose }) {
  const [editedStep, setEditedStep] = useState({ ...step });

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
          </SelectContent>
        </Select>
      </div>

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