import React, { useMemo } from "react";
import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  GitBranch,
  FileCheck,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function WorkflowFlowChart({ 
  workflow, 
  currentStepId, 
  completedSteps = [],
  answers = {},
  compact = false 
}) {
  const stepMap = useMemo(() => {
    if (!workflow?.steps) return {};

    const map = {};
    workflow.steps.forEach(step => {
      map[step.step_id] = step;
    });
    return map;
  }, [workflow]);

  const buildFlowStructure = () => {
    const visited = new Set();
    const structure = [];
    let currentId = workflow.steps[0]?.step_id;
    let depth = 0;
    const maxDepth = 20;

    while (currentId && depth < maxDepth) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const step = stepMap[currentId];
      if (!step) break;

      const isCompleted = completedSteps.includes(currentId);
      const isCurrent = currentId === currentStepId;
      const answer = answers[currentId];

      structure.push({
        step,
        isCompleted,
        isCurrent,
        answer,
        depth
      });

      // Determine next step
      let nextId = null;
      
      if (step.conditional_logic) {
        nextId = step.conditional_logic.next_step || step.conditional_logic.else_step;
      } else if (answer && step.options) {
        const selectedOption = step.options.find(opt => 
          opt.value === answer || opt.label === answer
        );
        nextId = selectedOption?.next_step;
      } else if (step.options?.[0]?.next_step) {
        nextId = step.options[0].next_step;
      }

      currentId = nextId;
      depth++;
    }

    return structure;
  };

  const flowStructure = buildFlowStructure();

  const getStepIcon = (step, isCompleted, isCurrent) => {
    if (isCompleted) return CheckCircle2;
    if (isCurrent) return Circle;
    if (!step.options || step.options.length === 0) return FileCheck;
    if (step.options.length > 2 || step.conditional_logic) return GitBranch;
    return Circle;
  };

  const getStepColor = (isCompleted, isCurrent) => {
    if (isCompleted) return "bg-green-100 border-green-300 text-green-700";
    if (isCurrent) return "bg-indigo-100 border-indigo-400 text-indigo-700";
    return "bg-slate-50 border-slate-200 text-slate-500";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {flowStructure.slice(0, 8).map((item, idx) => {
          const Icon = getStepIcon(item.step, item.isCompleted, item.isCurrent);
          return (
            <React.Fragment key={item.step.step_id}>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all flex-shrink-0",
                  getStepColor(item.isCompleted, item.isCurrent)
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium whitespace-nowrap">
                  {item.step.step_title?.substring(0, 20) || `Step ${idx + 1}`}
                  {item.step.step_title?.length > 20 && '...'}
                </span>
              </div>
              {idx < flowStructure.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
        {flowStructure.length > 8 && (
          <Badge variant="outline" className="flex-shrink-0">
            +{flowStructure.length - 8} more
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white">
      <CardContent className="p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Workflow Flowchart
            </h3>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              {completedSteps.length} / {flowStructure.length} steps
            </Badge>
          </div>

          <div className="relative space-y-3">
            {flowStructure.map((item, idx) => {
              const Icon = getStepIcon(item.step, item.isCompleted, item.isCurrent);
              const hasMultiplePaths = item.step.options?.length > 2 || item.step.conditional_logic;

              return (
                <div key={item.step.step_id} className="relative">
                  {/* Connecting line to previous step */}
                  {idx > 0 && (
                    <div className="absolute left-6 -top-3 w-0.5 h-3 bg-slate-300" />
                  )}

                  <div
                    className={cn(
                      "relative flex items-start gap-4 p-4 rounded-lg border-2 transition-all",
                      getStepColor(item.isCompleted, item.isCurrent),
                      item.isCurrent && "shadow-md ring-2 ring-indigo-200"
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                        item.isCompleted && "bg-green-600 text-white",
                        item.isCurrent && "bg-indigo-600 text-white animate-pulse",
                        !item.isCompleted && !item.isCurrent && "bg-slate-200 text-slate-500"
                      )}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <h4 className={cn(
                            "font-semibold text-sm mb-1",
                            item.isCurrent ? "text-indigo-900" : "text-slate-900"
                          )}>
                            {item.step.step_title}
                          </h4>
                          {item.step.question_text && (
                            <p className="text-xs text-slate-600">
                              {item.step.question_text}
                            </p>
                          )}
                        </div>
                        
                        {item.isCompleted && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {item.isCurrent && (
                          <Badge className="bg-indigo-600 text-white flex-shrink-0">
                            Current
                          </Badge>
                        )}
                      </div>

                      {/* Show answer if completed */}
                      {item.isCompleted && item.answer && (
                        <div className="mt-2 px-3 py-2 bg-white rounded border border-green-200">
                          <p className="text-xs text-slate-600 mb-1">Answer:</p>
                          <p className="text-sm font-medium text-slate-900">
                            {item.step.options?.find(o => o.value === item.answer)?.label || item.answer}
                          </p>
                        </div>
                      )}

                      {/* Show branch indicator */}
                      {hasMultiplePaths && !item.isCompleted && (
                        <div className="mt-2 flex items-center gap-2">
                          <GitBranch className="w-3 h-3 text-amber-600" />
                          <span className="text-xs text-amber-700 font-medium">
                            Decision Point ({item.step.options?.length || 2} paths)
                          </span>
                        </div>
                      )}

                      {/* Show help text for current step */}
                      {item.isCurrent && item.step.help_text && (
                        <div className="mt-2 flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-blue-900">{item.step.help_text}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Arrow indicator for next step */}
                  {idx < flowStructure.length - 1 && (
                    <div className="flex items-center justify-center py-1">
                      <ArrowRight className={cn(
                        "w-5 h-5",
                        item.isCompleted ? "text-green-500" : "text-slate-300"
                      )} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}