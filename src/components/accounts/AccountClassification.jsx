import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, Loader2, AlertCircle, Users, Check, Upload, GitBranch, Sparkles, Calendar } from "lucide-react";
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
import { computePrefillAnswers } from "../workflows/workflowPrefillUtils";
import { evaluateWorkflowTriggers } from "../workflows/WorkflowTriggerEvaluator";
import WorkflowIntroFields from "../workflows/WorkflowIntroFields";
import PreviousAnswers from "./PreviousAnswers";

export default function AccountClassification({ account, onComplete, onCancel }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [history, setHistory] = useState([]);
  const [showFlowchart, setShowFlowchart] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [completedPath, setCompletedPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [latestAccountData, setLatestAccountData] = useState(null);
  const linkedEntityRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [multiFieldValues, setMultiFieldValues] = useState({});
  const [addressValues, setAddressValues] = useState({ street: "", city: "", state: "", postal_code: "", country: "", tax_residence_country: "", tin: "" });
  const [selectedValue, setSelectedValue] = useState(null);
  const [dateReceivedValue, setDateReceivedValue] = useState("");

  const isEntityWorkflow = account?.account_holder_type === "entity";
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  // Fetch published workflows
  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows-published'],
    queryFn: () => base44.entities.Workflow.filter({ status: 'published' }),
  });

  // Single effect: fetch entity data → select correct workflow → prefill answers
  // All three steps happen sequentially so there is no race condition.
  useEffect(() => {
    if (!workflows.length || !account?.id) return;

    const initialize = async () => {
      // 1. Fetch latest account data
      const accountRecords = await base44.entities.Account.filter({ id: account.id });
      const latestAccount = accountRecords[0] || account;
      setLatestAccountData(latestAccount);

      // 2. Fetch related entity data (fi_type, rfi_status etc. live on Entity, not Account)
      let entityRecord = null;
      if (latestAccount.entity_id) {
        const entityRecords = await base44.entities.Entity.filter({ id: latestAccount.entity_id });
        entityRecord = entityRecords[0] || null;
      }

      // 3. Select workflow using trigger evaluation on merged account + entity data
      // First, narrow candidates by account_holder_type to avoid cross-type matching
      const holderType = latestAccount.account_holder_type; // 'individual' or 'entity'
      const allAccountReportabilityWorkflows = workflows.filter(w => w.workflow_type === 'account_reportability');
      const allCandidates = allAccountReportabilityWorkflows.length ? allAccountReportabilityWorkflows : workflows;

      // Split by whether the workflow name indicates entity vs individual
      const entityWorkflows = allCandidates.filter(w => w.workflow_name?.toLowerCase().includes('entity'));
      const individualWorkflows = allCandidates.filter(w => !w.workflow_name?.toLowerCase().includes('entity'));

      // Only evaluate workflows relevant to this account_holder_type
      const candidateWorkflows = holderType === 'entity'
        ? (entityWorkflows.length ? entityWorkflows : allCandidates)
        : (individualWorkflows.length ? individualWorkflows : allCandidates);

      const mergedData = { ...latestAccount, ...(entityRecord || {}) };
      const matched = await evaluateWorkflowTriggers(mergedData, 'account_created', candidateWorkflows);

      // Smart fallback: if no trigger conditions matched, pick a workflow that suits the account_holder_type.
      // Use workflow_type field first, then fall back to name-based matching.
      let chosenWorkflow = matched[0];
      if (!chosenWorkflow) {
        const holderType = latestAccount.account_holder_type; // 'individual' or 'entity'
        if (holderType === 'entity') {
          // Prefer entity classification workflows
          chosenWorkflow = candidateWorkflows.find(w =>
            w.workflow_type === 'entity_rfi_classification' ||
            w.workflow_name?.toLowerCase().includes('entity')
          ) || candidateWorkflows[0];
        } else {
          // For individuals: prefer account_reportability workflows that are NOT entity-specific
          chosenWorkflow = candidateWorkflows.find(w =>
            w.workflow_type === 'account_reportability' &&
            !w.workflow_name?.toLowerCase().includes('entity')
          ) || candidateWorkflows.find(w =>
            !w.workflow_name?.toLowerCase().includes('entity')
          ) || candidateWorkflows[0];
        }
      }
      linkedEntityRef.current = entityRecord;
      setSelectedWorkflow(chosenWorkflow);

      // 4. Prefill answers from Account fields then Entity fields for the chosen workflow
      if (chosenWorkflow) {
        const accountPrefilled = await computePrefillAnswers(chosenWorkflow, latestAccount, "Account");
        const entityPrefilled = entityRecord
          ? await computePrefillAnswers(chosenWorkflow, entityRecord, "Entity")
          : {};
        setAnswers(prev => ({ ...prev, ...accountPrefilled, ...entityPrefilled }));
      }
    };

    initialize();
  }, [workflows, account?.id]);

  const workflow = selectedWorkflow;

  const steps = workflow?.steps || [];
  const currentNode = steps[currentStepIndex];
  const currentNodeId = currentNode?.step_id;

  const stepMap = steps.reduce((acc, s) => { acc[s.step_id] = s; return acc; }, {});

  // Fetch ReferencedData options for single_choice steps that use referenced_data_key
  const referencedDataKeys = steps
    .filter(s => s.question_type === 'single_choice' && s.referenced_data_key)
    .map(s => s.referenced_data_key);

  const { data: referencedDataCache = {} } = useQuery({
    queryKey: ['workflow-step-referenced-data', referencedDataKeys],
    queryFn: async () => {
      const cache = {};
      for (const key of referencedDataKeys) {
        const [source, ...rest] = key.split('.');
        if (source === 'ReferencedData') {
          const [entityName, fieldName] = rest;
          const data = await base44.entities.ReferencedData.filter({ entity_name: entityName, field_name: fieldName, is_published: true });
          cache[key] = data.map(d => ({ value: d.value, label: d.label }));
        } else if (source === 'CrsCountryInfo') {
          const countries = await base44.entities.CrsCountryInfo.list();
          cache[key] = countries.map(c => ({ value: c.country_code, label: c.country_name }));
        }
      }
      return cache;
    },
    enabled: referencedDataKeys.length > 0,
  });

  // Get options for current step (static options or from referenced data)
  const getStepOptions = (step) => {
    if (step?.referenced_data_key && referencedDataCache[step.referenced_data_key]) {
      return referencedDataCache[step.referenced_data_key];
    }
    return step?.options || [];
  };

  // Sync selectedValue / multiFieldValues / addressValues when step changes OR when answers are prefilled
  const currentAnswerForSync = answers[currentNodeId];
  useEffect(() => {
    if (!currentNode) return;
    const existingAnswer = answers[currentNodeId];
    if (currentNode.question_type === 'multi_field_input') {
      setMultiFieldValues(existingAnswer || {});
    } else if (currentNode.question_type === 'address_input') {
      setAddressValues(existingAnswer || { street: "", city: "", state: "", postal_code: "", country: "", tax_residence_country: "", tin: "" });
    } else if (currentNode.question_type === 'file_upload') {
      setSelectedValue(existingAnswer || null);
      setDateReceivedValue(existingAnswer?.date_received || "");
    } else {
      setSelectedValue(existingAnswer || null);
    }
  }, [currentNodeId, currentAnswerForSync]);

  if (!workflow || steps.length === 0) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
        <p className="text-slate-600">Loading classification workflow...</p>
      </div>
    );
  }

  if (!currentNode) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No workflow steps found.</p>
      </div>
    );
  }

  const getFieldValue = (fieldPath, allAnswers) => {
    const acc = latestAccountData || account;
    return getFieldValueUtil(fieldPath, acc, linkedEntityRef.current, allAnswers);
  };

  const evalSingleCondition = async (condition, allAnswers) => {
    return await evaluateSingleCondition(condition, (fp) => getFieldValue(fp, allAnswers), {});
  };

  const evalConditionalLogic = async (logic, currentAnswer, allAnswers) => {
    // Check trigger guard: trigger_field may be a step ID or a step title
    if (logic.trigger_field && logic.trigger_value) {
      // Try direct lookup by step ID first
      let triggerAnswer = allAnswers[logic.trigger_field];

      // If not found, try to resolve by step title
      if (triggerAnswer === undefined) {
        const matchedStep = steps.find(
          s => s.step_title === logic.trigger_field || s.step_id === logic.trigger_field
        );
        if (matchedStep) {
          triggerAnswer = allAnswers[matchedStep.step_id];
        }
      }

      // Only block if the trigger step was actually answered AND doesn't match.
      // If the trigger step was never visited (undefined), allow condition groups to evaluate.
      if (triggerAnswer !== undefined && String(triggerAnswer) !== String(logic.trigger_value)) {
        return null;
      }
    }
    const boundEvalSingle = (condition) => evaluateSingleCondition(condition, (fp) => getFieldValue(fp, allAnswers), {});
    return await evaluateConditionalLogic(logic, allAnswers, boundEvalSingle);
  };

  const handleNext = async () => {
    // Save current answer
    let currentAnswer = selectedValue;
    if (currentNode.question_type === 'multi_field_input') currentAnswer = multiFieldValues;
    else if (currentNode.question_type === 'address_input') currentAnswer = addressValues;
    else if (currentNode.question_type === 'file_upload') {
      currentAnswer = selectedValue ? { ...selectedValue, date_received: dateReceivedValue } : null;
    }

    const newAnswers = { ...answers, [currentNodeId]: currentAnswer };
    setAnswers(newAnswers);

    // Handle address saving
    if (currentNode.question_type === 'address_input' && currentAnswer && account?.id) {
      const addressConfig = currentNode.address_config || {};
      const targetField = addressConfig.target_field || 'current_address';

      const updatePayload = {
        [targetField]: { street: currentAnswer.street, city: currentAnswer.city, state: currentAnswer.state, postal_code: currentAnswer.postal_code, country: currentAnswer.country }
      };

      // Persist tax residency if country provided and not already present
      if (currentAnswer.tax_residence_country) {
        const existingResidencies = (latestAccountData || account)?.tax_residencies || [];
        const alreadyExists = existingResidencies.some(
          r => r.country === currentAnswer.tax_residence_country
        );
        if (!alreadyExists) {
          updatePayload.tax_residencies = [
            ...existingResidencies,
            { country: currentAnswer.tax_residence_country, tin: currentAnswer.tin || "" }
          ];
        }
      }

      await base44.entities.Account.update(account.id, updatePayload);
      const updated = await base44.entities.Account.filter({ id: account.id });
      if (updated[0]) setLatestAccountData(updated[0]);
    }

    // Post-completion actions (after_step)
    if (currentNode.post_completion_actions) {
      for (const action of currentNode.post_completion_actions.filter(a => (a.execution_timing || 'after_step') === 'after_step')) {
        await executeAction(action, newAnswers);
      }
    }

    const newHistory = [...history, currentNodeId];
    setHistory(newHistory);

    // Navigation
    const nextStepId = await resolveNextStep(currentNode, currentAnswer, newAnswers);
    if (nextStepId) {
      const nextIndex = steps.findIndex(s => s.step_id === nextStepId);
      if (nextIndex !== -1) {
        setCurrentStepIndex(nextIndex);
        return;
      }
    }

    const nextNode = steps[currentStepIndex + 1];
    if (isActionNode(currentNode) || currentNode.question_type === 'info' || !nextNode) {
      setCompletedPath([...new Set([...newHistory])]);
      setShowSummary(true);
    } else {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const resolveNextStep = async (step, answer, allAnswers) => {
    // Multi-choice routing groups
    if (step.question_type === 'multiple_choice' && step.conditional_logic?.multi_choice_routing_groups?.length > 0 && Array.isArray(answer)) {
      for (const group of step.conditional_logic.multi_choice_routing_groups) {
        let groupMatches = group.group_operator === 'AND';
        for (const cond of group.conditions) {
          let met = false;
          if (cond.condition_type === 'selected_options') met = answer.some(v => cond.option_values?.includes(v));
          else if (cond.condition_type === 'selection_count') {
            const cnt = answer.length;
            switch (cond.count_operator) {
              case '=': met = cnt === cond.count_value; break;
              case '>': met = cnt > cond.count_value; break;
              case '<': met = cnt < cond.count_value; break;
              case '>=': met = cnt >= cond.count_value; break;
              case '<=': met = cnt <= cond.count_value; break;
              default: met = false;
            }
          }
          groupMatches = group.group_operator === 'AND' ? groupMatches && met : groupMatches || met;
        }
        if (groupMatches && group.next_step) return group.next_step;
      }
      const lastGroup = step.conditional_logic.multi_choice_routing_groups.at(-1);
      if (lastGroup?.false_step) return lastGroup.false_step;
      if (step.conditional_logic.multi_choice_default_step) return step.conditional_logic.multi_choice_default_step;
    }

    // Option values matching
    if (step.question_type === 'multiple_choice' && step.conditional_logic?.option_values?.length > 0 && Array.isArray(answer)) {
      const match = answer.some(v => step.conditional_logic.option_values.includes(v));
      return match ? step.conditional_logic.option_values_next_step : step.conditional_logic.option_values_else_step;
    }

    // Selection count branching
    if (step.question_type === 'multiple_choice' && Array.isArray(answer) &&
        step.conditional_logic?.selection_count_value !== undefined &&
        (step.conditional_logic?.selection_count_next_step || step.conditional_logic?.selection_count_else_step)) {
      const cnt = answer.length;
      const target = step.conditional_logic.selection_count_value;
      const op = step.conditional_logic.selection_count_operator || '=';
      let met = false;
      switch (op) {
        case '=': met = cnt === target; break;
        case '>': met = cnt > target; break;
        case '<': met = cnt < target; break;
        case '>=': met = cnt >= target; break;
        case '<=': met = cnt <= target; break;
        default: met = false;
      }
      return met ? step.conditional_logic.selection_count_next_step : step.conditional_logic.selection_count_else_step;
    }

    // Option-based next step takes priority for yes_no and single_choice
    // (the workflow builder explicitly set next_step per option)
    if (step.question_type === 'yes_no' || step.question_type === 'single_choice') {
      const opt = step.options?.find(o => o.value === answer);
      if (opt?.next_step) return opt.next_step;
    }

    // Conditional logic as fallback (for when options don't define a next_step)
    if (step.conditional_logic) {
      const nextId = await evalConditionalLogic(step.conditional_logic, answer, allAnswers);
      if (nextId) return nextId;
    }

    // Default next step
    if (step.default_next_step) return step.default_next_step;

    return null;
  };

  const executeAction = async (action, allAnswers) => {
    let targetId = account?.id;
    let valueToUpdate = action.value_source === 'static_value' ? action.value
      : action.value_source === 'from_step_answer' ? allAnswers[action.value]
      : null;

    if (valueToUpdate === 'true') valueToUpdate = true;
    if (valueToUpdate === 'false') valueToUpdate = false;
    if (valueToUpdate === 'YES') valueToUpdate = true;
    if (valueToUpdate === 'NO') valueToUpdate = false;

    if (action.condition) {
      const fieldVal = allAnswers[action.condition.field];
      const condMet = action.condition.operator === '=' ? fieldVal === action.condition.value
        : action.condition.operator === '!=' ? fieldVal !== action.condition.value : false;
      if (!condMet) return;
    }

    if (action.target_entity_type === 'Account' && targetId) {
      await base44.entities.Account.update(targetId, { [action.field_to_update]: valueToUpdate });
      const updated = await base44.entities.Account.filter({ id: targetId });
      if (updated[0]) setLatestAccountData(updated[0]);
    }
  };

  const handleBack = () => {
    if (history.length > 0) {
      const prevId = history[history.length - 1];
      const prevIndex = steps.findIndex(s => s.step_id === prevId);
      if (prevIndex !== -1) setCurrentStepIndex(prevIndex);
      setHistory(prev => prev.slice(0, -1));
    } else {
      onCancel?.();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    const allSteps = completedPath.length > 0 ? completedPath : [...history, currentNodeId];

    for (const stepId of allSteps) {
      const step = stepMap[stepId];
      if (step?.post_completion_actions) {
        const afterWorkflow = step.post_completion_actions.filter(a => a.execution_timing === 'after_workflow');
        for (const action of afterWorkflow) {
          await executeAction(action, answers);
        }
      }
    }

    // Build result data
    const finalStep = steps.find(s => s.step_id === allSteps[allSteps.length - 1]);
    const deriveStatusForComplete = (step) => {
      if (step?.result_status) return step.result_status;
      if (step?.result_action) {
        if (step.result_action.includes('non_reportable') || step.result_action.includes('excluded')) return 'non_reportable';
        if (step.result_action.includes('reportable')) return 'reportable';
      }
      return 'pending_review';
    };
    // Prefer the status already written to the account by post-completion actions (e.g. info steps)
    const currentAccountStatus = (latestAccountData || account)?.reportability_status;
    const resolvedStatus = (currentAccountStatus && currentAccountStatus !== 'pending_review')
      ? currentAccountStatus
      : deriveStatusForComplete(finalStep);
    const classificationData = {
      reportability_status: resolvedStatus,
      reportability_reason: (latestAccountData || account)?.reportability_reason
        || finalStep?.result_description || finalStep?.question_text || '',
      classification_answers: answers,
    };

    // Check if we need to redirect to controlling persons
    const hasControllingPersonStep = steps.some(s => s.question_type === 'controlling_person_input');
    const resultStatus = finalStep?.result_status;
    const entityClassification = (latestAccountData || account)?.entity_classification;
    const shouldRedirect = hasControllingPersonStep || entityClassification === 'passive_nfe';

    const completionData = {
      ...classificationData,
      _redirectToControllingPersons: shouldRedirect,
    };

    setLoading(false);
    onComplete?.(completionData);
  };

  const renderNode = () => {
    const answer = answers[currentNodeId];

    switch (currentNode.question_type) {
      case 'yes_no': {
        const opts = currentNode.options || [{ value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }];
        const yesNoVal = answers[currentNodeId] || null;
        return (
          <div className="space-y-3">
            <RadioGroup value={yesNoVal} onValueChange={v => { setSelectedValue(v); setAnswers(p => ({ ...p, [currentNodeId]: v })); }}>
              {opts.map(opt => (
                <div
                  key={opt.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer"
                  onClick={() => { setSelectedValue(opt.value); setAnswers(p => ({ ...p, [currentNodeId]: opt.value })); }}
                >
                  <RadioGroupItem value={opt.value} id={opt.value} />
                  <Label htmlFor={opt.value} className="flex-1 cursor-pointer font-medium text-slate-900">{opt.label}</Label>
                  {opt.value === yesNoVal && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      }

      case 'single_choice': {
        const singleOpts = getStepOptions(currentNode);
        return (
          <Select value={answers[currentNodeId] || ""} onValueChange={v => { setSelectedValue(v); setAnswers(p => ({ ...p, [currentNodeId]: v })); }}>
            <SelectTrigger className="w-full h-12">
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {singleOpts.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      case 'multiple_choice': {
        const selected = Array.isArray(answers[currentNodeId]) ? answers[currentNodeId] : [];
        return (
          <div className="space-y-3">
            {currentNode.options?.map(opt => {
              const isSel = selected.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${isSel ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
                  onClick={() => {
                    const newVals = isSel ? selected.filter(v => v !== opt.value) : [...selected, opt.value];
                    setSelectedValue(newVals);
                    setAnswers(p => ({ ...p, [currentNodeId]: newVals }));
                  }}
                >
                  <Checkbox checked={isSel} onCheckedChange={() => {}} />
                  <span className="flex-1 cursor-pointer font-medium text-slate-900">{opt.label}</span>
                  {isSel && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                </div>
              );
            })}
            {selected.length > 0 && <p className="text-sm text-slate-600">{selected.length} option(s) selected</p>}
          </div>
        );
      }

      case 'text_input':
        return (
          <Input
            value={selectedValue || ""}
            onChange={e => setSelectedValue(e.target.value)}
            placeholder={currentNode.help_text || "Enter your answer..."}
          />
        );

      case 'number_input':
        return (
          <Input
            type="number"
            value={selectedValue || ""}
            onChange={e => setSelectedValue(e.target.value)}
            placeholder={currentNode.help_text || "Enter a number..."}
          />
        );

      case 'date_input':
        return (
          <Input
            type="date"
            value={selectedValue || ""}
            onChange={e => setSelectedValue(e.target.value)}
          />
        );

      case 'file_upload': {
        const fileConfig = currentNode.file_upload_config || {};
        const uploadedFile = selectedValue;
        const handleFileUpload = async (file) => {
          if (!file) return;
          setUploadingFile(true);
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          setSelectedValue({ file_url, file_name: file.name, file_size: file.size });
          setUploadingFile(false);
        };
        return (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center border-slate-300 hover:border-indigo-400 hover:bg-slate-50 transition-colors"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-50'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50'); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50');
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileUpload(file);
              }}
            >
              <input
                type="file"
                id={`file-upload-${currentNodeId}`}
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
              {uploadingFile ? (
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
              ) : uploadedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileCheck className="w-8 h-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium text-slate-900">{uploadedFile.file_name}</p>
                    <p className="text-xs text-slate-500">Uploaded successfully</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-sm text-slate-500 mb-3">Drag & drop a file here, or</p>
                  <label htmlFor={`file-upload-${currentNodeId}`} className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </label>
                </>
              )}
            </div>
            {fileConfig.require_date_received && (
              <div>
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date Received <span className="text-red-600">*</span>
                </Label>
                <Input type="date" value={dateReceivedValue} onChange={e => setDateReceivedValue(e.target.value)} className="mt-1.5" />
              </div>
            )}
          </div>
        );
      }

      case 'address_input': {
        // Find the most recent file_upload answer from previous steps
        // File upload answers are stored as { file_url, file_name, file_size, date_received }
        const prevUploadedFile = history.slice().reverse()
          .map(sid => answers[sid])
          .find(a => a && typeof a === 'object' && a.file_url && !Array.isArray(a));

        const currentAddr = (latestAccountData || account)?.current_address;
        const addrParts = currentAddr
          ? [currentAddr.street, currentAddr.city, currentAddr.state, currentAddr.postal_code, currentAddr.country].filter(Boolean)
          : [];

        return (
          <form autoComplete="off" role="presentation" onSubmit={e => e.preventDefault()} className="space-y-4">
            {addrParts.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Address on File</p>
                <p className="text-sm text-slate-800">{addrParts.join(', ')}</p>
              </div>
            )}
            {prevUploadedFile?.file_url && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-medium text-slate-600 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-indigo-500" />
                    {prevUploadedFile.file_name || "Uploaded Document"}
                  </span>
                  <a href={prevUploadedFile.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Open in new tab</a>
                </div>
                {(() => {
                  const fileName = prevUploadedFile.file_name?.toLowerCase() || '';
                  const fileUrl = prevUploadedFile.file_url?.toLowerCase() || '';
                  const isPdf = fileName.endsWith('.pdf') || fileUrl.includes('.pdf') || fileUrl.includes('application/pdf') || (!fileName.includes('.'));
                  const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext => fileName.endsWith(ext));
                  const isDocx = fileName.endsWith('.docx') || fileName.endsWith('.doc');

                  if (isPdf) {
                    return (
                      <iframe
                        src={prevUploadedFile.file_url + '#toolbar=1&view=FitH'}
                        className="w-full border-0"
                        style={{ height: '450px' }}
                        title="Uploaded Document"
                      />
                    );
                  } else if (isImage) {
                    return (
                      <div className="p-4 bg-slate-50 flex items-center justify-center">
                        <img
                          src={prevUploadedFile.file_url}
                          alt={prevUploadedFile.file_name || "Uploaded image"}
                          className="max-w-full max-h-96 rounded-lg object-contain shadow-sm"
                        />
                      </div>
                    );
                  } else if (isDocx) {
                    return (
                      <iframe
                        src={`https://docs.google.com/gview?url=${encodeURIComponent(prevUploadedFile.file_url)}&embedded=true`}
                        className="w-full border-0"
                        style={{ height: '450px' }}
                        title="Uploaded Document"
                      />
                    );
                  } else {
                    return (
                      <div className="p-6 text-center bg-slate-50">
                        <p className="text-sm text-slate-500 mb-3">This file type cannot be previewed in the browser.</p>
                        <a href={prevUploadedFile.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium text-sm">
                          <FileCheck className="w-4 h-4" />
                          Download {prevUploadedFile.file_name || "Document"} to view
                        </a>
                      </div>
                    );
                  }
                })()}
              </div>
            )}
            <div>
              <Label className="text-sm font-medium text-slate-700">Street Address <span className="text-red-600">*</span></Label>
              <Input value={addressValues.street || ""} onChange={e => setAddressValues(p => ({ ...p, street: e.target.value }))} placeholder="123 Main Street" className="mt-1.5" autoComplete="off" name="x-crs-f1" data-lpignore="true" data-1p-ignore />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">City <span className="text-red-600">*</span></Label>
                <Input value={addressValues.city || ""} onChange={e => setAddressValues(p => ({ ...p, city: e.target.value }))} className="mt-1.5" autoComplete="off" name="x-crs-f2" data-lpignore="true" data-1p-ignore />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">State <span className="text-red-600">*</span></Label>
                <Input value={addressValues.state || ""} onChange={e => setAddressValues(p => ({ ...p, state: e.target.value }))} className="mt-1.5" autoComplete="off" name="x-crs-f3" data-lpignore="true" data-1p-ignore />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">Postal Code <span className="text-red-600">*</span></Label>
                <Input value={addressValues.postal_code || ""} onChange={e => setAddressValues(p => ({ ...p, postal_code: e.target.value }))} className="mt-1.5" autoComplete="off" name="x-crs-f4" data-lpignore="true" data-1p-ignore />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Country <span className="text-red-600">*</span></Label>
                <div className="mt-1.5">
                  <CountrySelect value={addressValues.country || ""} onValueChange={v => setAddressValues(p => ({ ...p, country: v }))} placeholder="Select country..." />
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4 mt-2 grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">Country of Tax Residence <span className="text-red-600">*</span></Label>
                <div className="mt-1.5">
                  <CountrySelect value={addressValues.tax_residence_country || ""} onValueChange={v => setAddressValues(p => ({ ...p, tax_residence_country: v }))} placeholder="Select country..." />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Tax Identification Number (TIN) <span className="text-red-600">*</span></Label>
                <Input value={addressValues.tin || ""} onChange={e => setAddressValues(p => ({ ...p, tin: e.target.value }))} placeholder="Enter TIN..." className="mt-1.5" autoComplete="off" name="x-crs-tin" data-lpignore="true" data-1p-ignore />
              </div>
            </div>
          </form>
        );
      }

      case 'beneficiary_input':
        return (
          <BeneficiaryInputRenderer
            account={latestAccountData || account}
            tenant={{ id: account?.tenant_id }}
            initialBeneficiaries={answer?.draftBeneficiaries}
            savedBeneficiaries={answer?.savedBeneficiaries}
            onBeneficiariesChange={(bens) => setAnswers(p => ({ ...p, [currentNodeId]: { ...p[currentNodeId], draftBeneficiaries: bens } }))}
            onBeneficiariesAdded={(saved) => setAnswers(p => ({ ...p, [currentNodeId]: { ...p[currentNodeId], savedBeneficiaries: saved, draftBeneficiaries: saved } }))}
          />
        );

      case 'controlling_person_input':
        return (
          <ControllingPersonInputRenderer
            account={latestAccountData || account}
            initialPersons={answer?.draftPersons}
            savedPersons={answer?.savedPersons}
            onPersonsChange={(persons) => setAnswers(p => ({ ...p, [currentNodeId]: { ...p[currentNodeId], draftPersons: persons } }))}
            onControllingPersonsAdded={(saved) => setAnswers(p => ({ ...p, [currentNodeId]: { ...p[currentNodeId], savedPersons: saved, draftPersons: saved } }))}
          />
        );

      case 'multi_field_input':
        return (
          <MultiFieldRenderer
            fields={currentNode.multi_fields || []}
            values={multiFieldValues}
            onChange={setMultiFieldValues}
            errors={{}}
          />
        );

      case 'info':
        return null;

      case 'result':
        return (
          <Alert className={currentNode.result_status === 'reportable' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}>
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>
              <strong>Result:</strong> {currentNode.result_description}
            </AlertDescription>
          </Alert>
        );

      default:
        return <p className="text-slate-500">Unsupported question type: {currentNode.question_type}</p>;
    }
  };

  const canProceed = () => {
    const qt = currentNode.question_type;
    if (qt === 'info' || qt === 'result') return true;
    if (!currentNode.required) return true;
    if (qt === 'multi_field_input') {
      const visibleRequiredFields = (currentNode.multi_fields || []).filter(field => {
        if (!field.is_required) return false;
        if (!field.conditional_visibility) return true;
        const dependsOnField = field.conditional_visibility.depends_on_field;
        const requiredValue = field.conditional_visibility.required_value?.toLowerCase();
        const depVal = multiFieldValues[dependsOnField];
        let normalized;
        if (typeof depVal === 'boolean') normalized = depVal ? 'yes' : 'no';
        else if (depVal === true || depVal === 'YES' || depVal === 'yes') normalized = 'yes';
        else if (depVal === false || depVal === 'NO' || depVal === 'no') normalized = 'no';
        else normalized = typeof depVal === 'string' ? depVal.toLowerCase() : depVal;
        return normalized === requiredValue;
      });
      return visibleRequiredFields.every(field => {
        const val = multiFieldValues[field.field_id];
        return val !== undefined && val !== null && val !== '';
      });
    }
    if (qt === 'address_input') return !!(addressValues.street && addressValues.city && addressValues.state && addressValues.postal_code && addressValues.country && addressValues.tax_residence_country && addressValues.tin);
    if (qt === 'beneficiary_input') return !!answers[currentNodeId]?.savedBeneficiaries?.length;
    if (qt === 'controlling_person_input') return !!answers[currentNodeId]?.savedPersons?.length;
    if (qt === 'file_upload') {
      if (!selectedValue?.file_url) return false;
      if (currentNode.file_upload_config?.require_date_received) return !!dateReceivedValue;
      return true;
    }
    // For all other types (yes_no, single_choice, multiple_choice, text, number, date)
    // read directly from answers so prefilled values enable the Next button
    const currentAnswer = answers[currentNodeId];
    if (qt === 'multiple_choice') return Array.isArray(currentAnswer) && currentAnswer.length > 0;
    return !!currentAnswer;
  };

  const currentStepNumber = history.length + 1;
  const progress = Math.round((history.length / steps.length) * 100);

  // Summary screen
  if (showSummary) {
    const finalStep = steps.find(s => s.step_id === completedPath[completedPath.length - 1]) || currentNode;
    // For info/result steps, derive status from result_status or result_action
    const deriveStatus = (step) => {
      if (step?.result_status) return step.result_status;
      if (step?.result_action) {
        if (step.result_action.includes('non_reportable') || step.result_action.includes('excluded')) return 'non_reportable';
        if (step.result_action.includes('reportable')) return 'reportable';
      }
      return 'pending_review';
    };
    // Prefer the status already written to the account by post-completion actions
    const accountStatus = (latestAccountData || account)?.reportability_status;
    const summaryStatus = (accountStatus && accountStatus !== 'pending_review')
      ? accountStatus
      : deriveStatus(finalStep);
    const isReportable = summaryStatus === 'reportable';
    const isPending = summaryStatus === 'pending_review';

    // Build previous answers rows for summary
    const summaryAnswerRows = completedPath
      .map((stepId) => {
        const step = stepMap[stepId];
        if (!step || step.question_type === 'info' || step.question_type === 'result') return null;
        const ans = answers[stepId];
        if (ans === null || ans === undefined || ans === '') return null;
        let displayAnswer = '';
        if (typeof ans === 'boolean') displayAnswer = ans ? 'Yes' : 'No';
        else if (ans === 'YES') displayAnswer = 'Yes';
        else if (ans === 'NO') displayAnswer = 'No';
        else if (Array.isArray(ans)) displayAnswer = ans.join(', ');
        else if (typeof ans === 'object') displayAnswer = ans.file_name || JSON.stringify(ans);
        else {
          const opts = getStepOptions(step);
          const matched = opts.find(o => o.value === ans);
          displayAnswer = matched ? matched.label : String(ans);
        }
        if (!displayAnswer) return null;
        return { stepId, step, displayAnswer };
      })
      .filter(Boolean);

    return (
      <div className="space-y-6" data-form-type="other">
        <div className="text-center">
          <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${isReportable ? 'bg-amber-100' : isPending ? 'bg-blue-100' : 'bg-green-100'}`}>
            {isReportable ? <AlertCircle className="w-10 h-10 text-amber-600" /> : isPending ? <Info className="w-10 h-10 text-blue-600" /> : <CheckCircle2 className="w-10 h-10 text-green-600" />}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Classification Complete</h2>
          <p className="text-slate-600">Review your answers and confirm the classification</p>
        </div>

        <Card className={`border-2 ${isReportable ? 'bg-amber-50 border-amber-200' : isPending ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Status:</span>
              <Badge className={`text-sm ${isReportable ? 'bg-amber-600 text-white' : isPending ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
                {isReportable ? 'Reportable' : isPending ? 'Pending Review' : 'Non-Reportable'}
              </Badge>
            </div>
            {(() => {
              const reason = (latestAccountData || account)?.reportability_reason
                || finalStep?.result_description
                || finalStep?.question_text;
              return reason ? (
                <div className="flex items-start justify-between gap-4 pt-2 border-t border-slate-200">
                  <span className="text-sm font-medium text-slate-700 flex-shrink-0">Reason:</span>
                  <span className="text-sm text-slate-900 text-right">{reason}</span>
                </div>
              ) : null;
            })()}
          </CardContent>
        </Card>

        {summaryAnswerRows.length > 0 && (
          <PreviousAnswers
            history={completedPath}
            stepMap={stepMap}
            answers={answers}
            getStepOptions={getStepOptions}
          />
        )}

        <div className="flex justify-between gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setShowSummary(false)} size="lg">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Review Answers
          </Button>
          <Button onClick={handleComplete} disabled={loading} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Complete Classification</>}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-form-type="other">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {workflow.workflow_name} v{workflow.version}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setShowFlowchart(true)} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
            <GitBranch className="w-4 h-4 mr-1" />
            Flowchart
          </Button>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">Step {currentStepNumber}</p>
          <p className="text-xs text-slate-500">{progress}% Complete</p>
        </div>
      </div>

      <Dialog open={showFlowchart} onOpenChange={setShowFlowchart}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Workflow Flowchart: {workflow.workflow_name}</DialogTitle>
          </DialogHeader>
          <WorkflowVisualizer workflow={workflow} />
        </DialogContent>
      </Dialog>

      {/* Introduction */}
      {workflow.display_workflow_introduction && (
        <Alert className={isEntityWorkflow ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}>
          <Info className={`w-4 h-4 ${isEntityWorkflow ? "text-purple-600" : "text-blue-600"}`} />
          <AlertDescription>
            <div className="space-y-2">
              {workflow.workflow_introduction_text && (
                <p className={`text-sm font-medium ${isEntityWorkflow ? "text-purple-900" : "text-blue-900"}`}>
                  {workflow.workflow_introduction_text}
                </p>
              )}
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
                {account?.is_pre_existing !== undefined && (
                  <span className="block mt-1">Account Type: <strong>{account.is_pre_existing ? "Pre-existing (before 2018)" : "New (2018+)"}</strong></span>
                )}
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      </div>

      {/* Step breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        {history.map((stepId, idx) => {
          const step = stepMap[stepId];
          return (
            <div key={stepId} className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 bg-green-50 border-green-200">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-600">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-medium whitespace-nowrap text-green-700">
                  {step?.step_title?.substring(0, 15) || `Step ${idx + 1}`}{step?.step_title?.length > 15 && '...'}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>
          );
        })}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 bg-indigo-50 border-indigo-300">
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-600">
            <span className="text-white text-xs font-bold">{currentStepNumber}</span>
          </div>
          <span className="text-xs font-medium whitespace-nowrap text-indigo-700">
            {currentNode?.step_title?.substring(0, 15) || `Step ${currentStepNumber}`}{currentNode?.step_title?.length > 15 && '...'}
          </span>
        </div>
      </div>

      {/* Current step card */}
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">{currentStepNumber}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-3">{currentNode.step_title}</h3>
                {currentNode.question_text && (
                  <p className="text-slate-700 mb-3 leading-relaxed">{currentNode.question_text}</p>
                )}
                {currentNode.help_text && (
                  <Alert className="bg-blue-50 border-blue-200 mb-4">
                    <Info className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">{currentNode.help_text}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
            <div className="pl-16">
              {renderNode()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Previous Answers */}
      {history.length > 0 && (
        <PreviousAnswers history={history} stepMap={stepMap} answers={answers} getStepOptions={getStepOptions} />
      )}

      {/* AI Helper */}
      <AIWorkflowHelper
        currentStep={currentNode}
        workflow={workflow}
        answers={answers}
        accountData={latestAccountData || account}
        onSuggestedAnswer={(value) => setSelectedValue(value)}
      />

      {/* Navigation */}
      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={handleBack} size="lg">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {history.length === 0 ? "Cancel" : "Previous"}
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed() || loading}
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