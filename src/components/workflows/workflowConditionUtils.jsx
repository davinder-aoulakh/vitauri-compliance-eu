/**
 * Utility functions for evaluating workflow conditional logic
 * Extracted from AccountClassification for better testability and reusability
 */

/**
 * Evaluates a single condition in a workflow
 * @param {Object} condition - The condition to evaluate
 * @param {Function} getFieldValue - Function to retrieve field values (must already be bound with workflow context)
 * @param {Object} crsCountryMap - Map of country codes to CRS info
 * @returns {Promise<boolean>} Whether the condition is met
 */
export const evaluateSingleCondition = async (condition, getFieldValue, crsCountryMap, linkedEntity) => {
  let fieldValue = getFieldValue(condition.field);
  let comparisonValue = condition.value;
  
  console.log('\n🔍 [CONDITION EVAL] Starting evaluation...');
  console.log('  Field:', condition.field);
  console.log('  Operator:', condition.operator);
  console.log('  Comparison Value (raw):', condition.value);
  console.log('  Field Value (raw):', fieldValue);
  console.log('  Value Type:', condition.value_type);
  
  if (condition.value_type === 'field_reference') {
    // Try getFieldValue first (handles account fields, step answers, etc.)
    comparisonValue = getFieldValue(condition.value);
    // If not resolved and we have a linkedEntity, try resolving directly from entity
    // (handles display-name references like "Country of Incorporation" stored on Entity)
    if ((comparisonValue === null || comparisonValue === undefined) && linkedEntity) {
      const ENTITY_FIELD_MAP = {
        'country of incorporation': 'country_of_incorporation',
        'country_of_incorporation': 'country_of_incorporation',
        'entity name': 'entity_name',
        'entity type': 'entity_type',
        'rfi status': 'rfi_status',
        'fi type': 'fi_type',
      };
      const mappedKey = ENTITY_FIELD_MAP[condition.value?.toLowerCase?.()];
      if (mappedKey && linkedEntity[mappedKey] !== undefined) {
        comparisonValue = linkedEntity[mappedKey];
        console.log(`  Comparison Value (resolved from linkedEntity.${mappedKey}):`, comparisonValue);
      }
    }
    console.log('  Comparison Value (after field_reference lookup):', comparisonValue);
  }

  const isBooleanLike = (val) => {
    if (val === true || val === false) return true;
    if (typeof val === 'string') {
      const lower = val.toLowerCase();
      return lower === 'yes' || lower === 'no' || lower === 'true' || lower === 'false';
    }
    return false;
  };

  const normalizeBooleanLike = (val) => {
    if (val === true || (typeof val === 'string' && val.toLowerCase() === 'yes') || (typeof val === 'string' && val.toLowerCase() === 'true')) return 'true';
    if (val === false || (typeof val === 'string' && val.toLowerCase() === 'no') || (typeof val === 'string' && val.toLowerCase() === 'false')) return 'false';
    return val;
  };

  // Only normalize when BOTH sides are boolean-like (YES/NO/true/false as strings or booleans)
  // If the field value is a multi-choice option like OPT1, do NOT coerce either side
  const isYesNoComparison = isBooleanLike(fieldValue) && isBooleanLike(comparisonValue);

  if (isYesNoComparison) {
    fieldValue = normalizeBooleanLike(fieldValue);
    comparisonValue = normalizeBooleanLike(comparisonValue);
  } else {
    // Fallback: still normalize raw booleans and string 'true'/'false' so edge cases work
    fieldValue = normalizeBooleanLike(fieldValue);
    comparisonValue = normalizeBooleanLike(comparisonValue);
  }

  console.log('  Field Value (after normalize):', fieldValue);
  console.log('  Comparison Value (after normalize):', comparisonValue);

  let conditionMet = false;

  const normalizeCountryForComparison = async (val) => {
    if (!val) return '';
    const valStr = String(val).trim();
    
    try {
      // Use async database lookup to resolve country name or code to standardized code
      const { base44 } = await import("@/api/base44Client");
      const countries = await base44.entities.CrsCountryInfo.filter({
        $or: [
          { country_name: valStr },
          { country_code: valStr }
        ]
      });
      
      if (countries.length > 0) {
        const code = countries[0].country_code.toLowerCase();
        console.log(`    Country normalization: "${val}" → "${code}" (via DB lookup)`);
        return code;
      }
    } catch (error) {
      console.log(`    Country normalization error:`, error);
    }
    
    // Fallback to map-based lookup
    const valLower = valStr.toLowerCase();
    let countryInfo = crsCountryMap[valLower];
    
    if (!countryInfo) {
      countryInfo = Object.values(crsCountryMap).find(
        c => c.code?.toLowerCase() === valLower
      );
    }
    
    if (countryInfo?.code) {
      console.log(`    Country normalization: "${val}" → "${countryInfo.code.toLowerCase()}" (via map)`);
      return countryInfo.code.toLowerCase();
    }
    
    console.log(`    Country normalization: "${val}" → "${valLower}" (no match)`);
    return valLower;
  };

  // Check if we're comparing countries — covers both the left-hand field and the right-hand reference field
  const isCountryField = condition.field?.toLowerCase().includes('country') ||
    (condition.value_type === 'field_reference' && condition.value?.toLowerCase().includes('country'));

  switch (condition.operator) {
    case "=":
      if (isCountryField) {
        const [normalizedField, normalizedComparison] = await Promise.all([
          normalizeCountryForComparison(fieldValue),
          normalizeCountryForComparison(comparisonValue)
        ]);
        conditionMet = normalizedField === normalizedComparison;
        console.log(`  [= with country] "${fieldValue}" (${normalizedField}) === "${comparisonValue}" (${normalizedComparison}) = ${conditionMet}`);
      } else {
        conditionMet = String(fieldValue || '').toLowerCase() === String(comparisonValue || '').toLowerCase();
      }
      break;
    case "!=":
      if (isCountryField) {
        const [normalizedField, normalizedComparison] = await Promise.all([
          normalizeCountryForComparison(fieldValue),
          normalizeCountryForComparison(comparisonValue)
        ]);
        conditionMet = normalizedField !== normalizedComparison;
        console.log(`  [!= with country] "${fieldValue}" (${normalizedField}) !== "${comparisonValue}" (${normalizedComparison}) = ${conditionMet}`);
      } else {
        conditionMet = String(fieldValue || '').toLowerCase() !== String(comparisonValue || '').toLowerCase();
        // Note: normalizeBooleanLike was already applied above to both sides before the switch,
        // so 'NO'→'false' and 'false'→'false' are already normalized at this point.
      }
      break;
    case "in":
      const inValues = String(comparisonValue).split(",").map(v => v.trim().toLowerCase());
      conditionMet = inValues.includes(String(fieldValue || '').toLowerCase());
      break;
    case "not_in":
      const notInValues = String(comparisonValue).split(",").map(v => v.trim().toLowerCase());
      conditionMet = !notInValues.includes(String(fieldValue || '').toLowerCase());
      break;
    case "contains":
      conditionMet = String(fieldValue || '').toLowerCase().includes(String(comparisonValue || '').toLowerCase());
      break;
    case ">":
      conditionMet = parseFloat(fieldValue) > parseFloat(comparisonValue);
      break;
    case "<":
      conditionMet = parseFloat(fieldValue) < parseFloat(comparisonValue);
      break;
    case ">=":
      conditionMet = parseFloat(fieldValue) >= parseFloat(comparisonValue);
      break;
    case "<=":
      conditionMet = parseFloat(fieldValue) <= parseFloat(comparisonValue);
      break;
    case "is_crs":
      if (fieldValue && typeof fieldValue === 'string') {
        try {
          const countries = await (async () => {
            const { base44 } = await import("@/api/base44Client");
            return await base44.entities.CrsCountryInfo.filter({
              $or: [
                { country_name: fieldValue.trim() },
                { country_code: fieldValue.trim() }
              ]
            });
          })();
          conditionMet = countries.length > 0 && countries[0].is_crs_country === true;
          console.log(`  [is_crs] Country "${fieldValue}" → is_crs=${conditionMet}`);
        } catch (error) {
          console.log(`  [is_crs] Error checking CRS status, fallback to map`);
          const countryLookup = crsCountryMap[String(fieldValue || '').toLowerCase()];
          conditionMet = countryLookup?.isCrs === true;
        }
      } else {
        conditionMet = false;
      }
      break;
    case "is_not_crs":
      if (fieldValue && typeof fieldValue === 'string') {
        try {
          const countries = await (async () => {
            const { base44 } = await import("@/api/base44Client");
            return await base44.entities.CrsCountryInfo.filter({
              $or: [
                { country_name: fieldValue.trim() },
                { country_code: fieldValue.trim() }
              ]
            });
          })();
          conditionMet = countries.length === 0 || countries[0].is_crs_country === false;
          console.log(`  [is_not_crs] Country "${fieldValue}" → is_not_crs=${conditionMet}`);
        } catch (error) {
          console.log(`  [is_not_crs] Error checking CRS status, fallback to map`);
          const countryLookupNot = crsCountryMap[String(fieldValue || '').toLowerCase()];
          conditionMet = countryLookupNot?.isCrs === false;
        }
      } else {
        conditionMet = true;
      }
      break;
    default:
      conditionMet = false;
  }

  console.log('  ✅ Result:', conditionMet);
  console.log('🔍 [CONDITION EVAL] Complete\n');

  return conditionMet;
};

/**
 * Evaluates conditional logic with support for condition groups (first match wins)
 * @param {Object} logic - The conditional logic configuration
 * @param {Object} currentAnswers - Current workflow answers
 * @param {Function} evaluateSingleConditionFn - Function to evaluate individual conditions
 * @returns {Promise<string|boolean>} Next step ID or boolean result
 */
export const evaluateConditionalLogic = async (logic, currentAnswers, evaluateSingleConditionFn) => {
  if (logic?.condition_groups && logic.condition_groups.length > 0) {
    console.log('\n🔷🔷🔷 [CONDITION GROUPS] Starting evaluation (fall-through model)...');
    console.log('  Total Groups:', logic.condition_groups.length);

    for (let i = 0; i < logic.condition_groups.length; i++) {
      const group = logic.condition_groups[i];
      console.log(`\n📋 [GROUP ${i + 1}] "${group.group_name || group.group_id}"`);
      console.log('  Operator:', group.group_operator);
      console.log('  Conditions:', group.conditions?.length || 0);

      if (!group.conditions || group.conditions.length === 0) {
        console.log('  ⚠️ No conditions - skipping group');
        continue;
      }

      // Evaluate ALL conditions in this group to determine group result
      let groupResult = true;
      if (group.group_operator === 'AND') {
        for (let j = 0; j < group.conditions.length; j++) {
          const condition = group.conditions[j];
          console.log(`  [Condition ${j + 1}/${group.conditions.length}]`);
          const conditionMet = await evaluateSingleConditionFn(condition);
          groupResult = groupResult && conditionMet;
          console.log(`    AND logic: groupResult = ${groupResult}`);
          if (!groupResult) {
            console.log('    ❌ AND failed, breaking early');
            break;
          }
        }
      } else {
        // OR: group is true if ANY condition is true
        groupResult = false;
        for (let j = 0; j < group.conditions.length; j++) {
          const condition = group.conditions[j];
          console.log(`  [Condition ${j + 1}/${group.conditions.length}]`);
          const conditionMet = await evaluateSingleConditionFn(condition);
          if (conditionMet) {
            groupResult = true;
            console.log(`    OR logic: condition true → group result = true`);
            break;
          }
        }
      }

      console.log(`  🎯 Group ${i + 1} Final Result: ${groupResult}`);
      console.log(`  → True Step: ${group.true_step} | False Step: ${group.false_step}`);

      if (groupResult) {
        // Group is TRUE — route using this group's true_step or false_step
        const destination = group.true_step || group.false_step;
        if (destination) {
          console.log(`  ✅ Group ${i + 1} TRUE → routing to true_step: ${destination}`);
          console.log('🔷🔷🔷 [CONDITION GROUPS] Complete\n');
          return destination;
        }
        console.log(`  ↪️ Group ${i + 1} TRUE but no true_step set — falling through to next group`);
      } else {
        // Group is FALSE — fall through to next group regardless of false_step
        console.log(`  ↪️ Group ${i + 1} FALSE — falling through to next group`);
      }
    }

    // All groups fell through (all were FALSE) — use last group's false_step, then overall fallback
    const lastGroup = logic.condition_groups[logic.condition_groups.length - 1];
    const fallbackStep = lastGroup?.false_step || logic.overall_false_step || logic.else_step || null;
    if (fallbackStep) {
      console.log(`  ⬇️ All groups FALSE — fallback step: ${fallbackStep}`);
    } else {
      console.error(`  🚨 Condition groups: no destination resolved — all groups were FALSE with no false_step set`);
    }
    console.log('🔷🔷🔷 [CONDITION GROUPS] Complete\n');
    return fallbackStep;
  }

  // Simple conditions evaluation
  if (!logic?.conditions || logic.conditions.length === 0) {
    return logic.else_step || null;
  }

  let result = true;

  for (let idx = 0; idx < logic.conditions.length; idx++) {
    const condition = logic.conditions[idx];
    const conditionMet = await evaluateSingleConditionFn(condition);

    if (idx === 0) {
      result = conditionMet;
    } else {
      const prevLogicOp = logic.conditions[idx - 1]?.logic_operator || "AND";
      if (prevLogicOp === "AND") {
        result = result && conditionMet;
      } else if (prevLogicOp === "OR") {
        result = result || conditionMet;
      }
    }
  }

  const resultStep = result ? logic.next_step : logic.else_step;
  console.log(`\n🏁 [SIMPLE CONDITIONS] Result: ${result} → step: ${resultStep}`);
  return resultStep || null;
};