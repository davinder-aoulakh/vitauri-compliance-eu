/**
 * Helper to evaluate a single condition with proper boolean vs string handling
 * Used by both AccountClassification and WorkflowRunner
 */

export const evaluateSingleConditionWithBooleanHandling = async (
  condition,
  getFieldValueFn,
  crsLookupFn = null
) => {
  console.log(`  🔍 Condition: field="${condition.field}", operator="${condition.operator}", value="${condition.value}", value_type="${condition.value_type}"`);
  
  let fieldValue = getFieldValueFn(condition.field);
  let comparisonValue = condition.value;
  
  if (condition.value_type === 'field_reference') {
    comparisonValue = getFieldValueFn(condition.value);
  }
  
  const originalFieldValue = fieldValue;
  const originalComparisonValue = comparisonValue;
  
  console.log(`  📊 Original field value:`, originalFieldValue, `(type: ${typeof originalFieldValue})`);
  console.log(`  📊 Original comparison value:`, originalComparisonValue, `(type: ${typeof originalComparisonValue})`);
  
  let conditionMet = false;
  
  switch (condition.operator) {
    case "=":
      // Enhanced boolean vs string comparison
      if (typeof originalFieldValue === 'boolean' && typeof originalComparisonValue === 'string') {
        const normalizedComparison = originalComparisonValue.toLowerCase() === 'true';
        conditionMet = originalFieldValue === normalizedComparison;
        console.log(`  🔄 Boolean vs String (=): ${originalFieldValue} === (${originalComparisonValue} -> ${normalizedComparison}) = ${conditionMet}`);
      } else if (typeof originalFieldValue === 'string' && typeof originalComparisonValue === 'boolean') {
        const normalizedField = originalFieldValue.toLowerCase() === 'true';
        conditionMet = normalizedField === originalComparisonValue;
        console.log(`  🔄 String vs Boolean (=): (${originalFieldValue} -> ${normalizedField}) === ${originalComparisonValue} = ${conditionMet}`);
      } else {
        conditionMet = String(originalFieldValue || '').toLowerCase() === String(originalComparisonValue || '').toLowerCase();
        console.log(`  ✓ String comparison (=): "${String(originalFieldValue || '').toLowerCase()}" === "${String(originalComparisonValue || '').toLowerCase()}" = ${conditionMet}`);
      }
      break;
    
    case "!=":
      if (typeof originalFieldValue === 'boolean' && typeof originalComparisonValue === 'string') {
        const normalizedComparison = originalComparisonValue.toLowerCase() === 'true';
        conditionMet = originalFieldValue !== normalizedComparison;
        console.log(`  🔄 Boolean vs String (!=): ${originalFieldValue} !== (${originalComparisonValue} -> ${normalizedComparison}) = ${conditionMet}`);
      } else if (typeof originalFieldValue === 'string' && typeof originalComparisonValue === 'boolean') {
        const normalizedField = originalFieldValue.toLowerCase() === 'true';
        conditionMet = normalizedField !== originalComparisonValue;
        console.log(`  🔄 String vs Boolean (!=): (${originalFieldValue} -> ${normalizedField}) !== ${originalComparisonValue} = ${conditionMet}`);
      } else {
        conditionMet = String(originalFieldValue || '').toLowerCase() !== String(originalComparisonValue || '').toLowerCase();
      }
      break;
    
    case ">":
      conditionMet = parseFloat(originalFieldValue) > parseFloat(originalComparisonValue);
      break;
    
    case "<":
      conditionMet = parseFloat(originalFieldValue) < parseFloat(originalComparisonValue);
      break;
    
    case ">=":
      conditionMet = parseFloat(originalFieldValue) >= parseFloat(originalComparisonValue);
      break;
    
    case "<=":
      conditionMet = parseFloat(originalFieldValue) <= parseFloat(originalComparisonValue);
      break;
    
    case "contains":
      conditionMet = String(originalFieldValue || '').toLowerCase().includes(String(originalComparisonValue || '').toLowerCase());
      break;
    
    case "in":
      const inValues = String(originalComparisonValue).split(",").map(v => v.trim().toLowerCase());
      conditionMet = inValues.includes(String(originalFieldValue || '').toLowerCase());
      break;
    
    case "not_in":
      const notInValues = String(originalComparisonValue).split(",").map(v => v.trim().toLowerCase());
      conditionMet = !notInValues.includes(String(originalFieldValue || '').toLowerCase());
      break;
    
    case "is_crs":
      if (originalFieldValue && crsLookupFn) {
        conditionMet = await crsLookupFn(originalFieldValue);
        console.log(`  🌍 is_crs check: "${originalFieldValue}" -> ${conditionMet}`);
      } else {
        conditionMet = false;
      }
      break;
    
    case "is_not_crs":
      if (originalFieldValue && crsLookupFn) {
        const isCrs = await crsLookupFn(originalFieldValue);
        conditionMet = !isCrs;
        console.log(`  🌍 is_not_crs check: "${originalFieldValue}" -> ${conditionMet}`);
      } else {
        conditionMet = true;
      }
      break;
    
    default:
      conditionMet = false;
  }
  
  console.log(`  >>> Condition Result: ${conditionMet}`);
  return conditionMet;
};