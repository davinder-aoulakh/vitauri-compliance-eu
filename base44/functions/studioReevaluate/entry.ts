import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  evaluate, inputHash, materialSnapshot, buildDecision, loadStudioInput, resolvePack, getRule,
  reevaluationOutcome, changeCaseDueDate, changeCaseFields, isSystemProposal,
} from '../../shared/crs/index.js';

// Classification Studio: automatic re-check of confirmed accounts (change in circumstances, Handbook ¶165, ¶202, ¶220, ¶267).
// Never writes to Account: a different result goes to the studio's Changed queue and waits for an admin or supervisor.
//
// Called by:
//  - entity-event workflows (Account, ControllingPerson, StudioEvidence): { event: { entity_name, type }, data, old_data? }
//  - directly:            { accountId }
//  - the nightly workflow: { action: "scan" }
//  - the studio UI:       { action: "trust_distribution", accountId, beneficiary, date, amount }

const TENANT_ROLES = ['tenant_admin', 'tenant_supervisor', 'tenant_user'];
const SYSTEM = { email: 'system' };

class Refused extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const platform = user.role === 'admin' || user.app_role === 'super_admin';
    const mayAct = (tenantId) => platform || (TENANT_ROLES.includes(user.app_role) && user.tenant_id === tenantId);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const now = new Date();

    const flags = {};
    const studioOn = async (tenantId) => {
      if (!(tenantId in flags)) flags[tenantId] = ((await db.Tenant.filter({ id: tenantId }))[0]?.enabled_features?.classification_studio) === true;
      return flags[tenantId];
    };
    const sharedByTenant = {};
    const getAccount = async (id) => (id ? (await db.Account.filter({ id }))[0] || null : null);

    // ---- Re-check one account ---------------------------------------------------------------------------
    const recheck = async (account, { forced = false, trigger: forcedTrigger } = {}) => {
      if (!(await studioOn(account.tenant_id))) return { id: account.id, result: 'skipped', reason: 'studio off' };
      const decisions = (await db.ClassificationDecision.filter({ target_id: account.id, target_type: 'account' }, '-sequence', 200)).filter((d) => d.tenant_id === account.tenant_id);
      const confirmed = decisions.find((d) => d.status === 'confirmed');
      if (!confirmed) return { id: account.id, result: 'skipped', reason: 'not confirmed in the studio' };

      const loaded = await loadStudioInput(db, account, sharedByTenant[account.tenant_id] || {});
      sharedByTenant[account.tenant_id] = loaded.shared;
      const input = { ...loaded.input, asOf: now.toISOString() };
      const answers = input.evidence?.draft_gap_answers || {};
      const result = evaluate(input, answers);
      const hash = await inputHash(input);
      const snapshot = materialSnapshot(input);

      const task = (await db.StudioTask.filter({ account_id: account.id }))[0] || null;
      const lastHash = task?.input_hash || confirmed.input_hash;
      const yearRolled = task?.last_evaluated_at && new Date(task.last_evaluated_at).getUTCFullYear() < now.getUTCFullYear();
      const pack = resolvePack(input.pack, input.overridePack);
      const thresholds = {
        high_value_threshold_usd: getRule(pack, 'GEN.BALANCE')?.params?.high_value_threshold_usd,
        entity_threshold_usd: getRule(pack, 'ENT_PRE.THRESHOLD_250K')?.params?.threshold_usd,
      };
      const out = reevaluationOutcome({ confirmed, result, snapshot, hash, lastHash, forced: forced || !!yearRolled, thresholds: Object.fromEntries(Object.entries(thresholds).filter(([, v]) => v)) });
      const trigger = forcedTrigger || out.trigger;

      const saveTask = (queue) => {
        const row = { tenant_id: account.tenant_id, account_id: account.id, input_hash: hash, last_evaluated_at: now.toISOString(), queue,
          proposed_outcome: result.outcome.status, proposed_jurisdictions: result.outcome.jurisdictions || [], open_gaps: (result.gaps || []).length, rule_pack_version: result.rule_pack_version };
        return task ? db.StudioTask.update(task.id, row) : db.StudioTask.create(row);
      };

      if (out.kind === 'none') {
        if (!task) await saveTask('classified');
        return { id: account.id, result: 'unchanged' };
      }

      const latestSeq = decisions.reduce((m, d) => Math.max(m, d.sequence || 0), 0);
      const openCases = (await db.ChangeCase.filter({ account_id: account.id }, '-detected_at', 50)).filter((c) => c.tenant_id === account.tenant_id && (c.status === 'open' || c.status === 'overdue'));
      const systemProposals = decisions.filter(isSystemProposal);

      if (out.kind === 'no_change') {
        const rec = buildDecision({ input, result, answers, aiSuggestions: input.evidence?.draft_ai_suggestions || [], previous: confirmed, user: SYSTEM, hash, now, status: 'checked_no_change', trigger });
        delete rec.supersedes_id;
        rec.sequence = latestSeq + 1;
        rec.changed_fields = changeCaseFields(out.changes);
        const created = await db.ClassificationDecision.create(rec);
        // The data now gives the confirmed result again: close what was open.
        for (const p of systemProposals) await db.ClassificationDecision.update(p.id, { status: 'rejected', superseded_by_id: created.id });
        for (const c of openCases) await db.ChangeCase.update(c.id, { status: 'resolved', resolution: 'The data gives the confirmed result again; nothing to do.', resolved_at: now.toISOString(), resolved_by: 'system' });
        await saveTask('classified');
        return { id: account.id, result: 'checked_no_change', decision_id: created.id, trigger };
      }

      // Changed: a different outcome or new open questions.
      let proposalId = null;
      if (out.final) {
        const rec = buildDecision({ input, result, answers, aiSuggestions: input.evidence?.draft_ai_suggestions || [], previous: confirmed, user: SYSTEM, hash, now, status: 'proposed', trigger });
        delete rec.supersedes_id;
        rec.sequence = latestSeq + 1;
        rec.changed_fields = changeCaseFields(out.changes);
        const created = await db.ClassificationDecision.create(rec);
        proposalId = created.id;
      }
      for (const p of systemProposals) await db.ClassificationDecision.update(p.id, { status: 'rejected', ...(proposalId ? { superseded_by_id: proposalId } : {}) });
      const caseFields = { trigger, changed_fields: changeCaseFields(out.changes), proposed_decision_id: proposalId || '' };
      let caseId;
      if (openCases.length) { await db.ChangeCase.update(openCases[0].id, caseFields); caseId = openCases[0].id; }
      else {
        const created = await db.ChangeCase.create({ tenant_id: account.tenant_id, account_id: account.id, ...caseFields, detected_at: now.toISOString(), due_date: changeCaseDueDate(now.toISOString()), status: 'open' });
        caseId = created.id;
      }
      await saveTask('changed');
      return { id: account.id, result: 'changed', change_case_id: caseId, proposal_id: proposalId, trigger, open_questions: (result.gaps || []).map((g) => g.key) };
    };

    // ---- Nightly scan ------------------------------------------------------------------------------------
    if (body.action === 'scan') {
      if (!platform) throw new Refused('Only the platform can run the nightly scan.', 403);
      const tenants = (await db.Tenant.filter({}, 'name', 1000)).filter((t) => t.enabled_features?.classification_studio === true);
      const summary = { tenants: tenants.length, accounts: 0, unchanged: 0, checked_no_change: 0, changed: 0, skipped: 0, errors: 0, overdue_marked: 0 };
      const today = now.toISOString().slice(0, 10);
      for (const t of tenants) {
        flags[t.id] = true;
        const confirmed = await db.ClassificationDecision.filter({ tenant_id: t.id, status: 'confirmed' }, '-decided_at', 5000);
        for (const accountId of [...new Set(confirmed.filter((d) => d.target_type === 'account').map((d) => d.target_id))]) {
          summary.accounts++;
          try {
            const account = await getAccount(accountId);
            if (!account) { summary.skipped++; continue; }
            const r = await recheck(account);
            summary[r.result === 'unchanged' ? 'unchanged' : r.result === 'skipped' ? 'skipped' : r.result] = (summary[r.result === 'unchanged' ? 'unchanged' : r.result === 'skipped' ? 'skipped' : r.result] || 0) + 1;
          } catch (e) { summary.errors++; console.error('scan failed for', accountId, e); }
        }
        const open = await db.ChangeCase.filter({ tenant_id: t.id, status: 'open' }, 'due_date', 5000);
        for (const c of open) if (c.due_date && c.due_date < today) { await db.ChangeCase.update(c.id, { status: 'overdue' }); summary.overdue_marked++; }
      }
      return Response.json({ summary });
    }

    // ---- Trust distribution ------------------------------------------------------------------------------
    if (body.action === 'trust_distribution') {
      const account = await getAccount(body.accountId);
      if (!account) throw new Refused('Account not found', 404);
      if (!mayAct(account.tenant_id)) throw new Refused('Forbidden', 403);
      if (!(await studioOn(account.tenant_id))) throw new Refused('The Classification Studio is not switched on.', 403);
      const beneficiary = String(body.beneficiary || '').trim().slice(0, 200);
      const date = String(body.date || '').slice(0, 10);
      if (!beneficiary || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Refused('Give the beneficiary and the date of the distribution.');
      const amount = body.amount === '' || body.amount === undefined || body.amount === null ? null : Number(body.amount);
      const evidence = (await db.StudioEvidence.filter({ account_id: account.id }))[0];
      const entry = { beneficiary, date, ...(Number.isFinite(amount) ? { amount } : {}), recorded_by: user.email, recorded_at: now.toISOString() };
      if (evidence) await db.StudioEvidence.update(evidence.id, { trust_distributions: [...(evidence.trust_distributions || []), entry] });
      else await db.StudioEvidence.create({ tenant_id: account.tenant_id, account_id: account.id, trust_distributions: [entry] });
      const r = await recheck(account, { forced: true, trigger: 'trust_distribution' });
      // A distribution to a member of a beneficiary class is a change in circumstances in its own right (¶267).
      if (r.result !== 'changed') {
        const openCases = (await db.ChangeCase.filter({ account_id: account.id }, '-detected_at', 50)).filter((c) => c.status === 'open' || c.status === 'overdue');
        if (!openCases.length) {
          await db.ChangeCase.create({ tenant_id: account.tenant_id, account_id: account.id, trigger: 'trust_distribution', status: 'open', detected_at: now.toISOString(), due_date: changeCaseDueDate(now.toISOString()),
            changed_fields: [{ field: 'Trust distribution', before: '—', after: `${beneficiary} · ${date}${Number.isFinite(amount) ? ` · ${amount}` : ''}` }], proposed_decision_id: '' });
        }
      }
      await db.AuditLog.create({ tenant_id: account.tenant_id, action_type: 'account_updated', actor_email: user.email, actor_role: user.app_role, target_entity_type: 'Account',
        target_entity_id: account.id, target_entity_name: account.account_holder_name || account.account_number || account.id, changes: { action: 'trust_distribution_recorded', ...entry }, timestamp: now.toISOString() });
      return Response.json({ ok: true, recheck: r });
    }

    // ---- Event or direct call ----------------------------------------------------------------------------
    const entityName = body.event?.entity_name;
    const data = body.data || {};
    const accountId = body.accountId || (entityName === 'Account' ? data.id || body.event?.entity_id : data.account_id) || body.old_data?.account_id;
    if (!accountId) return Response.json({ result: 'ignored', reason: 'no account in the event' });
    const account = await getAccount(accountId);
    if (!account) return Response.json({ result: 'ignored', reason: 'account not found' });
    if (!mayAct(account.tenant_id)) throw new Refused('Forbidden', 403);
    const r = await recheck(account);
    return Response.json(r);
  } catch (error) {
    if (error instanceof Refused) return Response.json({ error: error.message }, { status: error.status });
    console.error('studioReevaluate error', error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
