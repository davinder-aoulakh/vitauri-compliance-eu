import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (user?.app_role !== 'super_admin') {
    return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
  }

  const { tenantId, entityId } = await req.json();

  if (!tenantId || !entityId) {
    return Response.json({ error: 'tenantId and entityId are required' }, { status: 400 });
  }

  // Load active rules sorted by priority descending
  const allRules = await base44.asServiceRole.entities.AutoClassificationRule.filter({ entity_type: 'Account' });
  const rules = allRules
    .filter(r => r.is_active !== false)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  if (rules.length === 0) {
    return Response.json({ message: 'No active rules found', processed: 0, updated: 0 });
  }

  // Load accounts for the selected tenant + entity
  const accounts = await base44.asServiceRole.entities.Account.filter({
    tenant_id: tenantId,
    entity_id: entityId,
  });

  let updated = 0;
  let skipped = 0;
  const results = [];

  for (const account of accounts) {
    const matchedRule = rules.find(rule => evaluateRule(rule, account));

    if (matchedRule) {
      await base44.asServiceRole.entities.Account.update(account.id, {
        reportability_status: matchedRule.classification_result,
        reportability_reason: matchedRule.classification_reason,
        ...(matchedRule.entity_classification_result && account.account_holder_type === 'entity'
          ? { entity_classification: matchedRule.entity_classification_result }
          : {}),
      });
      updated++;
      results.push({ account_id: account.id, account_number: account.account_number, rule: matchedRule.rule_name, result: matchedRule.classification_result });
    } else {
      skipped++;
    }
  }

  return Response.json({
    message: `Completed. ${updated} accounts updated, ${skipped} skipped (no matching rule).`,
    processed: accounts.length,
    updated,
    skipped,
    results,
  });
});

function evaluateRule(rule, account) {
  // Support both grouped and legacy flat conditions
  if (rule.condition_group && (rule.condition_group.conditions?.length > 0 || rule.condition_group.subGroups?.length > 0)) {
    return evaluateGroup(rule.condition_group, account);
  }
  if (rule.conditions?.length > 0) {
    return evaluateFlatConditions(rule.conditions, account);
  }
  return false;
}

function evaluateGroup(group, account) {
  const op = group.logic_operator || 'AND';
  const results = [];

  for (const condition of (group.conditions || [])) {
    results.push(evaluateCondition(condition, account));
  }
  for (const subGroup of (group.subGroups || [])) {
    results.push(evaluateGroup(subGroup, account));
  }

  if (results.length === 0) return false;
  return op === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

function evaluateFlatConditions(conditions, account) {
  let result = evaluateCondition(conditions[0], account);
  for (let i = 1; i < conditions.length; i++) {
    const condResult = evaluateCondition(conditions[i], account);
    const logicOp = conditions[i - 1].logic_operator || 'AND';
    result = logicOp === 'AND' ? result && condResult : result || condResult;
  }
  return result;
}

function evaluateCondition(condition, account) {
  const { field, operator, value } = condition;
  if (!field || !operator) return false;

  // Support related entity fields like "entity.rfi_status" — skip for now as we don't have entity joined
  const fieldValue = field.includes('.') ? null : account[field];

  const strVal = fieldValue !== null && fieldValue !== undefined ? String(fieldValue) : null;

  switch (operator) {
    case 'is_empty': return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'is_not_empty': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'equals': return strVal === String(value);
    case 'not_equals': return strVal !== String(value);
    case 'contains': return strVal?.toLowerCase().includes(String(value).toLowerCase()) ?? false;
    case 'greater_than': return parseFloat(fieldValue) > parseFloat(value);
    case 'less_than': return parseFloat(fieldValue) < parseFloat(value);
    case 'greater_than_or_equal': return parseFloat(fieldValue) >= parseFloat(value);
    case 'less_than_or_equal': return parseFloat(fieldValue) <= parseFloat(value);
    case 'in': return String(value).split(',').map(v => v.trim()).includes(strVal);
    case 'not_in': return !String(value).split(',').map(v => v.trim()).includes(strVal);
    case 'days_ago_greater_than': {
      if (!fieldValue) return false;
      const diff = (Date.now() - new Date(fieldValue).getTime()) / (1000 * 60 * 60 * 24);
      return diff > parseFloat(value);
    }
    case 'days_ago_less_than': {
      if (!fieldValue) return false;
      const diff = (Date.now() - new Date(fieldValue).getTime()) / (1000 * 60 * 60 * 24);
      return diff < parseFloat(value);
    }
    case 'months_ago_greater_than': {
      if (!fieldValue) return false;
      const diff = (Date.now() - new Date(fieldValue).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      return diff > parseFloat(value);
    }
    case 'months_ago_less_than': {
      if (!fieldValue) return false;
      const diff = (Date.now() - new Date(fieldValue).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      return diff < parseFloat(value);
    }
    case 'years_ago_greater_than': {
      if (!fieldValue) return false;
      const diff = (Date.now() - new Date(fieldValue).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return diff > parseFloat(value);
    }
    case 'years_ago_less_than': {
      if (!fieldValue) return false;
      const diff = (Date.now() - new Date(fieldValue).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return diff < parseFloat(value);
    }
    default: return false;
  }
}