import React, { useState } from "react";
import { FileCheck, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toDisplayDate } from "@/lib/dateUtils";

/**
 * Resolves the display text for a matched option: help_text (trimmed) when present,
 * otherwise the option's label. Only single_choice and multiple_choice steps use help_text.
 */
function getOptionDisplayText(option, step) {
  const helpTextEligible = step.question_type === 'single_choice' || step.question_type === 'multiple_choice';
  if (helpTextEligible && option.help_text && option.help_text.trim()) {
    return option.help_text.trim();
  }
  return option.label;
}

/**
 * Formats a raw answer value into a human-readable string.
 * Handles booleans, arrays, file uploads, address inputs, controlling persons, and plain values.
 */
function formatAnswer(ans, step, getStepOptions) {
  if (ans === null || ans === undefined || ans === '') return null;

  if (typeof ans === 'boolean') return ans ? 'Yes' : 'No';

  if (Array.isArray(ans)) {
    const opts = getStepOptions(step);
    return ans.map(v => {
      const matched = opts.find(o => o.value === v);
      return matched ? getOptionDisplayText(matched, step) : v;
    }).join(', ') || null;
  }

  if (typeof ans === 'object') {
    // file_upload: show filename + date received if available
    if (ans.file_name) {
      return ans.date_received
        ? `${ans.file_name} (Received: ${toDisplayDate(ans.date_received)})`
        : ans.file_name;
    }
    if (step.question_type === 'address_input') {
      return ans.country ? `Address provided (${ans.country})` : 'Address provided';
    }
    if (step.question_type === 'controlling_person_input' || step.question_type === 'beneficiary_input') {
      const persons = ans.savedPersons || ans.draftPersons || ans.savedBeneficiaries || ans.draftBeneficiaries || [];
      if (persons.length > 0) {
        return persons.map(p =>
          [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || 'Unknown'
        ).join(', ');
      }
      return 'No persons added';
    }
    // multi_field_input
    const fields = step.multi_fields || [];
    const pairs = Object.entries(ans)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => {
        const fieldDef = fields.find(f => f.field_id === k);
        const label = fieldDef?.display_label || k;
        let val;
        if (typeof v === 'boolean') val = v ? 'Yes' : 'No';
        else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) val = toDisplayDate(v);
        else val = String(v);
        return `${label}: ${val}`;
      });
    return pairs.join(' | ') || null;
  }

  // Scalar: try label lookup first
  const opts = getStepOptions(step);
  const matched = opts.find(o => o.value === ans);
  if (matched) return getOptionDisplayText(matched, step);
  if (ans === 'YES') return 'Yes';
  if (ans === 'NO') return 'No';
  if (typeof ans === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ans)) return toDisplayDate(ans);
  return String(ans);
}

/**
 * PreviousAnswers renders the collapsible "View Previous Answers" panel.
 *
 * Uses `answerHistory` (a per-step array of every submitted value) together with
 * the ordered `history` array to show each loop iteration independently.
 * If `answerHistory` is absent (e.g. legacy callers), falls back to `answers`.
 */
// Rows for a completed source workflow (answers captured before a workflow hand-off).
function buildSectionRows(path, stepMap, answers, getStepOptions) {
  return (path || [])
    .map((stepId, i) => {
      const step = stepMap?.[stepId];
      if (!step || step.question_type === 'info' || step.question_type === 'result') return null;
      const displayAnswer = formatAnswer(answers?.[stepId], step, getStepOptions);
      return displayAnswer ? { key: `${stepId}-${i}`, title: step.step_title, displayAnswer } : null;
    })
    .filter(Boolean);
}

/**
 * transitionSections: [{ fromName, toName, stepMap, path, answers }] - completed source workflows
 * that handed off to another workflow. Their answers stay visible, grouped by workflow.
 */
export default function PreviousAnswers({ history, stepMap, answers, answerHistory, getStepOptions, transitionSections = [], currentWorkflowName }) {
  const [open, setOpen] = useState(false);
  const sections = transitionSections.map(t => ({ ...t, rows: buildSectionRows(t.path, t.stepMap, t.answers, getStepOptions) }));

  // Walk history in order; for each step visit track which iteration we are on
  // so we pick the correct entry from answerHistory[stepId][iterationIndex].
  const iterationCounters = {};
  const rows = history
    .map((stepId) => {
      const step = stepMap[stepId];
      if (!step || step.question_type === 'info' || step.question_type === 'result') return null;

      // Determine which iteration of this step this history entry represents
      iterationCounters[stepId] = (iterationCounters[stepId] ?? -1) + 1;
      const iterIdx = iterationCounters[stepId];

      // Prefer per-iteration history; fall back to flat answers for backward compat
      let ans;
      if (answerHistory && answerHistory[stepId] && answerHistory[stepId].length > iterIdx) {
        ans = answerHistory[stepId][iterIdx];
      } else {
        ans = answers[stepId];
      }

      const displayAnswer = formatAnswer(ans, step, getStepOptions);
      if (!displayAnswer) return null;

      // Add iteration label when the step appears more than once in history
      const totalVisits = history.filter(id => id === stepId).length;
      const iterationLabel = totalVisits > 1 ? ` (Attempt ${iterIdx + 1})` : '';

      return { stepId, iterIdx, step, displayAnswer, iterationLabel };
    })
    .filter(Boolean);

  const total = rows.length + sections.reduce((n, t) => n + t.rows.length, 0);
  if (total === 0) return null;

  return (
    <Card className="border border-slate-200">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-xl"
        onClick={() => setOpen(o => !o)}
      >
        <FileCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span className="text-sm font-medium text-slate-700 flex-1">
          View Previous Answers ({total})
        </span>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400" />
          : <ChevronRight className="w-4 h-4 text-slate-400" />
        }
      </button>
      {open && (
        <CardContent className="px-4 pb-4 pt-0">
          {sections.map((t, i) => (
            <div key={i} className="mb-3">
              <div className="text-xs font-semibold text-slate-700 bg-slate-50 rounded px-2 py-1 mb-1">
                {t.fromName} <span className="font-normal text-slate-500">(completed)</span>
              </div>
              {t.rows.map(r => (
                <div key={r.key} className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-600 flex-1">{r.title}</span>
                  <span className="text-xs font-medium text-slate-900 text-right max-w-[220px]">{r.displayAnswer}</span>
                </div>
              ))}
              <div className="flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded px-2 py-1 mt-1">
                <ArrowRight className="w-3 h-3" /> Workflow started: {t.toName}
              </div>
            </div>
          ))}
          {sections.length > 0 && rows.length > 0 && (
            <div className="text-xs font-semibold text-slate-700 bg-slate-50 rounded px-2 py-1 mb-1">
              {currentWorkflowName} <span className="font-normal text-slate-500">(current)</span>
            </div>
          )}
          <div className="space-y-0">
            {rows.map(({ stepId, iterIdx, step, displayAnswer, iterationLabel }) => (
              <div
                key={`${stepId}-${iterIdx}`}
                className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0"
              >
                <span className="text-xs text-slate-600 flex-1">
                  {step.step_title}{iterationLabel}
                </span>
                <span className="text-xs font-medium text-slate-900 text-right max-w-[220px]">
                  {displayAnswer}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}