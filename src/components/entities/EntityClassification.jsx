import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CLASSIFICATION_STEPS = [
  {
    id: "is_fi",
    question: "Is this entity a Financial Institution?",
    help: "A Financial Institution includes custodial institutions, depository institutions, investment entities, or specified insurance companies.",
    options: [
      { value: "yes", label: "Yes", next: "fi_type" },
      { value: "no", label: "No", next: "nfe_type" }
    ]
  },
  {
    id: "fi_type",
    question: "What type of Financial Institution is it?",
    help: "Select the category that best describes the entity's financial activities.",
    type: "select",
    options: [
      { value: "custodial_institution", label: "Custodial Institution" },
      { value: "depository_institution", label: "Depository Institution" },
      { value: "investment_entity", label: "Investment Entity" },
      { value: "specified_insurance_company", label: "Specified Insurance Company" }
    ],
    next: "is_reporting"
  },
  {
    id: "is_reporting",
    question: "Does this FI have CRS reporting obligations?",
    help: "Some Financial Institutions are exempt from reporting (e.g., governmental entities, pension funds, certain credit card issuers).",
    options: [
      { value: "yes", label: "Yes - Reporting FI", next: "complete_rfi" },
      { value: "no", label: "No - Non-Reporting FI", next: "complete_non_rfi" }
    ]
  },
  {
    id: "nfe_type",
    question: "Is this Non-Financial Entity (NFE) active or passive?",
    help: "Active NFEs are operational businesses. Passive NFEs primarily earn passive income (investment, holding companies).",
    options: [
      { value: "active", label: "Active NFE", next: "complete_active_nfe" },
      { value: "passive", label: "Passive NFE", next: "complete_passive_nfe" }
    ]
  }
];

export default function EntityClassification({ entity, onComplete, onCancel }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState(entity?.classification_answers || {});
  const [selectedValue, setSelectedValue] = useState("");

  const step = CLASSIFICATION_STEPS[currentStep];

  const handleNext = () => {
    if (!selectedValue) return;

    const newAnswers = { ...answers, [step.id]: selectedValue };
    setAnswers(newAnswers);

    const currentOption = step.options.find(o => o.value === selectedValue);
    const nextStepId = currentOption?.next;

    if (nextStepId?.startsWith("complete_")) {
      completeClassification(nextStepId, newAnswers);
    } else {
      const nextStepIndex = CLASSIFICATION_STEPS.findIndex(s => s.id === nextStepId);
      if (nextStepIndex !== -1) {
        setCurrentStep(nextStepIndex);
        setSelectedValue("");
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setSelectedValue(answers[CLASSIFICATION_STEPS[currentStep - 1].id] || "");
    }
  };

  const completeClassification = (resultType, finalAnswers) => {
    let classificationData = {
      classification_answers: finalAnswers,
      classification_completed_date: new Date().toISOString().split('T')[0]
    };

    switch (resultType) {
      case "complete_rfi":
        classificationData.rfi_status = "reporting_fi";
        classificationData.fi_type = finalAnswers.fi_type;
        break;
      case "complete_non_rfi":
        classificationData.rfi_status = "non_reporting_fi";
        classificationData.fi_type = finalAnswers.fi_type;
        classificationData.non_reporting_reason = "Exempt from CRS reporting";
        break;
      case "complete_active_nfe":
        classificationData.rfi_status = "nfe_active";
        classificationData.fi_type = "not_applicable";
        break;
      case "complete_passive_nfe":
        classificationData.rfi_status = "nfe_passive";
        classificationData.fi_type = "not_applicable";
        break;
    }

    onComplete(classificationData);
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Classification Progress</span>
          <span className="text-sm text-slate-500">Step {currentStep + 1} of {CLASSIFICATION_STEPS.length}</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / CLASSIFICATION_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-white font-bold text-sm">{currentStep + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {step.question}
                </h3>
                {step.help && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">
                      {step.help}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="ml-11 space-y-3">
              {step.type === "select" ? (
                <Select value={selectedValue} onValueChange={setSelectedValue}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select FI type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {step.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
                  {step.options.map((option) => (
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
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous Answers Summary */}
      {Object.keys(answers).length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Previous Answers</h4>
            <div className="space-y-2">
              {Object.entries(answers).map(([key, value]) => {
                const stepInfo = CLASSIFICATION_STEPS.find(s => s.id === key);
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{stepInfo?.question}</span>
                    <Badge variant="outline" className="capitalize">
                      {value.replace(/_/g, " ")}
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
          onClick={currentStep === 0 ? onCancel : handleBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {currentStep === 0 ? "Cancel" : "Back"}
        </Button>
        <Button 
          onClick={handleNext}
          disabled={!selectedValue}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}