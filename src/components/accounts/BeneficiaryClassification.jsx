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

// Beneficiary classification workflow steps based on flowchart
const BENEFICIARY_WORKFLOW_STEPS = [
  {
    step_id: "step_fi_crs_country",
    step_title: "Financial Institution CRS Country Check",
    question_text: "Is the beneficiary's bank account with the Financial Institution in a CRS reporting country?",
    question_type: "yes_no",
    help_text: "Check if the Financial Institution where the beneficiary holds the account is located in a CRS participating jurisdiction.",
    options: [
      { value: "YES", label: "Yes - FI is in a CRS reporting country", next_step: "step_beneficiary_tax_residence" },
      { value: "NO", label: "No - FI is not in a CRS reporting country", next_step: "step_collect_total_payments" }
    ]
  },
  {
    step_id: "step_beneficiary_tax_residence",
    step_title: "Beneficiary Tax Residence Check",
    question_text: "Is the tax residence of the beneficiary in a CRS reporting country?",
    question_type: "yes_no",
    help_text: "Check if the beneficiary's country of tax residence participates in CRS reporting.",
    options: [
      { value: "YES", label: "Yes - Tax resident in CRS country", next_step: "step_fi_same_as_residence" },
      { value: "NO", label: "No - Not a CRS country resident", next_step: "step_collect_total_payments" }
    ]
  },
  {
    step_id: "step_fi_same_as_residence",
    step_title: "FI Country Same as Residence",
    question_text: "Is the beneficiary's bank account with the Financial Institution in the same CRS reporting country as that of the beneficiary's residence?",
    question_type: "yes_no",
    help_text: "Check if the FI country matches the beneficiary's tax residence country.",
    options: [
      { value: "YES", label: "Yes - Same country", next_step: "step_reportable_per_beneficiary" },
      { value: "NO", label: "No - Different countries", next_step: "step_fi_is_rfi" }
    ]
  },
  {
    step_id: "step_fi_is_rfi",
    step_title: "FI is a Reporting Financial Institution",
    question_text: "Is the beneficiary's Financial Institution (FI) itself an RFI that should perform its own reporting?",
    question_type: "yes_no",
    help_text: "Check if the beneficiary's FI is a Reporting Financial Institution with its own CRS reporting obligations.",
    options: [
      { value: "YES", label: "Yes - FI is an RFI and will report", next_step: "step_non_reportable_fi_reports" },
      { value: "NO", label: "No - FI is not an RFI", next_step: "step_reportable_per_beneficiary" }
    ]
  },
  {
    step_id: "step_collect_total_payments",
    step_title: "Collect Total Payments Information",
    question_type: "info",
    question_text: "Collect total value (sum) of payments to beneficiaries per FI, then collect other CRS reporting info.",
    help_text: "This triggers manual CRS reporting on total value (sum) of payments to beneficiaries per FI.",
    next_step: "step_manual_report_total"
  },
  {
    step_id: "step_manual_report_total",
    step_title: "Manual CRS Reporting - Total Payments",
    question_type: "result",
    result_status: "reportable",
    result_description: "Start Manual CRS reporting on total value (sum) of payments to beneficiaries per FI. The account needs to be reported with aggregated payment information.",
    result_action: "manual_report_total"
  },
  {
    step_id: "step_reportable_per_beneficiary",
    step_title: "Reportable Per Beneficiary",
    question_type: "result",
    result_status: "reportable",
    result_description: "Collect CRS reporting info on payments to each single beneficiary. Start Manual CRS reporting on payments to each single beneficiary.",
    result_action: "report_per_beneficiary"
  },
  {
    step_id: "step_non_reportable_fi_reports",
    step_title: "Non-Reportable - FI Reports",
    question_type: "result",
    result_status: "non_reportable",
    result_description: "Record Account in Dashboard as: Non-Reportable Account. Reason: Death of Account Holder - Beneficiary's Financial Institution (FI) is itself an RFI and should perform its own reporting.",
    result_action: "fi_reports"
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
  const isInfoStep = currentStep?.question_type === "info";

  const handleNext = () => {
    // For info steps, no selection needed
    const isInfoStep = currentStep?.question_type === "info";
    if (!selectedValue && !isResultStep && !isInfoStep) return;

    const newAnswers = { ...answers, [currentStepId]: selectedValue || "ACKNOWLEDGED" };
    setAnswers(newAnswers);
    setHistory([...history, currentStepId]);

    // Find next step
    let nextStepId;
    if (isInfoStep) {
      nextStepId = currentStep.next_step;
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