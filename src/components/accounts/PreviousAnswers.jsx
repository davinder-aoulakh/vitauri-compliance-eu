import React, { useState } from "react";
import { FileCheck, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function PreviousAnswers({ history, stepMap, answers, getStepOptions }) {
  const [open, setOpen] = useState(false);

  const rows = history
    .map((stepId) => {
      const step = stepMap[stepId];
      if (!step || step.question_type === 'info' || step.question_type === 'result') return null;
      const ans = answers[stepId];
      if (ans === null || ans === undefined || ans === '') return null;
      let displayAnswer = '';
      if (typeof ans === 'boolean') displayAnswer = ans ? 'Yes' : 'No';
      else if (Array.isArray(ans)) {
        // Map values to labels using step options
        const opts = getStepOptions(step);
        displayAnswer = ans.map(v => {
          const matched = opts.find(o => o.value === v);
          return matched ? matched.label : v;
        }).join(', ');
      }
      else if (typeof ans === 'object') {
        // file_upload: show filename
        if (ans.file_name) {
          displayAnswer = ans.file_name;
        } else if (step.question_type === 'address_input') {
          // For address steps, show a neutral summary to avoid browser autofill detection
          displayAnswer = ans.country ? `Address provided (${ans.country})` : 'Address provided';
        } else {
          // multi_field_input: render as "Label: value" pairs from multi_fields config
          const fields = step.multi_fields || [];
          const pairs = Object.entries(ans)
            .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false)
            .map(([k, v]) => {
              const fieldDef = fields.find(f => f.field_id === k);
              const label = fieldDef?.display_label || k;
              const val = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
              return `${label}: ${val}`;
            });
          displayAnswer = pairs.join(' | ');
        }
      }
      else {
        // Try label lookup first (covers yes_no with custom options, single_choice, etc.)
        const opts = getStepOptions(step);
        const matched = opts.find(o => o.value === ans);
        if (matched) {
          displayAnswer = matched.label;
        } else if (ans === 'YES') {
          displayAnswer = 'Yes';
        } else if (ans === 'NO') {
          displayAnswer = 'No';
        } else {
          displayAnswer = String(ans);
        }
      }
      if (!displayAnswer) return null;
      return { stepId, step, displayAnswer };
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
            {rows.map(({ stepId, step, displayAnswer }) => (
              <div key={stepId} className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-600 flex-1">{step.step_title}</span>
                <span className="text-xs font-medium text-slate-900 text-right max-w-[200px]">{displayAnswer}</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}