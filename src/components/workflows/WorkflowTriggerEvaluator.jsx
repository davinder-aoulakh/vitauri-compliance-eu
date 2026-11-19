import { base44 } from "@/api/base44Client";

/**
 * Evaluates workflow trigger conditions and returns matching workflows
 * @param {Object} entityData - The account or entity data to evaluate
 * @param {string} eventType - The trigger event (e.g., 'account_created', 'account_updated')
 * @param {Array} workflows - Array of published workflows to check
 * @returns {Promise<Array>} - Array of matching workflows sorted by priority
 */
export const evaluateWorkflowTriggers = async (entityData, eventType, workflows) => {
  const matchingWorkflows = [];

  for (const workflow of workflows) {
    const triggerConfig = workflow.trigger_conditions;
    
    console.log(`[TRIGGER EVAL] Workflow: "${workflow.workflow_name}" | enabled: ${triggerConfig?.enabled} | event: ${triggerConfig?.trigger_event} | conditions: ${JSON.stringify(triggerConfig?.conditions)}`);

    // Skip if triggers not enabled or wrong event type
    if (!triggerConfig?.enabled || triggerConfig.trigger_event !== eventType) {
      console.log(`[TRIGGER EVAL] Skipped "${workflow.workflow_name}" - not enabled or wrong event`);
      continue;
    }

    // Evaluate all conditions
    const matched = await evaluateConditions(entityData, triggerConfig);
    console.log(`[TRIGGER EVAL] "${workflow.workflow_name}" conditions matched: ${matched}`);
    if (matched) {
      matchingWorkflows.push({
        workflow,
        priority: triggerConfig.priority || 0
      });
    }
  }

  // Sort by priority (highest first)
  return matchingWorkflows
    .sort((a, b) => b.priority - a.priority)
    .map(item => item.workflow);
};

/**
 * Evaluates a set of conditions against entity data
 * @param {Object} entityData - The data to evaluate
 * @param {Object} triggerConfig - The trigger configuration with conditions
 * @returns {Promise<boolean>} - Whether all conditions are met
 */
const evaluateConditions = async (entityData, triggerConfig) => {
  const { conditions = [], computed_conditions = [] } = triggerConfig;

  // If no conditions defined, this workflow does not match via triggers
  if (conditions.length === 0 && computed_conditions.length === 0) return false;
  
  // Evaluate regular conditions
  let result = true;
  
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const conditionResult = await evaluateSingleCondition(entityData, condition);
    
    if (i === 0) {
      result = conditionResult;
    } else {
      // Use the PREVIOUS condition's logic operator to combine with current result
      const prevCondition = conditions[i - 1];
      const logicOperator = prevCondition.logic_operator || 'AND';
      
      if (logicOperator === 'OR') {
        result = result || conditionResult;
      } else {
        result = result && conditionResult;
      }
    }
  }
  
  // Evaluate computed conditions
  for (let i = 0; i < computed_conditions.length; i++) {
    const compCondition = computed_conditions[i];
    const compResult = evaluateComputedCondition(entityData, compCondition);
    
    if (conditions.length === 0 && i === 0) {
      result = compResult;
    } else {
      if (compCondition.logic_operator === 'OR') {
        result = result || compResult;
      } else {
        result = result && compResult;
      }
    }
  }
  
  return result;
};

/**
 * Evaluates a single condition
 */
const evaluateSingleCondition = async (entityData, condition) => {
  const fieldValue = getNestedValue(entityData, condition.field);
  
  // Check if compareValue is a field reference or static value
  let compareValue = condition.value;
  if (condition.value_type === 'field_reference') {
    compareValue = getNestedValue(entityData, condition.value);
  }

  // Normalize fi_type: map human-readable Entity fi_type labels to short codes used in trigger conditions
  const FI_TYPE_NORMALIZATION = {
    'type a investment entity': 'type_a',
    'type b investment entity': 'type_b',
    'custodial institution': 'custodial_institution',
    'depository institution': 'depository_institution',
    'specified insurance company': 'specified_insurance_company',
    'investment entity': 'type_a',
  };
  let normalizedFieldValue = fieldValue;
  if (condition.field === 'fi_type' && typeof fieldValue === 'string') {
    const key = fieldValue.toLowerCase().trim();
    normalizedFieldValue = FI_TYPE_NORMALIZATION[key] || fieldValue;
  }

  // Detailed debug logging
  console.log(
    `[CONDITION EVAL] field="${condition.field}" | ` +
    `DB value="${fieldValue}" (normalized: "${normalizedFieldValue}") | ` +
    `compare value="${compareValue}" | ` +
    `operator="${condition.operator}"`
  );

  switch (condition.operator) {
    case 'equals':
    case '=': {
      const eqResult = String(normalizedFieldValue).toLowerCase() === String(compareValue).toLowerCase();
      console.log(`[CONDITION EVAL] Result: ${eqResult}`);
      return eqResult;
    }
    case 'not_equals':
    case '!=':
      return String(normalizedFieldValue).toLowerCase() !== String(compareValue).toLowerCase();
    case 'greater_than':
    case '>':
      return parseFloat(normalizedFieldValue) > parseFloat(compareValue);
    case 'less_than':
    case '<':
      return parseFloat(normalizedFieldValue) < parseFloat(compareValue);
    case 'greater_than_or_equal':
    case '>=':
      return parseFloat(normalizedFieldValue) >= parseFloat(compareValue);
    case 'less_than_or_equal':
    case '<=':
      return parseFloat(normalizedFieldValue) <= parseFloat(compareValue);
    case 'contains':
      return String(normalizedFieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
    case 'in':
      return compareValue.split(',').map(v => v.trim()).includes(String(normalizedFieldValue));
    case 'not_in':
      return !compareValue.split(',').map(v => v.trim()).includes(String(normalizedFieldValue));
    case 'is_crs':
      return await checkIsCrsCountry(fieldValue);
    case 'is_not_crs':
      return !(await checkIsCrsCountry(fieldValue));
    default:
      return false;
  }
};

/**
 * Checks if a country is a CRS participating country
 * @param {string} countryCode - The country code to check
 * @returns {Promise<boolean>} - True if the country is a CRS country
 */
const checkIsCrsCountry = async (countryCode) => {
  try {
    if (!countryCode) return false;
    
    const crsCountries = await base44.entities.CrsCountryInfo.filter({
      country_code: countryCode,
      is_crs_country: true
    });
    
    return crsCountries.length > 0;
  } catch (error) {
    console.error('Error checking CRS country:', error);
    return false;
  }
};

/**
 * Evaluates a computed condition (e.g., field1 + field2 > 100000)
 */
const evaluateComputedCondition = (entityData, compCondition) => {
  try {
    // Parse the expression to extract field names
    const expression = compCondition.expression;
    
    // Simple expression parser - supports basic arithmetic
    let computedValue = expression;
    
    // Replace field names with their values
    const fieldRegex = /\b([a-z_]+[a-z0-9_]*)\b/gi;
    computedValue = computedValue.replace(fieldRegex, (match) => {
      const value = getNestedValue(entityData, match);
      return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
    });
    
    // Evaluate the expression
    // Note: Using Function constructor is safe here as expression comes from trusted admin config
    const result = new Function(`return ${computedValue}`)();
    
    // Compare result with condition value
    // Ensure value is parsed as number for comparison
    const compareValue = parseFloat(compCondition.value);
    
    switch (compCondition.operator) {
      case 'greater_than':
      case '>':
        return result > compareValue;
      case 'less_than':
      case '<':
        return result < compareValue;
      case 'greater_than_or_equal':
      case '>=':
        return result >= compareValue;
      case 'less_than_or_equal':
      case '<=':
        return result <= compareValue;
      case 'equals':
      case '=':
        return result === compareValue;
      default:
        return false;
    }
  } catch (error) {
    console.error('Error evaluating computed condition:', error);
    return false;
  }
};

/**
 * Gets a nested value from an object using dot notation
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

/**
 * Suggests workflows for an account/entity and optionally auto-triggers them
 * @param {Object} entityData - The account or entity data
 * @param {string} eventType - The trigger event type
 * @param {boolean} autoTrigger - Whether to automatically start the workflow
 * @returns {Promise<Array>} - Array of suggested/triggered workflows
 */
export const suggestWorkflows = async (entityData, eventType, autoTrigger = false) => {
  try {
    // Fetch all published workflows
    const allWorkflows = await base44.entities.Workflow.filter({
      status: 'published'
    });
    
    // Evaluate which workflows match
    const matchingWorkflows = await evaluateWorkflowTriggers(entityData, eventType, allWorkflows);
    
    // If auto-trigger is enabled, we would create workflow execution records here
    // For now, just return the suggestions
    
    return matchingWorkflows;
  } catch (error) {
    console.error('Error suggesting workflows:', error);
    return [];
  }
};