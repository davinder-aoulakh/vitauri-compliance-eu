import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, GitMerge, ChevronDown, ChevronUp, RefreshCw, Wrench } from "lucide-react";
import ApplyFixModal from "@/components/workflows/ApplyFixModal";

const PRIORITY_STYLES = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

const TYPE_ICONS = {
  missing_exit: AlertTriangle,
  redundant_loop: GitMerge,
  simplification: CheckCircle2,
  dead_end: AlertTriangle,
  consolidation: GitMerge,
};

const TYPE_LABELS = {
  missing_exit: "Missing Exit Step",
  redundant_loop: "Redundant Retry Loop",
  simplification: "Simplification Opportunity",
  dead_end: "Dead End Path",
  consolidation: "Consolidation",
};

const FIXABLE_TYPES = ["missing_exit", "dead_end", "redundant_loop"];

function SuggestionCard({ suggestion, index, onApplyFix }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICONS[suggestion.type] || CheckCircle2;
  const priorityStyle = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES.low;
  const isFixable = FIXABLE_TYPES.includes(suggestion.type);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="mt-0.5 p-1.5 rounded-lg bg-indigo-50 shrink-0">
          <Icon className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{suggestion.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priorityStyle}`}>
              {suggestion.priority?.toUpperCase()} PRIORITY
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600">
              {TYPE_LABELS[suggestion.type] || suggestion.type}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{suggestion.problem}</p>
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3 bg-slate-50/50">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Problem</p>
            <p className="text-sm text-slate-700">{suggestion.problem}</p>
          </div>
          {suggestion.affected_steps?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Affected Steps</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestion.affected_steps.map((s, i) => (
                  <span key={i} className="font-mono text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Suggested Fix</p>
            <p className="text-sm text-slate-700">{suggestion.suggested_fix}</p>
          </div>
          {suggestion.paths_affected > 0 && (
            <p className="text-xs text-slate-500">
              Affects <strong>{suggestion.paths_affected}</strong> path{suggestion.paths_affected > 1 ? 's' : ''} out of the total traversal.
            </p>
          )}
          {isFixable && (
            <div className="pt-1">
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-7 text-xs px-3"
                onClick={e => { e.stopPropagation(); onApplyFix(suggestion); }}
              >
                <Wrench className="w-3 h-3 mr-1.5" />
                Apply Fix
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkflowAISuggestions({ pathsSummary, workflowName, workflowStepCount, workflow }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(null);

  const handleApplyFix = (suggestion) => {
    setActiveSuggestion(suggestion);
    setFixModalOpen(true);
  };

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setSuggestions(null);
    setSummary(null);

    try {
      // Build a compact representation of the paths for the LLM
      const outcomeDistribution = {};
      pathsSummary.forEach(p => {
        outcomeDistribution[p.final_status] = (outcomeDistribution[p.final_status] || 0) + 1;
      });

      const cyclePaths = pathsSummary.filter(p => p.final_status === "cycle_detected");
      const terminalPaths = pathsSummary.filter(p => p.final_status === "terminal");
      const missingStepPaths = pathsSummary.filter(p => p.final_status === "missing_step");

      // Identify repeated step sequences (potential redundancies)
      const stepSequences = pathsSummary.map(p => p.step_ids.join(" → "));
      const uniqueSequences = [...new Set(stepSequences)];
      const duplicateCount = stepSequences.length - uniqueSequences.length;

      // Find step IDs that commonly appear in cycle paths
      const cycleStepCounts = {};
      cyclePaths.forEach(p => {
        p.step_ids.forEach(sid => {
          cycleStepCounts[sid] = (cycleStepCounts[sid] || 0) + 1;
        });
      });
      const topCycleSteps = Object.entries(cycleStepCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([sid, count]) => `${sid} (${count}x)`);

      // Sample unique cycle paths (max 5) for context
      const sampleCyclePaths = cyclePaths.slice(0, 5).map(p => p.step_ids.join(" → "));
      const sampleTerminalPaths = terminalPaths.slice(0, 5).map(p => p.step_ids.join(" → "));

      const prompt = `You are a compliance workflow analyst. Analyze the following automated test results from a CRS/FATCA account classification workflow and provide specific, actionable improvement suggestions.

WORKFLOW: "${workflowName}"
TOTAL STEPS DEFINED: ${workflowStepCount}
TOTAL PATHS DISCOVERED: ${pathsSummary.length}

OUTCOME DISTRIBUTION:
${Object.entries(outcomeDistribution).map(([k, v]) => `  - ${k}: ${v} paths`).join('\n')}

DUPLICATE PATH SEQUENCES: ${duplicateCount} paths have identical step sequences (potential redundancy)
UNIQUE SEQUENCES: ${uniqueSequences.length}

STEPS MOST INVOLVED IN CYCLES:
${topCycleSteps.length > 0 ? topCycleSteps.map(s => `  - ${s}`).join('\n') : '  None'}

SAMPLE CYCLE PATHS (retry loops detected):
${sampleCyclePaths.length > 0 ? sampleCyclePaths.map((p, i) => `  ${i + 1}. ${p}`).join('\n') : '  None'}

SAMPLE TERMINAL PATHS (paths that end without a result step):
${sampleTerminalPaths.length > 0 ? sampleTerminalPaths.map((p, i) => `  ${i + 1}. ${p}`).join('\n') : '  None'}

MISSING STEP REFERENCES: ${missingStepPaths.length} paths reference step IDs that don't exist in the workflow.

Based on this data, provide 3-7 specific, concrete suggestions to:
1. Fix missing exit conditions or result steps for terminal/cycle paths
2. Consolidate redundant retry loops 
3. Simplify conditional logic branches
4. Remove or merge steps that create unnecessary complexity

For each suggestion, identify the specific step IDs involved where possible.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            overall_summary: {
              type: "string",
              description: "1-2 sentence overall assessment of the workflow complexity"
            },
            complexity_score: {
              type: "number",
              description: "Complexity score from 1 (simple) to 10 (very complex)"
            },
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  type: {
                    type: "string",
                    description: "One of: missing_exit, redundant_loop, simplification, dead_end, consolidation"
                  },
                  priority: {
                    type: "string",
                    description: "One of: high, medium, low"
                  },
                  problem: { type: "string" },
                  affected_steps: {
                    type: "array",
                    items: { type: "string" }
                  },
                  suggested_fix: { type: "string" },
                  paths_affected: { type: "number" }
                }
              }
            }
          }
        }
      });

      setSuggestions(response.suggestions || []);
      setSummary({ text: response.overall_summary, score: response.complexity_score });
    } catch (err) {
      setError(err?.message || "Failed to analyze workflow");
    } finally {
      setLoading(false);
    }
  };

  const highCount = suggestions?.filter(s => s.priority === "high").length || 0;
  const medCount = suggestions?.filter(s => s.priority === "medium").length || 0;

  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            AI Workflow Suggestions
          </CardTitle>
          <Button
            onClick={analyze}
            disabled={loading}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analyzing...</>
            ) : suggestions ? (
              <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-analyze</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Analyze with AI</>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!suggestions && !loading && !error && (
          <div className="text-center py-8 text-slate-400">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Click "Analyze with AI" to get specific suggestions for improving this workflow's conditional logic and reducing complexity.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-6 justify-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="text-sm">Analyzing {pathsSummary.length} paths for improvement opportunities...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {summary && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-indigo-800">{summary.text}</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-indigo-600 font-medium">Complexity Score:</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    summary.score >= 7 ? 'bg-red-100 text-red-700' :
                    summary.score >= 4 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>{summary.score}/10</span>
                </div>
                {highCount > 0 && (
                  <span className="text-xs text-red-600 font-medium">{highCount} high-priority issue{highCount > 1 ? 's' : ''}</span>
                )}
                {medCount > 0 && (
                  <span className="text-xs text-amber-600 font-medium">{medCount} medium-priority issue{medCount > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions
            .sort((a, b) => {
              const order = { high: 0, medium: 1, low: 2 };
              return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
            })
            .map((s, i) => (
              <SuggestionCard key={i} suggestion={s} index={i} onApplyFix={handleApplyFix} />
            ))}
          </div>
        )}

        {suggestions && suggestions.length === 0 && (
          <div className="text-center py-6 text-green-600">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">No significant issues found</p>
            <p className="text-xs text-slate-500 mt-1">This workflow appears to be well-structured.</p>
          </div>
        )}
      </CardContent>

      {workflow && (
        <ApplyFixModal
          open={fixModalOpen}
          onClose={() => setFixModalOpen(false)}
          suggestion={activeSuggestion}
          workflow={workflow}
          onFixApplied={() => {}}
        />
      )}
    </Card>
  );
}