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
    return step.default_next_step || null;
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
      if (opt?.next_step) return opt.next_step;
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
  if (logic.trigger_field && logic.trigger_value) {
    const triggerAnswer = allAnswers[logic.trigger_field];
    if (String(triggerAnswer) !== String(logic.trigger_value)) return null;
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
      if (opt?.next_step) return opt.next_step;
    }
  }
  return logic.next_step || logic.else_step || null;
}

function resolveFieldValue(fieldPath, allAnswers) {
  if (!fieldPath) return undefined;
  if (allAnswers[fieldPath] !== undefined) return allAnswers[fieldPath];
  const parts = fieldPath.split('.');
  if (parts.length === 2) {
    const stepAns = allAnswers[parts[0]];
    if (stepAns && typeof stepAns === 'object') return stepAns[parts[1]];
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
      allPaths.push({
        steps: [...currentPath],
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
  // Resolve single option label
  const opt = step?.options?.find(o => o.value === String(answer));
  return opt ? opt.label : String(answer);
}

function generatePDF(paths, workflowName, tenantId, accountId, accountReplay, accountData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;

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

  let y = margin;

  const checkPage = (needed = 10) => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLine = (text, fontSize, bold, color, x, indent = 0) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentW - indent);
    checkPage(lines.length * (fontSize * 0.4 + 1) + 2);
    doc.text(lines, x + indent, y);
    y += lines.length * (fontSize * 0.4 + 1) + 1;
    return lines.length;
  };

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Workflow Test Report', margin, 15);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`, pageW - margin, 15, { align: 'right' });
  y = 30;

  // Info block
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, contentW, 18, 2, 2, 'F');
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(workflowName, margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tenant: ${tenantId}   ·   Account: ${accountId || 'N/A'}   ·   Total Paths Found: ${paths.length}`, margin + 4, y + 13);
  y += 22;

  // Account Replay Section (if available)
  if (accountReplay) {
    y = generateReplaySection(doc, accountReplay, pageW, pageH, margin, contentW, y, STATUS_COLORS, STATUS_BG);
  }

  // Outcome summary counts
  const counts = {};
  paths.forEach(p => { counts[p.finalStatus] = (counts[p.finalStatus] || 0) + 1; });
  const summaryEntries = Object.entries(counts);
  const colW = contentW / Math.min(summaryEntries.length, 4);
  summaryEntries.forEach(([ status, count ], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const bx = margin + col * colW;
    const by = y + row * 16;
    const bg = STATUS_BG[status] || STATUS_BG.unknown;
    const fg = STATUS_COLORS[status] || STATUS_COLORS.unknown;
    doc.setFillColor(...bg);
    doc.roundedRect(bx, by, colW - 2, 13, 1.5, 1.5, 'F');
    doc.setTextColor(...fg);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(String(count), bx + colW/2 - 1, by + 7, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(status.replace(/_/g, ' ').toUpperCase(), bx + colW/2 - 1, by + 11, { align: 'center' });
  });
  const summaryRows = Math.ceil(summaryEntries.length / 4);
  y += summaryRows * 16 + 6;

  // Summary table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('All Test Paths', margin, y);
  y += 5;

  // Table header
  doc.setFillColor(51, 65, 85);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('#', margin + 3, y + 5);
  doc.text('Steps Traversed', margin + 14, y + 5);
  doc.text('Cnt', margin + contentW - 32, y + 5);
  doc.text('Outcome', margin + contentW - 23, y + 5);
  y += 7;

  paths.forEach((path, idx) => {
    checkPage(8);
    const color = STATUS_COLORS[path.finalStatus] || STATUS_COLORS.unknown;
    doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(String(idx + 1), margin + 3, y + 5);
    // Use step titles (not IDs) for readability
    const stepSummary = path.steps.map(s => s.stepTitle || s.stepId).join(' → ');
    const truncated = stepSummary.length > 100 ? stepSummary.substring(0, 97) + '...' : stepSummary;
    doc.text(truncated, margin + 14, y + 5);
    doc.text(String(path.steps.length), margin + contentW - 30, y + 5);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    const outcomeLabel = (path.finalStatus || 'unknown').replace(/_/g, ' ').toUpperCase();
    doc.text(outcomeLabel.substring(0, 16), margin + contentW - 21, y + 5);
    y += 7;
  });

  y += 10;

  // ─── Detailed Path Sections ───────────────────────────────────────────────
  paths.forEach((path, pathIdx) => {
    checkPage(25);

    const status = path.finalStatus || 'unknown';
    const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
    const bgColor = STATUS_BG[status] || STATUS_BG.unknown;

    // Path header banner
    doc.setFillColor(...color);
    doc.rect(margin, y, contentW, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const outcomeLabel = status.replace(/_/g, ' ').toUpperCase();
    doc.text(`PATH ${pathIdx + 1}  ·  OUTCOME: ${outcomeLabel}  ·  ${path.steps.length} STEPS`, margin + 4, y + 7);
    y += 12;

    // Step-by-step detail
    path.steps.forEach((step, stepIdx) => {
      const answerText = step.answer !== null && step.answer !== undefined ? formatAnswer(step.answer, step) : null;
      const isResultStep = step.questionType === 'result' || step.resultStatus;

      // Calculate height needed
      const titleLines = doc.splitTextToSize(step.stepTitle || step.stepId, contentW - 8);
      const answerLines = answerText ? doc.splitTextToSize(`Answer: ${answerText}`, contentW - 16) : [];
      const blockH = 6 + titleLines.length * 5 + (answerLines.length > 0 ? answerLines.length * 4.5 + 3 : 0) + (isResultStep ? 8 : 0) + 4;
      checkPage(blockH + 2);

      // Step block background
      if (isResultStep) {
        doc.setFillColor(...bgColor);
      } else {
        doc.setFillColor(248, 250, 252);
      }
      doc.roundedRect(margin, y, contentW, blockH, 1.5, 1.5, 'F');

      // Left accent bar
      doc.setFillColor(...color);
      doc.rect(margin, y, 3, blockH, 'F');

      // Step number
      doc.setTextColor(...color);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`STEP ${stepIdx + 1}`, margin + 6, y + 5);

      // Question type badge
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(step.questionType?.replace(/_/g, ' ') || '', margin + contentW - 3, y + 5, { align: 'right' });

      // Step title
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      let lineY = y + 10;
      doc.text(titleLines, margin + 6, lineY);
      lineY += titleLines.length * 5 + 2;

      // Answer
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

      // Result status (for result steps)
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

      // Missing step warning
      if (step.missingNextStep) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(124, 58, 237);
        doc.text(`⚠ Next step not found in workflow: "${step.missingNextStep}"`, margin + 6, lineY + 3);
      }

      y += blockH + 2;
    });

    y += 8;
  });

  // Page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(241, 245, 249);
    doc.rect(0, pageH - 12, pageW, 12, 'F');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Workflow Test Report  ·  Page ${i} of ${pageCount}`, pageW / 2, pageH - 5, { align: 'center' });
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