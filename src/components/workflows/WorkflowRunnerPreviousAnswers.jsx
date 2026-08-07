import React, { useState } from "react";
import { FileCheck, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Formats a raw answer value into a human-readable string for WorkflowRunner.
 * Handles booleans, arrays, multi_field objects, file uploads, address inputs,
 * controlling persons, and plain scalar values.
 */
function formatAnswer(ans, step) {
  if (ans === null || ans === undefined || ans === '') return null;

  // Boolean
  if (typeof ans === 'boolean') return ans ? 'Yes' : 'No';
  if (ans === 'YES') return 'Yes';
  if (ans === 'NO') return 'No';

  // Arrays (multiple_choice) — map values to option labels
  if (Array.isArray(ans)) {
    const opts = step.options || [];
    const labels = ans.map(v => {
      const matched = opts.find(o => o.value === v);
      return matched ? matched.label : v;
    });
    return labels.join(', ') || null;
  }

  // Objects
  if (typeof ans === 'object') {
    // file_upload (WorkflowRunner stores files as an array inside ans.files)
    if (ans.files && Array.isArray(ans.files) && ans.files.length > 0) {
      const firstName = ans.files[0]?.name || 'file';
      const extra = ans.files.length > 1 ? ` (+${ans.files.length - 1} more)` : '';
      return ans.date_received
        ? `${firstName}${extra} (Received: ${ans.date_received})`
        : `${firstName}${extra}`;
    }
    // file_upload (AccountClassification stores as { file_name, file_url, date_received })
    if (ans.file_name) {
      return ans.date_received
        ? `${ans.file_name} (Received: ${ans.date_received})`
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
    // multi_field_input — build "Label: Value | Label: Value" summary
    const fields = step.multi_fields || [];
    const pairs = Object.entries(ans)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => {
        const fieldDef = fields.find(f => f.field_id === k);
        const label = fieldDef?.display_label || k;
        const val = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
        return `${label}: ${val}`;
      });
    return pairs.join(' | ') || null;
  }

  // Scalar — try option label lookup first
  const opts = step.options || [];
  const matched = opts.find(o => o.value === ans);
  if (matched) return matched.label;

  return String(ans);
}

/**
 * "View Previous Answers" panel for WorkflowRunner.
 * Walks the history array in order so each step shows its actual submitted answer.
 */
export default function WorkflowRunnerPreviousAnswers({ history, answers, workflow }) {
  const [open, setOpen] = useState(false);

  const stepMap = {};
  (workflow?.steps || []).forEach(s => { stepMap[s.step_id] = s; });

  const rows = history
    .map((stepId, idx) => {
      const step = stepMap[stepId];
      if (!step || step.question_type === 'info' || step.question_type === 'result') return null;

      const ans = answers[stepId];
      const displayAnswer = formatAnswer(ans, step);
      if (!displayAnswer) return null;

      return { key: `${stepId}-${idx}`, step, displayAnswer };
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
            {rows.map(({ key, step, displayAnswer }) => (
              <div
                key={key}
                className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0"
              >
                <span className="text-xs text-slate-600 flex-1">{step.step_title}</span>
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