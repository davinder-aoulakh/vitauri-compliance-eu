import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Loader2, 
  HelpCircle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Book,
  ArrowRight
} from "lucide-react";

export default function AIWorkflowHelper({ 
  currentStep,
  workflow,
  answers,
  accountData,
  entityData,
  onSuggestedAnswer
}) {
  const [explanation, setExplanation] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastStepId, setLastStepId] = useState(null);

  useEffect(() => {
    // Reset when step changes
    if (currentStep?.step_id !== lastStepId) {
      setExplanation(null);
      setSuggestion(null);
      setIsExpanded(false);
      setLastStepId(currentStep?.step_id);
    }
  }, [currentStep?.step_id, lastStepId]);

  const getHelp = async () => {
    if (!currentStep) return;
    
    setLoading(true);
    setIsExpanded(true);

    try {
      const contextData = accountData || entityData || {};
      const workflowType = workflow?.workflow_type || "unknown";

      const prompt = `You are a CRS (Common Reporting Standard) compliance expert helping a user complete a ${workflowType} workflow.

Current Workflow: ${workflow?.workflow_name}
Current Step: ${currentStep.step_title}
Question: ${currentStep.question_text || currentStep.step_title}
Help Text: ${currentStep.help_text || "None provided"}
Regulatory Reference: ${currentStep.regulatory_reference || "None"}

Available Options: ${currentStep.options?.map(o => o.label).join(", ") || "Free input"}

Context Data:
${JSON.stringify(contextData, null, 2)}

Previous Answers in this workflow:
${JSON.stringify(answers, null, 2)}

Please provide:
1. A clear, simple explanation of what this question is asking and why it matters for CRS compliance
2. Based on the context data provided, suggest the most appropriate answer if one can be determined
3. If you cannot suggest an answer, explain what information would be needed

Keep explanations concise and accessible to non-experts. Use plain language.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            explanation: {
              type: "string",
              description: "Plain language explanation of the question"
            },
            why_it_matters: {
              type: "string",
              description: "Brief explanation of CRS relevance"
            },
            suggested_answer: {
              type: "string",
              description: "Suggested answer value based on context, or null if cannot determine"
            },
            suggestion_confidence: {
              type: "string",
              enum: ["high", "medium", "low", "none"],
              description: "Confidence in the suggested answer"
            },
            suggestion_reasoning: {
              type: "string",
              description: "Why this answer is suggested or why no suggestion can be made"
            },
            additional_context: {
              type: "string",
              description: "Any additional helpful information"
            }
          }
        }
      });

      setExplanation({
        text: result.explanation,
        whyItMatters: result.why_it_matters,
        additionalContext: result.additional_context
      });

      if (result.suggested_answer && result.suggestion_confidence !== "none") {
        setSuggestion({
          value: result.suggested_answer,
          confidence: result.suggestion_confidence,
          reasoning: result.suggestion_reasoning
        });
      } else {
        setSuggestion(null);
      }

    } catch (error) {
      console.error("Error getting AI help:", error);
      setExplanation({
        text: "Unable to provide AI assistance at this time. Please review the help text above or consult your compliance team.",
        whyItMatters: null,
        additionalContext: null
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = () => {
    if (suggestion?.value && onSuggestedAnswer) {
      // Find the matching option value
      const matchingOption = currentStep.options?.find(
        o => o.label.toLowerCase() === suggestion.value.toLowerCase() ||
             o.value.toLowerCase() === suggestion.value.toLowerCase()
      );
      
      onSuggestedAnswer(matchingOption?.value || suggestion.value);
    }
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case "high": return "bg-green-100 text-green-700 border-green-200";
      case "medium": return "bg-amber-100 text-amber-700 border-amber-200";
      case "low": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  if (!currentStep) return null;

  return (
    <Card className="border border-indigo-200 bg-gradient-to-br from-indigo-50/30 to-purple-50/30">
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-indigo-50/50 transition-colors"
        onClick={() => !loading && (explanation ? setIsExpanded(!isExpanded) : getHelp())}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <span className="font-medium text-slate-900">AI Assistant</span>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
        </div>
        
        {!explanation && !loading && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
            onClick={(e) => {
              e.stopPropagation();
              getHelp();
            }}
          >
            <HelpCircle className="w-3 h-3 mr-1" />
            Get Help
          </Button>
        )}
        
        {explanation && !loading && (
          isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )
        )}
      </div>

      {isExpanded && (
        <CardContent className="pt-0 pb-4 space-y-4">
          {loading ? (
            <div className="text-center py-6">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
              <p className="text-sm text-slate-600">AI is analyzing this question...</p>
            </div>
          ) : (
            <>
              {/* Explanation */}
              {explanation && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-indigo-100">
                    <MessageCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700">{explanation.text}</p>
                    </div>
                  </div>

                  {explanation.whyItMatters && (
                    <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <Book className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-800 mb-1">Why it matters for CRS</p>
                        <p className="text-sm text-amber-700">{explanation.whyItMatters}</p>
                      </div>
                    </div>
                  )}

                  {explanation.additionalContext && (
                    <p className="text-xs text-slate-500 italic px-1">{explanation.additionalContext}</p>
                  )}
                </div>
              )}

              {/* Suggestion */}
              {suggestion && (
                <Alert className="bg-green-50 border-green-200">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-800">AI Suggestion</span>
                      <Badge className={getConfidenceColor(suggestion.confidence)}>
                        {suggestion.confidence} confidence
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-green-700">{suggestion.reasoning}</p>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-green-200">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-green-800">Suggested:</span>
                        <Badge className="bg-green-600 text-white">{suggestion.value}</Badge>
                      </div>
                      
                      {onSuggestedAnswer && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={handleApplySuggestion}
                        >
                          Apply
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Alert>
              )}

              {/* Refresh button */}
              {explanation && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={getHelp}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Refresh AI Analysis
                </Button>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}