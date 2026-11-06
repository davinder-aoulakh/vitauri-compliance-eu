import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, Loader2, AlertCircle, Users, Check, Upload, Calendar, Lock, Save, Pencil, Clock, GitBranch } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CountrySelect from "../shared/CountrySelect";
import BeneficiaryInputRenderer from "@/components/accounts/BeneficiaryInputRenderer";
import ControllingPersonInputRenderer from "@/components/accounts/ControllingPersonInputRenderer";
import AIWorkflowHelper from "../ai/AIWorkflowHelper";
import AIClassificationAssistant from "../ai/AIClassificationAssistant";
import { evaluateSingleCondition, evaluateConditionalLogic } from "../workflows/workflowConditionUtils";
import { isActionNode } from "../workflows/workflowNavigationUtils";
import { getFieldValue as getFieldValueUtil } from "../workflows/workflowFieldUtils";
import { computePrefillAnswers, evaluateDateDifference, refreshDerivedPrefills } from "../workflows/workflowPrefillUtils";
import { resolveRequestedDate, validateDateReceived, computeSelfCertFieldMinDates } from "../workflows/workflowValidationUtils";
import { evaluateWorkflowTriggers } from "../workflows/WorkflowTriggerEvaluator";
import WorkflowIntroFields from "../workflows/WorkflowIntroFields";
import PreviousAnswers from "./PreviousAnswers";
import VoiceWorkflowAssistant from "../ai/VoiceWorkflowAssistant";
import AccountForm from "./AccountForm";
import DraftSyncWarningBanner from "./DraftSyncWarningBanner";
import WorkflowVisualizer from "../workflows/WorkflowVisualizer";
import { useTenantFeatureFlag } from "@/hooks/useTenantFeatureFlag";
import { selectWorkflow, computeWorkflowPrefill, findAffectedSteps, auditAccountEditDuringClassification, CLASSIFICATION_FIELDS, resolveFiTypeUpdate } from "@/lib/classificationEvaluator";
import { toDisplayDate } from "@/lib/dateUtils";
import { toast } from "@/components/ui/use-toast";
import { resolveTransitionTarget, validateTransition } from "@/lib/workflowTransitions";
import DateInput from "@/components/ui/date-input";
import { toggleMultiChoiceValue } from "@/lib/multiChoiceUtils";

export default function AccountClassification({ account, entities, onComplete, onCancel, onSaveAndExit, initialDraftState }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialDraftState?.currentStepIndex ?? 0);
  const [answers, setAnswers] = useState(initialDraftState?.answers ?? {});
  const [history, setHistory] = useState(initialDraftState?.history ?? []);
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
  const [prefilledSteps, setPrefilledSteps] = useState(
    initialDraftState?.lockedSteps ? new Set(initialDraftState.lockedSteps) : new Set()
  );
  const [rfiEntityFiType, setRfiEntityFiType] = useState(null);
  const [answerHistory, setAnswerHistory] = useState(initialDraftState?.answerHistory ?? {});
  const isDraftResume = !!initialDraftState;

  // ── Edit Account mid-session state ──────────────────────────────────────────
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [isSavingAccountEdit, setIsSavingAccountEdit] = useState(false);
  const [accountEditError, setAccountEditError] = useState(null);
  const [showWorkflowMismatchDialog, setShowWorkflowMismatchDialog] = useState(false);
  const [pendingNewWorkflow, setPendingNewWorkflow] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [affectedSteps, setAffectedSteps] = useState([]);
  const [resyncedSteps, setResyncedSteps] = useState([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const prevIsDirtyRef = useRef(false);
  const [showFlowchart, setShowFlowchart] = useState(false);
  // Workflow hand-offs performed during this classification session (in order)
  const [workflowTransitions, setWorkflowTransitions] = useState([]);
  const flowchartEnabled = useTenantFeatureFlag('flowchart_view');

  // Re-show banner whenever isDirty flips to true (i.e. a new account edit was saved)
  useEffect(() => {
    if (isDirty && !prevIsDirtyRef.current) {
      setBannerDismissed(false);
    }
    prevIsDirtyRef.current = isDirty;
  }, [isDirty]);

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

      // Split by whether the workflow name indicates entity vs individual.
      // Dormant workflows are intentionally excluded from the candidate pool here —
      // they are handled by the explicit dormant override below (lines ~230-240),
      // which searches allCandidates and fires only when status === 'dormant'.
      // Including them in the candidate pool caused them to match active entity
      // accounts via trigger evaluation.
      const entityWorkflows = allCandidates.filter(w =>
        w.workflow_name?.toLowerCase().includes('entity') &&
        !w.workflow_name?.toLowerCase().includes('dormant')
      );
      const individualWorkflows = allCandidates.filter(w =>
        !w.workflow_name?.toLowerCase().includes('entity') &&
        !w.workflow_name?.toLowerCase().includes('dormant')
      );

      // Only evaluate workflows relevant to this account_holder_type
      const candidateWorkflows = holderType === 'entity'
        ? (entityWorkflows.length ? entityWorkflows : allCandidates)
        : (individualWorkflows.length ? individualWorkflows : allCandidates);

      const mergedData = { ...latestAccount, ...(entityRecord || {}) };
      // Evaluate against ALL event types and collect all matches with their priorities.
      // This ensures that a high-priority 'account_updated' workflow (e.g. Dormant)
      // beats a lower-priority 'account_created' workflow (e.g. Individual - Low Value).
      const eventsToEvaluate = latestAccount.id
        ? ['account_updated', 'account_created']
        : ['account_created'];

      const allMatchedWithPriority = [];
      for (const evt of eventsToEvaluate) {
        const evtMatches = await evaluateWorkflowTriggers(mergedData, evt, candidateWorkflows);
        evtMatches.forEach((wf, idx) => {
          // Use the evaluator's sort order (index 0 = highest priority within that event)
          // Give account_updated a tie-breaking bonus so it wins over account_created at same priority
          const bonus = evt === 'account_updated' ? 1000 : 0;
          const priority = (wf.trigger_conditions?.priority || 0) + bonus - idx;
          allMatchedWithPriority.push({ wf, priority });
        });
      }
      allMatchedWithPriority.sort((a, b) => b.priority - a.priority);
      const matched = allMatchedWithPriority.map(x => x.wf);

      // If the account is dormant, prefer the Dormant workflow regardless of trigger evaluation
      // (it may not be caught by trigger conditions if the status field name differs)
      let chosenWorkflow = matched[0];
      if (latestAccount.status === 'dormant' || latestAccount.account_dormant_at_reporting_date === true) {
        // Search allCandidates (unfiltered) so the dormant workflow is always found
        // regardless of holder-type-based candidate pool filtering.
        const dormantWorkflow = allCandidates.find(w =>
          w.workflow_name?.toLowerCase().includes('dormant')
        );
        if (dormantWorkflow) chosenWorkflow = dormantWorkflow;
      }
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
      setRfiEntityFiType(entityRecord?.fi_type || null);
      setSelectedWorkflow(chosenWorkflow);

      // 4. If resuming from a draft, skip prefill — answers already restored
      if (isDraftResume) {
        linkedEntityRef.current = entityRecord;
        setRfiEntityFiType(entityRecord?.fi_type || null);
        setSelectedWorkflow(chosenWorkflow);
        // Always refresh balance-derived answers from the live account
        if (chosenWorkflow) {
          const { answers: derived, cleared } = refreshDerivedPrefills(chosenWorkflow, latestAccount);
          setAnswers(prev => {
            const next = { ...prev, ...derived };
            cleared.forEach(id => { delete next[id]; });
            return next;
          });
          setPrefilledSteps(prev => {
            const next = new Set(prev);
            cleared.forEach(id => next.delete(id));
            Object.keys(derived).forEach(id => next.add(id));
            return next;
          });
        }
        return;
      }

      // 4. Prefill answers from Account fields then Entity fields for the chosen workflow
      // Account values take priority — entity pass only fills steps not already covered by account
      if (chosenWorkflow) {
        const accountPrefilled = await computePrefillAnswers(chosenWorkflow, latestAccount, "Account");
        const entityPrefilled = entityRecord
          ? await computePrefillAnswers(chosenWorkflow, entityRecord, "Entity")
          : {};
        // Account prefill wins — entity prefill only fills gaps (steps account didn't cover)
        const mergedPrefill = { ...entityPrefilled, ...accountPrefilled };

        // 4b. Special prefill: "Select potential EXCEPTION" step from account_holder_entity_type
        // Explicit map from ReferencedData values (and legacy label strings) → workflow option values OPT1–OPT6.
        // Only the 6 approved entity types get prefilled+locked; all others leave the step editable.
        const EXCEPTION_OPTION_MAP = {
          // Short codes (ReferencedData.value)
          'DGA':        'OPT1',
          'NONPROFIT':  'OPT2',
          'STAK':       'OPT3',
          'holding':    'OPT4',
          'treasury':   'OPT5',
          'realestate': 'OPT6',
          // Legacy full label strings (imported / older accounts)
          'N.V. or B.V. acting with one 100% shareholder/director (100% DGA)': 'OPT1',
          'N.V. or B.V. acting with one 100% shareholder/director (DGA)':       'OPT1',
          'Non-Profit Organization':                                             'OPT2',
          'Stichting (Foundation) or other Non-Profit Organization':            'OPT2',
          'Non-Profit Organization ((religious/charitable/scientific/ artistic/cultural/athletic/educational))': 'OPT2',
          'Stichting Administratiekantoor (STAK)':                              'OPT3',
          'Holding Company':                                                     'OPT4',
          'Treasury Center':                                                     'OPT5',
          'Real Estate Fund':                                                    'OPT6',
        };

        const entityTypeVal = latestAccount.account_holder_entity_type;
        const exceptionOptValue = entityTypeVal ? EXCEPTION_OPTION_MAP[entityTypeVal] : null;

        if (exceptionOptValue) {
          // Prefill the exception step
          const exceptionStep = chosenWorkflow.steps.find(s =>
            s.step_title?.toLowerCase().includes('exception') &&
            (s.question_type === 'single_choice' || s.question_type === 'multiple_choice')
          );
          if (exceptionStep) {
            mergedPrefill[exceptionStep.step_id] = exceptionOptValue;
          }

          // Only clear the FI type prefill for exception accounts if no FI type is explicitly
          // set on the account. If the account already has a type_of_financial_institution value,
          // it is also a Financial Institution and the FI type step should remain prefilled.
          const fiTypeStep = chosenWorkflow.steps.find(s =>
            s.step_title?.toLowerCase().includes('type of financial institution') &&
            s.question_type === 'single_choice'
          );
          if (fiTypeStep && !latestAccount.type_of_financial_institution) {
            delete mergedPrefill[fiTypeStep.step_id];
          }
        }

        setAnswers(prev => ({ ...prev, ...mergedPrefill }));
        // Only lock steps that actually have a non-empty prefilled value.
        // Steps where prefill produced no answer (e.g. account has no FI type set)
        // must remain editable so the user can answer them manually.
        const lockable = Object.entries(mergedPrefill)
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k]) => k);
        setPrefilledSteps(new Set(lockable));
      }
    };

    initialize();
  }, [workflows, account?.id]);

  // ── Handle account edit saved mid-classification ────────────────────────────
  const handleAccountEditSave = async (updatedData) => {
    setIsSavingAccountEdit(true);
    setAccountEditError(null);
    const beforeData = latestAccountData || account;
    try {
      // 1. Persist the account update
      await base44.entities.Account.update(account.id, updatedData);
      const [freshAccount] = await base44.entities.Account.filter({ id: account.id });
      if (freshAccount) setLatestAccountData(freshAccount);

      // 2. Refresh linked entity
      let entityData = linkedEntityRef.current;
      if (freshAccount?.entity_id) {
        const [entityRecord] = await base44.entities.Entity.filter({ id: freshAccount.entity_id });
        if (entityRecord) { entityData = entityRecord; linkedEntityRef.current = entityRecord; }
      }
      setRfiEntityFiType(entityData?.fi_type || null);

      // 3. Re-select workflow based on fresh data
      const newWorkflow = await selectWorkflow(freshAccount || account, entityData, workflows);

      // 4. Re-compute prefill answers
      const targetWorkflow = newWorkflow || selectedWorkflow;
      const { prefillMap, lockableStepIds } = await computeWorkflowPrefill(
        targetWorkflow, freshAccount || account, entityData
      );

      // 5. Smart merge — only overwrite steps that were originally auto-prefilled;
      //    track which steps actually changed value → resyncedSteps
      const newlyResynced = [];
      setAnswers(prev => {
        const updated = { ...prev };

        // Pass A: overwrite steps that were auto-prefilled and have a new value
        for (const stepId of lockableStepIds) {
          if (prefilledSteps.has(stepId) && prefillMap[stepId] !== undefined) {
            if (JSON.stringify(prev[stepId]) !== JSON.stringify(prefillMap[stepId])) {
              newlyResynced.push(stepId);
            }
            updated[stepId] = prefillMap[stepId];
          }
        }

        // Pass B: seed new prefillable steps that were previously empty
        for (const stepId of lockableStepIds) {
          if (!prefilledSteps.has(stepId) && prefillMap[stepId] !== undefined) {
            if (prev[stepId] === undefined || prev[stepId] === null || prev[stepId] === "") {
              updated[stepId] = prefillMap[stepId];
              newlyResynced.push(stepId);
            }
          }
        }

        // Pass C: clear stale prefilled answers whose source field was cleared on the account.
        // When a previously-prefilled step is no longer in lockableStepIds (because its mapped
        // field now has an empty value), the old answer must be wiped so the dropdown resets
        // to the placeholder. Only auto-prefilled steps are cleared — manually-entered answers
        // (steps NOT in prefilledSteps) are left untouched.
        for (const stepId of prefilledSteps) {
          if (!lockableStepIds.includes(stepId) && updated[stepId] !== undefined) {
            delete updated[stepId];
            // Mark as resynced so the banner informs the user the answer was reset
            if (!newlyResynced.includes(stepId)) {
              newlyResynced.push(stepId);
            }
          }
        }

        return updated;
      });
      setResyncedSteps(newlyResynced);
      setPrefilledSteps(new Set(lockableStepIds));

      // 6. Find manually-answered steps that may now be stale
      const steps = targetWorkflow?.steps || [];
      const affected = findAffectedSteps(steps, history, beforeData, updatedData);
      setAffectedSteps(affected);

      // 7. Mark dirty so banner appears
      setIsDirty(true);

      // 8. Audit log
      const changedFields = CLASSIFICATION_FIELDS.filter(f =>
        JSON.stringify(beforeData?.[f]) !== JSON.stringify(updatedData[f])
      );
      await auditAccountEditDuringClassification({
        tenantId: account.tenant_id,
        accountId: account.id,
        accountName: beforeData?.account_holder_name,
        currentWorkflowId: selectedWorkflow?.id,
        newWorkflowId: newWorkflow?.id,
        affectedStepCount: affected.length,
        resyncedStepCount: newlyResynced.length,
        beforeData,
        afterData: updatedData,
        changedFields,
      });

      // 9. Check if workflow template should change (only if user has progressed)
      const workflowChanged = newWorkflow && newWorkflow.id !== selectedWorkflow?.id && history.length > 0;
      if (workflowChanged) {
        setPendingNewWorkflow(newWorkflow);
        setShowWorkflowMismatchDialog(true);
      }

      setShowEditAccount(false);
    } catch (err) {
      setAccountEditError(err.message || "Failed to save account changes.");
    } finally {
      setIsSavingAccountEdit(false);
    }
  };

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
    return await evaluateSingleCondition(condition, (fp) => getFieldValue(fp, allAnswers), {}, linkedEntityRef.current);
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
    const boundEvalSingle = (condition) => evaluateSingleCondition(condition, (fp) => getFieldValue(fp, allAnswers), {}, linkedEntityRef.current);
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

    // Overwrite at the correct iteration index (mirrors WorkflowRunner.jsx pattern).
    // expectedIdx is computed from the CURRENT history (before setHistory below),
    // so back-then-forward gives expectedIdx=0 → overwrites the stale entry at [0]
    // rather than appending a new entry that PreviousAnswers would never read.
    // Genuine forward-only loop iterations still grow the array: first visit → [0],
    // second visit → [0, 1], etc.
    const expectedIdx = history.filter(id => id === currentNodeId).length;
    setAnswerHistory(prev => {
      const existing = prev[currentNodeId] || [];
      const updated = [...existing];
      updated[expectedIdx] = currentAnswer;
      return { ...prev, [currentNodeId]: updated };
    });

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

    // Step-level workflow transition: end this workflow and start another one
    if (currentNode.workflow_transition?.enabled) {
      const handled = await performWorkflowTransition(newHistory, newAnswers, currentAnswer);
      if (handled) return;
    }

    // Navigation
    const nextStepId = await resolveNextStep(currentNode, currentAnswer, newAnswers);
    if (nextStepId) {
      const nextIndex = steps.findIndex(s => s.step_id === nextStepId);
      if (nextIndex !== -1) {
        // Only clear the destination step's answer if this is a genuinely NEW loop iteration,
        // i.e. the step has been visited as many times as there are answers stored in answerHistory.
        // This means all prior iterations are fully recorded and we need a blank slate.
        // When the user navigates back-then-forward, answerHistory still has the entry
        // for the current iteration, so the count is GREATER than history occurrences → no clear.
        const historyOccurrences = newHistory.filter(id => id === nextStepId).length;
        const storedIterations = (answerHistory[nextStepId] || []).length;
        const isNewLoopIteration = historyOccurrences >= storedIterations && !prefilledSteps.has(nextStepId);

        if (isNewLoopIteration && newAnswers[nextStepId] !== undefined) {
          setAnswers(prev => {
            const updated = { ...prev };
            delete updated[nextStepId];
            return updated;
          });
          setSelectedValue(null);
          setDateReceivedValue("");
          setMultiFieldValues({});
        }

        // Apply date_difference smart prefill when navigating to the destination step
        const destStep = steps[nextIndex];
        // Merge both locations: step-level prefill_config may have comparison_operator/threshold_days
        // while mapped_field.prefill_config may have source_step_id/source_subfield_id, or vice versa.
        const destPrefillCfg = (destStep?.prefill_config || destStep?.mapped_field?.prefill_config)
          ? { ...(destStep?.mapped_field?.prefill_config || {}), ...(destStep?.prefill_config || {}) }
          : null;
        if (destStep?.question_type === 'yes_no' && destPrefillCfg?.prefill_type === 'date_difference') {
          const prefillResult = evaluateDateDifference(destPrefillCfg, newAnswers);
          if (prefillResult !== null) {
            setAnswers(prev => ({ ...prev, [destStep.step_id]: prefillResult }));
            if (destStep?.mapped_field?.read_only !== false) {
              setPrefilledSteps(ps => new Set([...ps, destStep.step_id]));
            }
          }
        }

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

  // Resolves and performs a configured workflow hand-off. Returns true when the step was handled
  // (transition performed OR blocked with an error), false to continue normal navigation.
  const performWorkflowTransition = async (newHistory, newAnswers, answerGiven) => {
    const resolved = await resolveTransitionTarget(currentNode, (cond) => evalSingleCondition(cond, newAnswers), answerGiven, (fp) => getFieldValue(fp, newAnswers));
    if (!resolved) return false;

    const target = workflows.find(w => w.id === resolved.targetId);
    const chainIds = [workflowTransitions[0]?.from_workflow_id || selectedWorkflow?.id, ...workflowTransitions.map(t => t.to_workflow_id)].filter(Boolean);
    const error = validateTransition({ target, chainIds });
    if (error) {
      toast({ title: "Workflow transition blocked", description: error, variant: "destructive" });
      setHistory(history);
      return true;
    }

    const visitedAnswers = {};
    for (const id of newHistory) if (newAnswers[id] !== undefined) visitedAnswers[id] = newAnswers[id];

    setWorkflowTransitions(prev => [...prev, {
      sequence: prev.length + 1,
      transitioned_at: new Date().toISOString(),
      from_workflow_id: selectedWorkflow.id,
      from_workflow_name: selectedWorkflow.workflow_name,
      to_workflow_id: target.id,
      to_workflow_name: target.workflow_name,
      step_id: currentNode.step_id,
      step_title: currentNode.step_title || currentNode.step_id,
      mode: resolved.mode,
      answers: visitedAnswers,
      path: newHistory,
    }]);

    // Start the target workflow for the same account with fresh account/entity prefill
    const { prefillMap, lockableStepIds } = await computeWorkflowPrefill(target, latestAccountData || account, linkedEntityRef.current);
    setSelectedWorkflow(target);
    setCurrentStepIndex(0);
    setHistory([]);
    setCompletedPath([]);
    setAnswerHistory({});
    setAnswers(prefillMap || {});
    setPrefilledSteps(new Set(lockableStepIds || []));
    setSelectedValue(null);
    setDateReceivedValue("");
    setMultiFieldValues({});
    setAffectedSteps([]);
    toast({ title: "Workflow changed", description: `Continuing with "${target.workflow_name}"` });
    return true;
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
              case '!=': met = cnt !== cond.count_value; break;
              case '>': met = cnt > cond.count_value; break;
              case '<': met = cnt < cond.count_value; break;
              case '>=': met = cnt >= cond.count_value; break;
              case '<=': met = cnt <= cond.count_value; break;
              default: met = false;
            }
          } else if (cond.condition_type === 'field_comparison') {
            met = await evalSingleCondition(cond, allAnswers);
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

  // Resolves the field/value to update for an action, or null if its condition isn't met.
  // Does NOT perform the update itself — callers batch/parallelize the actual writes.
  const resolveActionUpdate = (action, allAnswers) => {
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
      if (!condMet) return null;
    }

    if (action.target_entity_type === 'Account') {
      return { [action.field_to_update]: valueToUpdate };
    }
    return null;
  };

  const executeAction = async (action, allAnswers) => {
    const update = resolveActionUpdate(action, allAnswers);
    if (update && account?.id) {
      await base44.entities.Account.update(account.id, update);
      const updated = await base44.entities.Account.filter({ id: account.id });
      if (updated[0]) setLatestAccountData(updated[0]);
    }
  };

  const handleBack = () => {
    if (history.length > 0) {
      const prevId = history[history.length - 1];
      const prevIndex = steps.findIndex(s => s.step_id === prevId);
      if (prevIndex !== -1) setCurrentStepIndex(prevIndex);
      setHistory(prev => prev.slice(0, -1));
      // NOTE: Do NOT pop from answerHistory on back navigation.
      // answerHistory is append-only (grows on handleNext) and is indexed by
      // how many times a step appears in the completed history array.
      // Shrinking history[] already causes PreviousAnswers to show the correct
      // iteration entry. Popping from answerHistory destroyed the saved value,
      // causing the blank-answer bug when the user navigated back then forward.
    } else {
      onCancel?.();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    const allSteps = completedPath.length > 0 ? completedPath : [...history, currentNodeId];

    // Collect all independent Account field updates from this completion pass into
    // a single merged object, then write them with as few round-trips as possible.
    let mergedAccountUpdate = {};

    // 1. after_workflow post-completion actions
    for (const stepId of allSteps) {
      const step = stepMap[stepId];
      if (step?.post_completion_actions) {
        const afterWorkflow = step.post_completion_actions.filter(a => a.execution_timing === 'after_workflow');
        for (const action of afterWorkflow) {
          const update = resolveActionUpdate(action, answers);
          if (update) mergedAccountUpdate = { ...mergedAccountUpdate, ...update };
        }
      }
    }

    // 2. Persist self-certification file upload from workflow steps
    const fileUploadSteps = allSteps
      .map(stepId => ({ stepId, step: stepMap[stepId] }))
      .filter(({ step }) => step?.question_type === 'file_upload');

    for (const { stepId } of fileUploadSteps) {
      const fileAnswer = answers[stepId];
      if (fileAnswer?.file_url && account?.id) {
        let uploaderEmail = '';
        let uploaderName = '';
        try {
          const me = await base44.auth.me();
          uploaderEmail = me?.email || '';
          uploaderName = me?.display_name || me?.full_name || '';
        } catch (err) {
          console.error('Error fetching current user for document upload:', err);
        }

        const today = new Date().toISOString().split('T')[0];
        const newDoc = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          document_url: fileAnswer.file_url,
          document_name: fileAnswer.file_name || 'Self-Certification Document',
          document_type: 'self_certification',
          upload_date: new Date().toISOString(),
          uploaded_by_email: uploaderEmail,
          uploaded_by_name: uploaderName,
          notes: 'Uploaded via account classification workflow',
        };

        const currentDocs = (mergedAccountUpdate.documents || (latestAccountData || account)?.documents || []);
        const alreadyExists = currentDocs.some(d => d.document_url === fileAnswer.file_url);
        const updatedDocs = alreadyExists ? currentDocs : [...currentDocs, newDoc];

        mergedAccountUpdate = {
          ...mergedAccountUpdate,
          self_certification_obtained: true,
          self_certification_date: fileAnswer.date_received || today,
          documents: updatedDocs,
        };
      }
    }

    // 3. FI TYPE → Account.type_of_financial_institution propagation
    if (account?.id) {
      const fiUpdate = resolveFiTypeUpdate(steps, answers);
      if (fiUpdate) mergedAccountUpdate = { ...mergedAccountUpdate, ...fiUpdate };
    }

    // 4. Write the merged update once and refresh state once.
    if (account?.id && Object.keys(mergedAccountUpdate).length > 0) {
      await base44.entities.Account.update(account.id, mergedAccountUpdate);
      const refreshed = await base44.entities.Account.filter({ id: account.id });
      if (refreshed[0]) setLatestAccountData(refreshed[0]);
    }
    // --- End completion updates ---

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

    // Only include answers for steps the user actually visited (allSteps = completedPath)
    // This prevents prefilled-but-never-visited answers from appearing in classification history
    const visitedAnswers = {};
    for (const stepId of allSteps) {
      if (answers[stepId] !== undefined) {
        visitedAnswers[stepId] = answers[stepId];
      }
    }

    const classificationData = {
      reportability_status: resolvedStatus,
      reportability_reason: (latestAccountData || account)?.reportability_reason
        || finalStep?.result_description || finalStep?.question_text || '',
      classification_answers: visitedAnswers,
    };

    // Derive post-classification action from the final step's result_action (config-driven only)
    const resultAction = finalStep?.result_action || null;

    const completionData = {
      ...classificationData,
      _redirectToControllingPersons: resultAction === 'manage_controlling_persons',
      _redirectToBeneficiaries: resultAction === 'report_per_beneficiary',
      _manualReportTotal: resultAction === 'manual_report_total',
      _workflowTransitions: workflowTransitions,
      _workflowId: selectedWorkflow?.id,
      _workflowName: selectedWorkflow?.workflow_name,
    };

    setLoading(false);
    onComplete?.(completionData);
  };

  const renderNode = () => {
    const answer = answers[currentNodeId];
    // For the fiduciary trust step: only lock if RFI entity is Investment Entity Type A
    const FIDUCIARY_STEP_ID = 'step_1769573962356';
    const fiTypeNorm = (rfiEntityFiType || '').toLowerCase().replace(/[\s_-]/g, '');
    const isTypeA = fiTypeNorm.includes('typea') || fiTypeNorm.includes('investmententitytypea');
    const isLocked = prefilledSteps.has(currentNodeId) && (
      currentNodeId !== FIDUCIARY_STEP_ID || isTypeA
    );

    switch (currentNode.question_type) {
      case 'yes_no': {
        const opts = currentNode.options || [{ value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }];
        const yesNoVal = answers[currentNodeId] || null;
        return (
          <div className="space-y-3">
            {isLocked && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>This answer was automatically determined from your account data and cannot be changed.</span>
              </div>
            )}
            <RadioGroup value={yesNoVal} onValueChange={isLocked ? undefined : v => { setSelectedValue(v); setAnswers(p => ({ ...p, [currentNodeId]: v })); }}>
              {opts.map(opt => (
                <div
                  key={opt.value}
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all ${
                    isLocked
                      ? opt.value === yesNoVal
                        ? 'border-indigo-300 bg-indigo-50/70 cursor-not-allowed opacity-90'
                        : 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-40'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer'
                  }`}
                  onClick={isLocked ? undefined : () => { setSelectedValue(opt.value); setAnswers(p => ({ ...p, [currentNodeId]: opt.value })); }}
                >
                  <RadioGroupItem value={opt.value} id={opt.value} disabled={isLocked} />
                  <Label htmlFor={opt.value} className={`flex-1 font-medium text-slate-900 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>{opt.label}</Label>
                  {opt.value === yesNoVal && (
                    isLocked
                      ? <Lock className="w-4 h-4 text-indigo-400" />
                      : <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      }

      case 'single_choice': {
        const singleOpts = getStepOptions(currentNode);
        return (
          <div className="space-y-3">
            {isLocked && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>This answer was automatically determined from your account data and cannot be changed.</span>
              </div>
            )}
            <Select disabled={isLocked} value={answers[currentNodeId] || ""} onValueChange={isLocked ? undefined : v => { setSelectedValue(v); setAnswers(p => ({ ...p, [currentNodeId]: v })); }}>
              <SelectTrigger className={`w-full h-12 ${isLocked ? 'cursor-not-allowed opacity-70 bg-slate-50' : ''}`}>
                <SelectValue placeholder="Select an option..." />
              </SelectTrigger>
              <SelectContent>
                {singleOpts.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                    const newVals = toggleMultiChoiceValue(selected, opt, currentNode.options);
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
          <DateInput
            value={selectedValue || ""}
            max={new Date().toISOString().split('T')[0]}
            onChange={(iso) => setSelectedValue(iso || "")}
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
                {(() => {
                  const reqDate = resolveRequestedDate(steps, answers, answerHistory, latestAccountData || account);
                  const today = new Date().toISOString().split('T')[0];
                  const { error: dateError } = validateDateReceived(dateReceivedValue, reqDate);
                  return (
                    <>
                      <DateInput
                        value={dateReceivedValue}
                        max={today}
                        min={reqDate || undefined}
                        onChange={(iso) => setDateReceivedValue(iso || "")}
                        className={`mt-1.5 ${dateError ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                      />
                      {reqDate && (
                        <p className="text-xs text-slate-500 mt-1">
                          Self-certification was requested on: <strong>{toDisplayDate(reqDate)}</strong>
                        </p>
                      )}
                      {dateError && (
                        <Alert className="mt-2 bg-red-50 border-red-200 py-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <AlertDescription className="text-xs text-red-700">{dateError}</AlertDescription>
                        </Alert>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );
      }

      case 'address_input': {
        const prevUploadedFile = history.slice().reverse()
          .map(sid => answers[sid])
          .find(a => a && typeof a === 'object' && a.file_url && !Array.isArray(a));

        const currentAddr = (latestAccountData || account)?.current_address;
        const addrParts = currentAddr
          ? [currentAddr.street, currentAddr.city, currentAddr.state, currentAddr.postal_code, currentAddr.country].filter(Boolean)
          : [];

        return (
          <div className="space-y-4">
            {/* Decoy fields: browser autofill scanner finds these first and considers
                the address form already handled — suppresses the "Save address?" prompt.
                Must be in the DOM (not display:none) so Edge/Chrome doesn't skip them.
                readOnly prevents any values being written. */}
            <div
              aria-hidden="true"
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden', zIndex: -1 }}
            >
              <input type="text"     tabIndex={-1} autoComplete="street-address" readOnly />
              <input type="text"     tabIndex={-1} autoComplete="address-level2" readOnly />
              <input type="text"     tabIndex={-1} autoComplete="address-level1" readOnly />
              <input type="text"     tabIndex={-1} autoComplete="postal-code"    readOnly />
              <input type="text"     tabIndex={-1} autoComplete="country-name"   readOnly />
              <input type="password" tabIndex={-1} autoComplete="new-password"   readOnly />
            </div>
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
              <Input value={addressValues.street || ""} onChange={e => setAddressValues(p => ({ ...p, street: e.target.value }))} placeholder="123 Main Street" className="mt-1.5" autoComplete="off" name={`x-crs-street-${currentNodeId}`} data-lpignore="true" data-1p-ignore data-form-type="other" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">City <span className="text-red-600">*</span></Label>
                <Input value={addressValues.city || ""} onChange={e => setAddressValues(p => ({ ...p, city: e.target.value }))} className="mt-1.5" autoComplete="off" name={`x-crs-city-${currentNodeId}`} data-lpignore="true" data-1p-ignore data-form-type="other" />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">State <span className="text-red-600">*</span></Label>
                <Input value={addressValues.state || ""} onChange={e => setAddressValues(p => ({ ...p, state: e.target.value }))} className="mt-1.5" autoComplete="off" name={`x-crs-state-${currentNodeId}`} data-lpignore="true" data-1p-ignore data-form-type="other" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">Postal Code <span className="text-red-600">*</span></Label>
                <Input value={addressValues.postal_code || ""} onChange={e => setAddressValues(p => ({ ...p, postal_code: e.target.value }))} className="mt-1.5" autoComplete="off" name={`x-crs-postal-${currentNodeId}`} data-lpignore="true" data-1p-ignore data-form-type="other" />
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
                <Input value={addressValues.tin || ""} onChange={e => setAddressValues(p => ({ ...p, tin: e.target.value }))} placeholder="Enter TIN..." className="mt-1.5" autoComplete="off" name={`x-crs-tin-${currentNodeId}`} data-lpignore="true" data-1p-ignore data-form-type="other" />
              </div>
            </div>
          </div>
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

      case 'multi_field_input': {
        const selfCertMinDates = computeSelfCertFieldMinDates(
          currentNode,
          steps,
          answers,
          answerHistory,
          latestAccountData || account,
          history.filter(id => id === currentNodeId).length
        );
        return (
          <MultiFieldRenderer
            fields={currentNode.multi_fields || []}
            values={multiFieldValues}
            onChange={setMultiFieldValues}
            errors={{}}
            fieldMinDates={selfCertMinDates}
          />
        );
      }

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
      if (currentNode.file_upload_config?.require_date_received) {
        if (!dateReceivedValue) return false;
        const reqDate = resolveRequestedDate(steps, answers, answerHistory, latestAccountData || account);
        const { valid } = validateDateReceived(dateReceivedValue, reqDate);
        return valid;
      }
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
    const isWorkInProgress = summaryStatus === 'work_in_progress';

    // Build previous answers rows for summary — use answerHistory for iteration-correct display
    const summaryIterCounters = {};
    const summaryAnswerRows = completedPath
      .map((stepId) => {
        const step = stepMap[stepId];
        if (!step || step.question_type === 'info' || step.question_type === 'result') return null;

        summaryIterCounters[stepId] = (summaryIterCounters[stepId] ?? -1) + 1;
        const iterIdx = summaryIterCounters[stepId];

        let ans;
        if (answerHistory && answerHistory[stepId] && answerHistory[stepId].length > iterIdx) {
          ans = answerHistory[stepId][iterIdx];
        } else {
          ans = answers[stepId];
        }

        if (ans === null || ans === undefined || ans === '') return null;
        let displayAnswer = '';
        if (typeof ans === 'boolean') displayAnswer = ans ? 'Yes' : 'No';
        else if (ans === 'YES') displayAnswer = 'Yes';
        else if (ans === 'NO') displayAnswer = 'No';
        else if (Array.isArray(ans)) {
          const opts = getStepOptions(step);
          displayAnswer = ans.map(v => opts.find(o => o.value === v)?.label || v).join(', ');
        }
        else if (typeof ans === 'object') {
          if (ans.file_name) {
            displayAnswer = ans.date_received ? `${ans.file_name} (Received: ${toDisplayDate(ans.date_received)})` : ans.file_name;
          } else {
            displayAnswer = JSON.stringify(ans);
          }
        }
        else {
          const opts = getStepOptions(step);
          const matched = opts.find(o => o.value === ans);
          displayAnswer = matched ? matched.label : String(ans);
        }
        if (!displayAnswer) return null;

        const totalVisits = completedPath.filter(id => id === stepId).length;
        const iterationLabel = totalVisits > 1 ? ` (Attempt ${iterIdx + 1})` : '';
        return { stepId, step, displayAnswer, iterationLabel };
      })
      .filter(Boolean);

    return (
      <div className="space-y-6" data-form-type="other" autoComplete="off" data-ms-editor="false">
        <div className="text-center">
          <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${isReportable ? 'bg-amber-100' : isPending ? 'bg-blue-100' : isWorkInProgress ? 'bg-red-100' : 'bg-green-100'}`}>
            {isReportable ? <AlertCircle className="w-10 h-10 text-amber-600" /> : isPending ? <Info className="w-10 h-10 text-blue-600" /> : isWorkInProgress ? <Clock className="w-10 h-10 text-red-600" /> : <CheckCircle2 className="w-10 h-10 text-green-600" />}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Classification Complete</h2>
          <p className="text-slate-600">Review your answers and confirm the classification</p>
        </div>

        <Card className={`border-2 ${isReportable ? 'bg-amber-50 border-amber-200' : isPending ? 'bg-blue-50 border-blue-200' : isWorkInProgress ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Status:</span>
              <Badge variant="outline" className={`text-sm border ${isReportable ? 'bg-amber-600 text-white border-amber-600' : isPending ? 'bg-blue-600 text-white border-blue-600' : isWorkInProgress ? 'bg-red-100 text-red-800 border-red-200' : 'bg-slate-500 text-white border-slate-500'}`}>
                {isReportable ? 'Reportable' : isPending ? 'Pending Review' : isWorkInProgress ? 'Work in progress' : 'Non-Reportable'}
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
            answerHistory={answerHistory}
            getStepOptions={getStepOptions}
          />
        )}

        <VoiceWorkflowAssistant
          currentStep={{ step_id: 'summary', question_type: 'info', step_title: 'Classification Complete', question_text: 'Review your answers and confirm the classification.' }}
          answers={answers}
          onAnswer={() => {}}
          onNext={handleComplete}
          onBack={() => setShowSummary(false)}
        />

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
    <div className="space-y-6" data-form-type="other" autoComplete="off" data-ms-editor="false">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {workflow.workflow_name} v{workflow.version}
          </Badge>
          {flowchartEnabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFlowchart(true)}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            >
              <GitBranch className="w-4 h-4 mr-1" />
              Flowchart
            </Button>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">Step {currentStepNumber}</p>
          <p className="text-xs text-slate-500">{progress}% Complete</p>
        </div>
      </div>

      {flowchartEnabled && (
        <Dialog open={showFlowchart} onOpenChange={setShowFlowchart}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Flowchart: {workflow.workflow_name}</DialogTitle>
            </DialogHeader>
            <WorkflowVisualizer workflow={workflow} />
          </DialogContent>
        </Dialog>
      )}

      {/* Introduction */}
      {workflow.display_workflow_introduction && (
        <Alert className={`relative ${isEntityWorkflow ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}`}>
          <Info className={`w-4 h-4 ${isEntityWorkflow ? "text-purple-600" : "text-blue-600"}`} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setAccountEditError(null); setShowEditAccount(true); }}
            className={`absolute top-2 right-2 text-xs h-7 px-2 ${isEntityWorkflow ? "text-purple-700 hover:bg-purple-100" : "text-blue-700 hover:bg-blue-100"}`}
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit Account
          </Button>
          <AlertDescription>
            <div className="space-y-2 pr-28">
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
        <Alert className={`relative ${isEntityWorkflow ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setAccountEditError(null); setShowEditAccount(true); }}
            className={`absolute top-2 right-2 text-xs h-7 px-2 ${isEntityWorkflow ? "text-purple-700 hover:bg-purple-100" : "text-blue-700 hover:bg-blue-100"}`}
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit Account
          </Button>
          {isEntityWorkflow ? (
            <>
              <Users className="w-4 h-4 text-purple-600" />
              <AlertDescription className="text-sm text-purple-900 pr-28">
                <strong>Entity Account:</strong> This workflow determines if the entity is a Financial Institution, Active NFE, or Passive NFE requiring controlling persons identification.
              </AlertDescription>
            </>
          ) : (
            <>
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900 pr-28">
                <strong>Individual Account:</strong> This workflow follows CRS due diligence procedures for individual accounts.
                {account?.is_pre_existing !== undefined && (
                  <span className="block mt-1">Account Type: <strong>{account.is_pre_existing ? "Pre-existing (before 2018)" : "New (2018+)"}</strong></span>
                )}
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Draft Sync Warning Banner */}
      {!bannerDismissed && (
        <DraftSyncWarningBanner
          isDirty={isDirty}
          affectedSteps={affectedSteps}
          resyncedSteps={resyncedSteps}
          stepMap={stepMap}
          isSaving={isSavingDraft}
          onDismiss={() => setBannerDismissed(true)}
          onSaveNow={async () => {
            setIsSavingDraft(true);
            try {
              const fiUpdate = resolveFiTypeUpdate(steps, answers);
              const fiTypeStep = steps.find(s => s.mapped_field?.field_name === 'fi_type' || s.mapped_field?.field_name === 'type_of_financial_institution');
              if (fiUpdate && account?.id && !(fiTypeStep && prefilledSteps.has(fiTypeStep.step_id))) {
                try {
                  await base44.entities.Account.update(account.id, fiUpdate);
                  const refreshed = await base44.entities.Account.filter({ id: account.id });
                  if (refreshed[0]) setLatestAccountData(refreshed[0]);
                } catch (err) {
                  console.error('FI type propagation on Save Now failed:', err);
                }
              }
              if (onSaveAndExit) {
                await onSaveAndExit({
                  answers,
                  history,
                  answerHistory,
                  currentStepIndex,
                  lastStepId: currentNode?.step_id,
                  workflowId: selectedWorkflow?.id,
                  workflowName: selectedWorkflow?.workflow_name,
                  lockedSteps: [...prefilledSteps],
                });
              }
              setIsDirty(false);
              setResyncedSteps([]);
            } finally {
              setIsSavingDraft(false);
            }
          }}
        />
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
                    <Info className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                    <AlertDescription className="text-sm text-blue-900">
                      {currentNode.help_text.trim().startsWith('<') ? (
                        <div dangerouslySetInnerHTML={{ __html: currentNode.help_text }} className="workflow-help-text [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:space-y-1.5 [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:space-y-1 [&_li]:leading-relaxed [&_p]:mb-2 [&_strong]:font-semibold [&_em]:italic" />
                      ) : (
                        currentNode.help_text
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
            <div className="pl-16 space-y-4">
              <VoiceWorkflowAssistant
                currentStep={currentNode}
                answers={answers}
                onAnswer={(stepId, answer) => {
                  if (currentNode.question_type === 'file_upload' && typeof answer === 'string') {
                    // Voice returned a date for the date_received field
                    setDateReceivedValue(answer);
                  } else {
                    setAnswers(p => ({ ...p, [stepId]: answer }));
                    setSelectedValue(answer);
                  }
                }}
                onNext={handleNext}
                onBack={handleBack}
              />
              {renderNode()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Previous Answers */}
      {history.length > 0 && (
        <PreviousAnswers history={history} stepMap={stepMap} answers={answers} answerHistory={answerHistory} getStepOptions={getStepOptions} />
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
      <div className="flex justify-between gap-3 pt-4 border-t flex-wrap">
        <Button type="button" variant="outline" onClick={handleBack} size="lg">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {history.length === 0 ? "Cancel" : "Previous"}
        </Button>
        <div className="flex gap-3">
          {onSaveAndExit && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={async () => {
                const fiUpdate = resolveFiTypeUpdate(steps, answers);
                const fiTypeStep = steps.find(s => s.mapped_field?.field_name === 'fi_type' || s.mapped_field?.field_name === 'type_of_financial_institution');
                if (fiUpdate && account?.id && !(fiTypeStep && prefilledSteps.has(fiTypeStep.step_id))) {
                  try {
                    await base44.entities.Account.update(account.id, fiUpdate);
                    const refreshed = await base44.entities.Account.filter({ id: account.id });
                    if (refreshed[0]) setLatestAccountData(refreshed[0]);
                  } catch (err) {
                    console.error('FI type propagation on Save & Exit failed:', err);
                  }
                }
                setIsDirty(false);
                setResyncedSteps([]);
                onSaveAndExit({
                  answers,
                  history,
                  answerHistory,
                  currentStepIndex,
                  lastStepId: currentNode?.step_id,
                  workflowId: selectedWorkflow?.id,
                  workflowName: selectedWorkflow?.workflow_name,
                  lockedSteps: [...prefilledSteps],
                });
              }}
            >
              <Save className="w-4 h-4 mr-2" />
              Save & Exit
            </Button>
          )}
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

      {/* Edit Account Dialog */}
      <Dialog open={showEditAccount} onOpenChange={(open) => { if (!open) setShowEditAccount(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Account: {(latestAccountData || account)?.account_holder_name}</DialogTitle>
          </DialogHeader>
          {accountEditError && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-800 text-sm">{accountEditError}</AlertDescription>
            </Alert>
          )}
          <div className="relative">
            {isSavingAccountEdit && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            )}
            <AccountForm
              account={latestAccountData || account}
              entities={entities || []}
              tenant={{ id: (latestAccountData || account)?.tenant_id }}
              onSubmit={handleAccountEditSave}
              onCancel={() => setShowEditAccount(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Workflow Template Mismatch Dialog */}
      <AlertDialog open={showWorkflowMismatchDialog} onOpenChange={setShowWorkflowMismatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Workflow Template Changed</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>The account changes affect which classification workflow applies.</p>
                <div className="text-xs bg-slate-50 border rounded p-3 space-y-1 mt-2">
                  <p><strong>Current:</strong> {selectedWorkflow?.workflow_name}</p>
                  <p><strong>Recommended:</strong> {pendingNewWorkflow?.workflow_name}</p>
                </div>
                <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 text-xs mt-2">
                  Restart with the correct template, or keep your current progress?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowWorkflowMismatchDialog(false); setPendingNewWorkflow(null); }}>
              Keep Current Progress
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                if (pendingNewWorkflow) {
                  setSelectedWorkflow(pendingNewWorkflow);
                  setCurrentStepIndex(0);
                  setHistory([]);
                  setAnswers({});
                  setAnswerHistory({});
                  setPrefilledSteps(new Set());
                  setAffectedSteps([]);
                }
                setShowWorkflowMismatchDialog(false);
                setPendingNewWorkflow(null);
              }}
            >
              Restart with New Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}