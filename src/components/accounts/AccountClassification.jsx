import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, Loader2, AlertCircle, Users, Check, Circle, Upload, GitBranch, Brain, Sparkles, Calendar, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import MultiFieldRenderer from "../workflows/MultiFieldRenderer";
import WorkflowVisualizer from "../workflows/WorkflowVisualizer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CountrySelect from "../shared/CountrySelect";
import BeneficiaryInputRenderer from "@/components/accounts/BeneficiaryInputRenderer";
import ControllingPersonInputRenderer from "@/components/accounts/ControllingPersonInputRenderer";
import AIWorkflowHelper from "../ai/AIWorkflowHelper";
import AIClassificationAssistant from "../ai/AIClassificationAssistant";
import { evaluateSingleCondition, evaluateConditionalLogic } from "../workflows/workflowConditionUtils";
import { isActionNode } from "../workflows/workflowNavigationUtils";
import { getFieldValue as getFieldValueUtil } from "../workflows/workflowFieldUtils";
import { evaluateComputedComparison } from "../workflows/workflowPrefillUtils";
import WorkflowIntroFields from "../workflows/WorkflowIntroFields";
              <WorkflowIntroFields
                introFields={workflow.workflow_introduction_fields}
                mappedEntityData={latestAccountData || account}
              />
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!workflow.display_workflow_introduction && (
        <Alert className={isEntityWorkflow ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}>
          {isEntityWorkflow ? (
            <>
              <Users className="w-4 h-4 text-purple-600" />
              <AlertDescription className="text-sm text-purple-900">
                <strong>Entity Account:</strong> This workflow determines if the entity is a Financial Institution, Active NFE, or Passive NFE requiring controlling persons identification.
              </AlertDescription>
            </>
          ) : (
            <>
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900">
                <strong>Individual Account:</strong> This workflow follows CRS due diligence procedures for individual accounts.
                {account.is_pre_existing !== undefined && (
                  <span className="block mt-1">
                    Account Type: <strong>{account.is_pre_existing ? "Pre-existing (before 2018)" : "New (2018+)"}</strong>
                  </span>
                )}
                {account.account_holder_is_alive !== undefined && (
                  <span className="block mt-1">
                    Holder Status: <strong>{account.account_holder_is_alive ? "Alive" : "Deceased"}</strong>
                  </span>
                )}
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {history.map((stepId, idx) => {
        const step = stepMap[stepId];

        return (
          <div key={stepId} className="flex items-center gap-2">
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
          </div>
        );
        })}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all bg-indigo-50 border-indigo-300">
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-600">
            <span className="text-white text-xs font-bold">{history.length + 1}</span>
          </div>
          <span className="text-xs font-medium whitespace-nowrap text-indigo-700">
            {currentNode?.step_title?.substring(0, 15) || `Step ${history.length + 1}`}
            {currentNode?.step_title?.length > 15 && '...'}
          </span>
        </div>
      </div>

      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">{currentStepIndex + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {currentNode.step_title}
                </h3>
                {currentNode.question_text && (
                  <p className="text-slate-700 mb-3 leading-relaxed">{currentNode.question_text}</p>
                )}
                {currentNode.help_text && (
                  <Alert className="bg-blue-50 border-blue-200 mb-4">
                    <Info className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">
                      {currentNode.help_text}
                    </AlertDescription>
                  </Alert>
                )}
                {currentNode.regulatory_reference && (
                  <p className="text-xs text-slate-500 italic mb-3 flex items-center gap-2">
                    <FileCheck className="w-3 h-3" />
                    Reference: {currentNode.regulatory_reference}
                  </p>
                )}
              </div>
            </div>

            <div className="pl-16">
              {renderNode()}
            </div>
          </div>
        </CardContent>
      </Card>

      {Object.keys(answers).filter(k => !k.startsWith('_')).length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <details className="cursor-pointer">
              <summary className="text-sm font-semibold text-slate-700 flex items-center gap-2 hover:text-indigo-600 transition-colors">
                <FileCheck className="w-4 h-4" />
                View Previous Answers ({Object.keys(answers).filter(k => !k.startsWith('_')).length})
              </summary>
              <div className="mt-3 space-y-2 pl-6">
                {Object.entries(answers).filter(([key]) => !key.startsWith('_')).map(([key, value]) => {
                  const step = stepMap[key];
                  if (!step) return null;

                  let displayValue = '';
                  if (typeof value === 'string' && value.includes(',') && step.question_type === 'multiple_choice') {
                    const selectedValues = value.split(',').filter(Boolean);
                    const labels = selectedValues.map(v =>
                      step.options?.find(o => o.value === v)?.label || v
                    );
                    displayValue = labels.join(', ');
                  } else if (typeof value === 'object' && value !== null) {
                    if (value.file_name) {
                      displayValue = value.date_received
                        ? `${value.file_name} (Received: ${value.date_received})`
                        : value.file_name;
                    } else if (value._address_config) {
                      const { _address_config, ...addr } = value;
                      const parts = [addr.street, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean);
                      displayValue = parts.join(', ') || 'Address entered';
                    } else if (value.savedBeneficiaries) {
                      displayValue = `${value.savedBeneficiaries.length} beneficiary(ies) added`;
                    } else if (value.savedPersons) {
                      displayValue = `${value.savedPersons.length} controlling person(s) added`;
                    } else {
                      const fieldValues = Object.entries(value)
                        .filter(([k]) => !k.startsWith('_'))
                        .map(([k, v]) => v)
                        .filter(Boolean);
                      displayValue = fieldValues.join(', ') || 'Data entered';
                    }
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

      <AIWorkflowHelper
        currentStep={currentNode}
        workflow={workflow}
        answers={answers}
        accountData={latestAccountData || account}
        onSuggestedAnswer={(value) => setSelectedValue(value)}
      />

      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          size="lg"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {history.length === 0 ? "Cancel" : "Previous"}
        </Button>
        <Button
          onClick={handleNext}
          disabled={
            !isActionNode(currentNode) &&
            !selectedValue &&
            !(currentNode.question_type === "multi_field_input" && Object.keys(multiFieldValues).length > 0) &&
            !(currentNode.question_type === "address_input" && addressValues.street && addressValues.city &&
              addressValues.state && addressValues.postal_code && addressValues.country) &&
            !(currentNode.question_type === "beneficiary_input" && answers[currentNodeId]?.savedBeneficiaries?.length > 0) &&
            !(currentNode.question_type === "controlling_person_input" && answers[currentNodeId]?.savedPersons?.length > 0) &&
            !(currentNode.question_type === "file_upload" && selectedValue?.file_url && (!currentNode.file_upload_config?.require_date_received || dateReceivedValue))
          }
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
        >
          {isActionNode(currentNode) ? "View Summary" : "Next Question"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}