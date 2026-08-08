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
    // multi_field_input answers are objects; check known date field names first, then all values
    if (typeof val === 'object' && !Array.isArray(val)) {
      // Prefer fields whose key contains "date"
      const dateFieldKeys = Object.keys(val).filter(k => k.toLowerCase().includes('date'));
      for (const key of dateFieldKeys) {
        const d = normalizeDate(val[key]);
        if (d) return d;
      }
      // Fallback: scan all values
      for (const fieldVal of Object.values(val)) {
        const d = normalizeDate(fieldVal);
        if (d) return d;
      }
      return null;
    }
    // date_input or yes_no answer is a plain string
    // Handle "YES | Date requested: YYYY-MM-DD" composite format
    if (typeof val === 'string') {
      const pipeDateMatch = val.match(/(\d{4}-\d{2}-\d{2})/);
      if (pipeDateMatch) return pipeDateMatch[1];
    }
    return normalizeDate(val);
  };

  // Collect all candidate dates across all request steps, then return the most recent one.
  const candidateDates = [];

  for (const step of requestSteps) {
    const stepId = step.step_id;

    // 1. AccountClassification path: answerHistory is { stepId: [val_iter0, val_iter1, ...] }
    //    Collect ALL entries — we'll pick the most recent date at the end.
    if (answerHistory?.[stepId]?.length > 0) {
      for (const entry of answerHistory[stepId]) {
        const d = extractDate(entry);
        if (d) candidateDates.push(d);
      }
    }

    // 2. WorkflowRunner path: answers uses iteration keys — stepId, stepId__iter1, stepId__iter2 ...
    //    Collect dates from ALL iteration keys for this step.
    if (answers) {
      const allKeys = Object.keys(answers);
      const stepKeys = allKeys.filter(k => k === stepId || k.startsWith(`${stepId}__iter`));
      for (const key of stepKeys) {
        const d = extractDate(answers[key]);
        if (d) candidateDates.push(d);
      }
    }

    // 3. Also check the plain answers map (for AccountClassification which overwrites the key each loop)
    if (answers?.[stepId]) {
      const d = extractDate(answers[stepId]);
      if (d) candidateDates.push(d);
    }
  }

  // Return the LATEST (most recent) date found across all candidates
  if (candidateDates.length > 0) {
    candidateDates.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    return candidateDates[0];
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