/**
 * Utility functions for evaluating workflow conditional logic
 * Extracted from AccountClassification for better testability and reusability
 */

/**
 * Evaluates a single condition in a workflow
 * @param {Object} condition - The condition to evaluate
 * @param {Function} getFieldValue - Function to retrieve field values
 * @param {Object} crsCountryMap - Map of country codes to CRS info
 * @returns {Promise<boolean>} Whether the condition is met
 */
export const evaluateSingleCondition = async (condition, getFieldValue, crsCountryMap) => {
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

  // Check if we're comparing countries by checking if field name contains 'country'
  // This helps determine if we should normalize values as country codes
  const isCountryField = condition.field?.toLowerCase().includes('country');

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
        const conditionMet = await evaluateSingleConditionFn(condition);

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

    // Use FIRST group's result to determine routing
    console.log('\n🏁 [FINAL DECISION] Using first group to determine routing...');
    if (groupResults.length > 0) {
      const { group, result } = groupResults[0];
      const nextStep = result ? group.true_step : group.false_step;
      console.log(`  Group 1 (${group.group_name}): ${result}`);
      console.log(`  ${result ? '✅ TRUE' : '❌ FALSE'} - using ${result ? 'true' : 'false'}_step: ${nextStep}`);
      console.log('🔷🔷🔷 [CONDITION GROUPS] Complete\n');
      return nextStep;
    }

    // Fallback if no groups exist
    console.log(`  ⚠️ No condition groups found - using overall_false_step`);
    console.log('🔷🔷🔷 [CONDITION GROUPS] Complete\n');
    return logic.overall_false_step;
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

  return result;
};