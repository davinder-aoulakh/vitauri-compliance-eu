import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  PlayCircle,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  FileCheck,
  Info,
  X,
  Calendar,
  Upload,
  MapPin,
  Users,
  FileText,
  Hash,
  Type,
  List
} from "lucide-react";

export default function WorkflowTestRunner({ workflow, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepId, setCurrentStepId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [pathTaken, setPathTaken] = useState([]);
  const [finalResult, setFinalResult] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedOptions, setSelectedOptions] = useState([]);

  // Build step map for quick lookup
  const stepMap = useMemo(() => {
    const map = {};
    workflow?.steps?.forEach(step => {
      map[step.step_id] = step;
    });
    return map;
  }, [workflow?.steps]);

  if (!workflow || !workflow.steps || workflow.steps.length === 0) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <Info className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-900">
          This workflow has no steps configured yet.
        </AlertDescription>
      </Alert>
    );
  }

  const currentStep = currentStepId ? stepMap[currentStepId] : null;
  const progress = Math.min((pathTaken.length / workflow.steps.length) * 100, 100);

  const handleStart = () => {
    const firstStep = workflow.steps[0];
    setIsRunning(true);
    setCurrentStepId(firstStep.step_id);
    setAnswers({});
    setPathTaken([firstStep.step_id]);
    setFinalResult(null);
    setInputValue("");
    setSelectedOptions([]);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentStepId(null);
    setAnswers({});
    setPathTaken([]);
    setFinalResult(null);
    setInputValue("");
    setSelectedOptions([]);
  };

  const evaluateConditionalLogic = (step, currentAnswers) => {
    const logic = step.conditional_logic;
    if (!logic || !logic.conditions || logic.conditions.length === 0) {
      return { matched: false, nextStep: null };
    }

    // Check trigger condition first
    if (logic.trigger_field && logic.trigger_value) {
      const triggerAnswer = currentAnswers[logic.trigger_field];
      if (String(triggerAnswer) !== String(logic.trigger_value)) {
        return { matched: false, nextStep: null };
      }
    }

    // Evaluate conditions
    let result = true;

    for (let i = 0; i < logic.conditions.length; i++) {
      const cond = logic.conditions[i];
      
      // Get field value - support nested fields like "step_id.field_id"
      let fieldValue;
      if (cond.field.includes('.')) {
        const parts = cond.field.split('.');
        const stepAnswer = currentAnswers[parts[0]];
        fieldValue = stepAnswer && typeof stepAnswer === 'object' ? stepAnswer[parts[1]] : null;
      } else {
        fieldValue = currentAnswers[cond.field];
      }

      // Get comparison value - handle field references
      let comparisonValue = cond.value;
      if (cond.value_type === 'field_reference') {
        if (cond.value.includes('.')) {
          const parts = cond.value.split('.');
          const refAnswer = currentAnswers[parts[0]];
          comparisonValue = refAnswer && typeof refAnswer === 'object' ? refAnswer[parts[1]] : null;
        } else {
          comparisonValue = currentAnswers[cond.value];
        }
      }

      let condResult = false;

      switch (cond.operator) {
        case "=":
          condResult = String(fieldValue || '').toLowerCase() === String(comparisonValue || '').toLowerCase();
          break;
        case "!=":
          condResult = String(fieldValue || '').toLowerCase() !== String(comparisonValue || '').toLowerCase();
          break;
        case ">":
          condResult = parseFloat(fieldValue) > parseFloat(comparisonValue);
          break;
        case "<":
          condResult = parseFloat(fieldValue) < parseFloat(comparisonValue);
          break;
        case ">=":
          condResult = parseFloat(fieldValue) >= parseFloat(comparisonValue);
          break;
        case "<=":
          condResult = parseFloat(fieldValue) <= parseFloat(comparisonValue);
          break;
        case "contains":
          condResult = String(fieldValue || '').toLowerCase().includes(String(comparisonValue || '').toLowerCase());
          break;
        case "in":
          const inValues = String(comparisonValue).split(",").map(v => v.trim().toLowerCase());
          condResult = inValues.includes(String(fieldValue || '').toLowerCase());
          break;
        case "not_in":
          const notInValues = String(comparisonValue).split(",").map(v => v.trim().toLowerCase());
          condResult = !notInValues.includes(String(fieldValue || '').toLowerCase());
          break;
        case "is_crs":
        case "is_not_crs":
          // In test mode, simulate CRS check (user would need to know if the country is CRS)
          condResult = cond.operator === "is_crs" ? true : false; // Default to true for testing
          break;
        default:
          condResult = false;
      }

      if (i === 0) {
        result = condResult;
      } else {
        const logicOp = logic.conditions[i - 1]?.logic_operator || "AND";
        if (logicOp === "AND") {
          result = result && condResult;
        } else if (logicOp === "OR") {
          result = result || condResult;
        }
      }
    }

    return {
      matched: true,
      nextStep: result ? logic.next_step : logic.else_step
    };
  };

  const evaluateSelectionCountLogic = (step, selectedCount) => {
    const logic = step.conditional_logic;
    if (!logic?.use_selection_count) {
      return { matched: false, nextStep: null };
    }

    const operator = logic.selection_count_operator || "=";
    const targetCount = logic.selection_count_value || 0;
    let conditionMet = false;

    switch (operator) {
      case "=": conditionMet = selectedCount === targetCount; break;
      case "!=": conditionMet = selectedCount !== targetCount; break;
      case ">": conditionMet = selectedCount > targetCount; break;
      case "<": conditionMet = selectedCount < targetCount; break;
      case ">=": conditionMet = selectedCount >= targetCount; break;
      case "<=": conditionMet = selectedCount <= targetCount; break;
      default: conditionMet = false;
    }

    return {
      matched: true,
      nextStep: conditionMet ? logic.selection_count_next_step : logic.selection_count_else_step
    };
  };

  const determineNextStep = (step, answer, currentAnswers) => {
    let nextStepId = null;

    // 1. Check selection count branching for multiple_choice
    if (step.question_type === "multiple_choice" && step.conditional_logic?.use_selection_count) {
      const selectedCount = answer ? answer.split(',').filter(Boolean).length : 0;
      const selectionResult = evaluateSelectionCountLogic(step, selectedCount);
      if (selectionResult.matched && selectionResult.nextStep) {
        return selectionResult.nextStep;
      }
    }

    // 2. Check conditional logic
    const conditionalResult = evaluateConditionalLogic(step, currentAnswers);
    if (conditionalResult.matched && conditionalResult.nextStep) {
      return conditionalResult.nextStep;
    }

    // 3. Check selected option's next_step
    if (step.options && step.options.length > 0 && answer) {
      const selectedOption = step.options.find(opt => 
        opt.value === answer || opt.label === answer
      );
      if (selectedOption?.next_step) {
        return selectedOption.next_step;
      }
    }

    // 4. Check default_next_step (for input-type questions)
    if (step.default_next_step) {
      return step.default_next_step;
    }

    return null;
  };

  const handleAnswer = (answer) => {
    const newAnswers = { ...answers, [currentStep.step_id]: answer };
    setAnswers(newAnswers);

    const nextStepId = determineNextStep(currentStep, answer, newAnswers);

    // Validate next step exists
    if (nextStepId && stepMap[nextStepId]) {
      setCurrentStepId(nextStepId);
      setPathTaken([...pathTaken, nextStepId]);
      setInputValue("");
      setSelectedOptions([]);
    } else {
      // End of workflow
      setFinalResult({
        status: "completed",
        answers: newAnswers,
        path: pathTaken,
        lastStep: currentStep
      });
      setIsRunning(false);
    }
  };

  const handleMultipleChoiceToggle = (optionValue) => {
    const newSelected = selectedOptions.includes(optionValue)
      ? selectedOptions.filter(v => v !== optionValue)
      : [...selectedOptions, optionValue];
    setSelectedOptions(newSelected);
  };

  const handleMultipleChoiceSubmit = () => {
    handleAnswer(selectedOptions.join(','));
  };

  const handleInputSubmit = () => {
    if (inputValue.trim()) {
      handleAnswer(inputValue.trim());
    }
  };

  const handleSkipInputStep = () => {
    handleAnswer("[Skipped in test]");
  };

  const getQuestionTypeIcon = (type) => {
    switch (type) {
      case "yes_no": return <CheckCircle2 className="w-4 h-4" />;
      case "single_choice": return <List className="w-4 h-4" />;
      case "multiple_choice": return <List className="w-4 h-4" />;
      case "text_input": return <Type className="w-4 h-4" />;
      case "number_input": return <Hash className="w-4 h-4" />;
      case "date_input": return <Calendar className="w-4 h-4" />;
      case "file_upload": return <Upload className="w-4 h-4" />;
      case "address_input": return <MapPin className="w-4 h-4" />;
      case "beneficiary_input": return <Users className="w-4 h-4" />;
      case "controlling_person_input": return <Users className="w-4 h-4" />;
      case "multi_field_input": return <FileText className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const renderQuestionInput = () => {
    if (!currentStep) return null;

    const questionType = currentStep.question_type;

    // Yes/No or Single Choice with options
    if ((questionType === "yes_no" || questionType === "single_choice") && 
        currentStep.options && currentStep.options.length > 0) {
      return (
        <div className="space-y-3">
          {currentStep.options.map((option, idx) => (
            <Button
              key={idx}
              variant="outline"
              className="w-full justify-start text-left h-auto p-4 hover:bg-blue-50 hover:border-blue-300"
              onClick={() => handleAnswer(option.value)}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="w-8 h-8 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0 text-sm font-medium">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">
                    {option.label || option.value}
                  </p>
                  {option.next_step && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <ArrowRight className="w-3 h-3" />
                      Next: {stepMap[option.next_step]?.step_title || option.next_step}
                    </p>
                  )}
                </div>
              </div>
            </Button>
          ))}
        </div>
      );
    }

    // Multiple Choice
    if (questionType === "multiple_choice" && currentStep.options && currentStep.options.length > 0) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            {currentStep.options.map((option, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedOptions.includes(option.value)
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
                onClick={() => handleMultipleChoiceToggle(option.value)}
              >
                <Checkbox
                  checked={selectedOptions.includes(option.value)}
                  onCheckedChange={() => handleMultipleChoiceToggle(option.value)}
                />
                <span className="font-medium text-slate-900">{option.label || option.value}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">
              {selectedOptions.length} option(s) selected
            </span>
            <Button onClick={handleMultipleChoiceSubmit} className="bg-blue-600 hover:bg-blue-700">
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // Text Input
    if (questionType === "text_input") {
      return (
        <div className="space-y-4">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter your answer..."
            className="h-12"
          />
          <div className="flex gap-3">
            <Button onClick={handleInputSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button onClick={handleSkipInputStep} variant="outline">
              Skip (Test)
            </Button>
          </div>
        </div>
      );
    }

    // Number Input
    if (questionType === "number_input") {
      return (
        <div className="space-y-4">
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter a number..."
            className="h-12"
          />
          <div className="flex gap-3">
            <Button onClick={handleInputSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button onClick={handleSkipInputStep} variant="outline">
              Skip (Test)
            </Button>
          </div>
        </div>
      );
    }

    // Date Input
    if (questionType === "date_input") {
      return (
        <div className="space-y-4">
          <Input
            type="date"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="h-12"
          />
          <div className="flex gap-3">
            <Button onClick={handleInputSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button onClick={handleSkipInputStep} variant="outline">
              Skip (Test)
            </Button>
          </div>
        </div>
      );
    }

    // File Upload, Address Input, Beneficiary Input, Controlling Person Input, Multi-Field Input
    if (["file_upload", "address_input", "beneficiary_input", "controlling_person_input", "multi_field_input"].includes(questionType)) {
      return (
        <div className="space-y-4">
          <Alert className="bg-slate-50 border-slate-200">
            <Info className="w-4 h-4 text-slate-600" />
            <AlertDescription className="text-slate-700">
              <strong>{questionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:</strong> In test mode, this step is simulated. Click "Continue" to proceed.
            </AlertDescription>
          </Alert>
          <Button onClick={() => handleAnswer("[Simulated in test]")} className="w-full bg-blue-600 hover:bg-blue-700">
            Continue (Simulate)
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      );
    }

    // Info or Result type - auto-continue
    if (questionType === "info" || questionType === "result") {
      return (
        <div className="space-y-4">
          {currentStep.result_description && (
            <Alert className={`${
              currentStep.result_status === 'reportable' ? 'bg-amber-50 border-amber-200' :
              currentStep.result_status === 'non_reportable' ? 'bg-green-50 border-green-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <Info className="w-4 h-4" />
              <AlertDescription>{currentStep.result_description}</AlertDescription>
            </Alert>
          )}
          <Button onClick={() => handleAnswer("[Info acknowledged]")} className="w-full bg-blue-600 hover:bg-blue-700">
            {currentStep.default_next_step ? "Continue" : "Complete Workflow"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      );
    }

    // Fallback for unknown types
    return (
      <div className="space-y-4">
        <Alert className="bg-amber-50 border-amber-200">
          <Info className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            Unknown question type: {questionType}. Click continue to proceed.
          </AlertDescription>
        </Alert>
        <Button onClick={() => handleAnswer("[Unknown type - skipped]")} className="w-full">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Test Mode: {workflow.workflow_name}
          </h3>
          <p className="text-sm text-slate-600">
            Run through the workflow without saving data
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Progress */}
      {isRunning && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                Progress: Step {pathTaken.length} of ~{workflow.steps.length}
              </span>
              <span className="text-sm text-slate-600">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Start Screen */}
      {!isRunning && !finalResult && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlayCircle className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Ready to Test Workflow
            </h3>
            <p className="text-slate-600 mb-6">
              Walk through the workflow step-by-step to verify logic and flow
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-slate-600 mb-6">
              <Badge variant="outline">{workflow.steps.length} Steps</Badge>
              <Badge variant="outline">Version {workflow.version || "1.0"}</Badge>
              <Badge variant="outline" className="capitalize">{workflow.workflow_type?.replace(/_/g, ' ')}</Badge>
            </div>
            <Button onClick={handleStart} size="lg" className="bg-blue-600 hover:bg-blue-700">
              <PlayCircle className="w-5 h-5 mr-2" />
              Start Test Run
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current Step */}
      {isRunning && currentStep && (
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  {getQuestionTypeIcon(currentStep.question_type)}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {currentStep.step_title || currentStep.step_id}
                  </CardTitle>
                  <Badge variant="outline" className="mt-1 text-xs capitalize">
                    {currentStep.question_type?.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
              <Badge className="bg-blue-600 text-white">
                Step {pathTaken.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {currentStep.question_text && (
                <p className="text-lg font-medium text-slate-900">
                  {currentStep.question_text}
                </p>
              )}

              {currentStep.help_text && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-900">
                    {currentStep.help_text}
                  </AlertDescription>
                </Alert>
              )}

              {renderQuestionInput()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Path Taken */}
      {pathTaken.length > 0 && (
        <Card className="border-0 shadow-sm bg-slate-50">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Path Taken ({pathTaken.length} steps)
            </h4>
            <div className="space-y-2">
              {pathTaken.map((stepId, idx) => {
                const step = stepMap[stepId];
                if (!step) return null;
                return (
                  <div key={idx} className="flex items-center gap-3 text-sm">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      idx === pathTaken.length - 1 && isRunning
                        ? 'bg-blue-600 text-white'
                        : 'bg-green-600 text-white'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 font-medium truncate">
                        {step.step_title || stepId}
                      </p>
                      {answers[stepId] && (
                        <Badge variant="outline" className="mt-1 text-xs max-w-full truncate">
                          {answers[stepId].length > 30 ? answers[stepId].substring(0, 30) + '...' : answers[stepId]}
                        </Badge>
                      )}
                    </div>
                    {idx < pathTaken.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Final Result */}
      {finalResult && (
        <Card className="border-2 border-green-200 bg-gradient-to-br from-white to-green-50/30">
          <CardHeader className="border-b bg-gradient-to-r from-green-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Test Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Alert className="bg-green-50 border-green-200 mb-4">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-900">
                Workflow completed successfully! The path went through {finalResult.path.length} steps.
              </AlertDescription>
            </Alert>

            {finalResult.lastStep && (
              <div className="mb-4 p-4 bg-white rounded-lg border">
                <p className="text-sm font-medium text-slate-700 mb-1">Final Step:</p>
                <p className="font-semibold text-slate-900">{finalResult.lastStep.step_title}</p>
                {finalResult.lastStep.help_text && (
                  <p className="text-sm text-slate-600 mt-1">{finalResult.lastStep.help_text}</p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  All Answers ({Object.keys(finalResult.answers).length})
                </label>
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(finalResult.answers).map(([stepId, answer]) => {
                    const step = stepMap[stepId];
                    return (
                      <div key={stepId} className="flex items-start justify-between gap-2 text-sm py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-600 flex-shrink-0">
                          {step?.step_title || stepId}:
                        </span>
                        <Badge variant="outline" className="text-right max-w-[50%] truncate">
                          {String(answer).length > 40 ? String(answer).substring(0, 40) + '...' : answer}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleReset} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Run Again
                </Button>
                {onClose && (
                  <Button onClick={onClose} variant="outline">
                    Close
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset Button */}
      {isRunning && (
        <div className="flex justify-center">
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Test
          </Button>
        </div>
      )}
    </div>
  );
}