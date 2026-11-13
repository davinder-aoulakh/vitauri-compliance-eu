import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Role check: only approved app roles may run classification
        const allowedRoles = ['tenant_user', 'tenant_supervisor', 'tenant_admin', 'super_admin'];
        if (!allowedRoles.includes(user.app_role)) {
            return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
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

        // Tenant check: non-super-admins may only classify accounts in their own tenant
        if (user.app_role !== 'super_admin' && account.tenant_id !== user.tenant_id) {
            return Response.json({ error: 'Account belongs to another tenant' }, { status: 403 });
        }

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

        // Select relevant workflow using smart matching on account data
        const holderType = account.account_holder_type;
        const accountReportabilityWorkflows = workflows.filter(w => w.workflow_type === 'account_reportability');
        const candidates = accountReportabilityWorkflows.length ? accountReportabilityWorkflows : workflows;

        let chosenWorkflow;
        if (holderType === 'entity') {
            // Entity accounts: route based on entity's fi_type, matching the actual workflow trigger conditions:
            // - "Insurance & Depository" triggers when fi_type = specified_insurance_company OR depository_institution
            // - "Investment" triggers when fi_type = type_a OR type_b (investment entities)
            const entityFiType = (entity?.fi_type || '').toLowerCase();
            const isInsuranceOrDepository = 
                ['specified_insurance_company', 'depository_institution'].includes(entityFiType) ||
                entityFiType.includes('insurance') || entityFiType.includes('depository');
            const isInvestment = 
                ['type_a', 'type_b', 'investment_entity'].includes(entityFiType) ||
                entityFiType.includes('investment') || entityFiType.includes('type a') || entityFiType.includes('type b');

            if (isInsuranceOrDepository) {
                chosenWorkflow = candidates.find(w => w.workflow_name === 'Entity Account - Insurance & Depository');
            } else if (isInvestment) {
                chosenWorkflow = candidates.find(w => w.workflow_name === 'Entity Account - Investment');
            }

            // Fallback: try any entity workflow
            if (!chosenWorkflow) {
                chosenWorkflow = candidates.find(w => w.workflow_name?.toLowerCase().includes('entity')) || candidates[0];
            }
        } else {
            // Individual accounts: filter out entity, beneficiary, controlling person, dormant workflows first
            const individualCandidates = candidates.filter(w =>
                !w.workflow_name?.toLowerCase().includes('entity') &&
                !w.workflow_name?.toLowerCase().includes('beneficiary') &&
                !w.workflow_name?.toLowerCase().includes('controlling') &&
                !w.workflow_name?.toLowerCase().includes('dormant')
            );

            const isAlive = account.account_holder_is_alive !== false; // default true if not set
            const isPreExisting = account.is_pre_existing === true;
            const balance = account.year_end_cash_value || 0;
            const HIGH_VALUE_THRESHOLD = 1000000;

            if (!isAlive) {
                // Deceased account
                chosenWorkflow = individualCandidates.find(w => w.workflow_name?.toLowerCase().includes('deceased'));
            } else if (isPreExisting) {
                // Pre-existing alive account — high vs low value
                if (balance >= HIGH_VALUE_THRESHOLD) {
                    chosenWorkflow = individualCandidates.find(w =>
                        w.workflow_name?.toLowerCase().includes('alive') &&
                        w.workflow_name?.toLowerCase().includes('high') &&
                        w.workflow_name?.toLowerCase().includes('pre')
                    );
                } else {
                    chosenWorkflow = individualCandidates.find(w =>
                        w.workflow_name?.toLowerCase().includes('alive') &&
                        w.workflow_name?.toLowerCase().includes('low') &&
                        w.workflow_name?.toLowerCase().includes('pre')
                    );
                }
                // Fallback to any pre-existing alive workflow
                if (!chosenWorkflow) {
                    chosenWorkflow = individualCandidates.find(w =>
                        w.workflow_name?.toLowerCase().includes('alive') &&
                        w.workflow_name?.toLowerCase().includes('pre')
                    );
                }
            } else {
                // New alive account
                chosenWorkflow = individualCandidates.find(w =>
                    w.workflow_name?.toLowerCase().includes('alive') &&
                    w.workflow_name?.toLowerCase().includes('new') &&
                    !w.workflow_name?.toLowerCase().includes('deceased')
                );
            }

            // Final fallback: any alive individual workflow
            if (!chosenWorkflow) {
                chosenWorkflow = individualCandidates.find(w => w.workflow_name?.toLowerCase().includes('alive'));
            }
            if (!chosenWorkflow) {
                chosenWorkflow = individualCandidates[0] || candidates[0];
            }
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
        const llmPrompt = `You are a CRS/FATCA compliance classification expert. Your task is to answer each step of a compliance workflow using ONLY the provided account data.

ACCOUNT DATA:
${JSON.stringify(accountSummary, null, 2)}

WORKFLOW: "${chosenWorkflow.workflow_name}"

INSTRUCTIONS:
- Answer ONLY using the account data above. Do not make assumptions beyond what is provided.
- For yes_no questions: answer must be exactly "YES" or "NO"
- For single_choice/multiple_choice: answer must be exactly one of the listed option VALUES (not labels)
- For text/number/date questions: provide the value from the account data
- If data is missing for a question, default to the most conservative CRS compliance answer (prefer flagging for review over excluding from reporting)
- Focus on tax residency, CRS country status, account values, and holder status to determine reportability
- DO NOT base answers on workflow name or irrelevant account fields

WORKFLOW STEPS TO ANSWER:
${JSON.stringify(stepsForLLM, null, 2)}

Return a JSON object where keys are step_ids and values are your answers. Include a "reasoning" key summarizing why the account is or is not reportable based purely on the data.

Example:
{
  "step_abc": "YES",
  "step_def": "NO",
  "reasoning": "Account holder has tax residency in France (CRS participating country), making this account reportable."
}`;

        // Build schema that explicitly requires each step_id as a property
        // so the LLM is forced to return an answer for every question step
        const stepProperties = { reasoning: { type: "string" } };
        questionSteps.forEach(s => {
            if (s.question_type === 'yes_no') {
                stepProperties[s.step_id] = { type: "string", enum: ["YES", "NO"] };
            } else if ((s.question_type === 'single_choice') && s.options?.length) {
                stepProperties[s.step_id] = { type: "string", enum: s.options.map(o => o.value) };
            } else {
                stepProperties[s.step_id] = { type: "string" };
            }
        });

        const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: llmPrompt,
            response_json_schema: {
                type: "object",
                properties: stepProperties,
                required: ["reasoning", ...questionSteps.map(s => s.step_id)],
                additionalProperties: false
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

            // Stop at any terminal step: explicit 'result' type OR any step with a result_status
            if (currentStep.question_type === 'result' || currentStep.result_status) break;

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

        // Build answers only for steps actually visited (for clean audit trail)
        const visitedAnswers = {};
        visitedPath.forEach(stepId => {
            if (stepAnswers[stepId] !== undefined) {
                visitedAnswers[stepId] = stepAnswers[stepId];
            }
        });

        // Update account
        await base44.asServiceRole.entities.Account.update(accountId, {
            reportability_status: reportabilityStatus,
            reportability_reason: reportabilityReason,
            classification_answers: visitedAnswers,
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
            workflow_answers: visitedAnswers,
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