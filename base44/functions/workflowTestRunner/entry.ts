/**
 * Automated Workflow Test Runner
 * Traverses all possible paths through a workflow and generates a PDF test report.
 * Does NOT touch runAutoClassification.js.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SYNTHETIC_ANSWERS = {
  yes_no: ['YES', 'NO'],
  text_input: ['Test Value'],
  number_input: [1000],
  date_input: ['2025-01-01'],
  address_input: [{
    street: '123 Test Street', city: 'Test City', state: 'Test State',
    postal_code: '12345', country: 'Netherlands'
  }],
  file_upload: [{ file_url: 'https://example.com/test.pdf', file_name: 'test.pdf', file_size: 1024, date_received: '2025-01-01' }],
  multi_field_input: null, // built dynamically
  beneficiary_input: [{ savedBeneficiaries: [{ first_name: 'Test', last_name: 'Beneficiary' }] }],
  controlling_person_input: [{ savedPersons: [{ first_name: 'Test', last_name: 'Person' }] }],
  info: [null],
  result: [null],
};

function buildMultiFieldAnswers(step) {
  // Generate both boolean variants (true/false) if any boolean fields exist
  // to cover both branches of conditional logic
  const hasBooleans = (step.multi_fields || []).some(f => f.field_type === 'boolean');
  const buildAnswer = (boolVal) => {
    const answer = {};
    for (const field of (step.multi_fields || [])) {
      switch (field.field_type) {
        case 'boolean': answer[field.field_id] = boolVal; break;
        case 'number': answer[field.field_id] = 100; break;
        case 'date': answer[field.field_id] = '2025-01-01'; break;
        case 'select': answer[field.field_id] = field.options?.[0]?.value || 'option1'; break;
        default: answer[field.field_id] = 'Test Value';
      }
    }
    return answer;
  };
  if (hasBooleans) return [buildAnswer(true), buildAnswer(false)];
  return [buildAnswer(true)];
}

function getSyntheticAnswers(step) {
  if (step.question_type === 'single_choice' || step.question_type === 'yes_no') {
    return step.options?.length > 0 ? step.options.map(o => o.value) : ['YES', 'NO'];
  }
  if (step.question_type === 'multiple_choice') {
    // Generate all non-empty subsets (max 8 options to prevent explosion)
    const opts = (step.options || []).slice(0, 4).map(o => o.value);
    const subsets = [];
    for (let i = 1; i < (1 << opts.length); i++) {
      const subset = opts.filter((_, j) => i & (1 << j));
      subsets.push(subset);
    }
    return subsets.length > 0 ? subsets : [['OPT1']];
  }
  if (step.question_type === 'multi_field_input') {
    return buildMultiFieldAnswers(step);
  }
  return SYNTHETIC_ANSWERS[step.question_type] || ['Test Value'];
}

// Resolve next step based on the current step definition and answer given
function resolveNextStep(step, answer, allAnswers) {
  const logic = step.conditional_logic;

  // --- result / info types: no next step ---
  if (step.question_type === 'result') return null;

  // --- default_next_step for simple input types ---
  if (['text_input','number_input','date_input','file_upload','address_input','beneficiary_input','controlling_person_input'].includes(step.question_type)) {
    return (step.default_next_step && step.default_next_step.trim() !== '') ? step.default_next_step : null;
  }

  // --- multi_field_input: check conditions, fall back to default_next_step ---
  if (step.question_type === 'multi_field_input') {
    if (logic?.conditions?.length > 0) {
      let met = true;
      for (const cond of logic.conditions) {
        const fv = resolveFieldValue(cond.field, allAnswers);
        const condMet = evalStrOp(cond.operator, fv, cond.value);
        if (cond.logic_operator === 'OR' && condMet) { met = true; break; }
        if (cond.logic_operator === 'AND' && !condMet) { met = false; break; }
        met = condMet;
      }
      return met ? (logic.next_step || step.default_next_step || null) : (logic.else_step || step.default_next_step || null);
    }
    return step.default_next_step || null;
  }

  if (!logic) {
    // Use option's next_step
    if (step.options) {
      const opt = step.options.find(o => o.value === answer || (Array.isArray(answer) && answer.includes(o.value)));
      if (opt?.next_step && opt.next_step.trim() !== '') return opt.next_step;
    }
    return null;
  }

  // --- selection_count routing (top priority for multiple_choice) ---
  if (logic.use_selection_count && logic.selection_count_value != null) {
    const count = Array.isArray(answer) ? answer.length : 1;
    // operator may be null — treat null as '='
    const op = logic.selection_count_operator || '=';
    const met = evalNumOp(op, count, logic.selection_count_value);
    return met ? (logic.selection_count_next_step || null) : (logic.selection_count_else_step || null);
  }

  // --- option_values routing ---
  if (logic.option_values?.length > 0) {
    const selectedOptions = Array.isArray(answer) ? answer : [answer];
    const hasMatch = logic.option_values.some(v => selectedOptions.includes(v));
    if (hasMatch) return logic.option_values_next_step || null;
    if (logic.option_values_else_step) return logic.option_values_else_step;
  }

  // --- multi_choice_routing_groups ---
  if (logic.multi_choice_routing_groups?.length > 0) {
    const selectedOptions = Array.isArray(answer) ? answer : [answer];
    for (const group of logic.multi_choice_routing_groups) {
      let groupMet = group.group_operator === 'AND';
      for (const cond of (group.conditions || [])) {
        let condMet = false;
        if (cond.condition_type === 'selected_options') {
          const hasAny = (cond.option_values || []).some(v => selectedOptions.includes(v));
          condMet = hasAny;
        } else if (cond.condition_type === 'selection_count') {
          const count = selectedOptions.length;
          condMet = evalNumOp(cond.count_operator, count, cond.count_value);
        } else if (cond.condition_type === 'field_comparison') {
          const fv = allAnswers[cond.field];
          condMet = evalStrOp(cond.operator, fv, cond.value);
        }
        if (group.group_operator === 'AND') groupMet = groupMet && condMet;
        else groupMet = groupMet || condMet;
      }
      if (groupMet && group.next_step) return group.next_step;
    }
    return logic.multi_choice_default_step || null;
  }

  // --- trigger-based condition_groups / simple conditions ---
  // The trigger_field/trigger_value check gates whether the conditional_logic block fires.
  // If the trigger doesn't match, skip the conditional_logic and fall through to option next_step.
  let triggerMatches = true;
  if (logic.trigger_field && logic.trigger_value) {
    const triggerAnswer = allAnswers[logic.trigger_field];
    if (String(triggerAnswer) !== String(logic.trigger_value)) {
      triggerMatches = false;
    }
  }

  if (!triggerMatches) {
    // Trigger didn't fire — use option's next_step directly
    if (step.options) {
      const selectedOptions = Array.isArray(answer) ? answer : [answer];
      for (const v of selectedOptions) {
        const opt = step.options.find(o => o.value === v);
        if (opt?.next_step && typeof opt.next_step === 'string' && opt.next_step.trim() !== '') {
          return opt.next_step;
        }
      }
    }
    return null;
  }

  // condition_groups
  if (logic.condition_groups?.length > 0) {
    const groupResults = logic.condition_groups.map(group => {
      let result = group.group_operator === 'AND';
      for (const cond of (group.conditions || [])) {
        const fv = resolveFieldValue(cond.field, allAnswers);
        const met = evalStrOp(cond.operator, fv, cond.value);
        result = group.group_operator === 'AND' ? result && met : result || met;
      }
      return { group, result };
    });

    if (logic.overall_logic_operator === 'OR') {
      const firstTrue = groupResults.find(r => r.result);
      if (firstTrue) return firstTrue.group.true_step;
      return logic.overall_false_step || null;
    } else {
      const allTrue = groupResults.every(r => r.result);
      return allTrue ? (logic.overall_true_step || null) : (logic.overall_false_step || null);
    }
  }

  // simple conditions
  if (logic.conditions?.length > 0) {
    let met = true;
    for (const cond of logic.conditions) {
      const fv = resolveFieldValue(cond.field, allAnswers);
      const condMet = evalStrOp(cond.operator, fv, cond.value);
      if (cond.logic_operator === 'OR' && condMet) { met = true; break; }
      if (cond.logic_operator === 'AND' && !condMet) { met = false; break; }
      met = condMet;
    }
    return met ? (logic.next_step || null) : (logic.else_step || null);
  }

  // fall back to option's next_step
  if (step.options) {
    const selectedOptions = Array.isArray(answer) ? answer : [answer];
    for (const v of selectedOptions) {
      const opt = step.options.find(o => o.value === v);
      // Use next_step if it's a non-empty string
      if (opt?.next_step && typeof opt.next_step === 'string' && opt.next_step.trim() !== '') {
        return opt.next_step;
      }
    }
  }
  return (logic.next_step && logic.next_step.trim() !== '' ? logic.next_step : null)
      || (logic.else_step && logic.else_step.trim() !== '' ? logic.else_step : null)
      || null;
}

function resolveFieldValue(fieldPath, allAnswers) {
  if (!fieldPath) return undefined;
  if (allAnswers[fieldPath] !== undefined) return allAnswers[fieldPath];
  const parts = fieldPath.split('.');
  if (parts.length === 2) {
    const stepAns = allAnswers[parts[0]];
    if (stepAns && typeof stepAns === 'object') return stepAns[parts[1]];
  }
  // Search inside multi_field_input answers (stored as objects keyed by step_id)
  // e.g. field_1778482819636 may be nested inside allAnswers["step_1778482806746"]
  for (const val of Object.values(allAnswers)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && val[fieldPath] !== undefined) {
      return val[fieldPath];
    }
  }
  return undefined;
}

function evalNumOp(op, a, b) {
  switch (op) {
    case '=': case '==': return Number(a) === Number(b);
    case '!=': return Number(a) !== Number(b);
    case '>': return Number(a) > Number(b);
    case '>=': return Number(a) >= Number(b);
    case '<': return Number(a) < Number(b);
    case '<=': return Number(a) <= Number(b);
    default: return false;
  }
}

function evalStrOp(op, fieldValue, compValue) {
  // Normalize booleans so true matches 'true'
  const fv = String(fieldValue === true ? 'true' : fieldValue === false ? 'false' : (fieldValue || '')).toLowerCase().trim();
  const cv = String(compValue || '').toLowerCase().trim();
  switch (op) {
    case '=': case '==': return fv === cv;
    case '!=': return fv !== cv;
    case 'contains': return fv.includes(cv);
    case 'in': return cv.split(',').map(v => v.trim()).includes(fv);
    case 'not_in': return !cv.split(',').map(v => v.trim()).includes(fv);
    default: return false;
  }
}

// ─── Path Traversal ──────────────────────────────────────────────────────────

function traverseAllPaths(workflow) {
  const stepMap = {};
  for (const step of workflow.steps) stepMap[step.step_id] = step;

  const allPaths = [];
  const MAX_PATHS = 200;
  const MAX_DEPTH = 30;

  function dfs(stepId, currentPath, currentAnswers, visitedInPath = new Set()) {
    if (allPaths.length >= MAX_PATHS) return;
    if (currentPath.length > MAX_DEPTH) return;
    if (!stepId) return;

    const step = stepMap[stepId];
    if (!step) return;

    // Cycle detection: if this step was already visited in the current path
    if (visitedInPath.has(stepId)) {
      // Annotate the last step in the current path with which step the loop returns to
      const pathWithLoop = [...currentPath];
      if (pathWithLoop.length > 0) {
        pathWithLoop[pathWithLoop.length - 1] = {
          ...pathWithLoop[pathWithLoop.length - 1],
          loopsBackTo: stepId,
          loopsBackToTitle: stepMap[stepId]?.step_title || stepId
        };
      }
      allPaths.push({
        steps: pathWithLoop,
        finalStatus: 'cycle_detected',
        answers: { ...currentAnswers }
      });
      return;
    }

    const possibleAnswers = getSyntheticAnswers(step);

    // For result / info steps → record the path as complete
    if (step.question_type === 'result') {
      allPaths.push({
        steps: [...currentPath, { stepId, stepTitle: step.step_title, answer: null, questionType: step.question_type, resultStatus: step.result_status, resultDescription: step.result_description }],
        finalStatus: step.result_status || 'unknown',
        answers: { ...currentAnswers }
      });
      return;
    }

    const newVisited = new Set(visitedInPath);
    newVisited.add(stepId);

    if (step.question_type === 'info') {
      const nextStep = step.default_next_step || (step.options?.[0]?.next_step);
      const pathEntry = { stepId, stepTitle: step.step_title, answer: null, questionType: step.question_type };
      dfs(nextStep, [...currentPath, pathEntry], { ...currentAnswers }, newVisited);
      return;
    }

    for (const answer of possibleAnswers) {
      const updatedAnswers = { ...currentAnswers, [stepId]: answer };
      const nextStepId = resolveNextStep(step, answer, updatedAnswers);
      const pathEntry = {
        stepId,
        stepTitle: step.step_title,
        questionText: step.question_text,
        questionType: step.question_type,
        answer,
        options: step.options,
        nextStepId
      };

      if (!nextStepId) {
        allPaths.push({
          steps: [...currentPath, pathEntry],
          finalStatus: 'terminal',
          answers: updatedAnswers
        });
      } else if (!stepMap[nextStepId]) {
        // Next step ID referenced but not found in workflow — missing step
        allPaths.push({
          steps: [...currentPath, { ...pathEntry, missingNextStep: nextStepId }],
          finalStatus: 'missing_step',
          answers: updatedAnswers
        });
      } else {
        dfs(nextStepId, [...currentPath, pathEntry], updatedAnswers, newVisited);
      }
    }
  }

  // Start from first step
  const firstStep = workflow.steps[0];
  if (firstStep) dfs(firstStep.step_id, [], {});

  return allPaths;
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

function formatAnswer(answer, step) {
  if (answer === null || answer === undefined) return '—';
  if (Array.isArray(answer)) {
    return answer.map(v => {
      const opt = step?.options?.find(o => o.value === v);
      return opt ? opt.label : String(v);
    }).join(', ');
  }
  if (typeof answer === 'object') {
    if (answer.file_name) return `File: ${answer.file_name}`;
    if (answer.street) return `${answer.street}, ${answer.city}, ${answer.country}`;
    return Object.entries(answer).map(([k, v]) => `${k}: ${v}`).join(' | ');
  }
  const opt = step?.options?.find(o => o.value === String(answer));
  return opt ? opt.label : String(answer);
}

function formatAccountField(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (value.street) return [value.street, value.city, value.state, value.country].filter(Boolean).join(', ');
    return JSON.stringify(value);
  }
  return String(value);
}

function generatePDF(paths, workflowName, tenantId, accountId, accountReplay, accountData) {
  // Landscape A3 for wide horizontal test script layout
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageW = 420;
  const pageH = 297;
  const margin = 10;

  const STATUS_COLORS = {
    reportable: [220, 38, 38],
    non_reportable: [22, 163, 74],
    pending_review: [202, 138, 4],
    excluded: [107, 114, 128],
    terminal: [100, 116, 139],
    cycle_detected: [234, 88, 12],
    missing_step: [124, 58, 237],
    unknown: [100, 116, 139]
  };

  const STATUS_BG = {
    reportable: [254, 226, 226],
    non_reportable: [220, 252, 231],
    pending_review: [254, 249, 195],
    excluded: [243, 244, 246],
    terminal: [241, 245, 249],
    cycle_detected: [255, 237, 213],
    missing_step: [237, 233, 254],
    unknown: [241, 245, 249]
  };

  // ── Page 1: Account Info + Summary ──────────────────────────────────────────
  let y = margin;

  // Header banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Workflow Test Script Execution Report', margin, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`, pageW - margin, 12, { align: 'right' });
  y = 22;

  // Workflow info row
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, pageW - margin * 2, 10, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('WORKFLOW', margin + 3, y + 4);
  doc.text('TENANT', margin + 120, y + 4);
  doc.text('TOTAL PATHS', margin + 240, y + 4);
  doc.text('ACCOUNT', margin + 320, y + 4);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const wfNameTrunc = workflowName.length > 60 ? workflowName.substring(0, 57) + '...' : workflowName;
  doc.text(wfNameTrunc, margin + 3, y + 9);
  doc.text(tenantId, margin + 120, y + 9);
  doc.text(String(paths.length), margin + 240, y + 9);
  doc.text(accountId || 'N/A', margin + 320, y + 9);
  y += 14;

  // ── Account Data Header Card ─────────────────────────────────────────────
  if (accountData) {
    const cardX = margin;
    const cardY = y;
    const cardW = pageW - margin * 2;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(cardX, cardY, cardW, 6, 1, 1, 'F');
    doc.setFillColor(70, 79, 235);
    doc.rect(cardX, cardY, cardW, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCOUNT DETAILS', cardX + 4, cardY + 4.5);
    y += 7;

    // Two rows of account fields
    const addrCurrent = accountData.current_address || accountData.account_holder_address;
    const addrOriginal = accountData.account_holder_address || accountData.current_address;
    const isPreExisting = accountData.is_pre_existing === true ? 'Pre-Existing' : accountData.is_pre_existing === false ? 'New' : '—';
    const balance = accountData.year_end_cash_value;
    const valueThreshold = balance !== undefined && balance !== null
      ? (Number(balance) >= 1000000 ? 'High Value (≥1M)' : 'Low Value (<1M)')
      : '—';

    const accountFields = [
      { label: 'Account Holder', value: accountData.account_holder_name || [accountData.first_name, accountData.last_name].filter(Boolean).join(' ') || '—' },
      { label: 'Account Number', value: accountData.account_number || '—' },
      { label: 'Account Type', value: accountData.account_type ? accountData.account_type.replace(/_/g, ' ') : '—' },
      { label: 'Pre-Existing / New', value: isPreExisting },
      { label: 'Value Category', value: valueThreshold },
      { label: 'Year End Balance', value: balance !== undefined && balance !== null ? `${accountData.year_end_cash_value_currency || ''} ${Number(balance).toLocaleString()}`.trim() : '—' },
      { label: 'Holder Type', value: accountData.account_holder_type || '—' },
      { label: 'Reportability Status', value: accountData.reportability_status ? accountData.reportability_status.replace(/_/g, ' ') : '—' },
      { label: 'Current Address', value: formatAccountField(addrCurrent) },
      { label: 'Original/Holder Address', value: formatAccountField(addrOriginal) },
    ];

    const fieldsPerRow = 5;
    const rows = [accountFields.slice(0, fieldsPerRow), accountFields.slice(fieldsPerRow)];
    const colW2 = cardW / fieldsPerRow;

    rows.forEach((rowFields, rowIdx) => {
      const rowY = y + rowIdx * 14;
      rowFields.forEach((field, colIdx) => {
        const fx = cardX + colIdx * colW2;
        const fy = rowY;
        doc.setFillColor(rowIdx % 2 === 0 ? 241 : 248, rowIdx % 2 === 0 ? 245 : 250, rowIdx % 2 === 0 ? 249 : 252);
        doc.rect(fx, fy, colW2 - 1, 13, 'F');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(field.label.toUpperCase(), fx + 2, fy + 4);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        const valTrunc = field.value.length > 38 ? field.value.substring(0, 35) + '...' : field.value;
        doc.text(valTrunc, fx + 2, fy + 10);
      });
    });

    y += rows.length * 14 + 5;
  }

  // ── Outcome summary pills ────────────────────────────────────────────────
  const counts = {};
  paths.forEach(p => { counts[p.finalStatus] = (counts[p.finalStatus] || 0) + 1; });
  const summaryEntries = Object.entries(counts);
  const pillW = 50;
  summaryEntries.forEach(([status, count], i) => {
    const px = margin + i * (pillW + 3);
    const bg = STATUS_BG[status] || STATUS_BG.unknown;
    const fg = STATUS_COLORS[status] || STATUS_COLORS.unknown;
    doc.setFillColor(...bg);
    doc.roundedRect(px, y, pillW, 10, 1.5, 1.5, 'F');
    doc.setTextColor(...fg);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(String(count), px + pillW / 2, y + 5.5, { align: 'center' });
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(status.replace(/_/g, ' ').toUpperCase(), px + pillW / 2, y + 9.5, { align: 'center' });
  });
  y += 14;

  // ── Page 2+: Horizontal Test Script Matrix ─────────────────────────────────
  // Collect all unique step IDs in order they appear across paths
  const stepOrder = [];
  const stepTitleMap = {};
  for (const path of paths) {
    for (const s of path.steps) {
      if (!stepOrder.includes(s.stepId)) {
        stepOrder.push(s.stepId);
        stepTitleMap[s.stepId] = s.stepTitle || s.stepId;
      }
    }
  }

  // Fixed columns: Test Case# | Outcome | Steps Count | then one per step
  const fixedCols = [
    { key: 'tc', label: 'Test\nCase', width: 14 },
    { key: 'outcome', label: 'Outcome', width: 28 },
    { key: 'steps', label: 'Steps\nCount', width: 14 },
  ];

  // Dynamic step columns — truncate title for header
  const stepCols = stepOrder.map(stepId => ({
    key: stepId,
    label: stepTitleMap[stepId],
    width: 28
  }));

  const allCols = [...fixedCols, ...stepCols];
  const totalTableW = allCols.reduce((sum, c) => sum + c.width, 0);

  // How many step-columns fit per page
  const pageContentW = pageW - margin * 2;
  const fixedW = fixedCols.reduce((sum, c) => sum + c.width, 0);
  const stepColsPerPage = Math.floor((pageContentW - fixedW) / 28);

  const rowH = 10; // height per data row
  const headerH = 16; // header row height (two lines for step title)

  // Chunk step columns into pages
  const stepChunks = [];
  for (let i = 0; i < stepCols.length; i += stepColsPerPage) {
    stepChunks.push(stepCols.slice(i, i + stepColsPerPage));
  }
  if (stepChunks.length === 0) stepChunks.push([]);

  stepChunks.forEach((chunkCols, chunkIdx) => {
    doc.addPage();
    let py = margin;

    // Mini header on each page
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${workflowName}  —  Test Script Matrix`, margin, 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${chunkIdx + 2}  ·  Steps ${chunkIdx * stepColsPerPage + 1}–${Math.min((chunkIdx + 1) * stepColsPerPage, stepCols.length)} of ${stepCols.length}`, pageW - margin, 7, { align: 'right' });
    py = 14;

    const pageCols = [...fixedCols, ...chunkCols];
    let cx = margin;

    // Column headers
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, py, pageCols.reduce((s, c) => s + c.width, 0), headerH, 'F');
    cx = margin;
    pageCols.forEach((col, ci) => {
      // Separator
      if (ci > 0) {
        doc.setDrawColor(71, 85, 105);
        doc.setLineWidth(0.3);
        doc.line(cx, py, cx, py + headerH);
      }
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');

      // Column number (step index)
      if (col.key !== 'tc' && col.key !== 'outcome' && col.key !== 'steps') {
        const stepIdx = stepOrder.indexOf(col.key);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(5.5);
        doc.text(`STEP ${stepIdx + 1}`, cx + col.width / 2, py + 4.5, { align: 'center' });
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
      } else {
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(5.5);
        doc.text(' ', cx + col.width / 2, py + 4.5, { align: 'center' });
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
      }

      // Title lines (wrap at column width)
      const titleLines = doc.splitTextToSize(col.label, col.width - 3);
      const maxLines = 2;
      titleLines.slice(0, maxLines).forEach((line, li) => {
        doc.text(line, cx + col.width / 2, py + 8 + li * 4, { align: 'center' });
      });
      cx += col.width;
    });
    py += headerH;

    // Draw each path as a row
    paths.forEach((path, pathIdx) => {
      const rowY = py;

      // Check if we need a new page
      if (rowY + rowH > pageH - 10) {
        doc.addPage();
        py = margin + 4;
        // Reprint headers
        doc.setFillColor(30, 41, 59);
        doc.rect(margin, py, pageCols.reduce((s, c) => s + c.width, 0), headerH, 'F');
        cx = margin;
        pageCols.forEach((col, ci) => {
          if (ci > 0) { doc.setDrawColor(71, 85, 105); doc.setLineWidth(0.3); doc.line(cx, py, cx, py + headerH); }
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          const titleLines = doc.splitTextToSize(col.label, col.width - 3);
          titleLines.slice(0, 2).forEach((line, li) => {
            doc.text(line, cx + col.width / 2, py + 8 + li * 4, { align: 'center' });
          });
          cx += col.width;
        });
        py += headerH;
      }

      const status = path.finalStatus || 'unknown';
      const resultStep = path.steps.find(s => s.questionType === 'result' || s.resultStatus);
      const outcomeStatus = resultStep?.resultStatus || status;
      const rowColor = STATUS_COLORS[outcomeStatus] || STATUS_COLORS.unknown;
      const rowBg = STATUS_BG[outcomeStatus] || STATUS_BG.unknown;

      // Alternate row background
      const baseRowBg = pathIdx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];

      cx = margin;
      pageCols.forEach((col, ci) => {
        // Cell background
        if (col.key === 'outcome') {
          doc.setFillColor(...rowBg);
        } else {
          doc.setFillColor(...baseRowBg);
        }
        doc.rect(cx, rowY, col.width, rowH, 'F');

        // Cell border
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.rect(cx, rowY, col.width, rowH, 'S');

        // Cell content
        if (col.key === 'tc') {
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.text(`TC${String(pathIdx + 1).padStart(3, '0')}`, cx + col.width / 2, rowY + 6.5, { align: 'center' });
        } else if (col.key === 'outcome') {
          doc.setTextColor(...rowColor);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          const outcomeLabel = outcomeStatus.replace(/_/g, ' ').toUpperCase();
          const outLines = doc.splitTextToSize(outcomeLabel, col.width - 3);
          outLines.slice(0, 2).forEach((line, li) => {
            doc.text(line, cx + col.width / 2, rowY + 4 + li * 4, { align: 'center' });
          });
        } else if (col.key === 'steps') {
          doc.setTextColor(71, 85, 105);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(String(path.steps.length), cx + col.width / 2, rowY + 6.5, { align: 'center' });
        } else {
          // Step answer cell
          const pathStep = path.steps.find(s => s.stepId === col.key);
          if (!pathStep) {
            // Step not visited in this path — grey N/A
            doc.setFillColor(245, 245, 245);
            doc.rect(cx + 0.5, rowY + 0.5, col.width - 1, rowH - 1, 'F');
            doc.setTextColor(200, 200, 200);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'italic');
            doc.text('—', cx + col.width / 2, rowY + 6.5, { align: 'center' });
          } else if (pathStep.questionType === 'result' || pathStep.resultStatus) {
            // Result step
            doc.setFillColor(...rowBg);
            doc.rect(cx + 0.5, rowY + 0.5, col.width - 1, rowH - 1, 'F');
            doc.setTextColor(...rowColor);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            const rsLabel = (pathStep.resultStatus || 'RESULT').replace(/_/g, ' ').toUpperCase();
            const rsLines = doc.splitTextToSize(rsLabel, col.width - 3);
            rsLines.slice(0, 2).forEach((line, li) => {
              doc.text(line, cx + col.width / 2, rowY + 4 + li * 3.5, { align: 'center' });
            });
          } else if (pathStep.loopsBackTo) {
            doc.setTextColor(234, 88, 12);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'italic');
            doc.text('↩ LOOP', cx + col.width / 2, rowY + 6.5, { align: 'center' });
          } else if (pathStep.missingNextStep) {
            doc.setTextColor(124, 58, 237);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('⚠ MISSING', cx + col.width / 2, rowY + 6.5, { align: 'center' });
          } else {
            const answerText = formatAnswer(pathStep.answer, pathStep);
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            const truncAns = answerText.length > 18 ? answerText.substring(0, 16) + '…' : answerText;
            doc.text(truncAns, cx + col.width / 2, rowY + 6.5, { align: 'center' });
          }
        }

        cx += col.width;
      });

      py += rowH;
    });
  });

  // ── Page footers ──────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(241, 245, 249);
    doc.rect(0, pageH - 8, pageW, 8, 'F');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Workflow Test Script Execution Report  ·  ${workflowName}  ·  Page ${i} of ${pageCount}`, pageW / 2, pageH - 3, { align: 'center' });
  }

  return doc;
}

// ─── Account Replay ──────────────────────────────────────────────────────────

function replayAccountPath(workflow, classificationAnswers) {
  if (!classificationAnswers || Object.keys(classificationAnswers).length === 0) return null;

  const stepMap = {};
  for (const step of workflow.steps) stepMap[step.step_id] = step;

  const replaySteps = [];
  const firstStep = workflow.steps[0];
  if (!firstStep) return null;

  let currentStepId = firstStep.step_id;
  const visited = new Set();
  let finalStatus = 'terminal';
  let finalResultStatus = null;
  let finalResultDescription = null;

  while (currentStepId && replaySteps.length < 50) {
    if (visited.has(currentStepId)) {
      finalStatus = 'cycle_detected';
      break;
    }
    const step = stepMap[currentStepId];
    if (!step) {
      finalStatus = 'missing_step';
      break;
    }

    visited.add(currentStepId);

    if (step.question_type === 'result') {
      finalStatus = step.result_status || 'unknown';
      finalResultStatus = step.result_status;
      finalResultDescription = step.result_description;
      replaySteps.push({ stepId: currentStepId, stepTitle: step.step_title, questionType: step.question_type, answer: null, resultStatus: step.result_status, resultDescription: step.result_description });
      break;
    }

    if (step.question_type === 'info') {
      replaySteps.push({ stepId: currentStepId, stepTitle: step.step_title, questionType: step.question_type, answer: null });
      currentStepId = step.default_next_step || step.options?.[0]?.next_step;
      continue;
    }

    // Get saved answer for this step
    const savedAnswer = classificationAnswers[currentStepId];
    const pathEntry = {
      stepId: currentStepId,
      stepTitle: step.step_title,
      questionText: step.question_text,
      questionType: step.question_type,
      answer: savedAnswer !== undefined ? savedAnswer : null,
      options: step.options
    };

    if (savedAnswer === undefined) {
      // No answer found for this step — path ends here
      replaySteps.push({ ...pathEntry, noAnswer: true });
      finalStatus = 'terminal';
      break;
    }

    replaySteps.push(pathEntry);

    const allAnswers = {};
    replaySteps.forEach(s => { if (s.answer !== undefined && s.answer !== null) allAnswers[s.stepId] = s.answer; });

    const nextStepId = resolveNextStep(step, savedAnswer, allAnswers);
    if (!nextStepId) { finalStatus = 'terminal'; break; }
    if (!stepMap[nextStepId]) { finalStatus = 'missing_step'; break; }
    currentStepId = nextStepId;
  }

  return { steps: replaySteps, finalStatus, finalResultStatus, finalResultDescription, accountReportabilityStatus: null, accountReportabilityReason: null };
}

function generateReplaySection(doc, replayPath, pageW, pageH, margin, contentW, y, statusColors, statusBg) {
  const checkPage = (needed = 10) => {
    if (y + needed > pageH - 20) { doc.addPage(); y = margin; }
    return y;
  };

  // Section header
  checkPage(30);
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ACCOUNT CLASSIFICATION REPLAY  ·  Path taken by this specific account', margin + 4, y + 7);
  y += 12;

  // Show the actual account reportability status prominently (from Account entity directly)
  const accountStatus = replayPath.accountReportabilityStatus;
  const accountStatusColors = {
    reportable: [220, 38, 38],
    non_reportable: [22, 163, 74],
    pending_review: [202, 138, 4],
    excluded: [107, 114, 128]
  };
  const accountStatusBg = {
    reportable: [254, 226, 226],
    non_reportable: [220, 252, 231],
    pending_review: [254, 249, 195],
    excluded: [243, 244, 246]
  };

  if (accountStatus && accountStatus !== 'pending_review') {
    const aColor = accountStatusColors[accountStatus] || [100, 116, 139];
    const aBg = accountStatusBg[accountStatus] || [241, 245, 249];
    doc.setFillColor(...aBg);
    doc.roundedRect(margin, y, contentW, 18, 2, 2, 'F');
    doc.setFillColor(...aColor);
    doc.rect(margin, y, 5, 18, 'F');
    doc.setTextColor(...aColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`ACCOUNT STATUS: ${accountStatus.replace(/_/g, ' ').toUpperCase()}`, margin + 10, y + 8);
    if (replayPath.accountReportabilityReason) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const reasonLines = doc.splitTextToSize(replayPath.accountReportabilityReason, contentW - 16);
      doc.text(reasonLines.slice(0, 2), margin + 10, y + 14);
    }
    y += 22;
  }

  const status = replayPath.finalStatus || 'unknown';
  const color = statusColors[status] || statusColors.unknown;
  const bgColor = statusBg[status] || statusBg.unknown;

  // Workflow path result banner
  doc.setFillColor(...bgColor);
  doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F');
  doc.setFillColor(...color);
  doc.rect(margin, y, 4, 12, 'F');
  doc.setTextColor(...color);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const resultLabel = replayPath.finalResultStatus
    ? `WORKFLOW PATH RESULT: ${replayPath.finalResultStatus.replace(/_/g, ' ').toUpperCase()}`
    : `WORKFLOW PATH: ${status.replace(/_/g, ' ').toUpperCase()} (workflow has no result step reached)`;
  doc.text(resultLabel, margin + 8, y + 5);
  if (replayPath.finalResultDescription) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(replayPath.finalResultDescription, margin + 8, y + 10);
  }
  y += 16;

  replayPath.steps.forEach((step, stepIdx) => {
    const answerText = step.answer !== null && step.answer !== undefined ? formatAnswer(step.answer, step) : null;
    const isResultStep = step.questionType === 'result' || step.resultStatus;

    const titleLines = doc.splitTextToSize(step.stepTitle || step.stepId, contentW - 8);
    const answerLines = answerText ? doc.splitTextToSize(`${answerText}`, contentW - 30) : [];
    const blockH = 6 + titleLines.length * 5 + (answerLines.length > 0 ? answerLines.length * 4.5 + 3 : 0) + (isResultStep ? 8 : 0) + (step.noAnswer ? 7 : 0) + 4;

    y = checkPage(blockH + 2);

    if (isResultStep) { doc.setFillColor(...bgColor); } else { doc.setFillColor(248, 250, 252); }
    doc.roundedRect(margin, y, contentW, blockH, 1.5, 1.5, 'F');
    doc.setFillColor(...color);
    doc.rect(margin, y, 3, blockH, 'F');

    doc.setTextColor(...color);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`STEP ${stepIdx + 1}`, margin + 6, y + 5);
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(step.questionType?.replace(/_/g, ' ') || '', margin + contentW - 3, y + 5, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    let lineY = y + 10;
    doc.text(titleLines, margin + 6, lineY);
    lineY += titleLines.length * 5 + 2;

    if (answerLines.length > 0) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Answer:', margin + 6, lineY);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(answerLines, margin + 20, lineY);
      lineY += answerLines.length * 4.5 + 2;
    }

    if (step.noAnswer) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text('⚠ No saved answer found for this step — path ends here', margin + 6, lineY + 3);
    }

    if (isResultStep && step.resultStatus) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(`OUTCOME: ${step.resultStatus.replace(/_/g, ' ').toUpperCase()}`, margin + 6, lineY + 3);
      if (step.resultDescription) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const descLines = doc.splitTextToSize(step.resultDescription, contentW - 14);
        doc.text(descLines.slice(0, 2), margin + 6, lineY + 8);
      }
    }

    y += blockH + 2;
  });

  y += 10;
  return y;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { tenantId, workflowId, accountId } = body;

    if (!tenantId || !workflowId) {
      return Response.json({ error: 'tenantId and workflowId are required' }, { status: 400 });
    }



    // Fetch the workflow
    const workflows = await base44.asServiceRole.entities.Workflow.filter({ id: workflowId });
    if (!workflows.length) return Response.json({ error: 'Workflow not found' }, { status: 404 });
    const workflow = workflows[0];

    if (!workflow.steps?.length) {
      return Response.json({ error: 'Workflow has no steps' }, { status: 400 });
    }

    // Fetch account classification answers if accountId provided
    let accountReplay = null;
    let accountData = null;
    if (accountId) {
      const accounts = await base44.asServiceRole.entities.Account.filter({ id: accountId });
      if (accounts.length) {
        accountData = accounts[0];
        const classificationAnswers = accountData.classification_answers || {};
        accountReplay = replayAccountPath(workflow, classificationAnswers);
        if (accountReplay) {
          accountReplay.accountReportabilityStatus = accountData.reportability_status || null;
          accountReplay.accountReportabilityReason = accountData.reportability_reason || null;
        }
      }
    }

    // Traverse all paths
    const paths = traverseAllPaths(workflow);

    // Generate PDF — inject account replay at top
    const doc = generatePDF(paths, workflow.workflow_name, tenantId, accountId || 'N/A', accountReplay, accountData);
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    // Convert PDF to base64 to return inline (no upload needed)
    let binary = '';
    for (let i = 0; i < pdfBytes.length; i++) binary += String.fromCharCode(pdfBytes[i]);
    const pdfBase64 = btoa(binary);

    return Response.json({
      success: true,
      workflow_name: workflow.workflow_name,
      total_paths: paths.length,
      paths_summary: paths.map((p, i) => ({
        path_number: i + 1,
        steps_count: p.steps.length,
        final_status: p.finalStatus,
        step_ids: p.steps.map(s => s.stepId)
      })),
      pdf_base64: pdfBase64
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});