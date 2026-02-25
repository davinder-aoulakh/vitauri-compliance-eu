/**
 * Enhanced condition evaluator that handles boolean vs string comparisons for multi-field inputs
 */

export const evaluateSingleConditionEnhanced = async (condition, allAnswers, getFieldValueFn, crsLookupFn = null) => {
  console.log('    --- Evaluating Single Condition (Enhanced) ---');
  console.log('    Condition Object:', JSON.stringify(condition, null, 2));
  console.log(`    Field: ${condition.field}, Operator: ${condition.operator}, Value: ${condition.value}, Value Type: ${condition.value_type}`);
  
  const fieldAnswer = getFieldValueFn(condition.field);
  console.log(`    Field Answer for "${condition.field}":`, fieldAnswer);
  console.log(`    Field Answer Type:`, typeof fieldAnswer);
  
  let comparisonValue = condition.value;
  if (condition.value_type === 'field_reference') {
    console.log(`    Value Type is field_reference, looking up: ${condition.value}`);
    comparisonValue = getFieldValueFn(condition.value);
    console.log(`    Resolved field reference value:`, comparisonValue);
  } else {
    console.log(`    Value Type is static, using value: ${comparisonValue}`);
  }
  
  let met = false;
  const isArrayAnswer = Array.isArray(fieldAnswer);
  
  switch (condition.operator) {
    case '=':
      if (isArrayAnswer) {
        met = fieldAnswer.includes(comparisonValue);
      } else {
        // Enhanced boolean vs string comparison
        if (typeof fieldAnswer === 'boolean' && typeof comparisonValue === 'string') {
          const normalizedComparison = comparisonValue.toLowerCase() === 'true';
          met = fieldAnswer === normalizedComparison;
          console.log(`    🔄 Boolean vs String (=): ${fieldAnswer} === (${comparisonValue} -> ${normalizedComparison}) = ${met}`);
        } else if (typeof fieldAnswer === 'string' && typeof comparisonValue === 'boolean') {
          const normalizedField = fieldAnswer.toLowerCase() === 'true';
          met = normalizedField === comparisonValue;
          console.log(`    🔄 String vs Boolean (=): (${fieldAnswer} -> ${normalizedField}) === ${comparisonValue} = ${met}`);
        } else {
          met = fieldAnswer === comparisonValue;
          console.log(`    ✓ Direct comparison (=): ${fieldAnswer} === ${comparisonValue} = ${met}`);
        }
      }
      break;
    
    case '!=':
      if (isArrayAnswer) {
        met = !fieldAnswer.includes(comparisonValue);
      } else {
        // Enhanced boolean vs string comparison
        if (typeof fieldAnswer === 'boolean' && typeof comparisonValue === 'string') {
          const normalizedComparison = comparisonValue.toLowerCase() === 'true';
          met = fieldAnswer !== normalizedComparison;
          console.log(`    🔄 Boolean vs String (!=): ${fieldAnswer} !== (${comparisonValue} -> ${normalizedComparison}) = ${met}`);
        } else if (typeof fieldAnswer === 'string' && typeof comparisonValue === 'boolean') {
          const normalizedField = fieldAnswer.toLowerCase() === 'true';
          met = normalizedField !== comparisonValue;
          console.log(`    🔄 String vs Boolean (!=): (${fieldAnswer} -> ${normalizedField}) !== ${comparisonValue} = ${met}`);
        } else {
          met = fieldAnswer !== comparisonValue;
          console.log(`    ✓ Direct comparison (!=): ${fieldAnswer} !== ${comparisonValue} = ${met}`);
        }
      }
      break;
    
    case '>':
      met = Number(fieldAnswer) > Number(comparisonValue);
      break;
    case '<':
      met = Number(fieldAnswer) < Number(comparisonValue);
      break;
    case '>=':
      met = Number(fieldAnswer) >= Number(comparisonValue);
      break;
    case '<=':
      met = Number(fieldAnswer) <= Number(comparisonValue);
      break;
    case 'contains':
      if (isArrayAnswer) {
        met = fieldAnswer.some(opt => String(opt).includes(String(comparisonValue)));
      } else {
        met = String(fieldAnswer || '').includes(String(comparisonValue));
      }
      break;
    case 'in':
      if (isArrayAnswer) {
        const comparisonList = String(comparisonValue).split(',').map(v => v.trim());
        met = fieldAnswer.some(opt => comparisonList.includes(String(opt)));
      } else {
        met = String(comparisonValue).split(',').map(v => v.trim()).includes(String(fieldAnswer));
      }
      break;
    case 'not_in':
      if (isArrayAnswer) {
        const comparisonList = String(comparisonValue).split(',').map(v => v.trim());
        met = !fieldAnswer.some(opt => comparisonList.includes(String(opt)));
      } else {
        met = !String(comparisonValue).split(',').map(v => v.trim()).includes(String(fieldAnswer));
      }
      break;
    case 'is_crs':
      console.log('    [IS_CRS OPERATOR] - checking fieldAnswer:', fieldAnswer);
      if (fieldAnswer && crsLookupFn) {
        met = await crsLookupFn(fieldAnswer);
        console.log('    [IS_CRS] Result - met:', met);
      } else {
        met = false;
      }
      break;
    case 'is_not_crs':
      if (fieldAnswer && crsLookupFn) {
        const isCrs = await crsLookupFn(fieldAnswer);
        met = !isCrs;
      } else {
        met = true;
      }
      break;
    default:
      met = false;
  }

  console.log(`    >>> Condition Result: ${met}`);
  console.log('    --- End Single Condition (Enhanced) ---\n');
  return met;
};