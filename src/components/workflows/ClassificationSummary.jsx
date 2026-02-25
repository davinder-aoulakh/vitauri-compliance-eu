import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Clock, ArrowLeft, FileCheck, Info, Calendar } from "lucide-react";

export default function ClassificationSummary({
  account,
  workflow,
  stepMap,
  completedPath,
  answers,
  onBack,
  onComplete
}) {
  const finalNode = stepMap[completedPath[completedPath.length - 1]];
  
  // Determine reportability status
  let summaryReportabilityStatus = "pending_review";
  
  console.log('\n🔍🔍🔍 [SUMMARY DISPLAY - DEBUG] Starting reportability status determination...');
  console.log('  Final Node:', finalNode);
  console.log('  Final Node Step Title:', finalNode?.step_title);
  console.log('  Final Node result_status:', finalNode?.result_status);
  console.log('  Final Node post_completion_actions:', finalNode?.post_completion_actions);
  console.log('  All Answers:', answers);
  
  let valueFoundInPriority1 = false;
  
  // PRIORITY 1: Post-completion actions
  if (finalNode?.post_completion_actions?.length > 0) {
    console.log(`  📋 [PRIORITY 1] Checking post-completion actions (${finalNode.post_completion_actions.length} actions)`);
    
    const statusAction = finalNode.post_completion_actions.find(
      action => action.field_to_update === "reportability_status"
    );
    
    if (statusAction) {
      console.log('    Found reportability_status action:', statusAction);
      let extractedValue = null;
      
      if (statusAction.value_source === "static_value") {
        extractedValue = statusAction.value;
        console.log(`    → static_value: "${extractedValue}"`);
      } else if (statusAction.value_source === "from_step_answer") {
        const sourceStepId = statusAction.value;
        extractedValue = answers[sourceStepId];
        console.log(`    → from_step_answer: step="${sourceStepId}", value="${extractedValue}"`);
      }
      
      if (extractedValue) {
        summaryReportabilityStatus = extractedValue;
        valueFoundInPriority1 = true;
        console.log(`  ✅✅✅ [PRIORITY 1 - LOCKED IN] Using post-completion action value: "${summaryReportabilityStatus}"`);
      }
    }
  }
  
  // PRIORITY 2: Explicit result_status from workflow step
  if (!valueFoundInPriority1 && finalNode?.result_status) {
    summaryReportabilityStatus = finalNode.result_status;
    console.log(`  ✅ [PRIORITY 2] Using result_status from workflow config: "${summaryReportabilityStatus}"`);
  }
  
  // PRIORITY 3: Fallback to text-based inference
  if (summaryReportabilityStatus === "pending_review" && !valueFoundInPriority1) {
    console.log(`  🔤 [PRIORITY 3] Using text-based inference`);
    if (finalNode?.step_title?.toLowerCase().includes("reportable") &&
        !finalNode?.step_title?.toLowerCase().includes("non-reportable")) {
      summaryReportabilityStatus = "reportable";
    } else if (finalNode?.step_title?.toLowerCase().includes("non-reportable")) {
      summaryReportabilityStatus = "non_reportable";
    }
  }
  
  console.log(`\n  🎯 FINAL SUMMARY STATUS: "${summaryReportabilityStatus}"`);
  
  const isReportable = summaryReportabilityStatus === "reportable";
  const isPending = summaryReportabilityStatus === "pending_review";

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
          isReportable ? 'bg-amber-100' : isPending ? 'bg-blue-100' : 'bg-green-100'
        }`}>
          {isReportable ? (
            <AlertCircle className="w-10 h-10 text-amber-600" />
          ) : isPending ? (
            <Clock className="w-10 h-10 text-blue-600" />
          ) : (
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {isPending ? 'Work In Progress' : 'Classification Complete'}
        </h2>
        <p className="text-slate-600">
          Review your answers and confirm the reportability status for account <strong>{account.account_number}</strong>
        </p>
      </div>

      {account.account_holder_type === "individual" && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            <strong>Account Context:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Account Type: {account.is_pre_existing ? "Pre-existing (opened before Jan 1, 2018)" : "New Account (Jan 1, 2018 or later)"}</li>
              <li>Account Holder Status: {account.account_holder_is_alive ? "Alive" : "Deceased"}</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card className={`border-2 ${
        isReportable ? 'bg-amber-50 border-amber-200' : isPending ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
      }`}>
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="w-5 h-5" />
            Reportability Assessment Result
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Status:</span>
              <Badge className={`text-sm ${
                isReportable ? 'bg-amber-600 text-white' : isPending ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
              }`}>
                {isReportable ? 'Reportable' : isPending ? 'Pending Review' : 'Non-Reportable'}
              </Badge>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-slate-700">Reason:</span>
              <span className="text-sm text-slate-900 text-right max-w-md">
                {finalNode?.help_text || finalNode?.step_title || "Classification completed"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="w-5 h-5" />
            Complete Answer Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {completedPath.map((stepId, idx) => {
              const step = stepMap[stepId];
              const answer = answers[stepId];
              if (!step || !answer) return null;

              let answerLabel;
              if (typeof answer === 'string' && answer.includes(',') && step.question_type === 'multiple_choice') {
                const selectedValues = answer.split(',').filter(Boolean);
                const labels = selectedValues.map(v =>
                  step.options?.find(o => o.value === v)?.label || v
                );
                answerLabel = labels.join(', ');
              } else if (typeof answer === 'object' && answer !== null) {
                if (answer.file_name) {
                  answerLabel = answer.date_received
                    ? `${answer.file_name} (Received: ${answer.date_received})`
                    : answer.file_name;
                } else if (answer.controlling_persons_count !== undefined || answer.savedPersons) {
                  answerLabel = `${answer.savedPersons?.length || answer.controlling_persons_count || 0} controlling person(s) added`;
                } else if (answer.beneficiaries_count !== undefined || answer.savedBeneficiaries) {
                  answerLabel = `${answer.savedBeneficiaries?.length || answer.beneficiaries_count || 0} beneficiary(ies) added`;
                } else if (answer._address_config) {
                  const { _address_config, ...addr } = answer;
                  const parts = [addr.street, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean);
                  answerLabel = parts.join(', ') || 'Address entered';
                } else {
                  const fieldValues = Object.entries(answer)
                    .filter(([k]) => !k.startsWith('_'))
                    .map(([k, v]) => v)
                    .filter(Boolean);
                  answerLabel = fieldValues.join(', ') || 'Data entered';
                }
              } else {
                answerLabel = step.options?.find(o => o.value === answer)?.label || String(answer || '');
              }

              return (
                <div key={stepId} className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 font-semibold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 mb-1">
                      {step.step_title}
                    </p>
                    {step.question_text && (
                      <p className="text-xs text-slate-600 mb-2">{step.question_text}</p>
                    )}
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                      {answerLabel}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack} size="lg">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Review Answers
        </Button>
        <Button onClick={onComplete} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Complete Classification
        </Button>
      </div>
    </div>
  );
}