import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, Info, FileCheck, Check } from "lucide-react";

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
        const yesNoOptions = currentStep.options || [
          { value: "YES", label: "Yes" },
          { value: "NO", label: "No" }
        ];
        
        return (
          <div className="space-y-3">
            <RadioGroup value={answer} onValueChange={(value) => handleAnswer(currentStep.step_id, value)}>
              {yesNoOptions.map((option) => (
                <div 
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer"
                  onClick={() => handleAnswer(currentStep.step_id, option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label 
                    htmlFor={option.value}
                    className="flex-1 cursor-pointer font-medium text-slate-900"
                  >
                    {option.label}
                  </Label>
                  {option.value === answer && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'single_choice':
        return (
          <div className="space-y-4">
            <Select
              value={answer}
              onValueChange={(value) => handleAnswer(currentStep.step_id, value)}
            >
              <SelectTrigger className="w-full h-12">
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
          </div>
        );

      case 'multiple_choice':
        const selectedOptions = answer ? (Array.isArray(answer) ? answer : answer.split(',').filter(Boolean)) : [];
        
        return (
          <div className="space-y-3">
            {currentStep.options?.map((option) => {
              const isSelected = selectedOptions.includes(option.value);
              
              return (
                <div 
                  key={option.value}
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                  onClick={() => {
                    const newValues = isSelected
                      ? selectedOptions.filter(v => v !== option.value)
                      : [...selectedOptions, option.value];
                    handleAnswer(currentStep.step_id, newValues);
                  }}
                >
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const newValues = checked
                        ? [...selectedOptions, option.value]
                        : selectedOptions.filter(v => v !== option.value);
                      handleAnswer(currentStep.step_id, newValues);
                    }}
                    id={`option-${option.value}`}
                  />
                  <Label 
                    htmlFor={`option-${option.value}`}
                    className="flex-1 cursor-pointer font-medium text-slate-900"
                  >
                    {option.label}
                  </Label>
                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
              );
            })}
            {selectedOptions.length > 0 && (
              <p className="text-sm text-slate-600 mt-2">
                {selectedOptions.length} option(s) selected
              </p>
            )}
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

  const currentStepIndex = history.length;
  const progress = Math.round(((currentStepIndex + 1) / workflow.steps.length) * 100);

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
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
        {history.map((stepId, idx) => {
          const step = workflow.steps.find(s => s.step_id === stepId);
          
          return (
            <React.Fragment key={stepId}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all bg-green-50 border-green-200">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-600">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-medium whitespace-nowrap text-green-700">
                  {step?.step_title?.substring(0, 15) || `Step ${idx + 1}`}
                  {step?.step_title?.length > 15 && '...'}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </React.Fragment>
          );
        })}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all bg-indigo-50 border-indigo-300">
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-600">
            <span className="text-white text-xs font-bold">{history.length + 1}</span>
          </div>
          <span className="text-xs font-medium whitespace-nowrap text-indigo-700">
            {currentStep?.step_title?.substring(0, 15) || `Step ${history.length + 1}`}
            {currentStep?.step_title?.length > 15 && '...'}
          </span>
        </div>
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
                  {currentStep.step_title}
                </h3>
                {currentStep.question_text && (
                  <p className="text-slate-700 mb-3 leading-relaxed">{currentStep.question_text}</p>
                )}
                {currentStep.help_text && (
                  <Alert className="bg-blue-50 border-blue-200 mb-4">
                    <Info className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">
                      {currentStep.help_text}
                    </AlertDescription>
                  </Alert>
                )}
                {currentStep.regulatory_reference && (
                  <p className="text-xs text-slate-500 italic mb-3 flex items-center gap-2">
                    <FileCheck className="w-3 h-3" />
                    Reference: {currentStep.regulatory_reference}
                  </p>
                )}
              </div>
            </div>

            <div className="pl-16">
              {renderQuestionInput()}
            </div>
          </div>
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