import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { accountId } = await req.json();
        if (!accountId) {
            return Response.json({ error: 'accountId is required' }, { status: 400 });
        }

        // Fetch account
        const accounts = await base44.asServiceRole.entities.Account.filter({ id: accountId });
        if (!accounts.length) {
            return Response.json({ error: 'Account not found' }, { status: 404 });
        }
        const account = accounts[0];

        // Fetch related entity
        let entity = null;
        if (account.entity_id) {
            const entities = await base44.asServiceRole.entities.Entity.filter({ id: account.entity_id });
            entity = entities[0] || null;
        }

        // Fetch published workflows
        const workflows = await base44.asServiceRole.entities.Workflow.filter({ status: 'published' });
        if (!workflows.length) {
            return Response.json({ error: 'No published workflows found' }, { status: 404 });
        }

        // Select relevant workflow (entity vs individual)
        const holderType = account.account_holder_type;
        const accountReportabilityWorkflows = workflows.filter(w => w.workflow_type === 'account_reportability');
        const candidates = accountReportabilityWorkflows.length ? accountReportabilityWorkflows : workflows;

        let chosenWorkflow;
        if (holderType === 'entity') {
            chosenWorkflow = candidates.find(w => w.workflow_name?.toLowerCase().includes('entity')) || candidates[0];
        } else {
            chosenWorkflow = candidates.find(w =>
                w.workflow_type === 'account_reportability' && !w.workflow_name?.toLowerCase().includes('entity')
            ) || candidates.find(w => !w.workflow_name?.toLowerCase().includes('entity')) || candidates[0];
        }

        if (!chosenWorkflow) {
            return Response.json({ error: 'No suitable workflow found' }, { status: 404 });
        }

        const steps = chosenWorkflow.steps || [];
        if (!steps.length) {
            return Response.json({ error: 'Workflow has no steps' }, { status: 400 });
        }

        // Build a compact summary of account + entity data for the LLM
        const accountSummary = {
            account_holder_name: account.account_holder_name,
            account_holder_type: account.account_holder_type,
            account_type: account.account_type,
            is_pre_existing: account.is_pre_existing,
            account_holder_is_alive: account.account_holder_is_alive,
            year_end_cash_value: account.year_end_cash_value,
            gross_payments: account.gross_payments,
            tax_residencies: account.tax_residencies,
            account_holder_address: account.account_holder_address,
            current_address: account.current_address,
            status: account.status,
            account_dormant_at_reporting_date: account.account_dormant_at_reporting_date,
            account_frozen_at_reporting_date: account.account_frozen_at_reporting_date,
            account_closed_during_period: account.account_closed_during_period,
            self_certification_obtained: account.self_certification_obtained,
            non_reportable_exception_type: account.non_reportable_exception_type,
            entity_classification: account.entity_classification,
            entity_managed_by_fiduciary_trust: account.entity_managed_by_fiduciary_trust,
            gross_income_50_passive: account.gross_income_50_passive,
        };

        if (entity) {
            accountSummary.entity_rfi_status = entity.rfi_status;
            accountSummary.entity_fi_type = entity.fi_type;
            accountSummary.entity_country_of_incorporation = entity.country_of_incorporation;
        }

        // Build workflow steps summary for LLM (only question steps)
        const questionSteps = steps.filter(s => !['result', 'info'].includes(s.question_type));
        const stepsForLLM = questionSteps.map(s => ({
            step_id: s.step_id,
            step_title: s.step_title,
            question_text: s.question_text,
            question_type: s.question_type,
            options: s.options?.map(o => ({ value: o.value, label: o.label })) || [],
            mapped_field: s.mapped_field?.field_name || null,
        }));

        // Ask LLM to answer each workflow step based on account data
        const llmPrompt = `You are a CRS/FATCA compliance classification expert. Based on the account data provided, answer each workflow question to determine the account's reportability status.

ACCOUNT DATA:
${JSON.stringify(accountSummary, null, 2)}

WORKFLOW: "${chosenWorkflow.workflow_name}"
WORKFLOW TYPE: ${chosenWorkflow.workflow_type}

For each workflow step below, provide the most appropriate answer based on the account data. 
- For yes_no questions: answer must be "YES" or "NO"
- For single_choice/multiple_choice questions: answer must be one of the provided option values exactly as listed
- For text/number/date questions: provide an appropriate value
- For steps where data is missing, make the most conservative compliance decision (prefer reporting/flagging for review over non-reporting)

WORKFLOW STEPS:
${JSON.stringify(stepsForLLM, null, 2)}

Return a JSON object with step_id as keys and your answers as values. Also include a "reasoning" key with a brief explanation of the overall classification decision.

Example format:
{
  "step_123": "YES",
  "step_456": "NO",
  "reasoning": "Account has foreign tax residency in France (CRS country), therefore reportable."
}`;

        const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: llmPrompt,
            response_json_schema: {
                type: "object",
                properties: {
                    reasoning: { type: "string" },
                },
                additionalProperties: true
            }
        });

        if (!llmResult) {
            return Response.json({ error: 'LLM classification failed' }, { status: 500 });
        }

        const { reasoning, ...stepAnswers } = llmResult;

        // Now simulate the workflow headlessly to determine final result step
        const stepMap = steps.reduce((acc, s) => { acc[s.step_id] = s; return acc; }, {});

        // Walk through workflow using LLM answers to find the result step
        let currentStepIndex = 0;
        const visitedPath = [];
        let maxIterations = steps.length * 2;

        while (currentStepIndex < steps.length && maxIterations-- > 0) {
            const currentStep = steps[currentStepIndex];
            if (!currentStep) break;

            visitedPath.push(currentStep.step_id);

            if (currentStep.question_type === 'result') break;

            const answer = stepAnswers[currentStep.step_id];
            let nextStepId = null;

            // Option-based routing for yes_no and single_choice
            if (currentStep.question_type === 'yes_no' || currentStep.question_type === 'single_choice') {
                const opt = currentStep.options?.find(o => o.value === answer);
                if (opt?.next_step) nextStepId = opt.next_step;
            }

            if (!nextStepId && currentStep.default_next_step) {
                nextStepId = currentStep.default_next_step;
            }

            if (nextStepId) {
                const nextIndex = steps.findIndex(s => s.step_id === nextStepId);
                if (nextIndex !== -1) {
                    currentStepIndex = nextIndex;
                    continue;
                }
            }

            currentStepIndex++;
        }

        // Determine final classification from the last visited result/info step
        const finalStep = visitedPath.slice().reverse()
            .map(sid => stepMap[sid])
            .find(s => s?.question_type === 'result' || s?.result_status);

        let reportabilityStatus = 'pending_review';
        let reportabilityReason = reasoning || 'AI classification based on workflow analysis';

        if (finalStep?.result_status) {
            reportabilityStatus = finalStep.result_status;
            reportabilityReason = finalStep.result_description || reasoning || reportabilityReason;
        } else if (finalStep?.result_action) {
            if (finalStep.result_action.includes('non_reportable') || finalStep.result_action.includes('excluded')) {
                reportabilityStatus = 'non_reportable';
            } else if (finalStep.result_action.includes('reportable')) {
                reportabilityStatus = 'reportable';
            }
        }

        // Update account
        await base44.asServiceRole.entities.Account.update(accountId, {
            reportability_status: reportabilityStatus,
            reportability_reason: reportabilityReason,
            classification_answers: stepAnswers,
        });

        // Create classification history
        await base44.asServiceRole.entities.AccountClassificationHistory.create({
            tenant_id: account.tenant_id,
            account_id: accountId,
            classification_date: new Date().toISOString(),
            reportability_status: reportabilityStatus,
            classification_reason: reportabilityReason,
            classification_source: 'workflow',
            workflow_id: chosenWorkflow.id,
            workflow_answers: stepAnswers,
            workflow_path_taken: visitedPath,
            performed_by: `AI (triggered by ${user.email})`,
            account_holder_name: account.account_holder_name,
            account_number: account.account_number,
            account_balance: account.year_end_cash_value,
        });

        // Audit log
        await base44.asServiceRole.entities.AuditLog.create({
            tenant_id: account.tenant_id,
            action_type: 'account_classified',
            actor_email: user.email,
            target_entity_type: 'Account',
            target_entity_id: accountId,
            changes: {
                reportability_status: reportabilityStatus,
                reportability_reason: reportabilityReason,
                classification_method: 'AI',
                workflow_used: chosenWorkflow.workflow_name,
            },
            timestamp: new Date().toISOString(),
        });

        return Response.json({
            success: true,
            reportability_status: reportabilityStatus,
            reportability_reason: reportabilityReason,
            workflow_used: chosenWorkflow.workflow_name,
            reasoning,
            steps_answered: Object.keys(stepAnswers).length,
            path_taken: visitedPath,
        });

    } catch (error) {
        console.error('AI classify error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});