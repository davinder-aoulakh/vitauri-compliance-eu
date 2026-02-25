/**
 * Utility functions for evaluating workflow conditional logic
 * Extracted from AccountClassification for better testability and reusability
 */

/**
 * Evaluates a single condition in a workflow
 * @param {Object} condition - The condition to evaluate
 * @param {Function} getFieldValue - Function to retrieve field values
 * @param {Object} crsCountryMap - Map of country codes to CRS info
 * @returns {boolean} Whether the condition is met
 */
export const evaluateSingleCondition = (condition, getFieldValue, crsCountryMap) => {
  let fieldValue = getFieldValue(condition.field);
  let comparisonValue = condition.value;
  
  console.log('\n🔍 [CONDITION EVAL] Starting evaluation...');
  console.log('  Field:', condition.field);
  console.log('  Operator:', condition.operator);
  console.log('  Comparison Value (raw):', condition.value);
  console.log('  Field Value (raw):', fieldValue);
  console.log('  Value Type:', condition.value_type);
  
  if (condition.value_type === 'field_reference') {
    comparisonValue = getFieldValue(condition.value);
    console.log('  Comparison Value (after field_reference lookup):', comparisonValue);
  }

  const normalizeBoolean = (val) => {
    if (val === 'YES') return 'true';
    if (val === 'NO') return 'false';
    if (val === true) return 'true';
    if (val === false) return 'false';
    return val;
  };

  fieldValue = normalizeBoolean(fieldValue);
  comparisonValue = normalizeBoolean(comparisonValue);

  console.log('  Field Value (after normalize):', fieldValue);
  console.log('  Comparison Value (after normalize):', comparisonValue);

  let conditionMet = false;

  const normalizeCountryForComparison = (val) => {
    if (!val) return '';
    const valLower = String(val).toLowerCase();
    
    // First, try to find by country name
    let countryInfo = crsCountryMap[valLower];
    
    // If not found, try to find by country code
    if (!countryInfo) {
      countryInfo = Object.values(crsCountryMap).find(
        c => c.code?.toLowerCase() === valLower
      );
    }
    
    // Return normalized code if found, otherwise return original
    if (countryInfo?.code) {
      console.log(`    Country normalization: "${val}" → "${countryInfo.code.toLowerCase()}"`);
      return countryInfo.code.toLowerCase();
    }
    
    console.log(`    Country normalization: "${val}" → "${valLower}" (no match in CRS map)`);
    return valLower;
  };

  const isCountryComparison = (
    condition.field?.toLowerCase().includes('country') ||
    condition.value?.toLowerCase().includes('country')
  );

  switch (condition.operator) {
    case "=":
      if (isCountryComparison) {
        conditionMet = normalizeCountryForComparison(fieldValue) === normalizeCountryForComparison(comparisonValue);
      } else {
        conditionMet = String(fieldValue || '').toLowerCase() === String(comparisonValue || '').toLowerCase();
      }
      break;
    case "!=":
      if (isCountryComparison) {
        conditionMet = normalizeCountryForComparison(fieldValue) !== normalizeCountryForComparison(comparisonValue);
      } else {
        conditionMet = String(fieldValue || '').toLowerCase() !== String(comparisonValue || '').toLowerCase();
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
      const countryLookup = crsCountryMap[String(fieldValue || '').toLowerCase()];
      conditionMet = countryLookup?.isCrs === true;
      break;
    case "is_not_crs":
      const countryLookupNot = crsCountryMap[String(fieldValue || '').toLowerCase()];
      conditionMet = countryLookupNot?.isCrs === false;
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
 * @returns {string|boolean} Next step ID or boolean result
 */
export const evaluateConditionalLogic = (logic, currentAnswers, evaluateSingleConditionFn) => {
  if (logic?.condition_groups && logic.condition_groups.length > 0) {
    console.log('\n🔷🔷🔷 [CONDITION GROUPS] Starting evaluation...');
    console.log('  Total Groups:', logic.condition_groups.length);
    console.log('  Current Answers:', currentAnswers);
    
    const groupResults = [];

    for (let i = 0; i < logic.condition_groups.length; i++) {
      const group = logic.condition_groups[i];
      console.log(`\n📋 [GROUP ${i + 1}] "${group.group_name || group.group_id}"`);
      console.log('  Operator:', group.group_operator);
      console.log('  Conditions:', group.conditions?.length || 0);

      if (!group.conditions || group.conditions.length === 0) {
        groupResults.push({ group, result: false });
        continue;
      }

      let groupResult = group.group_operator === 'AND' ? true : false;

      for (let j = 0; j < group.conditions.length; j++) {
        const condition = group.conditions[j];
        console.log(`  [Condition ${j + 1}/${group.conditions.length}]`);
        const conditionMet = evaluateSingleConditionFn(condition);

        if (group.group_operator === 'AND') {
          groupResult = groupResult && conditionMet;
          console.log(`    AND logic: groupResult = ${groupResult}`);
          if (!groupResult) {
            console.log('    ❌ AND failed, breaking early');
            break;
          }
        } else {
          groupResult = groupResult || conditionMet;
          console.log(`    OR logic: groupResult = ${groupResult}`);
          if (groupResult) {
            console.log('    ✅ OR succeeded, breaking early');
            break;
          }
        }
      }

      console.log(`  🎯 Group ${i + 1} Final Result:`, groupResult);
      console.log(`  → True Step: ${group.true_step}`);
      console.log(`  → False Step: ${group.false_step}`);
      groupResults.push({ group, result: groupResult });
    }

    // First match wins logic
    console.log('\n🏁 [FINAL DECISION] Processing results:');
    for (let i = 0; i < groupResults.length; i++) {
      const { group, result } = groupResults[i];

      if (result === true) {
        console.log(`  ✅ Group ${i + 1} matched! Returning: ${group.true_step}`);
        console.log('🔷🔷🔷 [CONDITION GROUPS] Complete\n');
        return group.true_step;
      } else {
        console.log(`  ❌ Group ${i + 1} failed → Returning: ${group.false_step}`);
        console.log('🔷🔷🔷 [CONDITION GROUPS] Complete\n');
        return group.false_step;
      }
    }

    // No groups matched - return fallback
    console.log('  ⚠️ No groups evaluated, using fallback...');
    const fallbackStep = logic.overall_false_step ||
                         groupResults[groupResults.length - 1]?.group.false_step ||
                         groupResults[0]?.group.false_step;
    console.log(`  → Fallback Step: ${fallbackStep}`);
    console.log('🔷🔷🔷 [CONDITION GROUPS] Complete\n');
    return fallbackStep;
  }

  // Legacy conditions evaluation
  if (!logic?.conditions || logic.conditions.length === 0) {
    return false;
  }

  if (logic.trigger_field && logic.trigger_value) {
    const triggerAnswer = currentAnswers[logic.trigger_field];
    if (String(triggerAnswer) !== String(logic.trigger_value)) {
      return false;
    }
  }

  let result = true;

  logic.conditions.forEach((condition, idx) => {
    const conditionMet = evaluateSingleConditionFn(condition);

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
  });

  return result;
};