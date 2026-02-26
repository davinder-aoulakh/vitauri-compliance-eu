/**
 * Helper function to determine if user can proceed from current workflow step
 */
export const canProceedFromStep = (currentStep, answer) => {
  if (currentStep.question_type === 'info' || currentStep.question_type === 'result') {
    return true;
  }
  if (!currentStep.required) {
    return true;
  }
  
  if (currentStep.question_type === 'address_input') {
    if (!answer || typeof answer !== 'object') return false;
    return !!(answer.street && answer.city && answer.state && answer.postal_code && answer.country);
  }

  // Special validation for file_upload with date_received
  if (currentStep.question_type === 'file_upload') {
    const fileConfig = currentStep.file_upload_config || {};
    const requireDateReceived = fileConfig.require_date_received || false;
    
    if (!answer) return false;
    
    // Handle both old format (array) and new format (object with files + date_received)
    const files = answer.files || answer;
    const hasFiles = Array.isArray(files) && files.length > 0;
    
    if (!hasFiles) return false;
    
    // If date is required, check it exists and is not empty
    if (requireDateReceived) {
      return !!(answer.date_received && answer.date_received.trim());
    }
    
    return true;
  }

  if (currentStep.question_type === 'beneficiary_input') {
    return answer?.savedBeneficiaries && answer.savedBeneficiaries.length > 0;
  }

  if (currentStep.question_type === 'controlling_person_input') {
    return answer?.savedPersons && answer.savedPersons.length > 0;
  }

  if (currentStep.question_type === 'multi_field_input') {
    if (!answer || typeof answer !== 'object') return false;
    
    // Filter to only required fields that are currently visible
    const requiredFields = (currentStep.multi_fields || []).filter(field => {
      if (!field.is_required) return false;
      
      // Check conditional visibility
      if (!field.conditional_visibility) return true;
      
      const dependsOnField = field.conditional_visibility.depends_on_field;
      const requiredValue = field.conditional_visibility.required_value?.toLowerCase();
      const dependentFieldValue = answer[dependsOnField];
      
      // Normalize boolean values
      let normalizedValue = dependentFieldValue;
      if (typeof dependentFieldValue === 'boolean') {
        normalizedValue = dependentFieldValue ? 'yes' : 'no';
      } else if (typeof dependentFieldValue === 'string') {
        normalizedValue = dependentFieldValue.toLowerCase();
      }
      
      // Only include this field if its visibility condition is met
      return normalizedValue === requiredValue;
    });
    
    // Check if all visible required fields are filled
    return requiredFields.every(field => {
      const value = answer[field.field_id];
      return value !== undefined && value !== null && value !== '';
    });
  }
  
  return answer !== undefined && answer !== null && answer !== '';
};