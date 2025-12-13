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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, Info, FileCheck, Check, GitBranch, Sparkles, Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import WorkflowVisualizer from "./WorkflowVisualizer";
import AIWorkflowHelper from "../ai/AIWorkflowHelper";

export default function WorkflowRunner({ workflow, initialData, onComplete, onCancel }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showFlowchart, setShowFlowchart] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [dragActive, setDragActive] = useState({});

  const currentStep = workflow.steps[currentStepIndex];
  const isLastStep = currentStepIndex === workflow.steps.length - 1;

  const handleAnswer = (stepId, answer) => {
    setAnswers(prev => ({ ...prev, [stepId]: answer }));
  };

  const handleNext = () => {
    const answer = answers[currentStep.step_id];
    
    // Add current step to history
    setHistory(prev => [...prev, currentStep.step_id]);
    
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
    if (history.length > 0) {
      setHistory(prev => prev.slice(0, -1));
    }
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
        // Ensure date value is in YYYY-MM-DD format for HTML5 date input
        // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss.sssZ" formats
        let dateValue = '';
        if (answer) {
          if (typeof answer === 'string') {
            // Extract just the date part (YYYY-MM-DD) from ISO strings or keep as-is
            dateValue = answer.includes('T') ? answer.split('T')[0] : answer;
          }
        }
        
        return (
          <Input
            key={`${currentStep.step_id}-${dateValue}`}
            type="date"
            value={dateValue}
            onChange={(e) => handleAnswer(currentStep.step_id, e.target.value)}
          />
        );

      case 'file_upload':
        const uploadedFiles = answer || [];
        const isUploading = uploadingFiles[currentStep.step_id];
        const isDragging = dragActive[currentStep.step_id];

        const handleFileChange = async (files) => {
          if (!files || files.length === 0) return;

          setUploadingFiles(prev => ({ ...prev, [currentStep.step_id]: true }));

          try {
            const uploadPromises = Array.from(files).map(async (file) => {
              const { file_url } = await base44.integrations.Core.UploadFile({ file });
              return {
                name: file.name,
                url: file_url,
                size: file.size,
                type: file.type
              };
            });

            const newFiles = await Promise.all(uploadPromises);
            const currentFiles = Array.isArray(answer) ? answer : [];
            handleAnswer(currentStep.step_id, [...currentFiles, ...newFiles]);
          } catch (error) {
            console.error("File upload error:", error);
            alert("Failed to upload file(s). Please try again.");
          } finally {
            setUploadingFiles(prev => ({ ...prev, [currentStep.step_id]: false }));
          }
        };

        const handleDrag = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(prev => ({ ...prev, [currentStep.step_id]: true }));
          } else if (e.type === "dragleave") {
            setDragActive(prev => ({ ...prev, [currentStep.step_id]: false }));
          }
        };

        const handleDrop = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(prev => ({ ...prev, [currentStep.step_id]: false }));
          
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files);
          }
        };

        const removeFile = (index) => {
          const currentFiles = Array.isArray(answer) ? answer : [];
          const newFiles = currentFiles.filter((_, i) => i !== index);
          handleAnswer(currentStep.step_id, newFiles);
        };

        return (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id={`file-upload-${currentStep.step_id}`}
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files)}
                multiple
                disabled={isUploading}
              />
              
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-indigo-600' : 'text-slate-400'}`} />
              
              {isUploading ? (
                <div className="space-y-2">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
                  <p className="text-sm font-medium text-slate-700">Uploading files...</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    {isDragging ? 'Drop files here' : 'Drag and drop files here'}
                  </p>
                  <p className="text-xs text-slate-500 mb-4">or</p>
                  <label
                    htmlFor={`file-upload-${currentStep.step_id}`}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Files
                  </label>
                </>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Uploaded Files ({uploadedFiles.length})
                </p>
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                        {file.size && (
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'address_input':
        const addressData = answer || {
          street: "",
          city: "",
          state: "",
          postal_code: "",
          country: ""
        };

        const handleAddressChange = (field, value) => {
          handleAnswer(currentStep.step_id, {
            ...addressData,
            [field]: value
          });
        };

        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">
                Street Address <span className="text-red-600">*</span>
              </Label>
              <Input
                value={addressData.street || ""}
                onChange={(e) => handleAddressChange("street", e.target.value)}
                placeholder="123 Main Street"
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  City <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={addressData.city || ""}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  placeholder="City"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">
                  State/Province <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={addressData.state || ""}
                  onChange={(e) => handleAddressChange("state", e.target.value)}
                  placeholder="State/Province"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Postal Code <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={addressData.postal_code || ""}
                  onChange={(e) => handleAddressChange("postal_code", e.target.value)}
                  placeholder="Postal Code"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Country <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={addressData.country || ""}
                  onChange={(e) => handleAddressChange("country", e.target.value)}
                  placeholder="Country"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
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
    
    // Special validation for address_input - all fields are required
    if (currentStep.question_type === 'address_input') {
      if (!answer || typeof answer !== 'object') return false;
      return !!(answer.street && answer.city && answer.state && answer.postal_code && answer.country);
    }
    
    return answer !== undefined && answer !== null && answer !== '';
  };

  const progress = Math.round(((currentStepIndex + 1) / workflow.steps.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header with Flowchart and AI buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">
            {workflow.workflow_name}
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              v{workflow.version}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFlowchart(true)}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            >
              <GitBranch className="w-4 h-4 mr-1" />
              Flowchart
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAIHelper(true)}
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              AI Assist
            </Button>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">
            Step {currentStepIndex + 1}
          </p>
          <p className="text-xs text-slate-500">{progress}% Complete</p>
        </div>
      </div>

      {/* Flowchart Dialog */}
      <Dialog open={showFlowchart} onOpenChange={setShowFlowchart}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Workflow Flowchart: {workflow.workflow_name}</DialogTitle>
          </DialogHeader>
          <WorkflowVisualizer workflow={workflow} />
        </DialogContent>
      </Dialog>

      {/* AI Helper Dialog */}
      <Dialog open={showAIHelper} onOpenChange={setShowAIHelper}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>AI Workflow Assistant</DialogTitle>
          </DialogHeader>
          <AIWorkflowHelper
            currentStep={currentStep}
            workflow={workflow}
            answers={answers}
            recordData={initialData}
            onSuggestedAnswer={(value) => {
              handleAnswer(currentStep.step_id, value);
            }}
          />
        </DialogContent>
      </Dialog>

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
            <span className="text-white text-xs font-bold">{currentStepIndex + 1}</span>
          </div>
          <span className="text-xs font-medium whitespace-nowrap text-indigo-700">
            {currentStep?.step_title?.substring(0, 15) || `Step ${currentStepIndex + 1}`}
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
                  const step = workflow.steps.find(s => s.step_id === key);
                  if (!step) return null;
                  
                  let displayValue = '';
                  if (Array.isArray(value)) {
                    displayValue = value.join(', ');
                  } else if (typeof value === 'object' && value !== null) {
                    displayValue = 'Data entered';
                  } else {
                    displayValue = step.options?.find(o => o.value === value)?.label || String(value || '');
                  }
                  
                  return (
                    <div key={key} className="flex items-start justify-between gap-4 text-sm py-2 border-b border-slate-200 last:border-0">
                      <span className="text-slate-600 text-xs flex-shrink-0 max-w-[40%]">
                        {step.step_title || key}
                      </span>
                      <span className="text-xs text-right text-slate-800 break-words">
                        {displayValue}
                      </span>
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
          onClick={history.length === 0 ? onCancel : handleBack}
          disabled={loading}
          size="lg"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {history.length === 0 ? "Cancel" : "Previous"}
        </Button>

        <Button
          type="button"
          onClick={isLastStep || currentStep.question_type === 'result' ? handleComplete : handleNext}
          disabled={!canProceed() || loading}
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
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
              Next Question
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}