import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { evaluate, loadStudioInput } from '../../shared/crs/index.js';

// Classification Studio: AI suggestions for the OPEN questions only.
// Nothing is written here and nothing is applied automatically: the person accepts or dismisses each suggestion.
// Body: { accountId: string, answers?: {[gapKey]: value} }  (answers = unsaved answers from the screen)

const ROLES = ['tenant_admin', 'tenant_supervisor', 'tenant_user'];

// Account fields the model may look at (CRS-relevant; no free-form documents).
const ACCOUNT_FIELDS = [
  'account_number', 'account_type', 'account_holder_type', 'account_holder_name', 'first_name', 'last_name', 'account_holder_entity_type',
  'account_creation_date', 'is_pre_existing', 'status', 'non_reportable_exception_type', 'country_of_residence', 'country_of_incorporation',
  'country_of_incorporation_code', 'tax_residencies', 'multiple_residencies', 'current_address', 'account_holder_address', 'current_phone',
  'date_of_birth', 'self_certification_obtained', 'self_certification_date', 'year_end_cash_value', 'year_end_cash_value_currency',
  'entity_classification', 'crs_entity_classification', 'type_of_financial_institution', 'gross_income_from_financial_assets',
  'entity_managed_by_asset_manager', 'notes', 'reportability_reason', 'account_holder_is_alive', 'account_holder_deceased_during_period',
  'death_certificate_received', 'will_or_inheritance_received', 'legacy_of_deceased_settled',
];
const CP_FIELDS = ['full_name', 'control_type', 'ownership_percentage', 'tax_residencies', 'country_of_residence', 'country_of_residence_code', 'self_certification_obtained'];
const EVIDENCE_FIELDS = ['crs_indicia', 'hold_mail_only', 'documentary_evidence', 'rm_attestations', 'self_cert_detail', 'entity_status', 'trust_parties', 'joint_holders'];

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined && o[k] !== null && o[k] !== '').map((k) => [k, o[k]]));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES.includes(user.app_role) || !user.tenant_id) return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });

    const { accountId, answers: screenAnswers } = await req.json().catch(() => ({}));
    if (!accountId) return Response.json({ error: 'accountId is required' }, { status: 400 });
    const db = base44.asServiceRole.entities;
    const account = (await db.Account.filter({ id: accountId }))[0];
    if (!account || account.tenant_id !== user.tenant_id) return Response.json({ error: 'Account not found' }, { status: 404 });
    const tenant = (await db.Tenant.filter({ id: user.tenant_id }))[0];
    if (tenant?.enabled_features?.classification_studio !== true) return Response.json({ error: 'The Classification Studio is not switched on.' }, { status: 403 });

    const { input } = await loadStudioInput(db, account);
    if (input.settings?.ai_suggestions_enabled === false) return Response.json({ error: 'AI suggestions are switched off in the studio settings.' }, { status: 403 });

    const answers = { ...(input.evidence?.draft_gap_answers || {}), ...(screenAnswers && typeof screenAnswers === 'object' ? screenAnswers : {}) };
    const result = evaluate(input, answers);
    const gaps = result.gaps || [];
    if (!gaps.length) return Response.json({ suggestions: [] });

    const facts = {
      reporting_jurisdiction: result.reporting_jurisdiction,
      account: pick(account, ACCOUNT_FIELDS),
      controlling_persons: (input.controllingPersons || []).map((c) => pick(c, CP_FIELDS)),
      beneficiaries: (input.beneficiaries || []).map((b) => pick(b, ['full_name', 'first_name', 'last_name', 'tax_residencies', 'country_of_residence', 'address', 'reportability_status'])),
      studio_evidence: pick(input.evidence, EVIDENCE_FIELDS),
      steps_already_decided: result.steps.filter((s) => !s.gap).map((s) => ({ question: s.question, answer: s.answer, evidence: s.evidence })),
    };
    const questions = gaps.map((g, i) => ({ id: `q${i}`, gap_key: g.key, question: g.question, help: g.help, options: g.options, crs_ref: g.crs_ref, hb_ref: g.hb_ref, guidance: g.ai_guidance }));

    const prompt = `You assist a compliance officer classifying a financial account under the OECD Common Reporting Standard (CRS) and its Implementation Handbook.
Only answer the open questions below. Use ONLY the facts provided. If the facts do not clearly support an option, answer "unknown".
Never invent documents, self-certifications, relationship-manager statements or dates. Be conservative: a wrong "yes" can hide a reportable account.
For each question give: the option value, a confidence between 0 and 1, a short rationale (max 2 sentences) that cites the facts, and the names of the fields you used.

FACTS (JSON):
${JSON.stringify(facts, null, 1)}

OPEN QUESTIONS (JSON):
${JSON.stringify(questions, null, 1)}`;

    const properties = {};
    for (const q of questions) {
      properties[q.id] = {
        type: 'object',
        properties: {
          answer: { type: 'string', enum: [...q.options.map((o) => o.value), 'unknown'] },
          confidence: { type: 'number' },
          rationale: { type: 'string' },
          fields_used: { type: 'array', items: { type: 'string' } },
        },
        required: ['answer', 'confidence', 'rationale', 'fields_used'],
        additionalProperties: false,
      };
    }
    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: { type: 'object', properties, required: questions.map((q) => q.id), additionalProperties: false },
    });
    if (!llm) return Response.json({ error: 'The AI service did not return a suggestion.' }, { status: 502 });

    const now = new Date().toISOString();
    const suggestions = questions.map((q) => {
      const r = llm[q.id] || {};
      const valid = q.options.some((o) => o.value === r.answer);
      return {
        gap_key: q.gap_key,
        answer: valid ? r.answer : 'unknown',
        answer_label: valid ? q.options.find((o) => o.value === r.answer).label : 'Not enough information',
        confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)),
        rationale: String(r.rationale || '').slice(0, 600),
        fields_used: Array.isArray(r.fields_used) ? r.fields_used.slice(0, 20).map(String) : [],
        suggested_at: now,
        accepted: false,
      };
    });
    return Response.json({ suggestions });
  } catch (error) {
    console.error('studioSuggestGaps error', error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
