import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, CheckCircle2, FileCode2 } from "lucide-react";

function generateTestScript(workflow) {
  if (!workflow) return "";

  const steps = workflow.steps || [];
  const questionSteps = steps.filter(s => !["result", "info"].includes(s.question_type));
  const resultSteps = steps.filter(s => s.question_type === "result");

  // Build test cases: one happy path + one per major branch
  const testCases = [];

  // Happy path: pick first option for every step
  const happyPathAnswers = questionSteps.map(s => {
    const firstOption = s.options?.[0];
    return {
      step_id: s.step_id,
      question: s.step_title || s.question_text || s.step_id,
      answer: firstOption ? `${firstOption.value} (${firstOption.label})` : "Enter value",
      question_type: s.question_type,
    };
  });

  testCases.push({
    name: "Happy Path – First Branch",
    description: "Follow the first available option at every decision point",
    answers: happyPathAnswers,
  });

  // Alternate path: pick last option for every step
  const altPathAnswers = questionSteps.map(s => {
    const lastOption = s.options?.[s.options.length - 1];
    return {
      step_id: s.step_id,
      question: s.step_title || s.question_text || s.step_id,
      answer: lastOption ? `${lastOption.value} (${lastOption.label})` : "Enter value",
      question_type: s.question_type,
    };
  });

  testCases.push({
    name: "Alternate Path – Last Branch",
    description: "Follow the last available option at every decision point",
    answers: altPathAnswers,
  });

  // YES path and NO path for yes_no questions
  const yesNoSteps = questionSteps.filter(s => s.question_type === "yes_no");
  if (yesNoSteps.length > 0) {
    testCases.push({
      name: "All YES Path",
      description: "Answer YES to every yes/no question",
      answers: questionSteps.map(s => ({
        step_id: s.step_id,
        question: s.step_title || s.question_text || s.step_id,
        answer: s.question_type === "yes_no" ? "YES" : (s.options?.[0]?.value || "Enter value"),
        question_type: s.question_type,
      })),
    });

    testCases.push({
      name: "All NO Path",
      description: "Answer NO to every yes/no question",
      answers: questionSteps.map(s => ({
        step_id: s.step_id,
        question: s.step_title || s.question_text || s.step_id,
        answer: s.question_type === "yes_no" ? "NO" : (s.options?.[s.options.length - 1]?.value || "Enter value"),
        question_type: s.question_type,
      })),
    });
  }

  // Build script text
  const lines = [];
  lines.push(`# QA Test Script: ${workflow.workflow_name}`);
  lines.push(`# Workflow Type: ${workflow.workflow_type}`);
  lines.push(`# Version: ${workflow.version || "1.0"}`);
  lines.push(`# Status: ${workflow.status}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Total Steps: ${steps.length} (${questionSteps.length} questions, ${resultSteps.length} results)`);
  lines.push("");
  lines.push("## OVERVIEW");
  lines.push(`This workflow has ${questionSteps.length} decision steps and ${resultSteps.length} possible outcomes.`);
  lines.push("");

  if (resultSteps.length > 0) {
    lines.push("## POSSIBLE OUTCOMES");
    resultSteps.forEach((s, i) => {
      lines.push(`  ${i + 1}. [${(s.result_status || "result").toUpperCase()}] ${s.step_title || s.step_id}`);
      if (s.result_description) lines.push(`     → ${s.result_description}`);
    });
    lines.push("");
  }

  lines.push("## ALL WORKFLOW STEPS (Reference)");
  questionSteps.forEach((s, i) => {
    lines.push(`  Step ${i + 1}: ${s.step_title || s.question_text || s.step_id} [${s.question_type}]`);
    if (s.options?.length) {
      s.options.forEach(o => lines.push(`    - ${o.value}: ${o.label}${o.next_step ? ` → ${o.next_step}` : ""}`));
    }
    if (s.help_text) lines.push(`    ℹ️  ${s.help_text}`);
  });
  lines.push("");

  lines.push("## TEST CASES");
  lines.push("");

  testCases.forEach((tc, tcIdx) => {
    lines.push(`---`);
    lines.push(`### TEST CASE ${tcIdx + 1}: ${tc.name}`);
    lines.push(`Description: ${tc.description}`);
    lines.push("");
    lines.push("**Pre-conditions:**");
    lines.push("  - User is logged in with appropriate tenant role");
    lines.push("  - Account exists and is in pending_review status");
    lines.push("  - Navigate to Account → Classify Account → Select this workflow");
    lines.push("");
    lines.push("**Steps:**");
    tc.answers.forEach((a, i) => {
      lines.push(`  ${i + 1}. Question: "${a.question}"`);
      lines.push(`     Answer: ${a.answer}`);
    });
    lines.push("");
    lines.push("**Expected Result:**");
    lines.push("  - Workflow completes and reaches a result step");
    lines.push("  - Account reportability_status is updated accordingly");
    lines.push("  - Classification history entry is created with workflow_answers");
    lines.push("  - Audit log entry is created");
    lines.push("");
    lines.push("**Pass Criteria:**");
    lines.push("  ✓ No error dialogs appear");
    lines.push("  ✓ Result step is displayed with correct status badge");
    lines.push("  ✓ Classification history shows the workflow answers");
    lines.push("  ✓ Account status badge updates in the accounts list");
    lines.push("");
  });

  lines.push("---");
  lines.push("## EDGE CASE TESTS");
  lines.push("");
  lines.push("### EDGE CASE 1: Required Field Validation");
  lines.push("  - Attempt to proceed without answering a required step");
  lines.push("  - Expected: Validation error shown, cannot advance");
  lines.push("");
  lines.push("### EDGE CASE 2: Missing Account Data");
  lines.push("  - Run AI Classify on an account with minimal data (no tax residencies)");
  lines.push("  - Expected: Defaults to pending_review, reasoning explains missing data");
  lines.push("");
  lines.push("### EDGE CASE 3: Re-classification");
  lines.push("  - Classify an account that was previously classified");
  lines.push("  - Expected: New history entry added, old entries preserved");
  lines.push("");
  lines.push("### EDGE CASE 4: Navigation (Back/Forward)");
  lines.push("  - On step 3+, click Back to return to step 1");
  lines.push("  - Change the answer");
  lines.push("  - Expected: Subsequent steps reset / re-routed correctly");

  return lines.join("\n");
}

export default function WorkflowTestScriptGenerator({ workflow, onClose }) {
  const [copied, setCopied] = useState(false);

  const script = generateTestScript(workflow);

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-script-${workflow.workflow_name.replace(/\s+/g, "-").toLowerCase()}-v${workflow.version || "1.0"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const questionCount = (workflow?.steps || []).filter(s => !["result", "info"].includes(s.question_type)).length;
  const resultCount = (workflow?.steps || []).filter(s => s.question_type === "result").length;

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <FileCode2 className="w-3 h-3 mr-1" />
          {workflow?.workflow_name}
        </Badge>
        <Badge variant="outline" className="bg-slate-100 text-slate-700">
          {questionCount} questions
        </Badge>
        <Badge variant="outline" className="bg-slate-100 text-slate-700">
          {resultCount} outcomes
        </Badge>
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          4 test cases generated
        </Badge>
      </div>

      <p className="text-sm text-slate-600">
        Copy or download this script and paste it into the QA Agent as your test goal. The agent will walk through each test case and report pass/fail.
      </p>

      {/* Script textarea */}
      <Textarea
        value={script}
        readOnly
        className="font-mono text-xs min-h-[420px] bg-slate-50 border-slate-200 resize-none"
      />

      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button variant="outline" onClick={handleDownload} className="gap-2">
          <Download className="w-4 h-4" />
          Download .md
        </Button>
        <Button onClick={handleCopy} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy to Clipboard"}
        </Button>
      </div>
    </div>
  );
}