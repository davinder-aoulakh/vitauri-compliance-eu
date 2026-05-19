/**
 * Automated Workflow Test Runner
 * Traverses all possible paths and generates an Excel (.xlsx) test script report.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import ExcelJS from 'npm:exceljs@4.4.0';

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
  multi_field_input: null,
  beneficiary_input: [{ savedBeneficiaries: [{ first_name: 'Test', last_name: 'Beneficiary' }] }],
  controlling_person_input: [{ savedPersons: [{ first_name: 'Test', last_name: 'Person' }] }],
  info: [null],
  result: [null],
};

function buildMultiFieldAnswers(step) {
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

function resolveNextStep(step, answer, allAnswers) {
  const logic = step.conditional_logic;

  if (step.question_type === 'result') return null;

  if (['text_input','number_input','date_input','file_upload','address_input','beneficiary_input','controlling_person_input'].includes(step.question_type)) {
    return (step.default_next_step && step.default_next_step.trim() !== '') ? step.default_next_step : null;
  }

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
    if (step.options) {
      const opt = step.options.find(o => o.value === answer || (Array.isArray(answer) && answer.includes(o.value)));
      if (opt?.next_step && opt.next_step.trim() !== '') return opt.next_step;
    }
    return null;
  }

  if (logic.use_selection_count && logic.selection_count_value != null) {
    const count = Array.isArray(answer) ? answer.length : 1;
    const op = logic.selection_count_operator || '=';
    const met = evalNumOp(op, count, logic.selection_count_value);
    return met ? (logic.selection_count_next_step || null) : (logic.selection_count_else_step || null);
  }

  if (logic.option_values?.length > 0) {
    const selectedOptions = Array.isArray(answer) ? answer : [answer];
    const hasMatch = logic.option_values.some(v => selectedOptions.includes(v));
    if (hasMatch) return logic.option_values_next_step || null;
    if (logic.option_values_else_step) return logic.option_values_else_step;
  }

  if (logic.multi_choice_routing_groups?.length > 0) {
    const selectedOptions = Array.isArray(answer) ? answer : [answer];
    for (const group of logic.multi_choice_routing_groups) {
      let groupMet = group.group_operator === 'AND';
      for (const cond of (group.conditions || [])) {
        let condMet = false;
        if (cond.condition_type === 'selected_options') {
          condMet = (cond.option_values || []).some(v => selectedOptions.includes(v));
        } else if (cond.condition_type === 'selection_count') {
          condMet = evalNumOp(cond.count_operator, selectedOptions.length, cond.count_value);
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

  let triggerMatches = true;
  if (logic.trigger_field && logic.trigger_value) {
    const triggerAnswer = allAnswers[logic.trigger_field];
    if (String(triggerAnswer) !== String(logic.trigger_value)) {
      triggerMatches = false;
    }
  }

  if (!triggerMatches) {
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

  if (step.options) {
    const selectedOptions = Array.isArray(answer) ? answer : [answer];
    for (const v of selectedOptions) {
      const opt = step.options.find(o => o.value === v);
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

    if (visitedInPath.has(stepId)) {
      const pathWithLoop = [...currentPath];
      if (pathWithLoop.length > 0) {
        pathWithLoop[pathWithLoop.length - 1] = {
          ...pathWithLoop[pathWithLoop.length - 1],
          loopsBackTo: stepId,
          loopsBackToTitle: stepMap[stepId]?.step_title || stepId
        };
      }
      allPaths.push({ steps: pathWithLoop, finalStatus: 'cycle_detected', answers: { ...currentAnswers } });
      return;
    }

    const possibleAnswers = getSyntheticAnswers(step);

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
        stepId, stepTitle: step.step_title, questionText: step.question_text,
        questionType: step.question_type, answer, options: step.options, nextStepId
      };

      if (!nextStepId) {
        allPaths.push({ steps: [...currentPath, pathEntry], finalStatus: 'terminal', answers: updatedAnswers });
      } else if (!stepMap[nextStepId]) {
        allPaths.push({ steps: [...currentPath, { ...pathEntry, missingNextStep: nextStepId }], finalStatus: 'missing_step', answers: updatedAnswers });
      } else {
        dfs(nextStepId, [...currentPath, pathEntry], updatedAnswers, newVisited);
      }
    }
  }

  const firstStep = workflow.steps[0];
  if (firstStep) dfs(firstStep.step_id, [], {});

  return allPaths;
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

function formatAnswer(answer, step) {
  if (answer === null || answer === undefined) return '';
  if (Array.isArray(answer)) {
    return answer.map(v => {
      const opt = step?.options?.find(o => o.value === v);
      return opt ? opt.label : String(v);
    }).join(', ');
  }
  if (typeof answer === 'object') {
    if (answer.file_name) return `File: ${answer.file_name}`;
    if (answer.street) return [answer.street, answer.city, answer.state, answer.postal_code, answer.country].filter(Boolean).join(', ');
    // For multi-field: show key-value pairs skipping raw field IDs if option labels available
    return Object.entries(answer).map(([k, v]) => `${k}: ${v}`).join(' | ');
  }
  const opt = step?.options?.find(o => o.value === String(answer));
  return opt ? opt.label : String(answer);
}

function formatAccountField(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (value.street) return [value.street, value.city, value.state, value.postal_code, value.country].filter(Boolean).join(', ');
    return JSON.stringify(value);
  }
  return String(value);
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
    if (visited.has(currentStepId)) { finalStatus = 'cycle_detected'; break; }
    const step = stepMap[currentStepId];
    if (!step) { finalStatus = 'missing_step'; break; }

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

    const savedAnswer = classificationAnswers[currentStepId];
    const pathEntry = {
      stepId: currentStepId, stepTitle: step.step_title, questionText: step.question_text,
      questionType: step.question_type, answer: savedAnswer !== undefined ? savedAnswer : null, options: step.options
    };

    if (savedAnswer === undefined) {
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

// ─── Excel Generation ────────────────────────────────────────────────────────

async function generateExcel(paths, workflowName, tenantId, accountId, accountReplay, accountData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vitauri Compliance';
  wb.created = new Date();

  // ── Colour helpers ──────────────────────────────────────────────────────
  const STATUS_FILL = {
    reportable:     { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFEE2E2' } },
    non_reportable: { type:'pattern', pattern:'solid', fgColor:{ argb:'FFD1FAE5' } },
    pending_review: { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFEF9C3' } },
    excluded:       { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF3F4F6' } },
    terminal:       { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF1F5F9' } },
    cycle_detected: { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFED7AA' } },
    missing_step:   { type:'pattern', pattern:'solid', fgColor:{ argb:'FFEDE9FE' } },
    unknown:        { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF1F5F9' } },
  };
  const STATUS_FONT_COLOR = {
    reportable:     'FFDC2626',
    non_reportable: 'FF16A34A',
    pending_review: 'FFCA8A04',
    excluded:       'FF6B7280',
    terminal:       'FF64748B',
    cycle_detected: 'FFEA580C',
    missing_step:   'FF7C3AED',
    unknown:        'FF64748B',
  };
  const HEADER_DARK  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF0F172A' } };
  const HEADER_MID   = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1E293B' } };
  const HEADER_STEP  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF334155' } };
  const ACCENT_BLUE  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF464FEB' } };
  const ROW_ODD      = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFFFFF' } };
  const ROW_EVEN     = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF8FAFC' } };
  const CELL_SKIP    = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF5F5F5' } };
  const WHITE_FONT   = { color:{ argb:'FFFFFFFF' }, bold:true };
  const GREY_FONT    = { color:{ argb:'FF94A3B8' } };
  const THIN_BORDER  = {
    top:    { style:'thin', color:{ argb:'FFE2E8F0' } },
    left:   { style:'thin', color:{ argb:'FFE2E8F0' } },
    bottom: { style:'thin', color:{ argb:'FFE2E8F0' } },
    right:  { style:'thin', color:{ argb:'FFE2E8F0' } },
  };

  // ── Sheet 1: Summary ────────────────────────────────────────────────────
  const infoSheet = wb.addWorksheet('Summary');
  infoSheet.properties.defaultRowHeight = 18;

  // Title
  infoSheet.mergeCells('A1:H1');
  const titleCell = infoSheet.getCell('A1');
  titleCell.value = 'Workflow Test Script Execution Report';
  titleCell.font = { ...WHITE_FONT, size: 14 };
  titleCell.fill = HEADER_DARK;
  titleCell.alignment = { vertical:'middle', horizontal:'left', indent:1 };
  infoSheet.getRow(1).height = 28;

  // Generated date
  infoSheet.mergeCells('A2:H2');
  const genCell = infoSheet.getCell('A2');
  genCell.value = `Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`;
  genCell.font = GREY_FONT;
  genCell.fill = HEADER_MID;
  genCell.alignment = { vertical:'middle', horizontal:'left', indent:1 };
  infoSheet.getRow(2).height = 16;

  infoSheet.addRow([]).height = 6;

  // Workflow / Tenant / Paths meta
  const metaHeaders = infoSheet.addRow(['WORKFLOW', '', '', 'TENANT', '', 'TOTAL PATHS', 'ACCOUNT ID']);
  metaHeaders.eachCell(cell => { cell.font = { ...GREY_FONT, size:8 }; cell.fill = HEADER_MID; cell.alignment = { vertical:'middle', horizontal:'left', indent:1 }; });
  infoSheet.getRow(metaHeaders.number).height = 14;

  const metaVals = infoSheet.addRow([workflowName, '', '', tenantId, '', paths.length, accountId || 'N/A']);
  metaVals.eachCell(cell => { cell.font = { ...WHITE_FONT, size:10 }; cell.fill = HEADER_MID; cell.alignment = { vertical:'middle', horizontal:'left', indent:1, wrapText:true }; });
  infoSheet.getRow(metaVals.number).height = 22;
  infoSheet.mergeCells(`A${metaVals.number}:C${metaVals.number}`);
  infoSheet.mergeCells(`D${metaVals.number}:E${metaVals.number}`);

  infoSheet.addRow([]).height = 8;

  // Account Details section
  if (accountData) {
    const accHdrRow = infoSheet.addRow(['ACCOUNT DETAILS']);
    infoSheet.mergeCells(`A${accHdrRow.number}:H${accHdrRow.number}`);
    accHdrRow.getCell('A').fill = ACCENT_BLUE;
    accHdrRow.getCell('A').font = { ...WHITE_FONT, size:10 };
    accHdrRow.getCell('A').alignment = { vertical:'middle', horizontal:'left', indent:1 };
    infoSheet.getRow(accHdrRow.number).height = 22;

    const addrCurrent  = accountData.current_address || accountData.account_holder_address;
    const addrOriginal = accountData.account_holder_address || accountData.current_address;
    const isPreExisting = accountData.is_pre_existing === true ? 'Pre-Existing'
                        : accountData.is_pre_existing === false ? 'New' : '—';
    const balance = accountData.year_end_cash_value;
    const valueThreshold = balance !== undefined && balance !== null
      ? (Number(balance) >= 1000000 ? 'High Value (>=1M)' : 'Low Value (<1M)') : '—';

    const accountFields = [
      ['Account Holder',          accountData.account_holder_name || [accountData.first_name, accountData.last_name].filter(Boolean).join(' ') || '—'],
      ['Account Number',          accountData.account_number || '—'],
      ['Account Type',            accountData.account_type ? accountData.account_type.replace(/_/g,' ') : '—'],
      ['Pre-Existing / New',      isPreExisting],
      ['Value Category',          valueThreshold],
      ['Year End Balance',        balance !== undefined && balance !== null ? `${accountData.year_end_cash_value_currency || ''} ${Number(balance).toLocaleString()}`.trim() : '—'],
      ['Holder Type',             accountData.account_holder_type || '—'],
      ['Reportability Status',    accountData.reportability_status ? accountData.reportability_status.replace(/_/g,' ') : '—'],
      ['Current Address',         formatAccountField(addrCurrent)],
      ['Original/Holder Address', formatAccountField(addrOriginal)],
    ];

    const labelFill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF1F5F9' } };
    const valFill   = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFFFFF' } };

    for (let i = 0; i < 5; i++) {
      const row = infoSheet.addRow([
        accountFields[i][0], accountFields[i][1], '',
        accountFields[i + 5][0], accountFields[i + 5][1]
      ]);
      infoSheet.getRow(row.number).height = 24;
      row.getCell(1).font = { color:{ argb:'FF64748B' }, size:8 };
      row.getCell(1).fill = labelFill;
      row.getCell(1).alignment = { vertical:'middle', indent:1 };
      row.getCell(2).font = { bold:true, size:9 };
      row.getCell(2).fill = valFill;
      row.getCell(2).alignment = { vertical:'middle', wrapText:true, indent:1 };
      row.getCell(4).font = { color:{ argb:'FF64748B' }, size:8 };
      row.getCell(4).fill = labelFill;
      row.getCell(4).alignment = { vertical:'middle', indent:1 };
      row.getCell(5).font = { bold:true, size:9 };
      row.getCell(5).fill = valFill;
      row.getCell(5).alignment = { vertical:'middle', wrapText:true, indent:1 };
      infoSheet.mergeCells(`B${row.number}:C${row.number}`);
      infoSheet.mergeCells(`E${row.number}:H${row.number}`);
      [1,2,4,5].forEach(c => { row.getCell(c).border = THIN_BORDER; });
    }
  }

  infoSheet.addRow([]).height = 8;

  // Outcome summary
  const sumHdr = infoSheet.addRow(['OUTCOME SUMMARY']);
  infoSheet.mergeCells(`A${sumHdr.number}:H${sumHdr.number}`);
  sumHdr.getCell('A').fill = HEADER_MID;
  sumHdr.getCell('A').font = { ...WHITE_FONT, size:10 };
  sumHdr.getCell('A').alignment = { vertical:'middle', horizontal:'left', indent:1 };
  infoSheet.getRow(sumHdr.number).height = 20;

  const counts = {};
  paths.forEach(p => { counts[p.finalStatus] = (counts[p.finalStatus] || 0) + 1; });
  const countLabelRow = infoSheet.addRow(Object.keys(counts).map(s => s.replace(/_/g,' ').toUpperCase()));
  const countValRow   = infoSheet.addRow(Object.values(counts));
  infoSheet.getRow(countLabelRow.number).height = 16;
  infoSheet.getRow(countValRow.number).height = 26;

  Object.keys(counts).forEach((status, i) => {
    const col = i + 1;
    const fill = STATUS_FILL[status] || STATUS_FILL.unknown;
    const fc   = STATUS_FONT_COLOR[status] || 'FF64748B';
    countLabelRow.getCell(col).fill = fill;
    countLabelRow.getCell(col).font = { color:{ argb:fc }, size:8, bold:true };
    countLabelRow.getCell(col).alignment = { horizontal:'center', vertical:'middle' };
    countLabelRow.getCell(col).border = THIN_BORDER;
    countValRow.getCell(col).fill = fill;
    countValRow.getCell(col).font = { color:{ argb:fc }, size:16, bold:true };
    countValRow.getCell(col).alignment = { horizontal:'center', vertical:'middle' };
    countValRow.getCell(col).border = THIN_BORDER;
  });

  infoSheet.getColumn(1).width = 30;
  infoSheet.getColumn(2).width = 38;
  infoSheet.getColumn(3).width = 4;
  infoSheet.getColumn(4).width = 30;
  infoSheet.getColumn(5).width = 38;
  infoSheet.getColumn(6).width = 16;
  infoSheet.getColumn(7).width = 30;
  infoSheet.getColumn(8).width = 16;

  // ── Sheet 2: Test Script Matrix ─────────────────────────────────────────
  const ws = wb.addWorksheet('Test Script Matrix', {
    views: [{ state:'frozen', xSplit:3, ySplit:3 }]
  });
  ws.properties.defaultRowHeight = 40;

  // Collect all unique steps in order
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

  const totalCols = 3 + stepOrder.length;

  // Row 1: Title spanning all columns
  ws.mergeCells(1, 1, 1, totalCols);
  const r1cell = ws.getRow(1).getCell(1);
  r1cell.value = `Test Script Matrix — ${workflowName}`;
  r1cell.font = { ...WHITE_FONT, size:13 };
  r1cell.fill = HEADER_DARK;
  r1cell.alignment = { vertical:'middle', horizontal:'left', indent:1 };
  ws.getRow(1).height = 26;

  // Row 2: Step number labels
  const r2 = ws.getRow(2);
  r2.height = 16;
  r2.getCell(1).fill = HEADER_STEP;
  r2.getCell(2).fill = HEADER_STEP;
  r2.getCell(3).fill = HEADER_STEP;
  stepOrder.forEach((stepId, i) => {
    const cell = r2.getCell(4 + i);
    cell.value = `Step ${i + 1}`;
    cell.font = { ...GREY_FONT, size:8, italic:true };
    cell.fill = HEADER_STEP;
    cell.alignment = { horizontal:'center', vertical:'middle' };
  });

  // Row 3: Column header titles
  const r3 = ws.getRow(3);
  r3.height = 52;
  [
    { col:1, label:'Test Case' },
    { col:2, label:'Outcome' },
    { col:3, label:'Steps' },
  ].forEach(({col, label}) => {
    const cell = r3.getCell(col);
    cell.value = label;
    cell.font = WHITE_FONT;
    cell.fill = HEADER_STEP;
    cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    cell.border = THIN_BORDER;
  });
  stepOrder.forEach((stepId, i) => {
    const cell = r3.getCell(4 + i);
    cell.value = stepTitleMap[stepId];
    cell.font = WHITE_FONT;
    cell.fill = HEADER_STEP;
    cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    cell.border = THIN_BORDER;
  });

  // Data rows
  paths.forEach((path, pathIdx) => {
    const status = path.finalStatus || 'unknown';
    const resultStep = path.steps.find(s => s.questionType === 'result' || s.resultStatus);
    const outcomeStatus = resultStep?.resultStatus || status;
    const outcomeFill = STATUS_FILL[outcomeStatus] || STATUS_FILL.unknown;
    const outcomeFontColor = STATUS_FONT_COLOR[outcomeStatus] || 'FF64748B';
    const rowFill = pathIdx % 2 === 0 ? ROW_ODD : ROW_EVEN;

    const dataRow = ws.addRow([]);
    dataRow.height = 40;

    // TC#
    const tcCell = dataRow.getCell(1);
    tcCell.value = `TC${String(pathIdx + 1).padStart(3, '0')}`;
    tcCell.font = { bold:true, color:{ argb:'FF64748B' }, size:9 };
    tcCell.fill = rowFill;
    tcCell.alignment = { horizontal:'center', vertical:'middle' };
    tcCell.border = THIN_BORDER;

    // Outcome
    const outCell = dataRow.getCell(2);
    outCell.value = outcomeStatus.replace(/_/g,' ').toUpperCase();
    outCell.font = { bold:true, color:{ argb:outcomeFontColor }, size:9 };
    outCell.fill = outcomeFill;
    outCell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    outCell.border = THIN_BORDER;

    // Steps count
    const cntCell = dataRow.getCell(3);
    cntCell.value = path.steps.length;
    cntCell.font = { color:{ argb:'FF64748B' }, size:9 };
    cntCell.fill = rowFill;
    cntCell.alignment = { horizontal:'center', vertical:'middle' };
    cntCell.border = THIN_BORDER;

    // Step answer cells
    stepOrder.forEach((stepId, i) => {
      const cell = dataRow.getCell(4 + i);
      const pathStep = path.steps.find(s => s.stepId === stepId);

      if (!pathStep) {
        cell.value = '';
        cell.fill = CELL_SKIP;
        cell.alignment = { horizontal:'center', vertical:'middle' };
      } else if (pathStep.questionType === 'result' || pathStep.resultStatus) {
        cell.value = (pathStep.resultStatus || 'RESULT').replace(/_/g,' ').toUpperCase();
        cell.font = { bold:true, color:{ argb:outcomeFontColor }, size:9 };
        cell.fill = outcomeFill;
        cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      } else if (pathStep.loopsBackTo) {
        cell.value = `LOOP -> ${pathStep.loopsBackToTitle || pathStep.loopsBackTo}`;
        cell.font = { italic:true, color:{ argb:'FFEA580C' }, size:8 };
        cell.fill = STATUS_FILL.cycle_detected;
        cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      } else if (pathStep.missingNextStep) {
        cell.value = `MISSING: ${pathStep.missingNextStep}`;
        cell.font = { bold:true, color:{ argb:'FF7C3AED' }, size:8 };
        cell.fill = STATUS_FILL.missing_step;
        cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      } else {
        const answerText = formatAnswer(pathStep.answer, pathStep);
        cell.value = answerText || '';
        cell.fill = rowFill;
        cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
        cell.font = { size:9 };
      }
      cell.border = THIN_BORDER;
    });
  });

  // Column widths
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 9;
  stepOrder.forEach((_, i) => { ws.getColumn(4 + i).width = 30; });

  // ── Sheet 3: Account Replay (if available) ──────────────────────────────
  if (accountReplay) {
    const rs = wb.addWorksheet('Account Replay');
    rs.properties.defaultRowHeight = 20;

    rs.mergeCells('A1:E1');
    const rsTitleCell = rs.getCell('A1');
    rsTitleCell.value = 'Account Classification Replay — Actual Path Taken';
    rsTitleCell.font = { ...WHITE_FONT, size:12 };
    rsTitleCell.fill = HEADER_DARK;
    rsTitleCell.alignment = { vertical:'middle', horizontal:'left', indent:1 };
    rs.getRow(1).height = 26;

    // Status banner
    const rsStatus = accountReplay.accountReportabilityStatus || accountReplay.finalResultStatus || accountReplay.finalStatus;
    if (rsStatus) {
      rs.mergeCells('A2:E2');
      const rsStatusCell = rs.getCell('A2');
      rsStatusCell.value = `Account Status: ${rsStatus.replace(/_/g,' ').toUpperCase()}`;
      rsStatusCell.font = { bold:true, color:{ argb: STATUS_FONT_COLOR[rsStatus] || 'FF64748B' }, size:11 };
      rsStatusCell.fill = STATUS_FILL[rsStatus] || STATUS_FILL.unknown;
      rsStatusCell.alignment = { vertical:'middle', horizontal:'left', indent:2 };
      rs.getRow(2).height = 24;
    }

    rs.addRow([]).height = 6;

    // Header row
    const rsHdr = rs.addRow(['Step #', 'Step Title', 'Question Type', 'Answer Given', 'Notes']);
    rsHdr.height = 20;
    rsHdr.eachCell(cell => {
      cell.font = WHITE_FONT;
      cell.fill = HEADER_STEP;
      cell.alignment = { horizontal:'center', vertical:'middle' };
      cell.border = THIN_BORDER;
    });

    accountReplay.steps.forEach((step, idx) => {
      const answerText = formatAnswer(step.answer, step);
      const notes = step.noAnswer ? 'No saved answer — path ends here'
                  : step.loopsBackTo ? `LOOP -> ${step.loopsBackToTitle || step.loopsBackTo}`
                  : step.resultStatus ? `Result: ${step.resultStatus.replace(/_/g,' ').toUpperCase()}`
                  : '';
      const isResult = step.questionType === 'result' || step.resultStatus;
      const rowFill2 = isResult ? (STATUS_FILL[step.resultStatus] || STATUS_FILL.unknown) : (idx % 2 === 0 ? ROW_ODD : ROW_EVEN);

      const dataRow = rs.addRow([`Step ${idx + 1}`, step.stepTitle || step.stepId, step.questionType || '', answerText, notes]);
      dataRow.height = 36;
      dataRow.eachCell(cell => {
        cell.fill = rowFill2;
        cell.alignment = { vertical:'middle', wrapText:true, indent:1 };
        cell.border = THIN_BORDER;
        cell.font = { size:9 };
      });
      if (isResult) {
        dataRow.eachCell(cell => { cell.font = { bold:true, color:{ argb: STATUS_FONT_COLOR[step.resultStatus] || 'FF64748B' }, size:9 }; });
      }
    });

    rs.getColumn(1).width = 10;
    rs.getColumn(2).width = 45;
    rs.getColumn(3).width = 20;
    rs.getColumn(4).width = 40;
    rs.getColumn(5).width = 40;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
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

    const workflows = await base44.asServiceRole.entities.Workflow.filter({ id: workflowId });
    if (!workflows.length) return Response.json({ error: 'Workflow not found' }, { status: 404 });
    const workflow = workflows[0];

    if (!workflow.steps?.length) {
      return Response.json({ error: 'Workflow has no steps' }, { status: 400 });
    }

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

    const paths = traverseAllPaths(workflow);

    const xlsxBuffer = await generateExcel(paths, workflow.workflow_name, tenantId, accountId || 'N/A', accountReplay, accountData);

    // Convert to base64
    let binary = '';
    const bytes = new Uint8Array(xlsxBuffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const xlsxBase64 = btoa(binary);

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
      xlsx_base64: xlsxBase64
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});