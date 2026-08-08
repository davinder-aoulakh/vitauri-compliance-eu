/**
 * Utility functions for workflow validation logic
 */

/**
 * Resolves the most recent "date requested" value for self-certification.
 *
 * Search order (most-recent-first):
 *  1. answerHistory: the per-step array of answers accumulated across loop iterations.
 *     We scan every step whose title contains "request" and whose answer looks like a date string.
 *  2. Flat answers map (current-iteration answers).
 *  3. Fallback: account entity field `self_certification_request_date`.
 *
 * @param {Object} steps              - Array of workflow step definitions
 * @param {Object} answers            - Current flat answers map { stepId: value }
 * @param {Object} answerHistory      - Per-step history { stepId: [val1, val2, ...] }
 * @param {Object|null} accountData   - Account entity record (may have self_certification_request_date)
 * @returns {string|null}             - YYYY-MM-DD string or null if not found
 */
export const resolveRequestedDate = (steps, answers, answerHistory, accountData) => {
  if (!steps) return accountData?.self_certification_request_date || null;

  // Find all "request" steps (multi_field_input or date_input whose title includes "request")
  const requestSteps = steps.filter(s => {
    const title = (s.step_title || '').toLowerCase();
    return title.includes('request') && (
      s.question_type === 'multi_field_input' ||
      s.question_type === 'date_input'
    );
  });

  // Helper: extract a date string from a step answer value
  const extractDate = (val) => {
    if (!val) return null;
    // multi_field_input answers are objects; look for any field whose key or value looks like a date
    if (typeof val === 'object' && !Array.isArray(val)) {
      for (const fieldVal of Object.values(val)) {
        if (typeof fieldVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fieldVal)) return fieldVal;
      }
      return null;
    }
    // date_input answer is a plain string
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    return null;
  };

  // 1. Check answerHistory (last entry = most recent loop iteration)
  for (const step of requestSteps) {
    const history = answerHistory?.[step.step_id];
    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      const d = extractDate(latest);
      if (d) return d;
    }
  }

  // 2. Check flat answers map
  for (const step of requestSteps) {
    const d = extractDate(answers?.[step.step_id]);
    if (d) return d;
  }

  // 3. Fallback to account entity field
  return accountData?.self_certification_request_date || null;
};

/**
 * Validates the "Date Received" on a file_upload step.
 *
 * Rules:
 *  - Date received must not be a future date (> today).
 *  - If a requestedDate is known, date received must be >= requestedDate.
 *
 * @param {string} dateReceived   - YYYY-MM-DD value entered by the user
 * @param {string|null} requestedDate - YYYY-MM-DD of when self-cert was requested
 * @returns {{ valid: boolean, error: string|null }}
 */
export const validateDateReceived = (dateReceived, requestedDate) => {
  if (!dateReceived) return { valid: false, error: null }; // Missing — handled by required check elsewhere

  const today = new Date().toISOString().split('T')[0];

  if (dateReceived > today) {
    return { valid: false, error: 'Date received cannot be a future date.' };
  }

  if (requestedDate && dateReceived < requestedDate) {
    return {
      valid: false,
      error: `Date received (${dateReceived}) cannot be before the date the self-certification was requested (${requestedDate}).`,
    };
  }

  return { valid: true, error: null };
};

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