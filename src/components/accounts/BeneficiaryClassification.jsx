import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

// Beneficiary classification workflow steps
const BENEFICIARY_WORKFLOW_STEPS = [
  {
    step_id: "step_residence",
    step_title: "Tax Residence Check",
    question_text: "Is the beneficiary a tax resident in a CRS participating jurisdiction?",
    question_type: "yes_no",
    help_text: "Check if the beneficiary's country of residence participates in CRS reporting.",
    options: [
      { value: "YES", label: "Yes - Tax resident in CRS jurisdiction", next_step: "step_tin" },
      { value: "NO", label: "No - Not a CRS jurisdiction resident", next_step: "step_non_reportable" }
    ]
  },
  {
    step_id: "step_tin",
    step_title: "Tax Identification Number",
    question_text: "Has the beneficiary provided a valid Tax Identification Number (TIN)?",
    question_type: "yes_no",
    help_text: "A TIN is required for CRS reporting purposes.",
    options: [
      { value: "YES", label: "Yes - TIN provided", next_step: "step_address_verification" },
      { value: "NO", label: "No - TIN not available", next_step: "step_tin_reason" }
    ]
  },
  {
    step_id: "step_tin_reason",
    step_title: "TIN Unavailable Reason",
    question_text: "Why is the TIN not available?",
    question_type: "single_choice",
    help_text: "Select the reason for TIN unavailability.",
    options: [
      { value: "NOT_ISSUED", label: "Country does not issue TINs", next_step: "step_address_verification" },
      { value: "NOT_REQUIRED", label: "TIN not required by law", next_step: "step_address_verification" },
      { value: "PENDING", label: "TIN application pending", next_step: "step_address_verification" },
      { value: "REFUSED", label: "Beneficiary refused to provide", next_step: "step_reportable_no_tin" }
    ]
  },
  {
    step_id: "step_address_verification",
    step_title: "Address Verification",
    question_text: "Is the beneficiary's address in a CRS participating jurisdiction?",
    question_type: "yes_no",
    help_text: "Verify that the address country matches the tax residence declaration.",
    options: [
      { value: "YES", label: "Yes - Address confirms CRS jurisdiction", next_step: "step_reportable" },
      { value: "NO", label: "No - Address indicates different jurisdiction", next_step: "step_indicia_review" }
    ]
  },
  {
    step_id: "step_indicia_review",
    step_title: "Indicia Review",
    question_text: "Are there any other foreign indicia that indicate reportability?",
    question_type: "yes_no",
    help_text: "Check for standing instructions, power of attorney, or other indicia.",
    options: [
      { value: "YES", label: "Yes - Other indicia present", next_step: "step_reportable" },
      { value: "NO", label: "No - No other indicia", next_step: "step_non_reportable" }
    ]
  },
  {
    step_id: "step_reportable",
    step_title: "Reportable",
    question_type: "result",
    result_status: "reportable",
    result_description: "This beneficiary is reportable under CRS. The beneficiary is a tax resident in a CRS participating jurisdiction and must be included in CRS reporting."
  },
  {
    step_id: "step_reportable_no_tin",
    step_title: "Reportable (No TIN)",
    question_type: "result",
    result_status: "reportable",
    result_description: "This beneficiary is reportable under CRS. Although TIN was not provided, the beneficiary must still be reported with appropriate TIN unavailability code."
  },
  {
    step_id: "step_non_reportable",
    step_title: "Non-Reportable",
    question_type: "result",
    result_status: "non_reportable",
    result_description: "This beneficiary is not reportable under CRS. The beneficiary is not a tax resident in any CRS participating jurisdiction."
  }
];

export default function BeneficiaryClassification({ beneficiary, account, onComplete, onCancel }) {
  const [currentStepId, setCurrentStepId] = useState(BENEFICIARY_WORKFLOW_STEPS[0].step_id);
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

  // Fetch CRS countries for display
  const { data: crsCountries = [] } = useQuery({
    queryKey: ['crs-countries'],
    queryFn: () => base44.entities.CrsCountryInfo.filter({ is_crs_country: true }),
    staleTime: Infinity
  });

  const stepMap = {};
  BENEFICIARY_WORKFLOW_STEPS.forEach(step => {
    stepMap[step.step_id] = step;
  });

  const currentStep = stepMap[currentStepId];
  const isResultStep = currentStep?.question_type === "result";

  const handleNext = () => {
    if (!selectedValue && !isResultStep) return;

    const newAnswers = { ...answers, [currentStepId]: selectedValue };
    setAnswers(newAnswers);
    setHistory([...history, currentStepId]);

    // Find next step
    const selectedOption = currentStep.options?.find(opt => opt.value === selectedValue);
    const nextStepId = selectedOption?.next_step;

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

  const progress = Math.round((history.length / (BENEFICIARY_WORKFLOW_STEPS.length - 2)) * 100);

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
          disabled={!selectedValue}
          size="lg"
          className="bg-purple-600 hover:bg-purple-700 text-white px-8"
        >
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}