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

function buildMultiFieldAnswer(step) {
  const answer = {};
  for (const field of (step.multi_fields || [])) {
    switch (field.field_type) {
      case 'boolean': answer[field.field_id] = true; break;
      case 'number': answer[field.field_id] = 100; break;
      case 'date': answer[field.field_id] = '2025-01-01'; break;
      case 'select': answer[field.field_id] = field.options?.[0]?.value || 'option1'; break;
      default: answer[field.field_id] = 'Test Value';
    }
  }
  return answer;
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
    return [buildMultiFieldAnswer(step)];
  }
  return SYNTHETIC_ANSWERS[step.question_type] || ['Test Value'];
}

// Resolve next step based on the current step definition and answer given
function resolveNextStep(step, answer, allAnswers) {
  const logic = step.conditional_logic;

  // --- result / info types: no next step ---
  if (step.question_type === 'result') return null;

  // --- default_next_step for input types ---
  if (['text_input','number_input','date_input','file_upload','multi_field_input','address_input','beneficiary_input','controlling_person_input'].includes(step.question_type)) {
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

  // --- option_values routing ---
  if (logic.option_values?.length > 0) {
    const selectedOptions = Array.isArray(answer) ? answer : [answer];
    const hasMatch = logic.option_values.some(v => selectedOptions.includes(v));
    return hasMatch ? (logic.option_values_next_step || null) : (logic.option_values_else_step || null);
  }

  // --- selection_count routing ---
  if (logic.use_selection_count && logic.selection_count_operator) {
    const count = Array.isArray(answer) ? answer.length : 1;
    const met = evalNumOp(logic.selection_count_operator, count, logic.selection_count_value);
    return met ? (logic.selection_count_next_step || null) : (logic.selection_count_else_step || null);
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
  const fv = String(fieldValue || '').toLowerCase().trim();
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

  function dfs(stepId, currentPath, currentAnswers) {
    if (allPaths.length >= MAX_PATHS) return;
    if (currentPath.length > MAX_DEPTH) return;
    if (!stepId) return;

    const step = stepMap[stepId];
    if (!step) return;

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

    if (step.question_type === 'info') {
      const nextStep = step.default_next_step || (step.options?.[0]?.next_step);
      const pathEntry = { stepId, stepTitle: step.step_title, answer: null, questionType: step.question_type };
      dfs(nextStep, [...currentPath, pathEntry], { ...currentAnswers });
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
        // Terminal — record as complete path
        allPaths.push({
          steps: [...currentPath, pathEntry],
          finalStatus: 'terminal',
          answers: updatedAnswers
        });
      } else if (nextStepId === stepId) {
        // Cycle guard
        allPaths.push({
          steps: [...currentPath, pathEntry],
          finalStatus: 'cycle_detected',
          answers: updatedAnswers
        });
      } else {
        dfs(nextStepId, [...currentPath, pathEntry], updatedAnswers);
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
      return opt ? `${opt.label} (${v})` : String(v);
    }).join(', ');
  }
  if (typeof answer === 'object') {
    if (answer.file_name) return `File: ${answer.file_name}`;
    if (answer.street) return `${answer.street}, ${answer.city}, ${answer.country}`;
    return Object.entries(answer).map(([k, v]) => `${k}: ${v}`).join(' | ');
  }
  // Resolve single option label
  const opt = step?.options?.find(o => o.value === String(answer));
  return opt ? `${opt.label} (${answer})` : String(answer);
}

function generatePDF(paths, workflowName, tenantId, accountId) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;

  const STATUS_COLORS = {
    reportable: [239, 68, 68],
    non_reportable: [34, 197, 94],
    pending_review: [234, 179, 8],
    excluded: [156, 163, 175],
    terminal: [100, 116, 139],
    cycle_detected: [249, 115, 22],
    unknown: [100, 116, 139]
  };

  let y = margin;

  const checkPage = (needed = 10) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Workflow Test Report', margin, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toISOString()}`, pageW - margin, 14, { align: 'right' });
    y = 28;
  };

  drawHeader();

  // Workflow info block
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentW, 22, 'F');
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Workflow: ${workflowName}`, margin + 3, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Tenant ID: ${tenantId}   |   Account ID: ${accountId || 'N/A'}   |   Total Paths: ${paths.length}`, margin + 3, y + 14);
  y += 26;

  // Summary table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Summary of Test Paths', margin, y);
  y += 5;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(51, 65, 85);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('#', margin + 2, y + 5);
  doc.text('Path Summary (Steps)', margin + 10, y + 5);
  doc.text('Steps', margin + contentW - 30, y + 5);
  doc.text('Outcome', margin + contentW - 15, y + 5);
  y += 7;

  paths.forEach((path, idx) => {
    checkPage(7);
    const color = STATUS_COLORS[path.finalStatus] || [100, 116, 139];
    doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(String(idx + 1), margin + 2, y + 5);
    const summary = path.steps.filter(s => s.answer !== null).map(s => {
      const ans = Array.isArray(s.answer) ? s.answer.join('+') : String(s.answer || '');
      return `${s.stepTitle?.substring(0, 20) || s.stepId}: ${ans.substring(0, 15)}`;
    }).join(' → ').substring(0, 80);
    doc.text(summary, margin + 10, y + 5);
    doc.text(String(path.steps.length), margin + contentW - 28, y + 5);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.text((path.finalStatus || 'unknown').replace('_', ' ').toUpperCase().substring(0, 14), margin + contentW - 13, y + 5);
    y += 7;
  });

  y += 8;

  // ─── Detailed Path Pages ───────────────────────────────────────────────────
  paths.forEach((path, pathIdx) => {
    checkPage(20);

    // Path header
    const color = STATUS_COLORS[path.finalStatus] || [100, 116, 139];
    doc.setFillColor(...color);
    doc.rect(margin, y, contentW, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Path ${pathIdx + 1} of ${paths.length}  —  Outcome: ${(path.finalStatus || 'unknown').replace(/_/g, ' ').toUpperCase()}`, margin + 3, y + 6);
    y += 11;

    // Step-by-step detail
    path.steps.forEach((step, stepIdx) => {
      checkPage(22);

      // Step number chip
      doc.setFillColor(226, 232, 240);
      doc.rect(margin, y, contentW, 18, 'F');

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`STEP ${stepIdx + 1}`, margin + 3, y + 4);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(step.stepTitle || step.stepId, contentW - 60);
      doc.text(titleLines[0], margin + 3, y + 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Type: ${step.questionType}`, margin + 3, y + 14);

      if (step.answer !== null && step.answer !== undefined) {
        const answerText = `Answer: ${formatAnswer(step.answer, step)}`;
        const ansLines = doc.splitTextToSize(answerText, contentW - 6);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(ansLines[0].substring(0, 100), margin + contentW - 3 - doc.getTextWidth(ansLines[0].substring(0, 100)), y + 9);
      }

      if (step.resultStatus) {
        doc.setTextColor(...color);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(`Result: ${step.resultStatus.replace(/_/g, ' ').toUpperCase()}`, margin + 3, y + 14);
        if (step.resultDescription) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(71, 85, 105);
          const descLines = doc.splitTextToSize(step.resultDescription, contentW - 6);
          checkPage(5 * descLines.length);
          doc.text(descLines.slice(0, 2), margin + 3, y + 18);
          y += 5 * Math.min(descLines.length, 2);
        }
      }

      y += 20;
    });

    y += 6;
  });

  // Page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  return doc;
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

    // Traverse all paths
    const paths = traverseAllPaths(workflow);

    // Generate PDF
    const doc = generatePDF(paths, workflow.workflow_name, tenantId, accountId || 'N/A');
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    // Convert to base64 for upload
    let binary = '';
    for (let i = 0; i < pdfBytes.length; i++) binary += String.fromCharCode(pdfBytes[i]);
    const base64 = btoa(binary);
    const dataUrl = `data:application/pdf;base64,${base64}`;

    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: dataUrl });

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
      pdf_url: uploadResult.file_url
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});