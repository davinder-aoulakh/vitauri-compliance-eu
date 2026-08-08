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

  // Helper: normalize any date string to YYYY-MM-DD, or return null if not a date
  const normalizeDate = (str) => {
    if (!str || typeof str !== 'string') return null;
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    // MM/DD/YYYY
    const mdyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`;
    return null;
  };

  // Helper: extract a date string from a step answer value
  const extractDate = (val) => {
    if (!val) return null;
    // multi_field_input answers are objects; look for any date-like field value
    if (typeof val === 'object' && !Array.isArray(val)) {
      for (const fieldVal of Object.values(val)) {
        const d = normalizeDate(fieldVal);
        if (d) return d;
      }
      return null;
    }
    // date_input answer is a plain string
    return normalizeDate(val);
  };

  for (const step of requestSteps) {
    const stepId = step.step_id;

    // 1. AccountClassification path: answerHistory is { stepId: [val_iter0, val_iter1, ...] }
    //    The LAST entry is always the most recent loop iteration.
    if (answerHistory?.[stepId]?.length > 0) {
      const latest = answerHistory[stepId][answerHistory[stepId].length - 1];
      const d = extractDate(latest);
      if (d) return d;
    }

    // 2. WorkflowRunner path: answers uses iteration keys — stepId, stepId__iter1, stepId__iter2 ...
    //    Find ALL keys belonging to this step and pick the one with the highest iteration number
    //    (that is the answer from the current/most-recent loop).
    if (answers) {
      const allKeys = Object.keys(answers);
      const stepKeys = allKeys.filter(k => k === stepId || k.startsWith(`${stepId}__iter`));
      if (stepKeys.length > 0) {
        // Sort by iteration number descending: bare key = iter0, __iter1 = iter1, etc.
        const getIterNum = (k) => {
          const m = k.match(/__iter(\d+)$/);
          return m ? parseInt(m[1], 10) : 0;
        };
        stepKeys.sort((a, b) => getIterNum(b) - getIterNum(a));
        const latestKey = stepKeys[0];
        const d = extractDate(answers[latestKey]);
        if (d) return d;
      }
    }
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