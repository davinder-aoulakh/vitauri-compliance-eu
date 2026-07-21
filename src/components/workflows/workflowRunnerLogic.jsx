/**
 * Conditional logic evaluation for WorkflowRunner
 */
import { base44 } from "@/api/base44Client";

export const evaluateSingleCondition = async (condition, getFieldValue, allAnswers) => {
  console.log('    --- Evaluating Single Condition ---');
  console.log('    Condition Object:', JSON.stringify(condition, null, 2));
  console.log(`    Field: ${condition.field}, Operator: ${condition.operator}, Value: ${condition.value}, Value Type: ${condition.value_type}`);
  
  const fieldAnswer = getFieldValue(condition.field, allAnswers);
  console.log(`    Field Answer for "${condition.field}":`, fieldAnswer);
  console.log(`    Field Answer Type:`, typeof fieldAnswer);
  console.log(`    Field Answer (stringified):`, JSON.stringify(fieldAnswer));
  
  let comparisonValue = condition.value;
  if (condition.value_type === 'field_reference') {
    console.log(`    Value Type is field_reference, looking up: ${condition.value}`);
    comparisonValue = getFieldValue(condition.value, allAnswers);
    console.log(`    Resolved field reference value:`, comparisonValue);
    console.log(`    Resolved field reference type:`, typeof comparisonValue);
    console.log(`    Resolved field reference (stringified):`, JSON.stringify(comparisonValue));
  } else {
    console.log(`    Value Type is static, using value: ${comparisonValue}`);
  }
  
  let met = false;

  // Normalize tax_residencies (array of objects) to a flat array of country strings
  // so all operators work consistently, matching account classification behaviour
  let resolvedAnswer = fieldAnswer;
  if (
    Array.isArray(fieldAnswer) &&
    fieldAnswer.length > 0 &&
    typeof fieldAnswer[0] === 'object' &&
    fieldAnswer[0] !== null &&
    ('country' in fieldAnswer[0] || 'Country' in fieldAnswer[0])
  ) {
    resolvedAnswer = fieldAnswer
      .map(item => item.country || item.Country)
      .filter(Boolean);
    console.log(`    [NORMALIZE] Detected array-of-objects (tax_residencies). Flattened to countries:`, resolvedAnswer);
  }

  const isArrayAnswer = Array.isArray(resolvedAnswer);

  switch (condition.operator) {
    case '=':
      if (isArrayAnswer) {
        // For array of countries: true if ANY country in the array equals the comparison value
        met = await (async () => {
          for (const countryItem of resolvedAnswer) {
            let normalizedField = String(countryItem || '').trim().toLowerCase();
            let normalizedComparison = String(comparisonValue || '').trim().toLowerCase();
            if (countryItem && comparisonValue) {
              try {
                const [fc, cc] = await Promise.all([
                  base44.entities.CrsCountryInfo.filter({ $or: [{ country_name: String(countryItem).trim() }, { country_code: String(countryItem).trim() }] }).then(r => r.length > 0 ? r[0].country_code : countryItem),
                  base44.entities.CrsCountryInfo.filter({ $or: [{ country_name: String(comparisonValue).trim() }, { country_code: String(comparisonValue).trim() }] }).then(r => r.length > 0 ? r[0].country_code : comparisonValue)
                ]);
                normalizedField = fc.trim().toLowerCase();
                normalizedComparison = cc.trim().toLowerCase();
              } catch (e) { /* use raw values */ }
            }
            if (normalizedField === normalizedComparison) return true;
          }
          return false;
        })();
      } else {
        if (typeof resolvedAnswer === 'boolean' && typeof comparisonValue === 'string') {
          met = resolvedAnswer === (comparisonValue === 'true');
        } else {
          let normalizedField = String(resolvedAnswer || '').trim().toLowerCase();
          let normalizedComparison = String(comparisonValue || '').trim().toLowerCase();
          if (resolvedAnswer && comparisonValue && typeof resolvedAnswer === 'string' && typeof comparisonValue === 'string') {
            try {
              const [fieldCountry, comparisonCountry] = await Promise.all([
                base44.entities.CrsCountryInfo.filter({ $or: [{ country_name: resolvedAnswer.trim() }, { country_code: resolvedAnswer.trim() }] }).then(r => r.length > 0 ? r[0].country_code : resolvedAnswer),
                base44.entities.CrsCountryInfo.filter({ $or: [{ country_name: comparisonValue.trim() }, { country_code: comparisonValue.trim() }] }).then(r => r.length > 0 ? r[0].country_code : comparisonValue)
              ]);
              normalizedField = fieldCountry.trim().toLowerCase();
              normalizedComparison = comparisonCountry.trim().toLowerCase();
              console.log(`    [= OPERATOR] COUNTRY CODES - Field: "${fieldCountry}", Comparison: "${comparisonCountry}"`);
            } catch (error) {
              console.log(`    [= OPERATOR] Error resolving country codes, using raw values:`, error);
            }
          }
          met = normalizedField === normalizedComparison;
          console.log(`    [= OPERATOR] Normalized comparison: "${normalizedField}" === "${normalizedComparison}" = ${met}`);
        }
      }
      break;
    case '!=':
      if (isArrayAnswer) {
        // For array of countries: true if ANY country in the array differs from the comparison value
        met = await (async () => {
          for (const countryItem of resolvedAnswer) {
            let normalizedField = String(countryItem || '').trim().toLowerCase();
            let normalizedComparison = String(comparisonValue || '').trim().toLowerCase();
            if (countryItem && comparisonValue) {
              try {
                const [fc, cc] = await Promise.all([
                  base44.entities.CrsCountryInfo.filter({ $or: [{ country_name: String(countryItem).trim() }, { country_code: String(countryItem).trim() }] }).then(r => r.length > 0 ? r[0].country_code : countryItem),
                  base44.entities.CrsCountryInfo.filter({ $or: [{ country_name: String(comparisonValue).trim() }, { country_code: String(comparisonValue).trim() }] }).then(r => r.length > 0 ? r[0].country_code : comparisonValue)
                ]);
                normalizedField = fc.trim().toLowerCase();
                normalizedComparison = cc.trim().toLowerCase();
              } catch (e) { /* use raw values */ }
            }
            console.log(`    [!= ARRAY] "${normalizedField}" !== "${normalizedComparison}" = ${normalizedField !== normalizedComparison}`);
            if (normalizedField !== normalizedComparison) return true;
          }
          return false;
        })();
      } else {
        if (typeof resolvedAnswer === 'boolean' && typeof comparisonValue === 'string') {
          met = resolvedAnswer !== (comparisonValue === 'true');
        } else {
          let normalizedField = String(resolvedAnswer || '').trim().toLowerCase();
          let normalizedComparison = String(comparisonValue || '').trim().toLowerCase();
          console.log(`    [!= OPERATOR] RAW VALUES - Field: "${resolvedAnswer}", Comparison: "${comparisonValue}"`);
          if (resolvedAnswer && comparisonValue && typeof resolvedAnswer === 'string' && typeof comparisonValue === 'string') {
            try {
              const [fieldCountry, comparisonCountry] = await Promise.all([
                base44.entities.CrsCountryInfo.filter({ $or: [{ country_name: resolvedAnswer.trim() }, { country_code: resolvedAnswer.trim() }] }).then(r => r.length > 0 ? r[0].country_code : resolvedAnswer),
                base44.entities.CrsCountryInfo.filter({ $or: [{ country_name: comparisonValue.trim() }, { country_code: comparisonValue.trim() }] }).then(r => r.length > 0 ? r[0].country_code : comparisonValue)
              ]);
              normalizedField = fieldCountry.trim().toLowerCase();
              normalizedComparison = comparisonCountry.trim().toLowerCase();
              console.log(`    [!= OPERATOR] COUNTRY CODES - Field: "${fieldCountry}", Comparison: "${comparisonCountry}"`);
            } catch (error) {
              console.log(`    [!= OPERATOR] Error resolving country codes, using raw values:`, error);
            }
          }
          met = normalizedField !== normalizedComparison;
          console.log(`    [!= OPERATOR] NORMALIZED - Field: "${normalizedField}", Comparison: "${normalizedComparison}"`);
          console.log(`    [!= OPERATOR] RESULT: "${normalizedField}" !== "${normalizedComparison}" = ${met}`);
        }
      }
      break;
    case '>':
      met = Number(resolvedAnswer) > Number(comparisonValue);
      break;
    case '<':
      met = Number(resolvedAnswer) < Number(comparisonValue);
      break;
    case '>=':
      met = Number(resolvedAnswer) >= Number(comparisonValue);
      break;
    case '<=':
      met = Number(resolvedAnswer) <= Number(comparisonValue);
      break;
    case 'contains':
      if (isArrayAnswer) {
        met = resolvedAnswer.some(opt => String(opt).includes(String(comparisonValue)));
      } else {
        met = String(resolvedAnswer || '').includes(String(comparisonValue));
      }
      break;
    case 'in':
      if (isArrayAnswer) {
        const comparisonListIn = String(comparisonValue).split(',').map(v => v.trim());
        met = resolvedAnswer.some(opt => comparisonListIn.includes(String(opt)));
      } else {
        met = String(comparisonValue).split(',').map(v => v.trim()).includes(String(resolvedAnswer));
      }
      break;
    case 'not_in':
      if (isArrayAnswer) {
        const comparisonListNotIn = String(comparisonValue).split(',').map(v => v.trim());
        met = !resolvedAnswer.some(opt => comparisonListNotIn.includes(String(opt)));
      } else {
        met = !String(comparisonValue).split(',').map(v => v.trim()).includes(String(resolvedAnswer));
      }
      break;
    case 'is_crs':
      console.log('    [IS_CRS OPERATOR] - resolvedAnswer:', resolvedAnswer);

      if (isArrayAnswer) {
        // Array of countries (from tax_residencies): true if ANY country is a CRS country
        met = await (async () => {
          for (const countryItem of resolvedAnswer) {
            if (!countryItem) continue;
            try {
              const crsCountries = await base44.entities.CrsCountryInfo.filter({
                $or: [{ country_name: String(countryItem).trim() }, { country_code: String(countryItem).trim() }]
              });
              console.log(`    [IS_CRS ARRAY] "${countryItem}" → is_crs=${crsCountries[0]?.is_crs_country}`);
              if (crsCountries.length > 0 && crsCountries[0].is_crs_country === true) return true;
            } catch (e) { /* skip */ }
          }
          return false;
        })();
      } else {
        // Single value (object with .country, or plain string)
        let countryValue = resolvedAnswer;
        if (typeof resolvedAnswer === 'object' && resolvedAnswer !== null) {
          countryValue = resolvedAnswer.country || resolvedAnswer.Country;
          console.log('    [IS_CRS] Extracted country from object:', countryValue);
        }
        if (countryValue && typeof countryValue === 'string') {
          try {
            const normalizedCountry = countryValue.trim();
            console.log('    [IS_CRS] Looking up country:', normalizedCountry);
            const crsCountries = await base44.entities.CrsCountryInfo.filter({
              $or: [{ country_name: normalizedCountry }, { country_code: normalizedCountry }]
            });
            met = crsCountries.length > 0 && crsCountries[0].is_crs_country === true;
            console.log(`    [IS_CRS] Country "${normalizedCountry}" → is_crs=${met}`);
          } catch (error) {
            console.error("    [IS_CRS] Error checking CRS country status:", error);
            met = false;
          }
        } else {
          console.log('    [IS_CRS] No valid country value found, met = false');
          met = false;
        }
      }
      break;
    case 'is_not_crs':
      if (isArrayAnswer) {
        // Array of countries: true if ALL countries are non-CRS (none are CRS)
        met = await (async () => {
          for (const countryItem of resolvedAnswer) {
            if (!countryItem) continue;
            try {
              const crsCountries = await base44.entities.CrsCountryInfo.filter({
                $or: [{ country_name: String(countryItem).trim() }, { country_code: String(countryItem).trim() }]
              });
              if (crsCountries.length > 0 && crsCountries[0].is_crs_country === true) return false;
            } catch (e) { /* skip */ }
          }
          return true;
        })();
      } else {
        if (resolvedAnswer) {
          try {
            const crsCountries = await base44.entities.CrsCountryInfo.filter({
              $or: [{ country_name: resolvedAnswer }, { country_code: resolvedAnswer }]
            });
            met = crsCountries.length === 0 || crsCountries[0].is_crs_country === false;
          } catch (error) {
            console.error("Error checking CRS country status:", error);
            met = true;
          }
        } else {
          met = true;
        }
      }
      break;
    default:
      met = false;
  }

  console.log(`    >>> Condition Result: ${met}`);
  console.log('    --- End Single Condition ---\n');
  return met;
};

export const evaluateConditionalLogic = async (logic, currentAnswer, allAnswers, getFieldValue, workflow) => {
  console.log('\n========== EVALUATING CONDITIONAL LOGIC ==========');
  console.log('Full Logic Object:', JSON.stringify(logic, null, 2));
  console.log('All Current Answers:', JSON.stringify(allAnswers, null, 2));
  console.log('Trigger Field:', logic?.trigger_field);
  console.log('Trigger Value:', logic?.trigger_value);
  console.log('Has condition_groups:', !!logic?.condition_groups?.length);
  console.log('Number of condition_groups:', logic?.condition_groups?.length || 0);

  if (logic?.condition_groups && logic.condition_groups.length > 0) {
    console.log('\n========== EVALUATING CONDITION GROUPS ==========');
    console.log(`Total condition_groups: ${logic.condition_groups.length}`);
    console.log('Overall Logic Operator:', logic.overall_logic_operator);
    console.log('Overall True Step:', logic.overall_true_step);
    console.log('Overall False Step:', logic.overall_false_step);
    console.log('🔍 TRIGGER CHECK - trigger_field:', logic.trigger_field);
    console.log('🔍 TRIGGER CHECK - trigger_value:', logic.trigger_value);
    console.log('🔍 TRIGGER CHECK - currentAnswer:', currentAnswer);
    
    if (logic.trigger_field && logic.trigger_value) {
      const triggerStepAnswer = allAnswers[logic.trigger_field];
      console.log(`🔍 TRIGGER STEP ANSWER for "${logic.trigger_field}":`, triggerStepAnswer);
      
      if (triggerStepAnswer !== logic.trigger_value) {
        console.log(`⚠️ TRIGGER NOT MET: Expected "${logic.trigger_value}", got "${triggerStepAnswer}"`);
        console.log(`⚠️ Skipping advanced conditional logic - trigger not satisfied`);
        console.log('========== END CONDITION GROUPS EVALUATION (TRIGGER NOT MET) ==========\n');
        return null;
      } else {
        console.log(`✅ TRIGGER MET: "${triggerStepAnswer}" === "${logic.trigger_value}"`);
      }
    }
    
    const groupResults = [];

    for (let i = 0; i < logic.condition_groups.length; i++) {
      const group = logic.condition_groups[i];
      console.log(`\n--- EVALUATING GROUP ${i + 1}: ${group.group_name || group.group_id} ---`);
      console.log(`Group ID: ${group.group_id}`);
      console.log(`Group Operator: ${group.group_operator}`);
      console.log(`Number of conditions in group: ${group.conditions?.length || 0}`);
      console.log(`Group True Step: ${group.true_step}`);
      console.log(`Group False Step: ${group.false_step}`);

      if (!group.conditions || group.conditions.length === 0) {
        console.log(`WARNING: Group ${group.group_name} has no conditions! Treating as FALSE.`);
        groupResults.push({ group, result: false });
        continue;
      }

      let groupResult = group.group_operator === 'AND' ? true : false;

      for (let j = 0; j < group.conditions.length; j++) {
        const condition = group.conditions[j];
        console.log(`\n  Condition ${j + 1}/${group.conditions.length}:`);
        console.log(`  - Field: ${condition.field}`);
        console.log(`  - Operator: ${condition.operator}`);
        console.log(`  - Value: ${condition.value}`);
        console.log(`  - Value Type: ${condition.value_type}`);
        
        const conditionMet = await evaluateSingleCondition(condition, getFieldValue, allAnswers);
        console.log(`  - Result: ${conditionMet}`);
        
        if (group.group_operator === 'AND') {
          groupResult = groupResult && conditionMet;
          console.log(`  - Running AND: groupResult = ${groupResult}`);
          if (!groupResult) {
            console.log(`  - Short-circuit AND (group failed)`);
            break;
          }
        } else {
          groupResult = groupResult || conditionMet;
          console.log(`  - Running OR: groupResult = ${groupResult}`);
          if (groupResult) {
            console.log(`  - Short-circuit OR (group succeeded)`);
            break;
          }
        }
      }

      console.log(`\n>>> GROUP ${i + 1} FINAL RESULT: ${groupResult}`);
      groupResults.push({ group, result: groupResult });
    }

    console.log('\n--- ALL GROUP RESULTS ---');
    groupResults.forEach(({ group, result }, idx) => {
      console.log(`Group ${idx + 1} (${group.group_name}): ${result}`);
    });

    if (logic.overall_logic_operator) {
      console.log(`\n--- COMBINING GROUPS with ${logic.overall_logic_operator} ---`);
      let finalResult = logic.overall_logic_operator === 'AND' ? true : false;
      let matchedGroupIndex = -1;

      for (let i = 0; i < groupResults.length; i++) {
        const { result } = groupResults[i];
        if (logic.overall_logic_operator === 'AND') {
          finalResult = finalResult && result;
          console.log(`After group ${i + 1}: finalResult = ${finalResult} (AND logic)`);
          if (!finalResult) {
            console.log('Short-circuit AND - stopping evaluation');
            break;
          }
        } else {
          const previousResult = finalResult;
          finalResult = finalResult || result;
          console.log(`After group ${i + 1}: finalResult = ${finalResult} (OR logic, group result: ${result})`);
          if (result && matchedGroupIndex === -1) {
            matchedGroupIndex = i;
            console.log(`✅ First TRUE group found at index ${i}`);
          }
          if (finalResult && previousResult === false && result === true) {
            console.log('Short-circuit OR - first TRUE group found, stopping evaluation');
            break;
          }
        }
      }

      console.log(`\n>>> FINAL OVERALL RESULT: ${finalResult}`);
      
      let nextStep;
      if (logic.overall_logic_operator === 'OR' && finalResult && matchedGroupIndex >= 0) {
        const matchedGroup = groupResults[matchedGroupIndex].group;
        nextStep = matchedGroup.true_step;
        console.log(`>>> OR Logic - Using matched group ${matchedGroupIndex + 1}'s true_step: ${nextStep}`);
      } else {
        nextStep = finalResult ? logic.overall_true_step : logic.overall_false_step;
        console.log(`>>> Using overall ${finalResult ? 'true' : 'false'} step: ${nextStep}`);
      }
      
      console.log(`>>> RETURNING NEXT STEP: ${nextStep} (${finalResult ? 'TRUE' : 'FALSE'} path)`);
      
      const nextStepObj = workflow.steps.find(s => s.step_id === nextStep);
      if (nextStepObj) {
        console.log(`>>> Next step title: ${nextStepObj.step_title}`);
      } else {
        console.log(`>>> WARNING: Next step "${nextStep}" not found in workflow!`);
      }
      
      console.log('========== END CONDITION GROUPS EVALUATION ==========\n');
      return nextStep;
    } else {
      console.log('\n--- NO OVERALL OPERATOR - finding first TRUE group ---');
      for (let i = 0; i < groupResults.length; i++) {
        const { group, result } = groupResults[i];
        console.log(`  Group ${i + 1} (${group.group_name}): ${result}`);
        if (result) {
          console.log(`  ✅ First TRUE group found - using true_step: ${group.true_step}`);
          console.log('========== END CONDITION GROUPS EVALUATION ==========\n');
          return group.true_step;
        }
      }
      
      // No groups were TRUE - use last group's false_step as fallback
      const lastGroup = groupResults[groupResults.length - 1]?.group;
      const fallbackStep = lastGroup?.false_step || logic.overall_false_step;
      console.log(`  ❌ No TRUE groups - using last group's false_step: ${fallbackStep}`);
      console.log('========== END CONDITION GROUPS EVALUATION ==========\n');
      return fallbackStep;
    }
  }

  console.log('\n--- EVALUATING LEGACY SIMPLE CONDITIONS ---');
  if (!logic?.conditions || logic.conditions.length === 0) {
    console.log('No simple conditions found, returning else_step:', logic.else_step);
    console.log('========== END CONDITIONAL LOGIC EVALUATION ==========\n');
    return logic.else_step;
  }

  console.log(`Evaluating ${logic.conditions.length} simple conditions`);
  let conditionsMet = true;
  for (let i = 0; i < logic.conditions.length; i++) {
    const condition = logic.conditions[i];
    console.log(`\nSimple Condition ${i + 1}/${logic.conditions.length}:`);
    const met = await evaluateSingleCondition(condition, getFieldValue, allAnswers);
    
    if (condition.logic_operator === 'AND' && !met) {
      console.log('AND condition failed, conditionsMet = false');
      conditionsMet = false;
      break;
    }
    if (condition.logic_operator === 'OR' && met) {
      console.log('OR condition met, conditionsMet = true');
      conditionsMet = true;
      break;
    }
  }

  console.log('\n>>> Final conditionsMet:', conditionsMet);
  const resultStep = conditionsMet ? logic.next_step : logic.else_step;
  console.log(`>>> Returning: ${resultStep} (${conditionsMet ? 'next_step' : 'else_step'})`);
  console.log('========== END CONDITIONAL LOGIC EVALUATION ==========\n');
  
  return resultStep;
};