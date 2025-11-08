import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function EntityClassification({ entity, onComplete, onCancel }) {
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [answers, setAnswers] = useState(entity?.classification_answers || {});
  const [selectedValue, setSelectedValue] = useState("");
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [workflow, setWorkflow] = useState(null);

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

  if (!currentNodeId) {
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

  const currentNode = stepMap[currentNodeId];
  
  if (!currentNode) {
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

  const progress = Math.round((Object.keys(answers).length / workflow.steps.length) * 100);

  // Determine if current node is an action (end) node
  const isActionNode = (step) => {
    if (!step.options || step.options.length === 0) {
      return true;
    }
    // Check if any option has a next_step
    return !step.options.some(opt => opt.next_step);
  };

  const handleNext = () => {
    const newAnswers = { ...answers };
    
    // Store the answer
    if (currentNode.question_type === "single_choice" || 
        currentNode.question_type === "yes_no" ||
        currentNode.question_type === "multiple_choice") {
      if (!selectedValue) return;
      newAnswers[currentNodeId] = selectedValue;
    }

    setAnswers(newAnswers);
    setHistory([...history, currentNodeId]);

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

    // If this is an action node or no next step, complete classification
    if (!nextNodeId || isActionNode(currentNode)) {
      completeClassification(currentNode, newAnswers);
      return;
    }

    // Move to next node
    setCurrentNodeId(nextNodeId);
    setSelectedValue("");
  };

  const evaluateConditionalLogic = (logic, answers) => {
    if (!logic.conditions || logic.conditions.length === 0) return false;

    let result = true;
    let currentLogicOp = null;

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

  const completeClassification = async (finalNode, finalAnswers) => {
    // Determine classification based on final node
    let classification = "non_reporting_fi";
    let reason = finalNode.help_text || finalNode.step_title || "Classification completed";
    let rfi_status = "non_reporting_fi";
    let fi_type = "not_applicable";

    // Parse classification from node title/help text
    if (finalNode.step_title?.toLowerCase().includes("reporting fi") || 
        finalNode.help_text?.toLowerCase().includes("reporting fi")) {
      classification = "reporting_fi";
      rfi_status = "reporting_fi";
      
      // Extract FI type from answers
      const fiTypeValue = finalAnswers.frm_select_fi_type;
      const fiTypeMap = {
        "1": "custodial_institution",
        "2": "depository_institution",
        "3a": "investment_entity",
        "3b": "investment_entity",
        "4": "specified_insurance_company"
      };
      fi_type = fiTypeMap[fiTypeValue] || "not_applicable";
    }

    const classificationData = {
      classification_answers: finalAnswers,
      classification_completed_date: new Date().toISOString().split('T')[0],
      rfi_status: rfi_status,
      fi_type: fi_type,
      non_reporting_reason: classification === "non_reporting_fi" ? reason : undefined,
      entity_type: finalAnswers.frm_select_legal_entity_type || entity.entity_type
    };

    // Save classification history record
    try {
      await base44.entities.EntityClassificationHistory.create({
        tenant_id: entity.tenant_id,
        entity_id: entity.id,
        classification_date: new Date().toISOString(),
        classification_result: rfi_status,
        classification_reason: reason,
        fi_type: fi_type,
        workflow_answers: finalAnswers,
        performed_by: user?.email || "unknown",
        entity_name: entity.entity_name,
        entity_type: finalAnswers.frm_select_legal_entity_type || entity.entity_type
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
        <div className="space-y-4">
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
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select an option...`} />
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

  return (
    <div className="space-y-6">
      {/* Workflow Info */}
      <div className="flex items-center justify-between">
        <div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {workflow.workflow_name} v{workflow.version}
          </Badge>
        </div>
        <span className="text-sm text-slate-500">{Object.keys(answers).length} steps completed</span>
      </div>

      {/* Progress */}
      <div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-white font-bold text-sm">{history.length + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {currentNode.step_title}
                </h3>
                {currentNode.question_text && (
                  <p className="text-slate-700 mb-3">{currentNode.question_text}</p>
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
                  <p className="text-xs text-slate-500 italic mb-3">
                    Reference: {currentNode.regulatory_reference}
                  </p>
                )}
              </div>
            </div>

            {/* Render current node */}
            <div className="ml-11">
              {renderNode()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous Answers Summary */}
      {Object.keys(answers).length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Previous Answers
            </h4>
            <div className="space-y-2">
              {Object.entries(answers).map(([key, value]) => {
                const step = stepMap[key];
                if (!step) return null;
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
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
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {history.length === 0 ? "Cancel" : "Back"}
        </Button>
        <Button 
          onClick={handleNext}
          disabled={!selectedValue && !isActionNode(currentNode)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isActionNode(currentNode) ? "Complete" : "Continue"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}