import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Info,
  User,
  MapPin,
  Globe,
  AlertCircle
} from "lucide-react";

export default function BeneficiaryClassification({ beneficiary, account, onComplete, onCancel }) {
  const [currentStepId, setCurrentStepId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [selectedValue, setSelectedValue] = useState("");
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);

  // Load user
  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  // Fetch the beneficiary classification workflow from the database
  const { data: workflows = [], isLoading: loadingWorkflows } = useQuery({
    queryKey: ['beneficiary-classification-workflow'],
    queryFn: () => base44.entities.Workflow.filter({ 
      workflow_type: "beneficiary_classification",
      status: "published"
    }),
    staleTime: 5 * 60 * 1000
  });

  // Get the active workflow
  const workflow = workflows[0];
  const workflowSteps = workflow?.steps || [];

  // Initialize first step when workflow loads
  React.useEffect(() => {
    if (workflowSteps.length > 0 && !currentStepId) {
      setCurrentStepId(workflowSteps[0].step_id);
    }
  }, [workflowSteps, currentStepId]);

  // Fetch CRS countries for display
  const { data: crsCountries = [] } = useQuery({
    queryKey: ['crs-countries'],
    queryFn: () => base44.entities.CrsCountryInfo.filter({ is_crs_country: true }),
    staleTime: Infinity
  });

  // Build step map
  const stepMap = {};
  workflowSteps.forEach(step => {
    stepMap[step.step_id] = step;
  });

  const currentStep = stepMap[currentStepId];
  const isResultStep = currentStep?.question_type === "result";
  const isInfoStep = currentStep?.question_type === "info";

  // Loading state
  if (loadingWorkflows) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
        <p className="text-slate-600">Loading classification workflow...</p>
      </div>
    );
  }

  // No workflow found
  if (!workflow) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          No Classification Workflow Found
        </h3>
        <p className="text-slate-600 mb-4">
          A "Beneficiary Classification" workflow needs to be created and published in the Workflow Builder.
        </p>
        <Button variant="outline" onClick={onCancel}>
          Close
        </Button>
      </div>
    );
  }

  // No current step (shouldn't happen)
  if (!currentStep) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <p className="text-slate-600">Error loading workflow step.</p>
        <Button variant="outline" onClick={onCancel} className="mt-4">
          Close
        </Button>
      </div>
    );
  }

  const handleNext = () => {
    // For info steps, no selection needed
    if (!selectedValue && !isResultStep && !isInfoStep) return;

    const newAnswers = { ...answers, [currentStepId]: selectedValue || "ACKNOWLEDGED" };
    setAnswers(newAnswers);
    setHistory([...history, currentStepId]);

    // Find next step
    let nextStepId;
    if (isInfoStep) {
      nextStepId = currentStep.default_next_step || currentStep.next_step;
    } else {
      const selectedOption = currentStep.options?.find(opt => opt.value === selectedValue);
      nextStepId = selectedOption?.next_step;
    }

    if (nextStepId && stepMap[nextStepId]) {
      setCurrentStepId(nextStepId);
      setSelectedValue("");
    }
  };

  const handleBack = () => {
    if (history.length === 0) {
      onCancel();
      return;
    }

    const previousStepId = history[history.length - 1];
    const newAnswers = { ...answers };
    delete newAnswers[currentStepId];

    setAnswers(newAnswers);
    setHistory(history.slice(0, -1));
    setCurrentStepId(previousStepId);
    setSelectedValue(answers[previousStepId] || "");
  };

  const handleComplete = () => {
    const classificationData = {
      classification_answers: answers,
      reportability_status: currentStep.result_status,
      reportability_reason: currentStep.result_description,
      result_action: currentStep.result_action || null,
      classification_date: new Date().toISOString(),
      classified_by: user?.email || "unknown"
    };
    onComplete(classificationData);
  };

  // Check if beneficiary's country is CRS
  const beneficiaryCountry = beneficiary?.address?.country;
  const isCrsCountry = crsCountries.some(c => 
    c.country_code?.toLowerCase() === beneficiaryCountry?.toLowerCase() ||
    c.country_name?.toLowerCase() === beneficiaryCountry?.toLowerCase()
  );

  const totalSteps = workflowSteps.filter(s => s.question_type !== "result").length;
  const progress = Math.round((history.length / Math.max(totalSteps - 1, 1)) * 100);

  // Get action label for result
  const getActionLabel = (action) => {
    const actionLabels = {
      manual_report_total: "Manual CRS Reporting - Total Payments per FI",
      report_per_beneficiary: "CRS Reporting per Individual Beneficiary",
      fi_reports: "FI Handles Own Reporting"
    };
    return actionLabels[action] || action;
  };

  // Result Screen
  if (isResultStep) {
    const isReportable = currentStep.result_status === "reportable";

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
            isReportable ? 'bg-amber-100' : 'bg-green-100'
          }`}>
            {isReportable ? (
              <AlertCircle className="w-10 h-10 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {currentStep.step_title}
          </h2>
          <p className="text-slate-600">
            Classification complete for <strong>{beneficiary.full_name}</strong>
          </p>
        </div>

        {/* Beneficiary Info */}
        <Alert className="bg-purple-50 border-purple-200">
          <User className="w-4 h-4 text-purple-600" />
          <AlertDescription className="text-sm text-purple-900">
            <strong>Beneficiary:</strong> {beneficiary.full_name}
            {beneficiary.address?.country && (
              <span className="block mt-1">
                <MapPin className="w-3 h-3 inline mr-1" />
                {[beneficiary.address.city, beneficiary.address.country].filter(Boolean).join(", ")}
              </span>
            )}
          </AlertDescription>
        </Alert>

        {/* Result */}
        <Card className={`border-2 ${
          isReportable 
            ? 'bg-amber-50 border-amber-200' 
            : 'bg-green-50 border-green-200'
        }`}>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Status:</span>
                <Badge className={`text-sm ${
                  isReportable 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-green-600 text-white'
                }`}>
                  {isReportable ? 'Reportable' : 'Non-Reportable'}
                </Badge>
              </div>
              {currentStep.result_action && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Action:</span>
                  <Badge variant="outline" className="text-sm bg-blue-50 text-blue-800 border-blue-200">
                    {getActionLabel(currentStep.result_action)}
                  </Badge>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-slate-700">Reason:</span>
                <p className="text-sm text-slate-900 mt-1">
                  {currentStep.result_description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Answer Summary */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base">Classification Path</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {history.map((stepId, idx) => {
                const step = stepMap[stepId];
                const answer = answers[stepId];
                const answerLabel = step?.options?.find(o => o.value === answer)?.label || answer;

                return (
                  <div key={stepId} className="flex items-center gap-3 text-sm py-2 border-b border-slate-100 last:border-0">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </div>
                    <span className="text-slate-600 flex-1">{step?.step_title}</span>
                    <Badge variant="outline" className="text-xs">
                      {answerLabel}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleBack} size="lg">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Review
          </Button>
          <Button 
            onClick={handleComplete}
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Complete
          </Button>
        </div>
      </div>
    );
  }

  // Main Workflow Screen
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Beneficiary Classification</h2>
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            {beneficiary.full_name}
          </Badge>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">
            Step {history.length + 1}
          </p>
          <p className="text-xs text-slate-500">{Math.min(progress, 100)}% Complete</p>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Beneficiary Context */}
      <Alert className="bg-purple-50 border-purple-200">
        <User className="w-4 h-4 text-purple-600" />
        <AlertDescription className="text-sm text-purple-900">
          <strong>Beneficiary:</strong> {beneficiary.full_name}
          {beneficiary.address?.country && (
            <span className="ml-2">
              • <Globe className="w-3 h-3 inline" /> {beneficiary.address.country}
              {isCrsCountry && (
                <Badge className="ml-2 bg-blue-100 text-blue-800 text-xs">CRS Country</Badge>
              )}
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Current Step */}
      <Card className="border-2 border-purple-100 bg-gradient-to-br from-white to-purple-50/30 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">{history.length + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {currentStep.step_title}
                </h3>
                {currentStep.question_text && (
                  <p className="text-slate-700 mb-3 leading-relaxed">
                    {currentStep.question_text}
                  </p>
                )}
                {currentStep.help_text && (
                  <Alert className="bg-blue-50 border-blue-200 mb-4">
                    <Info className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">
                      {currentStep.help_text}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="pl-16">
              {currentStep.question_type === "yes_no" && (
                <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
                  {currentStep.options?.map((option) => (
                    <div 
                      key={option.value}
                      className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer"
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
                        <CheckCircle2 className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                  ))}
                </RadioGroup>
              )}

              {currentStep.question_type === "single_choice" && (
                <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
                  {currentStep.options?.map((option) => (
                    <div 
                      key={option.value}
                      className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer"
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
                        <CheckCircle2 className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                  ))}
                </RadioGroup>
              )}

              {currentStep.question_type === "info" && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-sm text-amber-900">
                    <strong>Action Required:</strong> {currentStep.question_text}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button variant="outline" onClick={handleBack} size="lg">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {history.length === 0 ? "Cancel" : "Previous"}
        </Button>
        <Button 
          onClick={handleNext}
          disabled={!selectedValue && !isInfoStep}
          size="lg"
          className="bg-purple-600 hover:bg-purple-700 text-white px-8"
        >
          {isInfoStep ? "Continue" : "Next"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}