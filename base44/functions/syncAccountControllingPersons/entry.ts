import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const PROCESS_NAME = 'Controlling person rollup sync';

export default async function (req: Request): Promise<Response> {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();

        // Support both direct call and automation event
        let accountId = payload.accountId;
        if (!accountId && payload.event?.entity_name === 'ControllingPerson' && payload.data?.account_id) {
            accountId = payload.data.account_id;
        }

        if (!accountId) {
            return Response.json({ error: 'Account ID is required' }, { status: 400 });
        }

        // Fresh persisted data
        const controllingPersons = await base44.entities.ControllingPerson.filter({ account_id: accountId });
        const accounts = await base44.entities.Account.filter({ id: accountId });
        const account = accounts[0];
        if (!account) {
            return Response.json({ error: 'Account not found' }, { status: 404 });
        }

        const totalCount = controllingPersons.length;
        // Strict: only null/undefined is unclassified (false is a real classification)
        const hasUnclassified = controllingPersons.some(cp => cp.is_reportable === null || cp.is_reportable === undefined);
        const hasReportable = controllingPersons.some(cp => cp.is_reportable === true);

        const updates: Record<string, unknown> = {};
        if (account.controlling_persons_count !== totalCount) updates.controlling_persons_count = totalCount;
        if (account.has_unclassified_controlling_persons !== hasUnclassified) updates.has_unclassified_controlling_persons = hasUnclassified;

        // Eligible only when WIP *because of* unclassified controlling persons (never dormancy / other causes)
        const reason = String(account.reportability_reason || '');
        const eligible =
            account.reportability_status === 'work_in_progress' &&
            /controlling person/i.test(reason) &&
            !/dorman/i.test(reason) &&
            totalCount > 0;

        let rollupApplied = false;
        let resultingStatus = account.reportability_status;

        if (eligible) {
            let newStatus = 'work_in_progress';
            let newReason = reason;
            if (hasReportable) {
                newStatus = 'reportable';
                newReason = 'Controlling person classification completed: at least one controlling person is reportable.';
            } else if (!hasUnclassified) {
                newStatus = 'non_reportable';
                newReason = 'Controlling person classification completed: all controlling persons are non-reportable.';
            }
            if (newStatus !== account.reportability_status) {
                updates.reportability_status = newStatus;
                updates.reportability_reason = newReason;
                rollupApplied = true;
                resultingStatus = newStatus;
            }
        }

        if (Object.keys(updates).length > 0) {
            if (rollupApplied) {
                // Audit record of the system-initiated status change (written before the account update)
                try {
                    await base44.entities.AuditLog.create({
                        tenant_id: account.tenant_id,
                        action_type: 'account_updated',
                        actor_email: user.email,
                        actor_role: PROCESS_NAME,
                        target_entity_type: 'Account',
                        target_entity_id: accountId,
                        target_entity_name: account.account_number,
                        changes: {
                            process: PROCESS_NAME,
                            initiated_by: user.email,
                            reportability_status: { from: account.reportability_status, to: updates.reportability_status },
                            reportability_reason: updates.reportability_reason
                        },
                        timestamp: new Date().toISOString()
                    });
                } catch (auditError) {
                    console.error('Failed to write rollup audit entry:', auditError);
                }
            }
            await base44.entities.Account.update(accountId, updates);

            if (rollupApplied) {
                // Attach the roll-up reason to the existing WIP history assessment (no new record)
                try {
                    const history = await base44.entities.AccountClassificationHistory.filter(
                        { account_id: accountId },
                        '-classification_date',
                        1
                    );
                    const latest = Array.isArray(history) ? history[0] : history?.items?.[0];
                    if (latest && latest.reportability_status === 'work_in_progress' && !latest.cp_rollup_reason) {
                        const label = resultingStatus === 'reportable' ? 'Reportable' : 'Non-Reportable';
                        await base44.entities.AccountClassificationHistory.update(latest.id, {
                            cp_rollup_reason: `Controlling person classification completed. The account is now ${label} based on the controlling person classification results.`,
                            cp_rollup_status: resultingStatus,
                            cp_rollup_date: new Date().toISOString()
                        });
                    }
                } catch (historyError) {
                    console.error('Failed to write rollup history reason:', historyError);
                }
            }
        }

        return Response.json({
            success: true,
            controlling_persons_count: totalCount,
            has_unclassified_controlling_persons: hasUnclassified,
            reportability_status: resultingStatus,
            rollup_applied: rollupApplied
        });
    } catch (error) {
        console.error('Error syncing controlling persons:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}