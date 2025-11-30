import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, Loader2, Check, Circle, AlertCircle, GitBranch } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import WorkflowVisualizer from "../workflows/WorkflowVisualizer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AIWorkflowHelper from "../ai/AIWorkflowHelper";

export default function EntityClassification({ entity, onComplete, onCancel }) {
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [answers, setAnswers] = useState(entity?.classification_answers || {});
  const [selectedValue, setSelectedValue] = useState("");
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [completedPath, setCompletedPath] = useState([]);
  const [entityStatus, setEntityStatus] = useState(null);
  const [showFlowChart, setShowFlowChart] = useState(false);

  // Fetch published entity classification workflows
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['entity-workflows'],
    queryFn: () => base44.entities.Workflow.filter({ 
      workflow_type: 'entity_rfi_classification',
      status: 'published'
    })
  });

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      if (entity?.id && showSummary) {
        const entities = await base44.entities.Entity.list();
        const currentEntity = entities.find(e => e.id === entity.id);
        setEntityStatus(currentEntity?.rfi_status);
      }
    };
    fetchStatus();
  }, [showSummary, entity?.id]);

  useEffect(() => {
    if (workflows.length > 0 && !workflow) {
      // Get the latest version
      const sortedWorkflows = workflows.sort((a, b) => 
        parseFloat(b.version || "1.0") - parseFloat(a.version || "1.0")
      );
      const latestWorkflow = sortedWorkflows[0];
      setWorkflow(latestWorkflow);
      
      // Set initial node
      if (latestWorkflow.steps && latestWorkflow.steps.length > 0) {
        setCurrentNodeId(latestWorkflow.steps[0].step_id);
      }
    }
  }, [workflows, workflow]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  // Guard clause - check if entity exists
  if (!entity) {
    return (
      <div className="p-12 text-center">
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-900">
            Entity data is missing. Please close and try again.
          </AlertDescription>
        </Alert>
        <Button onClick={onCancel} className="mt-4" variant="outline">
          Close
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="p-12 text-center">
        <Alert className="bg-amber-50 border-amber-200">
          <AlertDescription className="text-amber-900">
            No published entity classification workflow found. Please contact your administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentNodeId && !showSummary) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Build step map
  const stepMap = {};
  workflow.steps.forEach(step => {
    stepMap[step.step_id] = step;
  });

  const currentNode = showSummary ? null : stepMap[currentNodeId];
  
  if (!currentNode && !showSummary) {
    return (
      <div className="p-12 text-center">
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-900">
            Workflow configuration error. Current step not found.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentStepIndex = history.length;
  const totalSteps = completedPath.length || history.length + 1;
  const progress = Math.round((currentStepIndex / totalSteps) * 100);

  // Determine if current node is an action (end) node
  const isActionNode = (step) => {
    if (!step) return false;
    if (!step.options || step.options.length === 0) {
      return true;
    }
    // Check if any option has a next_step
    return !step.options.some(opt => opt.next_step);
  };

  const handleNext = async () => {
    const newAnswers = { ...answers };
    
    // Store the answer
    if (currentNode.question_type === "single_choice" || 
        currentNode.question_type === "yes_no" ||
        currentNode.question_type === "multiple_choice") {
      if (!selectedValue) return;
      newAnswers[currentNodeId] = selectedValue;
    }

    setAnswers(newAnswers);
    const newHistory = [...history, currentNodeId];
    setHistory(newHistory);

    // Execute post-completion actions
    await executePostCompletionActions(currentNode, newAnswers);

    // Determine next step
    let nextNodeId = null;

    // Check conditional logic first
    if (currentNode.conditional_logic) {
      const conditionMet = evaluateConditionalLogic(currentNode.conditional_logic, newAnswers);
      nextNodeId = conditionMet 
        ? currentNode.conditional_logic.next_step 
        : currentNode.conditional_logic.else_step;
    } 
    // Check if there's a selected option with next_step
    else if (selectedValue && currentNode.options) {
      const selectedOption = currentNode.options.find(opt => 
        opt.value === selectedValue || opt.label === selectedValue
      );
      nextNodeId = selectedOption?.next_step;
    }

    // If this is an action node or no next step, show summary
    if (!nextNodeId || isActionNode(currentNode)) {
      setCompletedPath([...newHistory, currentNodeId]);
      setShowSummary(true);
      return;
    }

    // Move to next node
    setCurrentNodeId(nextNodeId);
    setSelectedValue("");
  };

  const executePostCompletionActions = async (step, allAnswers) => {
    if (!step.post_completion_actions || step.post_completion_actions.length === 0) {
      return;
    }

    for (const action of step.post_completion_actions) {
      // Check if condition is met (if condition exists)
      if (action.condition) {
        const conditionMet = evaluateActionCondition(action.condition, allAnswers);
        if (!conditionMet) continue;
      }

      // Determine the value to set
      let valueToSet = action.value;
      if (action.value_source === "from_step_answer") {
        // Get answer from specified step
        valueToSet = allAnswers[action.value];
      } else if (action.value_source === "static_value") {
        valueToSet = action.value;
      }

      // Update the entity/account
      try {
        if (action.target_entity_type === "Entity" && entity?.id) {
          await base44.entities.Entity.update(entity.id, {
            [action.field_to_update]: valueToSet
          });
        }
        // Account updates would go here if needed
      } catch (error) {
        console.error("Error executing post-completion action:", error);
      }
    }
  };

  const evaluateActionCondition = (condition, answers) => {
    const fieldValue = answers[condition.field];
    
    switch (condition.operator) {
      case "=":
        return String(fieldValue) === String(condition.value);
      case "!=":
        return String(fieldValue) !== String(condition.value);
      case "contains":
        return String(fieldValue).includes(condition.value);
      case "in":
        return condition.value.split(",").map(v => v.trim()).includes(String(fieldValue));
      case "not_in":
        return !condition.value.split(",").map(v => v.trim()).includes(String(fieldValue));
      default:
        return true;
    }
  };

  const evaluateConditionalLogic = (logic, answers) => {
    if (!logic.conditions || logic.conditions.length === 0) return false;

    let result = true;

    logic.conditions.forEach((condition, idx) => {
      const fieldValue = answers[condition.field];
      let conditionMet = false;

      // Evaluate condition based on operator
      switch (condition.operator) {
        case "=":
          conditionMet = fieldValue == condition.value;
          break;
        case "!=":
          conditionMet = fieldValue != condition.value;
          break;
        case "in":
          conditionMet = condition.value.split(",").map(v => v.trim()).includes(fieldValue);
          break;
        case "not_in":
          conditionMet = !condition.value.split(",").map(v => v.trim()).includes(fieldValue);
          break;
        case "contains":
          conditionMet = String(fieldValue).includes(condition.value);
          break;
        case ">":
          conditionMet = parseFloat(fieldValue) > parseFloat(condition.value);
          break;
        case "<":
          conditionMet = parseFloat(fieldValue) < parseFloat(condition.value);
          break;
        case ">=":
          conditionMet = parseFloat(fieldValue) >= parseFloat(condition.value);
          break;
        case "<=":
          conditionMet = parseFloat(fieldValue) <= parseFloat(condition.value);
          break;
        default:
          conditionMet = false;
      }

      // Combine with previous result
      if (idx === 0) {
        result = conditionMet;
      } else {
        if (condition.logic_operator === "AND") {
          result = result && conditionMet;
        } else if (condition.logic_operator === "OR") {
          result = result || conditionMet;
        }
      }
    });

    return result;
  };

  const handleBack = () => {
    if (showSummary) {
      setShowSummary(false);
      return;
    }

    if (history.length === 0) {
      onCancel();
      return;
    }

    const previousNodeId = history[history.length - 1];

    // Remove last answer
    const newAnswers = { ...answers };
    delete newAnswers[currentNodeId];

    setAnswers(newAnswers);
    setHistory(history.slice(0, -1));
    setCurrentNodeId(previousNodeId);
    setSelectedValue(answers[previousNodeId] || "");
  };

  const completeClassification = async () => {
    const finalNode = stepMap[history[history.length - 1]] || currentNode;
    const finalAnswers = answers;

    // Fetch the current entity state to get values set by post-completion actions
    const currentEntity = await base44.entities.Entity.list();
    const updatedEntity = currentEntity.find(e => e.id === entity.id);

    // Use entity's current state as source of truth (set by post-completion actions or defaults)
    let rfi_status = updatedEntity?.rfi_status || "non_reporting_fi";
    let fi_type = updatedEntity?.fi_type || "not_applicable";

    // Parse classification from node title/help text (only if not already set by actions)
    if (finalNode.step_title?.toLowerCase().includes("reporting fi") || 
        finalNode.help_text?.toLowerCase().includes("reporting fi")) {
      
      // Only set rfi_status if it wasn't already set by post-completion actions
      if (!updatedEntity?.rfi_status) {
        rfi_status = "reporting_fi";
      }
      
      // Only determine fi_type if it wasn't already set by post-completion actions
      if (!updatedEntity?.fi_type || updatedEntity.fi_type === "not_applicable") {
        const fiTypeValue = finalAnswers.frm_select_fi_type;
        
        const fiTypeMap = {
          "1": "custodial_institution",
          "2": "depository_institution",
          "3a": "investment_entity",
          "3b": "investment_entity",
          "4": "specified_insurance_company"
        };
        
        const fiTypeLabelMap = {
          "Custodial Institution": "custodial_institution",
          "Depository Institution": "depository_institution",
          "Investment Entity (3a)": "investment_entity",
          "Investment Entity (3b)": "investment_entity",
          "Specified Insurance Company": "specified_insurance_company"
        };
        
        fi_type = fiTypeMap[fiTypeValue] || fiTypeLabelMap[fiTypeValue] || "not_applicable";
      }
    }

    // Set reason based on actual rfi_status
    let reason = finalNode.help_text || finalNode.step_title || "Classification completed";
    if (rfi_status === "non_reporting_fi" && reason.toLowerCase().includes("reporting fi")) {
      reason = "Result: Non-Reporting FI - " + reason;
    }

    // Filter answers to only include actually answered questions from completedPath
    const actualAnswers = {};
    completedPath.forEach(stepId => {
      if (finalAnswers[stepId] !== undefined) {
        actualAnswers[stepId] = finalAnswers[stepId];
      }
    });

    const classificationData = {
      classification_answers: actualAnswers,
      classification_completed_date: new Date().toISOString().split('T')[0],
      rfi_status: rfi_status,
      fi_type: fi_type,
      non_reporting_reason: rfi_status === "non_reporting_fi" ? reason : undefined,
      entity_type: finalAnswers.frm_select_legal_entity_type || entity?.entity_type
    };

    // Save classification history record
    try {
      await base44.entities.EntityClassificationHistory.create({
        tenant_id: entity?.tenant_id,
        entity_id: entity?.id,
        classification_date: new Date().toISOString(),
        classification_result: rfi_status,
        classification_reason: reason,
        fi_type: fi_type,
        workflow_answers: actualAnswers,
        performed_by: user?.email || "unknown",
        entity_name: entity?.entity_name || "Unknown Entity",
        entity_type: finalAnswers.frm_select_legal_entity_type || entity?.entity_type
      });
    } catch (error) {
      console.error("Error saving classification history:", error);
    }

    onComplete(classificationData);
  };

  const renderNode = () => {
    if (currentNode.question_type === "yes_no") {
      const options = currentNode.options || [
        { value: "YES", label: "Yes" },
        { value: "NO", label: "No" }
      ];
      
      return (
        <div className="space-y-3">
          <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
            {options.map((option) => (
              <div 
                key={option.value}
                className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer"
                onClick={() => setSelectedValue(option.value)}
              >
                <RadioGroupItem value={option.value} id={option.value} />
                <Label 
                  htmlFor={option.value}
                  className="flex-1 cursor-pointer font-medium text-slate-900"
                >
                  {option.label}
                </Label>
                {option.value === selectedValue && (
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                )}
              </div>
            ))}
          </RadioGroup>
        </div>
      );
    }

    if (currentNode.question_type === "single_choice" || currentNode.question_type === "multiple_choice") {
      return (
        <div className="space-y-4">
          <Select value={selectedValue} onValueChange={setSelectedValue}>
            <SelectTrigger className="w-full h-12">
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {currentNode.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (currentNode.question_type === "text_input") {
      return (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-900 font-medium">
            {currentNode.help_text || "Classification complete!"}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  // Summary Screen
  if (showSummary) {
    const finalNode = stepMap[completedPath[completedPath.length - 1]];
    
    // Only check actual entity status, not text content which can be misleading
    const isReportingFI = entityStatus === "reporting_fi";

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
            isReportingFI ? 'bg-amber-100' : 'bg-green-100'
          }`}>
            {isReportingFI ? (
              <AlertCircle className="w-10 h-10 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Classification Complete</h2>
          <p className="text-slate-600">
            Review your answers and confirm the classification for <strong>{entity?.entity_name || "this entity"}</strong>
          </p>
        </div>

        {/* Classification Result Preview */}
        <Card className={`border-2 ${
          isReportingFI 
            ? 'bg-amber-50 border-amber-200' 
            : 'bg-green-50 border-green-200'
        }`}>
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Final Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Status:</span>
                <Badge className={`text-sm ${
                  isReportingFI 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-green-600 text-white'
                }`}>
                  {isReportingFI ? 'Reporting FI' : 'Non-Reporting FI'}
                </Badge>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-slate-700">Reason:</span>
                <span className="text-sm text-slate-900 text-right max-w-md">
                  {finalNode?.help_text || finalNode?.step_title || "Classification completed"}
                </span>
              </div>
              {answers.frm_select_fi_type && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">FI Type:</span>
                  <Badge variant="outline">
                    {currentNode?.options?.find(o => o.value === answers.frm_select_fi_type)?.label || answers.frm_select_fi_type}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* All Answers Summary */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Complete Answer Summary ({Object.keys(answers).length} questions answered)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {completedPath.map((stepId, idx) => {
                const step = stepMap[stepId];
                const answer = answers[stepId];
                
                // Only show steps that have answers
                if (!step || !answer) return null;

                const answerLabel = step.options?.find(o => o.value === answer)?.label || answer;
                const isLastStep = idx === completedPath.length - 1;

                return (
                  <div key={stepId}>
                    <div className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 font-semibold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 mb-1">
                          {step.step_title}
                        </p>
                        {step.question_text && (
                          <p className="text-xs text-slate-600 mb-2">{step.question_text}</p>
                        )}
                        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                          {answerLabel}
                        </Badge>
                      </div>
                    </div>
                    {isLastStep && (
                      <Alert className="mt-4 bg-green-50 border-green-200">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <AlertDescription className="text-sm text-green-900">
                          <strong>Workflow concluded at this step</strong> - Classification determination complete
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleBack}
            size="lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Review Answers
          </Button>
          <Button 
            onClick={completeClassification}
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Complete Classification
          </Button>
        </div>
      </div>
    );
  }

  // Main workflow screen
  return (
    <div className="space-y-6">
      {/* Workflow Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Entity Classification</h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">
            Step {currentStepIndex + 1}
          </p>
          <p className="text-xs text-slate-500">{progress}% Complete</p>
        </div>
      </div>

      <Dialog open={showFlowChart} onOpenChange={setShowFlowChart}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Workflow Flowchart: {workflow.workflow_name}</DialogTitle>
          </DialogHeader>
          <WorkflowVisualizer workflow={workflow} />
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {workflow.workflow_name} v{workflow.version}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFlowChart(true)}
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
          >
            <GitBranch className="w-4 h-4 mr-1" />
            Show Flowchart
          </Button>
        </div>
      </div>

      {/* Enhanced Progress Bar */}
      <div className="space-y-2">
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Started</span>
          <span className="font-medium text-indigo-600">{Object.keys(answers).length} questions answered</span>
          <span>Summary</span>
        </div>
      </div>

      {/* Step Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        {[...history, currentNodeId].map((stepId, idx) => {
          const step = stepMap[stepId];
          const isCompleted = idx < history.length;
          const isCurrent = idx === history.length;
          
          return (
            <React.Fragment key={stepId}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                isCompleted 
                  ? 'bg-green-50 border-green-200' 
                  : isCurrent 
                    ? 'bg-indigo-50 border-indigo-300' 
                    : 'bg-slate-50 border-slate-200'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted 
                    ? 'bg-green-600' 
                    : isCurrent 
                      ? 'bg-indigo-600' 
                      : 'bg-slate-300'
                }`}>
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <span className="text-white text-xs font-bold">{idx + 1}</span>
                  )}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  isCompleted 
                    ? 'text-green-700' 
                    : isCurrent 
                      ? 'text-indigo-700' 
                      : 'text-slate-500'
                }`}>
                  {step?.step_title?.substring(0, 15) || `Step ${idx + 1}`}
                  {step?.step_title?.length > 15 && '...'}
                </span>
              </div>
              {idx < history.length && (
                <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Question Card */}
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">{currentStepIndex + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {currentNode.step_title}
                </h3>
                {currentNode.question_text && (
                  <p className="text-slate-700 mb-3 leading-relaxed">{currentNode.question_text}</p>
                )}
                {currentNode.help_text && (
                  <Alert className="bg-blue-50 border-blue-200 mb-4">
                    <Info className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">
                      {currentNode.help_text}
                    </AlertDescription>
                  </Alert>
                )}
                {currentNode.regulatory_reference && (
                  <p className="text-xs text-slate-500 italic mb-3 flex items-center gap-2">
                    <FileCheck className="w-3 h-3" />
                    Reference: {currentNode.regulatory_reference}
                  </p>
                )}
              </div>
            </div>

            {/* Render current node */}
            <div className="pl-16">
              {renderNode()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Workflow Helper */}
      <AIWorkflowHelper
        currentStep={currentNode}
        workflow={workflow}
        answers={answers}
        entityData={entity}
        onSuggestedAnswer={(value) => setSelectedValue(value)}
      />

      {/* Previous Answers Compact View */}
      {Object.keys(answers).length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <details className="cursor-pointer">
              <summary className="text-sm font-semibold text-slate-700 flex items-center gap-2 hover:text-indigo-600 transition-colors">
                <FileCheck className="w-4 h-4" />
                View Previous Answers ({Object.keys(answers).length})
              </summary>
              <div className="mt-3 space-y-2 pl-6">
                {Object.entries(answers).map(([key, value]) => {
                  const step = stepMap[key];
                  if (!step) return null;
                  return (
                    <div key={key} className="flex items-center justify-between text-sm py-2 border-b border-slate-200 last:border-0">
                      <span className="text-slate-600 text-xs">
                        {step.step_title || key}
                      </span>
                      <Badge variant="outline" className="capitalize text-xs">
                        {step.options?.find(o => o.value === value)?.label || value}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleBack}
          size="lg"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {history.length === 0 ? "Cancel" : "Previous"}
        </Button>
        <Button 
          onClick={handleNext}
          disabled={!selectedValue && !isActionNode(currentNode)}
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
        >
          {isActionNode(currentNode) ? "View Summary" : "Next Question"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}