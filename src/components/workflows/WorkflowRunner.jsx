import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, Info } from "lucide-react";

export default function WorkflowRunner({ workflow, initialData, onComplete, onCancel }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);

  const currentStep = workflow.steps[currentStepIndex];
  const isLastStep = currentStepIndex === workflow.steps.length - 1;

  const handleAnswer = (stepId, answer) => {
    setAnswers(prev => ({ ...prev, [stepId]: answer }));
  };

  const handleNext = () => {
    const answer = answers[currentStep.step_id];
    
    // Check conditional logic
    if (currentStep.conditional_logic) {
      const nextStepId = evaluateConditionalLogic(currentStep.conditional_logic, answer, answers);
      if (nextStepId) {
        const nextIndex = workflow.steps.findIndex(s => s.step_id === nextStepId);
        if (nextIndex !== -1) {
          setCurrentStepIndex(nextIndex);
          return;
        }
      }
    }

    // Check options for next step
    if (currentStep.question_type === 'yes_no' || currentStep.question_type === 'single_choice') {
      const selectedOption = currentStep.options?.find(opt => opt.value === answer);
      if (selectedOption?.next_step) {
        const nextIndex = workflow.steps.findIndex(s => s.step_id === selectedOption.next_step);
        if (nextIndex !== -1) {
          setCurrentStepIndex(nextIndex);
          return;
        }
      }
    }

    // Default next step
    if (currentStep.default_next_step) {
      const nextIndex = workflow.steps.findIndex(s => s.step_id === currentStep.default_next_step);
      if (nextIndex !== -1) {
        setCurrentStepIndex(nextIndex);
        return;
      }
    }

    // Just go to next in sequence
    if (currentStepIndex < workflow.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const evaluateConditionalLogic = (logic, currentAnswer, allAnswers) => {
    if (!logic?.conditions || logic.conditions.length === 0) return logic.else_step;

    let conditionsMet = true;
    for (const condition of logic.conditions) {
      const fieldAnswer = allAnswers[condition.field];
      let met = false;

      switch (condition.operator) {
        case '=':
          met = fieldAnswer === condition.value;
          break;
        case '!=':
          met = fieldAnswer !== condition.value;
          break;
        case 'contains':
          met = String(fieldAnswer).includes(condition.value);
          break;
        case 'in':
          met = condition.value.split(',').includes(fieldAnswer);
          break;
        default:
          met = false;
      }

      if (condition.logic_operator === 'AND' && !met) {
        conditionsMet = false;
        break;
      }
      if (condition.logic_operator === 'OR' && met) {
        conditionsMet = true;
        break;
      }
    }

    return conditionsMet ? logic.next_step : logic.else_step;
  };

  const handleComplete = () => {
    setLoading(true);
    
    // Build completion data
    const completionData = Object.entries(answers).map(([stepId, answer]) => {
      const step = workflow.steps.find(s => s.step_id === stepId);
      return {
        step_id: stepId,
        step_title: step?.step_title,
        answer: answer,
        result_status: step?.result_status,
        result_description: step?.result_description
      };
    });

    onComplete(completionData);
    setLoading(false);
  };

  const renderQuestionInput = () => {
    const answer = answers[currentStep.step_id];

    switch (currentStep.question_type) {
      case 'yes_no':
        return (
          <div className="flex gap-4">
            {currentStep.options?.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={answer === option.value ? "default" : "outline"}
                onClick={() => handleAnswer(currentStep.step_id, option.value)}
                className="flex-1"
              >
                {option.label}
              </Button>
            ))}
          </div>
        );

      case 'single_choice':
        return (
          <Select
            value={answer}
            onValueChange={(value) => handleAnswer(currentStep.step_id, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {currentStep.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {currentStep.options?.map((option) => {
              const selectedValues = answer || [];
              const isSelected = selectedValues.includes(option.value);
              
              return (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const newValues = checked
                        ? [...selectedValues, option.value]
                        : selectedValues.filter(v => v !== option.value);
                      handleAnswer(currentStep.step_id, newValues);
                    }}
                  />
                  <Label>{option.label}</Label>
                </div>
              );
            })}
          </div>
        );

      case 'text_input':
        return (
          <Input
            value={answer || ""}
            onChange={(e) => handleAnswer(currentStep.step_id, e.target.value)}
            placeholder={currentStep.help_text || "Enter your answer..."}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={answer || ""}
            onChange={(e) => handleAnswer(currentStep.step_id, e.target.value)}
            placeholder={currentStep.help_text || "Enter your answer..."}
            rows={4}
          />
        );

      case 'number_input':
        return (
          <Input
            type="number"
            value={answer || ""}
            onChange={(e) => handleAnswer(currentStep.step_id, e.target.value)}
            placeholder={currentStep.help_text || "Enter a number..."}
          />
        );

      case 'date_input':
        return (
          <Input
            type="date"
            value={answer || ""}
            onChange={(e) => handleAnswer(currentStep.step_id, e.target.value)}
          />
        );

      case 'info':
        return null;

      case 'result':
        return (
          <Alert className={`${
            currentStep.result_status === 'reportable' ? 'bg-green-50 border-green-200' :
            currentStep.result_status === 'non_reportable' ? 'bg-slate-50 border-slate-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>
              <strong>Result:</strong> {currentStep.result_description}
            </AlertDescription>
          </Alert>
        );

      default:
        return <p className="text-slate-500">Unsupported question type</p>;
    }
  };

  const canProceed = () => {
    if (currentStep.question_type === 'info' || currentStep.question_type === 'result') {
      return true;
    }
    if (!currentStep.required) {
      return true;
    }
    const answer = answers[currentStep.step_id];
    return answer !== undefined && answer !== null && answer !== '';
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-indigo-600 h-full transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / workflow.steps.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-medium text-slate-600">
          {currentStepIndex + 1} / {workflow.steps.length}
        </span>
      </div>

      {/* Current Step */}
      <Card className="border-2 border-indigo-100">
        <CardHeader>
          <CardTitle>{currentStep.step_title}</CardTitle>
          {currentStep.step_description && (
            <CardDescription>{currentStep.step_description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStep.question_text && (
            <div>
              <Label className="text-base">{currentStep.question_text}</Label>
              {currentStep.help_text && (
                <p className="text-sm text-slate-500 mt-1">{currentStep.help_text}</p>
              )}
            </div>
          )}

          {renderQuestionInput()}

          {currentStep.regulatory_reference && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900">
                <strong>Reference:</strong> {currentStep.regulatory_reference}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={currentStepIndex === 0 ? onCancel : handleBack}
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {currentStepIndex === 0 ? "Cancel" : "Back"}
        </Button>

        <Button
          type="button"
          onClick={isLastStep || currentStep.question_type === 'result' ? handleComplete : handleNext}
          disabled={!canProceed() || loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : isLastStep || currentStep.question_type === 'result' ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Complete
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}