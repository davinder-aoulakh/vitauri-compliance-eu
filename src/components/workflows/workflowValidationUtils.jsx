/**
 * Utility functions for workflow validation logic
 */

/**
 * Check if a field should be visible based on conditional visibility rules
 */
export const isFieldVisible = (field, currentValues) => {
  if (!field.conditional_visibility) return true;
  
  const dependsOnField = field.conditional_visibility.depends_on_field;
  const requiredValue = field.conditional_visibility.required_value?.toLowerCase();
  const dependentFieldValue = currentValues[dependsOnField];
  
  // Normalize boolean values
  let normalizedValue = dependentFieldValue;
  if (typeof dependentFieldValue === 'boolean') {
    normalizedValue = dependentFieldValue ? 'yes' : 'no';
  } else if (typeof dependentFieldValue === 'string') {
    normalizedValue = dependentFieldValue.toLowerCase();
  }
  
  return normalizedValue === requiredValue;
};

/**
 * Validate if user can proceed from multi-field input step
 */
export const canProceedMultiField = (answer, multiFields) => {
  if (!answer || typeof answer !== 'object') return false;
  
  // Filter to only required fields that are currently visible
  const requiredFields = (multiFields || []).filter(field => {
    if (!field.is_required) return false;
    return isFieldVisible(field, answer);
  });
  
  // Check if all visible required fields are filled
  return requiredFields.every(field => {
    const value = answer[field.field_id];
    return value !== undefined && value !== null && value !== '';
  });
};