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
  
  if (condition.value_type === 'field_reference') {
    comparisonValue = getFieldValue(condition.value);
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

  let conditionMet = false;

  const normalizeCountryForComparison = (val) => {
    if (!val) return '';
    const valLower = String(val).toLowerCase();
    const countryInfo = crsCountryMap[valLower];
    if (countryInfo?.code) {
      return countryInfo.code.toLowerCase();
    }
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
    const groupResults = [];

    for (let i = 0; i < logic.condition_groups.length; i++) {
      const group = logic.condition_groups[i];

      if (!group.conditions || group.conditions.length === 0) {
        groupResults.push({ group, result: false });
        continue;
      }

      let groupResult = group.group_operator === 'AND' ? true : false;

      for (let j = 0; j < group.conditions.length; j++) {
        const condition = group.conditions[j];
        const conditionMet = evaluateSingleConditionFn(condition);

        if (group.group_operator === 'AND') {
          groupResult = groupResult && conditionMet;
          if (!groupResult) break;
        } else {
          groupResult = groupResult || conditionMet;
          if (groupResult) break;
        }
      }

      groupResults.push({ group, result: groupResult });
    }

    // First match wins logic
    for (let i = 0; i < groupResults.length; i++) {
      const { group, result } = groupResults[i];

      if (result === true) {
        return group.true_step;
      }
    }

    // No groups matched - return fallback
    const fallbackStep = logic.overall_false_step ||
                         groupResults[groupResults.length - 1]?.group.false_step ||
                         groupResults[0]?.group.false_step;
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