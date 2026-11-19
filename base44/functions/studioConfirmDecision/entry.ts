import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { evaluate, inputHash, buildDecision, accountWriteBack, canConfirm, loadStudioInput } from '../../shared/crs/index.js';

// Classification Studio: confirm decisions (D2, D4).
// Only tenant_admin and tenant_supervisor may confirm, and only in their own tenant.
// The engine is re-run here on the server; the browser's result is never trusted.
// Body: { accountIds: string[] (max 100), expectedHashes?: {[id]: hash}, note?: string, signOffDecisionId?: string }

const CONFIRM_ROLES = ['tenant_admin', 'tenant_supervisor'];
const MAX = 100;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!CONFIRM_ROLES.includes(user.app_role) || !user.tenant_id) {
      return Response.json({ error: 'Only a tenant admin or supervisor can confirm studio decisions.' }, { status: 403 });
    }
    const tenantId = user.tenant_id;
    const db = base44.asServiceRole.entities;

    const tenant = (await db.Tenant.filter({ id: tenantId }))[0];
    if (tenant?.enabled_features?.classification_studio !== true) {
      return Response.json({ error: 'The Classification Studio is not switched on for this organisation.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : '';
    const now = new Date();
    const confirmed = [];
    const skipped = [];

    // ---- Second sign-off of a proposed decision --------------------------------------------------------------
    if (body.signOffDecisionId) {
      const proposal = (await db.ClassificationDecision.filter({ id: body.signOffDecisionId }))[0];
      if (!proposal || proposal.tenant_id !== tenantId) return Response.json({ error: 'Decision not found' }, { status: 404 });
      if (proposal.status !== 'proposed') return Response.json({ error: 'This decision is not waiting for sign-off.' }, { status: 409 });
      if (proposal.decided_by === user.email) return Response.json({ error: 'The second sign-off must be done by a different person.' }, { status: 409 });
      const account = (await db.Account.filter({ id: proposal.target_id }))[0];
      if (!account || account.tenant_id !== tenantId) return Response.json({ error: 'Account not found' }, { status: 404 });
      const { input } = await loadStudioInput(db, account);
      const hash = await inputHash(input);
      if (hash !== proposal.input_hash) {
        return Response.json({ error: 'The account data changed after this decision was proposed. Review it again and propose a new decision.' }, { status: 409 });
      }
      await db.ClassificationDecision.update(proposal.id, { status: 'confirmed', reviewer: user.email, reviewed_at: now.toISOString() });
      const final = { ...proposal, status: 'confirmed', reviewer: user.email, reviewed_at: now.toISOString() };
      await finalise(db, user, account, final, now);
      confirmed.push({ id: account.id, decision_id: proposal.id, outcome: proposal.outcome });
      return Response.json({ confirmed, skipped });
    }

    // ---- Confirm one or more accounts -----------------------------------------------------------------------
    const ids = Array.isArray(body.accountIds) ? [...new Set(body.accountIds.filter((x) => typeof x === 'string'))] : [];
    if (!ids.length) return Response.json({ error: 'accountIds is required' }, { status: 400 });
    if (ids.length > MAX) return Response.json({ error: `At most ${MAX} accounts can be confirmed at once.` }, { status: 400 });
    const expected = body.expectedHashes && typeof body.expectedHashes === 'object' ? body.expectedHashes : {};

    let shared = {};
    for (const id of ids) {
      try {
        const account = (await db.Account.filter({ id }))[0];
        if (!account || account.tenant_id !== tenantId) { skipped.push({ id, reason: 'Account not found in your organisation.' }); continue; }
        const loaded = await loadStudioInput(db, account, shared);
        shared = loaded.shared;
        const input = loaded.input;
        const answers = input.evidence?.draft_gap_answers || {};
        const result = evaluate(input, answers);
        if (!canConfirm(result)) { skipped.push({ id, reason: 'There are still open questions.' }); continue; }
        const hash = await inputHash(input);
        if (expected[id] && expected[id] !== hash) { skipped.push({ id, reason: 'The account data changed since you reviewed it. Reload and check again.' }); continue; }

        const existing = await db.ClassificationDecision.filter({ target_id: id, target_type: 'account' }, '-sequence', 50);
        const mine = existing.filter((d) => d.tenant_id === tenantId);
        if (mine.some((d) => d.status === 'proposed')) { skipped.push({ id, reason: 'A decision is already waiting for second sign-off.' }); continue; }
        const previous = mine.find((d) => d.status === 'confirmed') || null;
        const latestSeq = mine.reduce((m, d) => Math.max(m, d.sequence || 0), 0);

        const twoStep = input.settings?.require_second_signoff === true;
        const record = buildDecision({ input, result, answers, aiSuggestions: input.evidence?.draft_ai_suggestions || [], previous, user, hash, now,
          status: twoStep ? 'proposed' : 'confirmed', note });
        record.sequence = Math.max(record.sequence, latestSeq + 1);
        const created = await db.ClassificationDecision.create(record);

        if (twoStep) {
          confirmed.push({ id, decision_id: created.id, outcome: record.outcome, awaiting_sign_off: true });
          continue;
        }
        await finalise(db, user, account, { ...record, id: created.id }, now);
        confirmed.push({ id, decision_id: created.id, outcome: record.outcome });
      } catch (e) {
        console.error('studioConfirmDecision failed for', id, e);
        skipped.push({ id, reason: `Couldn't confirm: ${e?.message || e}` });
      }
    }
    return Response.json({ confirmed, skipped });
  } catch (error) {
    console.error('studioConfirmDecision error', error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});

// Supersede the previous confirmed decision, write back to the Account, and record history and audit entries.
async function finalise(db, user, account, decision, now) {
  if (decision.supersedes_id) {
    await db.ClassificationDecision.update(decision.supersedes_id, { status: 'superseded', superseded_by_id: decision.id });
  }
  const before = { reportability_status: account.reportability_status, reportability_reason: account.reportability_reason };
  const writeBack = accountWriteBack(decision);
  await db.Account.update(account.id, writeBack);
  await db.AccountClassificationHistory.create({
    tenant_id: account.tenant_id,
    account_id: account.id,
    classification_date: now.toISOString(),
    reportability_status: writeBack.reportability_status,
    classification_reason: writeBack.reportability_reason,
    classification_source: 'studio',
    entry_type: 'classification',
    reportable_jurisdictions: decision.reportable_jurisdictions || [],
    performed_by: decision.reviewer || user.email,
    account_holder_name: account.account_holder_name || [account.first_name, account.last_name].filter(Boolean).join(' '),
    account_number: account.account_number || '',
    ...(typeof account.year_end_cash_value === 'number' ? { account_balance: account.year_end_cash_value } : {}),
    studio_decision_id: decision.id,
  });
  await db.AuditLog.create({
    tenant_id: account.tenant_id,
    action_type: 'account_classified',
    actor_email: user.email,
    actor_role: user.app_role,
    target_entity_type: 'Account',
    target_entity_id: account.id,
    target_entity_name: account.account_holder_name || account.account_number || account.id,
    changes: { before, after: writeBack, studio_decision_id: decision.id, sequence: decision.sequence, decided_by: decision.decided_by, reviewer: decision.reviewer || null },
    timestamp: now.toISOString(),
  });
}
