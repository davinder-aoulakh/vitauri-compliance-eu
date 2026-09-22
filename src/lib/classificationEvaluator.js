/**
 * classificationEvaluator.js
 * Pure service: workflow selection, prefill re-computation, affected step detection, audit logging.
 * Used by AccountClassification to re-sync answers when account data is edited mid-session.
 */

import { evaluateWorkflowTriggers } from "@/components/workflows/WorkflowTriggerEvaluator";
import { computePrefillAnswers } from "@/components/workflows/workflowPrefillUtils";
import { base44 } from "@/api/base44Client";

// ─── Workflow Selection ────────────────────────────────────────────────────────

/**
 * Selects the best-matching published workflow for a given account + entity.
 */
export const selectWorkflow = async (accountData, entityData, publishedWorkflows) => {
  if (!publishedWorkflows?.length || !accountData) return null;

  const holderType = accountData.account_holder_type;
  const allCandidates = publishedWorkflows.filter(w => w.workflow_type === "account_reportability");
  const pool = allCandidates.length ? allCandidates : publishedWorkflows;

  const entityWfs = pool.filter(w => w.workflow_name?.toLowerCase().includes("entity"));
  const individualWfs = pool.filter(w => !w.workflow_name?.toLowerCase().includes("entity"));
  const candidates = holderType === "entity"
    ? (entityWfs.length ? entityWfs : pool)
    : (individualWfs.length ? individualWfs : pool);

  const mergedData = { ...accountData, ...(entityData || {}) };

  const allMatched = [];
  for (const evt of ["account_updated", "account_created"]) {
    const matches = await evaluateWorkflowTriggers(mergedData, evt, candidates);
    matches.forEach((wf, idx) => {
      const bonus = evt === "account_updated" ? 1000 : 0;
      allMatched.push({ wf, priority: (wf.trigger_conditions?.priority || 0) + bonus - idx });
    });
  }
  allMatched.sort((a, b) => b.priority - a.priority);

  // Dormant override
  if (accountData.status === "dormant" || accountData.account_dormant_at_reporting_date === true) {
    const dormant = candidates.find(w => w.workflow_name?.toLowerCase().includes("dormant"));
    if (dormant) return dormant;
  }

  let chosen = allMatched[0]?.wf;

  if (!chosen) {
    if (holderType === "entity") {
      chosen = candidates.find(w =>
        w.workflow_type === "entity_rfi_classification" || w.workflow_name?.toLowerCase().includes("entity")
      ) || candidates[0];
    } else {
      chosen = candidates.find(w =>
        w.workflow_type === "account_reportability" && !w.workflow_name?.toLowerCase().includes("entity")
      ) || candidates.find(w => !w.workflow_name?.toLowerCase().includes("entity")) || candidates[0];
    }
  }

  return chosen || null;
};

// ─── Prefill Re-computation ────────────────────────────────────────────────────

const EXCEPTION_OPTION_MAP = {
  'DGA': 'OPT1', 'NONPROFIT': 'OPT2', 'STAK': 'OPT3',
  'holding': 'OPT4', 'treasury': 'OPT5', 'realestate': 'OPT6',
  'N.V. or B.V. acting with one 100% shareholder/director (100% DGA)': 'OPT1',
  'N.V. or B.V. acting with one 100% shareholder/director (DGA)': 'OPT1',
  'Non-Profit Organization': 'OPT2',
  'Stichting (Foundation) or other Non-Profit Organization': 'OPT2',
  'Non-Profit Organization ((religious/charitable/scientific/ artistic/cultural/athletic/educational))': 'OPT2',
  'Stichting Administratiekantoor (STAK)': 'OPT3',
  'Holding Company': 'OPT4',
  'Treasury Center': 'OPT5',
  'Real Estate Fund': 'OPT6',
};

/**
 * Computes the full prefill map for a workflow given fresh account + entity data.
 */
export const computeWorkflowPrefill = async (workflow, accountData, entityData) => {
  if (!workflow || !accountData) return { prefillMap: {}, lockableStepIds: [] };

  const accountPrefilled = await computePrefillAnswers(workflow, accountData, "Account");
  const entityPrefilled = entityData
    ? await computePrefillAnswers(workflow, entityData, "Entity")
    : {};

  // Account prefill wins; entity fills only gaps
  const merged = { ...entityPrefilled, ...accountPrefilled };

  // Exception entity type → prefill the "Select potential exception" step
  const exceptionOptValue = EXCEPTION_OPTION_MAP[accountData.account_holder_entity_type];
  if (exceptionOptValue) {
    const exceptionStep = workflow.steps.find(s =>
      s.step_title?.toLowerCase().includes("exception") &&
      (s.question_type === "single_choice" || s.question_type === "multiple_choice")
    );
    if (exceptionStep) merged[exceptionStep.step_id] = exceptionOptValue;

    const fiTypeStep = workflow.steps.find(s =>
      s.step_title?.toLowerCase().includes("type of financial institution") &&
      s.question_type === "single_choice"
    );
    if (fiTypeStep && !accountData.type_of_financial_institution) {
      delete merged[fiTypeStep.step_id];
    }
  }

  const lockableStepIds = Object.entries(merged)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k]) => k);

  return { prefillMap: merged, lockableStepIds };
};

// ─── Affected Steps Detection ──────────────────────────────────────────────────

export const CLASSIFICATION_FIELDS = [
  "is_pre_existing", "account_holder_type", "year_end_cash_value", "gross_payments",
  "account_holder_is_alive", "account_dormant_at_reporting_date", "account_holder_entity_type",
  "entity_classification", "status", "type_of_financial_institution",
];

/**
 * Returns step IDs from visitedHistory whose mapped_field.field_name was
 * changed by the account edit — these steps may need re-review.
 */
export const findAffectedSteps = (steps, visitedHistory, beforeData, afterData) => {
  const changed = CLASSIFICATION_FIELDS.filter(f =>
    JSON.stringify(beforeData?.[f]) !== JSON.stringify(afterData?.[f])
  );
  if (!changed.length) return [];

  return visitedHistory.filter(stepId => {
    const step = steps.find(s => s.step_id === stepId);
    return step?.mapped_field && changed.includes(step.mapped_field.field_name);
  });
};

// ─── FI Type Propagation ────────────────────────────────────────────────────────

const FI_TYPE_VALUE_MAP = {
  'depository_institution': 'depository_institution',
  'custodial_institution': 'custodial_institution',
  'type_a': 'investment_entity_type_a',
  'type_b': 'investment_entity_type_b',
  'investment_entity_type_a': 'investment_entity_type_a',
  'investment_entity_type_b': 'investment_entity_type_b',
  'specified_insurance_company': 'specified_insurance_company',
};

/**
 * Resolves the Account.type_of_financial_institution update from a workflow's
 * FI type step answer, or null if no update is warranted.
 */
export const resolveFiTypeUpdate = (steps, answers) => {
  const fiTypeStep = (steps || []).find(
    s => s.mapped_field?.field_name === 'fi_type' || s.mapped_field?.field_name === 'type_of_financial_institution'
  );
  if (!fiTypeStep) return null;
  const rawAnswer = answers?.[fiTypeStep.step_id];
  if (!rawAnswer || rawAnswer === 'none') return null;
  const mappedFiType = FI_TYPE_VALUE_MAP[rawAnswer] || rawAnswer;
  return { type_of_financial_institution: mappedFiType };
};

const ENTITY_FI_TYPE_VALUE_MAP = {
  '1': 'custodial_institution',
  '2': 'depository_institution',
  '3a': 'investment_entity',
  '3b': 'investment_entity',
  '4': 'specified_insurance_company',
  'Custodial Institution': 'custodial_institution',
  'Depository Institution': 'depository_institution',
  'Investment Entity (3a)': 'investment_entity',
  'Investment Entity (3b)': 'investment_entity',
  'Specified Insurance Company': 'specified_insurance_company',
};

/**
 * Resolves the Entity.fi_type update from a workflow's FI type step answer,
 * or null if no update is warranted.
 */
export const resolveEntityFiTypeUpdate = (steps, answers) => {
  const fiTypeStep = (steps || []).find(
    s => s.step_id === 'frm_select_fi_type' || s.mapped_field?.field_name === 'fi_type'
  );
  if (!fiTypeStep) return null;
  const rawAnswer = answers?.[fiTypeStep.step_id];
  if (!rawAnswer || rawAnswer === 'none' || rawAnswer === 'not_applicable') return null;
  const mappedFiType = ENTITY_FI_TYPE_VALUE_MAP[rawAnswer] || rawAnswer;
  return { fi_type: mappedFiType };
};

// ─── Audit Logging ─────────────────────────────────────────────────────────────

export const auditAccountEditDuringClassification = async ({
  tenantId, accountId, accountName, currentWorkflowId, newWorkflowId,
  affectedStepCount, resyncedStepCount = 0, beforeData, afterData, changedFields,
}) => {
  try {
    const me = await base44.auth.me();
    await base44.entities.AuditLog.create({
      tenant_id: tenantId,
      action_type: "account_updated",
      actor_email: me?.email || "",
      actor_role: me?.app_role || "",
      target_entity_type: "Account",
      target_entity_id: accountId,
      target_entity_name: accountName || "",
      changes: {
        _context: "edited_during_classification",
        workflow_template_before: currentWorkflowId,
        workflow_template_after: newWorkflowId,
        answers_affected_step_count: affectedStepCount,
        prefill_resynced_step_count: resyncedStepCount,
        ...changedFields.reduce((acc, f) => {
          acc[`${f}_before`] = beforeData?.[f];
          acc[`${f}_after`] = afterData?.[f];
          return acc;
        }, {}),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (_) {
    // Audit log failures are non-fatal
  }
};