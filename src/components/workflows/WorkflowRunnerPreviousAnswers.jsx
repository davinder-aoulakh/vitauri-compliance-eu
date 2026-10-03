import React, { useState } from "react";
import { FileCheck, ChevronDown, ChevronRight } from "lucide-react";
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
 * Formats a raw answer value into a human-readable string for WorkflowRunner.
 */
function formatAnswer(ans, step) {
  if (ans === null || ans === undefined || ans === '') return null;

  const opts = step.options || [];

  // Boolean primitive
  if (typeof ans === 'boolean') return ans ? 'Yes' : 'No';

  // String scalars — try option label lookup first, then YES/NO conversion
  if (typeof ans === 'string') {
    const matched = opts.find(o => o.value === ans);
    if (matched) return getOptionDisplayText(matched, step);
    if (ans === 'YES') return 'Yes';
    if (ans === 'NO') return 'No';
    if (/^\d{4}-\d{2}-\d{2}/.test(ans)) return toDisplayDate(ans);
    return ans;
  }

  // Arrays (multiple_choice) — always map to option labels
  if (Array.isArray(ans)) {
    const labels = ans.map(v => {
      const matched = opts.find(o => o.value === v);
      return matched ? getOptionDisplayText(matched, step) : v;
    });
    return labels.join(', ') || null;
  }

  // Objects
  if (typeof ans === 'object') {
    // file_upload: WorkflowRunner stores files array
    if (ans.files && Array.isArray(ans.files) && ans.files.length > 0) {
      const firstName = ans.files[0]?.name || 'file';
      const extra = ans.files.length > 1 ? ` (+${ans.files.length - 1} more)` : '';
      return ans.date_received
        ? `${firstName}${extra} (Received: ${toDisplayDate(ans.date_received)})`
        : `${firstName}${extra}`;
    }
    // file_upload: AccountClassification stores as { file_name, file_url, date_received }
    if (ans.file_name) {
      return ans.date_received
        ? `${ans.file_name} (Received: ${toDisplayDate(ans.date_received)})`
        : ans.file_name;
    }
    // address_input
    if (step.question_type === 'address_input') {
      const parts = [ans.street, ans.city, ans.state, ans.country].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'Address provided';
    }
    // controlling_person_input / beneficiary_input
    if (step.question_type === 'controlling_person_input' || step.question_type === 'beneficiary_input') {
      const persons = ans.savedPersons || ans.draftPersons || ans.savedBeneficiaries || ans.draftBeneficiaries || [];
      if (persons.length > 0) {
        return persons
          .map(p => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || 'Unknown')
          .join(', ');
      }
      return 'No persons added';
    }
    // multi_field_input — render each sub-field using its display_label
    const fields = step.multi_fields || [];
    const pairs = Object.entries(ans)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => {
        const fieldDef = fields.find(f => f.field_id === k);
        const label = fieldDef?.display_label || k;
        let val;
        if (typeof v === 'boolean') {
          val = v ? 'Yes' : 'No';
        } else if (v === 'YES' || v === 'true') {
          val = 'Yes';
        } else if (v === 'NO' || v === 'false') {
          val = 'No';
        } else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
          val = toDisplayDate(v);
        } else {
          const subOpts = fieldDef?.options || [];
          const subMatched = subOpts.find(o => o.value === v);
          val = subMatched ? subMatched.label : String(v);
        }
        return `${label}: ${val}`;
      });
    return pairs.join(' | ') || null;
  }

  return String(ans);
}

/**
 * "View Previous Answers" panel for WorkflowRunner.
 *
 * Uses `answerHistory` (a per-step array of every submitted value in order) together with
 * the ordered `history` array to show each loop iteration independently — the same pattern
 * used by AccountClassification's PreviousAnswers component.
 *
 * Falls back to __iterN keyed answers when answerHistory is absent (legacy/draft-resume).
 */
export default function WorkflowRunnerPreviousAnswers({ history, answers, workflow, answerHistory }) {
  const [open, setOpen] = useState(false);

  const stepMap = {};
  (workflow?.steps || []).forEach(s => { stepMap[s.step_id] = s; });

  // Walk history in order; track iteration count per step to pick correct answerHistory entry
  const iterationCounters = {};
  const rows = history
    .map((stepId, idx) => {
      const step = stepMap[stepId];
      if (!step || step.question_type === 'info' || step.question_type === 'result') return null;

      iterationCounters[stepId] = (iterationCounters[stepId] ?? -1) + 1;
      const iterIdx = iterationCounters[stepId];

      let ans;
      if (answerHistory && answerHistory[stepId] && answerHistory[stepId].length > iterIdx) {
        // Use the per-iteration history (correct for loops)
        ans = answerHistory[stepId][iterIdx];
      }
      // Always fall back to the __iterN keyed answer if answerHistory entry is missing or undefined
      if (ans === undefined || ans === null) {
        const answerKey = iterIdx > 0 ? `${stepId}__iter${iterIdx}` : stepId;
        ans = answers[answerKey];
      }

      const displayAnswer = formatAnswer(ans, step);
      if (!displayAnswer) return null;

      // Add iteration label when the step appears more than once in history
      const totalVisits = history.filter(id => id === stepId).length;
      const iterationLabel = totalVisits > 1 ? ` (Attempt ${iterIdx + 1})` : '';

      return { key: `${stepId}-${idx}`, stepId, iterIdx, step, displayAnswer, iterationLabel };
    })
    .filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <Card className="border border-slate-200">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-xl"
        onClick={() => setOpen(o => !o)}
      >
        <FileCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span className="text-sm font-medium text-slate-700 flex-1">
          View Previous Answers ({rows.length})
        </span>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400" />
          : <ChevronRight className="w-4 h-4 text-slate-400" />
        }
      </button>
      {open && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="space-y-0">
            {rows.map(({ key, stepId, iterIdx, step, displayAnswer, iterationLabel }) => (
              <div
                key={key}
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