import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  PlayCircle,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  FileCheck,
  Info,
  X
} from "lucide-react";

export default function WorkflowTestRunner({ workflow, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [pathTaken, setPathTaken] = useState([]);
  const [finalResult, setFinalResult] = useState(null);

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

  const currentStep = workflow.steps[currentStepIndex];
  const progress = (pathTaken.length / Math.max(workflow.steps.length, 1)) * 100;

  const handleStart = () => {
    setIsRunning(true);
    setCurrentStepIndex(0);
    setAnswers({});
    setPathTaken([workflow.steps[0]]);
    setFinalResult(null);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentStepIndex(0);
    setAnswers({});
    setPathTaken([]);
    setFinalResult(null);
  };

  const evaluateConditionalLogic = (step, selectedAnswer) => {
    if (!step.conditional_logic || !step.conditional_logic.conditions) {
      return step.conditional_logic?.next_step || null;
    }

    // Evaluate conditions
    const conditions = step.conditional_logic.conditions;
    let result = true;

    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      const fieldValue = answers[cond.field];
      let condResult = false;

      // Evaluate single condition
      switch (cond.operator) {
        case "=":
          condResult = fieldValue == cond.value;
          break;
        case "!=":
          condResult = fieldValue != cond.value;
          break;
        case ">":
          condResult = parseFloat(fieldValue) > parseFloat(cond.value);
          break;
        case "<":
          condResult = parseFloat(fieldValue) < parseFloat(cond.value);
          break;
        case ">=":
          condResult = parseFloat(fieldValue) >= parseFloat(cond.value);
          break;
        case "<=":
          condResult = parseFloat(fieldValue) <= parseFloat(cond.value);
          break;
        case "contains":
          condResult = String(fieldValue).includes(String(cond.value));
          break;
        case "in":
          condResult = cond.value.split(",").map(v => v.trim()).includes(String(fieldValue));
          break;
        default:
          condResult = false;
      }

      // Combine with previous result
      if (i === 0) {
        result = condResult;
      } else {
        const logicOp = conditions[i - 1].logic_operator || "AND";
        if (logicOp === "AND") {
          result = result && condResult;
        } else if (logicOp === "OR") {
          result = result || condResult;
        }
      }
    }

    return result 
      ? step.conditional_logic.next_step 
      : step.conditional_logic.else_step;
  };

  const handleAnswer = (answer) => {
    const newAnswers = { ...answers, [currentStep.step_id]: answer };
    setAnswers(newAnswers);

    // Determine next step
    let nextStepId = null;

    // Check conditional logic first
    if (currentStep.conditional_logic) {
      nextStepId = evaluateConditionalLogic(currentStep, answer);
    }
    // Then check options
    else if (currentStep.options) {
      const selectedOption = currentStep.options.find(
        opt => opt.value === answer || opt.label === answer
      );
      nextStepId = selectedOption?.next_step;
    }

    // Find next step
    const nextStepIndex = workflow.steps.findIndex(s => s.step_id === nextStepId);

    if (nextStepIndex >= 0) {
      const nextStep = workflow.steps[nextStepIndex];
      setCurrentStepIndex(nextStepIndex);
      setPathTaken([...pathTaken, nextStep]);
    } else {
      // End of workflow
      setFinalResult({
        status: "completed",
        answers: newAnswers,
        path: [...pathTaken],
        lastStep: currentStep
      });
      setIsRunning(false);
    }
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
              <div className="flex items-center gap-2">
                <Badge variant="outline">{workflow.steps.length} Steps</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Version {workflow.version || "1.0"}</Badge>
              </div>
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
              <CardTitle className="text-lg">
                {currentStep.step_title || currentStep.step_id}
              </CardTitle>
              <Badge className="bg-blue-600 text-white">
                Step {pathTaken.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {currentStep.question_text && (
                <div>
                  <p className="text-lg font-medium text-slate-900 mb-4">
                    {currentStep.question_text}
                  </p>
                </div>
              )}

              {currentStep.help_text && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-900">
                    {currentStep.help_text}
                  </AlertDescription>
                </Alert>
              )}

              {/* Answer Options */}
              {currentStep.options && currentStep.options.length > 0 && (
                <div className="space-y-3">
                  {currentStep.options.map((option, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className="w-full justify-start text-left h-auto p-4 hover:bg-blue-50 hover:border-blue-300"
                      onClick={() => handleAnswer(option.value)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">
                            {option.label || option.value}
                          </p>
                          {option.next_step && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <ArrowRight className="w-3 h-3" />
                              Next: {option.next_step}
                            </p>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
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
              Path Taken
            </h4>
            <div className="space-y-2">
              {pathTaken.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-900 font-medium">
                      {step.step_title || step.step_id}
                    </p>
                    {answers[step.step_id] && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        Answer: {answers[step.step_id]}
                      </Badge>
                    )}
                  </div>
                  {idx < pathTaken.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              ))}
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

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  All Answers
                </label>
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                  {Object.entries(finalResult.answers).map(([stepId, answer]) => (
                    <div key={stepId} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{stepId}:</span>
                      <Badge variant="outline">{answer}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleReset} className="flex-1">
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