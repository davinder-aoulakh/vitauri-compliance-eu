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

  // For each request step, find the LATEST (most recent) iteration answer only.
  // This ensures that if the user is on loop 3, we show the date from loop 3 request,
  // not an older loop's date or a fallback entity field date.
  const candidateDates = [];

  for (const step of requestSteps) {
    const stepId = step.step_id;

    // 1. AccountClassification path: answerHistory is { stepId: [val_iter0, val_iter1, ...] }
    //    Use ONLY the LAST entry — the most recent iteration's requested date.
    if (answerHistory?.[stepId]?.length > 0) {
      const lastEntry = answerHistory[stepId][answerHistory[stepId].length - 1];
      const d = extractDate(lastEntry);
      if (d) candidateDates.push(d);
      // Don't also check answers keys below for this path — answerHistory is authoritative
      continue;
    }

    // 2. WorkflowRunner path: answers uses iteration keys — stepId, stepId__iter1, stepId__iter2 ...
    //    Find the key with the HIGHEST iteration index (latest answer).
    if (answers) {
      const allKeys = Object.keys(answers);
      const stepKeys = allKeys.filter(k => k === stepId || k.startsWith(`${stepId}__iter`));
      if (stepKeys.length > 0) {
        // Sort by iteration index: base key (iter0) < __iter1 < __iter2 ...
        stepKeys.sort((a, b) => {
          const idxA = a.includes('__iter') ? parseInt(a.split('__iter')[1], 10) : 0;
          const idxB = b.includes('__iter') ? parseInt(b.split('__iter')[1], 10) : 0;
          return idxB - idxA; // descending — highest index first
        });
        // Use the latest iteration key's value
        const d = extractDate(answers[stepKeys[0]]);
        if (d) candidateDates.push(d);
      }
    }
  }

  // Return the LATEST (most recent) date found across all request steps
  if (candidateDates.length > 0) {
    candidateDates.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    return candidateDates[0];
  }

  // Fallback to account entity field only when NO workflow answer exists at all
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
 * Returns true if a workflow step is a self-certification request step.
 * Matches titles containing "request" AND ("self" OR "cert") — avoids false
 * matches like "Request death certificate".
 *
 * @param {Object} step - Workflow step definition
 * @returns {boolean}
 */
export const isSelfCertRequestStep = (step) => {
  const title = (step?.step_title || '').toLowerCase();
  return (
    title.includes('request') &&
    (title.includes('self') || title.includes('cert')) &&
    step.question_type === 'multi_field_input'
  );
};

/**
 * Computes a fieldMinDates map for a self-cert request step's date sub-fields.
 * The min is the latest previously-requested date (from prior answers/history),
 * so the date picker disables dates before that value.
 *
 * For the very first request there are no prior answers, so all mins are undefined.
 *
 * @param {Object} step                    - Current multi_field_input step definition
 * @param {Array}  allSteps                - All workflow step definitions
 * @param {Object} answers                 - Current answers map (WorkflowRunner path)
 * @param {Object} answerHistory           - Per-step history (AccountClassification path)
 * @param {Object|null} accountData        - Account or ControllingPerson entity record
 * @param {number} currentIterationIndex   - 0-based index of the CURRENT visit to this step
 *                                           (= history.filter(id => id === step.step_id).length)
 * @returns {Object}                       - { [field_id]: "YYYY-MM-DD" | undefined }
 */
export const computeSelfCertFieldMinDates = (step, allSteps, answers, answerHistory, accountData, currentIterationIndex = 0) => {
  if (!isSelfCertRequestStep(step)) return {};

  // ── WorkflowRunner path (answers uses __iter keys) ──────────────────────────
  // Only remove the CURRENT iteration's key; keep all prior __iter keys intact.
  const answersWithoutCurrentStep = { ...answers };
  const currentAnswerKey = currentIterationIndex > 0
    ? `${step.step_id}__iter${currentIterationIndex}`
    : step.step_id;
  delete answersWithoutCurrentStep[currentAnswerKey];

  // ── AccountClassification path (answerHistory[stepId] = array of iterations) ─
  // Slice to keep ONLY prior iterations (indices 0 … currentIterationIndex-1).
  // This way, iteration N sees the date from iteration N-1 as the minimum,
  // and doesn't accidentally see its own in-progress (unsaved) value.
  const historyWithoutCurrentStep = answerHistory ? { ...answerHistory } : null;
  if (historyWithoutCurrentStep && Array.isArray(historyWithoutCurrentStep[step.step_id])) {
    const priorIterations = historyWithoutCurrentStep[step.step_id].slice(0, currentIterationIndex);
    if (priorIterations.length > 0) {
      historyWithoutCurrentStep[step.step_id] = priorIterations;
    } else {
      delete historyWithoutCurrentStep[step.step_id];
    }
  }

  const latestRequestedDate = resolveRequestedDate(
    allSteps,
    answersWithoutCurrentStep,
    historyWithoutCurrentStep,
    accountData
  );

  if (!latestRequestedDate) return {}; // First request — no min

  // Apply the min to all date sub-fields in this step
  const map = {};
  (step.multi_fields || []).forEach(field => {
    if (field.field_type === 'date') {
      map[field.field_id] = latestRequestedDate;
    }
  });
  return map;
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