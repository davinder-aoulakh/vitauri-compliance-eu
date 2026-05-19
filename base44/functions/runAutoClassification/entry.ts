import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (user?.app_role !== 'super_admin') {
    return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
  }

  const { tenantId, entityId, ruleId } = await req.json();

  if (!tenantId || !entityId) {
    return Response.json({ error: 'tenantId and entityId are required' }, { status: 400 });
  }

  // Load rules: either a specific rule or all active rules sorted by priority
  let rules;
  if (ruleId) {
    const allRules = await base44.asServiceRole.entities.AutoClassificationRule.filter({ entity_type: 'Account' });
    const specific = allRules.find(r => r.id === ruleId);
    if (!specific) return Response.json({ error: 'Rule not found' }, { status: 404 });
    rules = [specific];
  } else {
    const allRules = await base44.asServiceRole.entities.AutoClassificationRule.filter({ entity_type: 'Account' });
    rules = allRules
      .filter(r => r.is_active !== false)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

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

  // Pre-load the entity so entity.* fields (e.g. entity.fi_type) can be resolved
  let entityRecord = null;
  try {
    const entityRecords = await base44.asServiceRole.entities.Entity.filter({ id: entityId });
    entityRecord = entityRecords[0] || null;
  } catch (_e) { /* ignore */ }

  for (const account of accounts) {
    // Attach entity data so conditions like entity.fi_type resolve correctly
    const accountWithEntity = { ...account, entity: entityRecord || {} };

    let matchedRule = null;

    if (ruleId) {
      matchedRule = evaluateRule(rules[0], accountWithEntity) ? rules[0] : null;
    } else {
      matchedRule = rules.find(rule => evaluateRule(rule, accountWithEntity));
    }

    if (matchedRule) {
      // Update account reportability
      await base44.asServiceRole.entities.Account.update(account.id, {
        reportability_status: matchedRule.classification_result,
        reportability_reason: matchedRule.classification_reason,
        ...(matchedRule.entity_classification_result && account.account_holder_type === 'entity'
          ? { entity_classification: matchedRule.entity_classification_result }
          : {}),
      });

      // Build workflow simulation data if rule has a linked workflow
      let workflowAnswers = {};
      let workflowPathTaken = [];
      let workflowId = null;

      if (matchedRule.linked_workflow_id && matchedRule.workflow_field_mappings?.length > 0) {
        workflowId = matchedRule.linked_workflow_id;

        // Resolve answers from account fields using the mapping
        for (const mapping of matchedRule.workflow_field_mappings) {
          if (mapping.step_id && mapping.account_field) {
            const value = resolveAccountField(account, mapping.account_field);
            if (value !== undefined && value !== null) {
              workflowAnswers[mapping.step_id] = value;
              workflowPathTaken.push(mapping.step_id);
            }
          }
        }
      }

      // Create classification history record
      await base44.asServiceRole.entities.AccountClassificationHistory.create({
        tenant_id: tenantId,
        account_id: account.id,
        classification_date: new Date().toISOString(),
        reportability_status: matchedRule.classification_result,
        classification_reason: matchedRule.classification_reason,
        classification_source: 'auto_classification',
        rule_id: matchedRule.id,
        rule_name: matchedRule.rule_name,
        workflow_id: workflowId,
        workflow_answers: workflowAnswers,
        workflow_path_taken: workflowPathTaken,
        performed_by: user.email,
        account_holder_name: account.account_holder_name || `${account.first_name || ''} ${account.last_name || ''}`.trim(),
        account_number: account.account_number,
        account_balance: account.year_end_cash_value,
      });

      updated++;
      results.push({
        account_id: account.id,
        account_number: account.account_number,
        rule: matchedRule.rule_name,
        result: matchedRule.classification_result,
        history_created: true,
      });
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

function resolveAccountField(account, fieldPath) {
  // Support dot notation for nested fields e.g. "current_address.country"
  const parts = fieldPath.split('.');
  let val = account;
  for (const part of parts) {
    if (val == null) return null;
    val = val[part];
  }
  return val;
}

function evaluateRule(rule, account) {
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

  // Resolve dot-notation paths (e.g. "current_address.country")
  // Bug: previously returned null for ALL dot-notation fields — silent failure.
  const fieldValue = field.includes('.')
    ? field.split('.').reduce((obj, key) => (obj != null ? obj[key] : undefined), account)
    : account[field];
  const strVal = fieldValue !== null && fieldValue !== undefined ? String(fieldValue) : null;

  switch (operator) {
    case 'is_empty': return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'is_not_empty': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'equals':     return strVal?.toLowerCase() === String(value).toLowerCase();
    case 'not_equals': return strVal?.toLowerCase() !== String(value).toLowerCase();
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