import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  BASELINE_RULES, resolvePack, validatePack, diffPacks, draftFingerprint, effectiveRulesForValidation, nextVersion, baselineRuleRows,
  runFixtures, EDITABLE_TEXT_FIELDS,
} from '../../shared/crs/index.js';

// CRS Rule Library (Classification Studio) — every write to CrsRulePack / CrsRule goes through here.
// Super admin only. Published and retired packs are never edited. Publishing needs green fixtures (re-run here)
// and a current impact report. Publishing changes no account or decision.
//
// Body: { action, ...params }
//   create_draft     { from_pack_id?, scope? }        new draft (global: full copy; override scope: empty, holds changed rules only)
//   save_rule        { pack_id, rule }                 add or update one rule in a draft (validated)
//   delete_rule      { pack_id, rule_key }             remove an extra question, or (override packs) revert a rule to the global pack
//   delete_draft     { pack_id }
//   update_draft     { pack_id, title?, change_note? }
//   run_tests        { pack_id }                       run the fixtures on the server and store the result
//   record_impact    { pack_id, report }               store the browser-computed impact report (must match the draft fingerprint)
//   publish          { pack_id, change_note }
//   rollback         { pack_id }                       copy an earlier version into a new draft marked as a rollback

const baseByKey = new Map(BASELINE_RULES.map((r) => [r.rule_key, r]));
const RULE_STORE_FIELDS = ['rule_key', 'procedure', 'order', 'tier', 'locked', 'enabled', 'params', 'question', 'help', 'options', 'condition', 'crs_ref', 'hb_ref', 'outcome_reason_template', 'ai_guidance', 'custom', 'hook'];

// bulkCreate when the SDK has it, otherwise one by one.
async function createMany(api, rows) {
  if (!rows.length) return;
  if (typeof api.bulkCreate === 'function') { for (let i = 0; i < rows.length; i += 100) await api.bulkCreate(rows.slice(i, i + 100)); return; }
  for (const r of rows) await api.create(r);
}

class Refused extends Error { constructor(message, status = 400, details = undefined) { super(message); this.status = status; this.details = details; } }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.app_role !== 'super_admin') return Response.json({ error: 'Only super admins can change the CRS Rule Library.' }, { status: 403 });
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const audit = (pack, action, changes) => db.AuditLog.create({
      action_type: 'settings_changed', actor_email: user.email, actor_role: user.app_role,
      target_entity_type: 'CrsRulePack', target_entity_id: pack.id, target_entity_name: `CRS Rule Library ${pack.jurisdiction_scope || 'global'} v${pack.version}`,
      changes: { action, ...changes }, timestamp: now,
    });

    const getPack = async (id) => {
      const p = (await db.CrsRulePack.filter({ id }))[0];
      if (!p) throw new Refused('Rule pack not found', 404);
      return p;
    };
    const rulesOf = (id) => db.CrsRule.filter({ pack_id: id }, 'order', 500);
    const draftOnly = (p) => { if (p.status !== 'draft') throw new Refused('Published and retired versions can\'t be changed. Create a new draft instead.', 409); };
    const publishedGlobal = async () => {
      const g = (await db.CrsRulePack.filter({ status: 'published' }, '-published_at', 50)).find((x) => !x.jurisdiction_scope || x.jurisdiction_scope === 'global') || null;
      return g ? { ...g, rules: await rulesOf(g.id) } : null;
    };
    const checkDraft = async (pack, rules) => {
      const global = (pack.jurisdiction_scope || 'global') === 'global' ? null : await publishedGlobal();
      const effective = effectiveRulesForValidation(pack, rules, global, resolvePack);
      const validation = validatePack(effective);
      const tests = (pack.jurisdiction_scope || 'global') === 'global'
        ? runFixtures({ version: pack.version, rules })
        : runFixtures(global, { version: pack.version, jurisdiction_scope: pack.jurisdiction_scope, rules });
      return { validation, tests, fingerprint: draftFingerprint(pack, rules, global), global };
    };

    const action = body.action;

    // ---- create_draft ----------------------------------------------------------------------------------------
    if (action === 'create_draft') {
      const scope = String(body.scope || 'global').toUpperCase() === 'GLOBAL' ? 'global' : String(body.scope).toUpperCase();
      if (scope !== 'global' && !/^[A-Z]{2}$/.test(scope)) throw new Refused('Scope must be "global" or a two-letter jurisdiction code.');
      const all = await db.CrsRulePack.filter({}, '-created_date', 500);
      const sameScope = all.filter((p) => (p.jurisdiction_scope || 'global') === scope);
      if (sameScope.some((p) => p.status === 'draft')) throw new Refused(`There is already a draft for ${scope}. Finish or delete it first.`, 409);
      let from = body.from_pack_id ? await getPack(body.from_pack_id) : sameScope.find((p) => p.status === 'published') || null;
      if (from && (from.jurisdiction_scope || 'global') !== scope) throw new Refused('A draft can only be based on a version with the same scope.');
      const latest = sameScope.map((p) => p.version).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop() || (scope === 'global' ? '1.0.0' : '0.0.0');
      const version = nextVersion(latest, sameScope.map((p) => p.version));
      const pack = await db.CrsRulePack.create({
        version, status: 'draft', jurisdiction_scope: scope, title: body.title || (scope === 'global' ? 'OECD CRS Handbook rules' : `${scope} overrides`),
        based_on_version: from?.version || '', created_by_email: user.email, change_note: '',
      });
      const source = from ? await rulesOf(from.id) : scope === 'global' ? baselineRuleRows() : [];
      const rows = source.map((r) => ({ ...Object.fromEntries(RULE_STORE_FIELDS.filter((f) => r[f] !== undefined && r[f] !== null).map((f) => [f, r[f]])), pack_id: pack.id }));
      await createMany(db.CrsRule, rows);
      const { fingerprint } = await checkDraft(pack, rows);
      await db.CrsRulePack.update(pack.id, { rules_fingerprint: fingerprint });
      await audit(pack, 'create_draft', { based_on: from?.version || null, rules: rows.length });
      return Response.json({ pack: { ...pack, rules_fingerprint: fingerprint } });
    }

    // ---- save_rule -------------------------------------------------------------------------------------------
    if (action === 'save_rule') {
      const pack = await getPack(body.pack_id); draftOnly(pack);
      const input = body.rule || {};
      const key = String(input.rule_key || '');
      const base = baseByKey.get(key);
      const rule = {};
      if (base) {
        // Handbook rule: structure comes from the baseline; only the editable parts are taken from the request.
        Object.assign(rule, { rule_key: key, procedure: base.procedure, tier: base.tier, order: base.order, locked: !!base.locked, custom: false });
        for (const f of EDITABLE_TEXT_FIELDS) if (input[f] !== undefined) rule[f] = String(input[f] ?? '');
        if (input.enabled !== undefined) {
          if (base.locked && input.enabled === false) throw new Refused("This is a core Handbook step and can't be switched off.", 422, [{ rule_key: key, field: 'enabled', message: "This is a core Handbook step and can't be switched off." }]);
          rule.enabled = input.enabled !== false;
        }
        if (input.params !== undefined) rule.params = input.params;
        if (input.options !== undefined) rule.options = (input.options || []).map((o) => ({ value: String(o.value ?? ''), label: String(o.label ?? '') }));
      } else {
        Object.assign(rule, { rule_key: key, procedure: 'custom', tier: 'logic', locked: false, custom: true,
          order: Number(input.order) || 100, enabled: input.enabled !== false, hook: input.hook, question: String(input.question || ''),
          help: String(input.help || ''), crs_ref: String(input.crs_ref || ''), hb_ref: String(input.hb_ref || ''), ai_guidance: String(input.ai_guidance || ''),
          condition: input.condition || null,
          options: (input.options || []).map((o) => ({ value: String(o.value ?? ''), label: String(o.label ?? ''), effect: o.effect, reason: String(o.reason || '') })) });
      }
      const rules = await rulesOf(pack.id);
      const existing = rules.find((r) => r.rule_key === key);
      const merged = existing ? { ...existing, ...rule } : rule;
      const candidate = [...rules.filter((r) => r.rule_key !== key), merged];
      const { validation, fingerprint } = await checkDraft(pack, candidate);
      const mine = validation.errors.filter((e) => e.rule_key === key);
      if (mine.length) throw new Refused(mine.map((e) => e.message).join(' '), 422, mine);
      let saved;
      if (existing) saved = await db.CrsRule.update(existing.id, rule);
      else saved = await db.CrsRule.create({ ...rule, pack_id: pack.id });
      await db.CrsRulePack.update(pack.id, { rules_fingerprint: fingerprint });
      await audit(pack, 'save_rule', { rule_key: key, diff: diffPacks(existing ? [existing] : [], [merged]) });
      return Response.json({ rule: saved, fingerprint, other_errors: validation.errors.filter((e) => e.rule_key !== key) });
    }

    // ---- delete_rule -----------------------------------------------------------------------------------------
    if (action === 'delete_rule') {
      const pack = await getPack(body.pack_id); draftOnly(pack);
      const rules = await rulesOf(pack.id);
      const row = rules.find((r) => r.rule_key === body.rule_key);
      if (!row) throw new Refused('Rule not found in this draft', 404);
      const isOverride = (pack.jurisdiction_scope || 'global') !== 'global';
      if (!row.custom && !isOverride) throw new Refused('Handbook rules can\'t be removed. Switch optional rules off instead.', 409);
      await db.CrsRule.delete(row.id);
      const rest = rules.filter((r) => r.id !== row.id);
      const { fingerprint } = await checkDraft(pack, rest);
      await db.CrsRulePack.update(pack.id, { rules_fingerprint: fingerprint });
      await audit(pack, 'delete_rule', { rule_key: row.rule_key });
      return Response.json({ ok: true, fingerprint });
    }

    // ---- update_draft / delete_draft -------------------------------------------------------------------------
    if (action === 'update_draft') {
      const pack = await getPack(body.pack_id); draftOnly(pack);
      const patch = {};
      if (typeof body.title === 'string') patch.title = body.title.slice(0, 200);
      if (typeof body.change_note === 'string') patch.change_note = body.change_note.slice(0, 4000);
      await db.CrsRulePack.update(pack.id, patch);
      return Response.json({ ok: true });
    }
    if (action === 'delete_draft') {
      const pack = await getPack(body.pack_id); draftOnly(pack);
      for (const r of await rulesOf(pack.id)) await db.CrsRule.delete(r.id);
      await db.CrsRulePack.delete(pack.id);
      await audit(pack, 'delete_draft', {});
      return Response.json({ ok: true });
    }

    // ---- run_tests -------------------------------------------------------------------------------------------
    if (action === 'run_tests') {
      const pack = await getPack(body.pack_id);
      const rules = await rulesOf(pack.id);
      const { validation, tests, fingerprint } = await checkDraft(pack, rules);
      const result = { fingerprint, run_at: now, run_by: user.email, passed: tests.passed && validation.ok, total: tests.total, failed: tests.failed,
        validation_errors: validation.errors, results: tests.results.map((r) => ({ id: r.id, title: r.title, ref: r.ref, passed: r.passed, problems: r.problems, outcome: r.outcome })) };
      if (pack.status === 'draft') await db.CrsRulePack.update(pack.id, { test_run_result: result, rules_fingerprint: fingerprint });
      return Response.json({ result });
    }

    // ---- record_impact ---------------------------------------------------------------------------------------
    if (action === 'record_impact') {
      const pack = await getPack(body.pack_id); draftOnly(pack);
      const report = body.report || {};
      const { fingerprint } = await checkDraft(pack, await rulesOf(pack.id));
      if (report.fingerprint !== fingerprint) throw new Refused('The draft changed while the impact report was running. Run it again.', 409);
      const stored = {
        fingerprint, run_at: now, run_by: user.email,
        tenants: (report.tenants || []).slice(0, 200), totals: report.totals || {}, changed: (report.changed || []).slice(0, 300),
      };
      await db.CrsRulePack.update(pack.id, { impact_report: stored });
      return Response.json({ report: stored });
    }

    // ---- publish ---------------------------------------------------------------------------------------------
    if (action === 'publish') {
      const pack = await getPack(body.pack_id); draftOnly(pack);
      const note = String(body.change_note || pack.change_note || '').trim();
      if (!note) throw new Refused('Add a change note that says what changed and why.');
      const rules = await rulesOf(pack.id);
      const { validation, tests, fingerprint } = await checkDraft(pack, rules);
      if (!validation.ok) throw new Refused('The draft has rule errors. Fix them before publishing.', 422, validation.errors);
      if (!tests.passed) throw new Refused(`${tests.failed} reference case(s) fail. A draft can only be published when every Handbook case passes.`, 422, tests.results.filter((r) => !r.passed));
      if (!pack.impact_report || pack.impact_report.fingerprint !== fingerprint) throw new Refused('Run the impact report on the current draft before publishing.', 409);
      const scope = pack.jurisdiction_scope || 'global';
      const current = (await db.CrsRulePack.filter({ status: 'published' }, '-published_at', 50)).filter((p) => (p.jurisdiction_scope || 'global') === scope);
      const before = current[0] ? await rulesOf(current[0].id) : (scope === 'global' ? baselineRuleRows() : []);
      for (const p of current) await db.CrsRulePack.update(p.id, { status: 'retired', retired_at: now });
      const testResult = { fingerprint, run_at: now, run_by: user.email, passed: true, total: tests.total, failed: 0, validation_errors: [], results: tests.results.map((r) => ({ id: r.id, title: r.title, passed: r.passed })) };
      await db.CrsRulePack.update(pack.id, { status: 'published', published_at: now, published_by: user.email, effective_from: now.slice(0, 10), change_note: note, rules_fingerprint: fingerprint, test_run_result: testResult });
      await audit(pack, 'publish', { scope, retired: current.map((p) => p.version), change_note: note, impact: pack.impact_report.totals || {}, diff: diffPacks(before, rules) });
      return Response.json({ ok: true, published: pack.version, retired: current.map((p) => p.version) });
    }

    // ---- rollback --------------------------------------------------------------------------------------------
    if (action === 'rollback') {
      const target = await getPack(body.pack_id);
      if (target.status === 'draft') throw new Refused('Choose a published or retired version to roll back to.');
      const scope = target.jurisdiction_scope || 'global';
      const all = await db.CrsRulePack.filter({}, '-created_date', 500);
      const sameScope = all.filter((p) => (p.jurisdiction_scope || 'global') === scope);
      if (sameScope.some((p) => p.status === 'draft')) throw new Refused(`There is already a draft for ${scope}. Finish or delete it first.`, 409);
      const current = sameScope.find((p) => p.status === 'published');
      if (current?.id === target.id) throw new Refused('This version is already the published one.', 409);
      const latest = sameScope.map((p) => p.version).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
      const version = nextVersion(latest, sameScope.map((p) => p.version));
      const pack = await db.CrsRulePack.create({
        version, status: 'draft', jurisdiction_scope: scope, title: `Rollback to ${target.version}`, rollback_of: target.version,
        based_on_version: current?.version || '', created_by_email: user.email, change_note: `Rollback to version ${target.version}.`,
      });
      const rows = (await rulesOf(target.id)).map((r) => ({ ...Object.fromEntries(RULE_STORE_FIELDS.filter((f) => r[f] !== undefined && r[f] !== null).map((f) => [f, r[f]])), pack_id: pack.id }));
      await createMany(db.CrsRule, rows);
      const { fingerprint } = await checkDraft(pack, rows);
      await db.CrsRulePack.update(pack.id, { rules_fingerprint: fingerprint });
      await audit(pack, 'rollback_draft', { rollback_of: target.version });
      return Response.json({ pack: { ...pack, rules_fingerprint: fingerprint } });
    }

    return Response.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (error) {
    if (error instanceof Refused) return Response.json({ error: error.message, details: error.details }, { status: error.status });
    console.error('studioRulePack error', error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
