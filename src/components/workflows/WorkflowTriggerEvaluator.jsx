import { base44 } from "@/api/base44Client";

/**
 * Evaluates workflow trigger conditions and returns matching workflows
 * @param {Object} entityData - The account or entity data to evaluate
 * @param {string} eventType - The trigger event (e.g., 'account_created', 'account_updated')
 * @param {Array} workflows - Array of published workflows to check
 * @returns {Array} - Array of matching workflows sorted by priority
 */
export const evaluateWorkflowTriggers = (entityData, eventType, workflows) => {
  const matchingWorkflows = [];

  workflows.forEach(workflow => {
    const triggerConfig = workflow.trigger_conditions;
    
    // Skip if triggers not enabled or wrong event type
    if (!triggerConfig?.enabled || triggerConfig.trigger_event !== eventType) {
      return;
    }

    // Evaluate all conditions
    if (evaluateConditions(entityData, triggerConfig)) {
      matchingWorkflows.push({
        workflow,
        priority: triggerConfig.priority || 0
      });
    }
  });

  // Sort by priority (highest first)
  return matchingWorkflows
    .sort((a, b) => b.priority - a.priority)
    .map(item => item.workflow);
};

/**
 * Evaluates a set of conditions against entity data
 * @param {Object} entityData - The data to evaluate
 * @param {Object} triggerConfig - The trigger configuration with conditions
 * @returns {boolean} - Whether all conditions are met
 */
const evaluateConditions = (entityData, triggerConfig) => {
  const { conditions = [], computed_conditions = [] } = triggerConfig;
  
  // Evaluate regular conditions
  let result = true;
  let currentLogicOperator = 'AND';
  
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const conditionResult = evaluateSingleCondition(entityData, condition);
    
    if (i === 0) {
      result = conditionResult;
    } else {
      if (currentLogicOperator === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }
    }
    
    currentLogicOperator = condition.logic_operator || 'AND';
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
const evaluateSingleCondition = (entityData, condition) => {
  const fieldValue = getNestedValue(entityData, condition.field);
  const compareValue = condition.value;
  
  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(compareValue);
    case 'not_equals':
      return String(fieldValue) !== String(compareValue);
    case 'greater_than':
      return parseFloat(fieldValue) > parseFloat(compareValue);
    case 'less_than':
      return parseFloat(fieldValue) < parseFloat(compareValue);
    case 'greater_than_or_equal':
      return parseFloat(fieldValue) >= parseFloat(compareValue);
    case 'less_than_or_equal':
      return parseFloat(fieldValue) <= parseFloat(compareValue);
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
    case 'in':
      return compareValue.split(',').map(v => v.trim()).includes(String(fieldValue));
    case 'not_in':
      return !compareValue.split(',').map(v => v.trim()).includes(String(fieldValue));
    default:
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
    switch (compCondition.operator) {
      case 'greater_than':
        return result > compCondition.value;
      case 'less_than':
        return result < compCondition.value;
      case 'greater_than_or_equal':
        return result >= compCondition.value;
      case 'less_than_or_equal':
        return result <= compCondition.value;
      case 'equals':
        return result === compCondition.value;
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
    const matchingWorkflows = evaluateWorkflowTriggers(entityData, eventType, allWorkflows);
    
    // If auto-trigger is enabled, we would create workflow execution records here
    // For now, just return the suggestions
    
    return matchingWorkflows;
  } catch (error) {
    console.error('Error suggesting workflows:', error);
    return [];
  }
};