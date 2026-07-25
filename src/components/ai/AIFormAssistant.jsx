import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Lightbulb,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import VoiceFormAssistant from "./VoiceFormAssistant";


export default function AIFormAssistant({ 
  formData, 
  formType = "account", // "account" or "entity"
  onSuggestionApply,
  tenant,
  onRequestSave,  // replaces onSave — fires formRef.current.requestSubmit()
  onClose,        // optional — closes/cancels the form
}) {
  // Voice handler: receives { field: value, ... } object and fans out to onSuggestionApply
  const handleVoiceChanges = (changesObj) => {
    if (!onSuggestionApply) return;
    Object.entries(changesObj).forEach(([field, value]) => {
      onSuggestionApply(field, value);
    });
  };
  const [suggestions, setSuggestions] = useState([]);
  const [validationIssues, setValidationIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyzeData = async () => {
    if (!formData || Object.keys(formData).filter(k => formData[k]).length < 2) {
      return;
    }
    
    setLoading(true);
    setIsExpanded(true);
    try {
      const prompt = formType === "account" 
        ? buildAccountAnalysisPrompt(formData, tenant)
        : buildEntityAnalysisPrompt(formData, tenant);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  current_value: { type: "string" },
                  suggested_value: { type: "string" },
                  reason: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] }
                }
              }
            },
            validation_issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  issue: { type: "string" },
                  severity: { type: "string", enum: ["error", "warning", "info"] }
                }
              }
            },
            compliance_notes: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setSuggestions(result.suggestions || []);
      setValidationIssues(result.validation_issues || []);
      setHasAnalyzed(true);
    } catch (error) {
      console.error("Error analyzing form data:", error);
    } finally {
      setLoading(false);
    }
  };

  const buildAccountAnalysisPrompt = (data, tenant) => {
    return `You are a CRS (Common Reporting Standard) compliance expert. Analyze this account data for a financial institution in ${tenant?.jurisdiction || "an unknown jurisdiction"}.

Account Data:
${JSON.stringify(data, null, 2)}

Please analyze this account data and provide:
1. Suggestions for improving data quality or completeness
2. Validation issues that might affect CRS reporting
3. Compliance notes based on CRS requirements

Focus on:
- Tax residency information completeness
- Address validation for CRS indicia detection
- Required fields for reportability determination
- Pre-existing vs new account rules
- Deceased account holder requirements if applicable

Be specific and actionable. Only flag real issues, not minor stylistic concerns.`;
  };

  const buildEntityAnalysisPrompt = (data, tenant) => {
    return `You are a CRS (Common Reporting Standard) compliance expert. Analyze this entity data for classification purposes.

Entity Data:
${JSON.stringify(data, null, 2)}

Please analyze this entity data and provide:
1. Suggestions for improving data quality
2. Validation issues that might affect entity classification
3. Notes about potential CRS classification (Reporting FI, Non-Reporting FI, Active NFE, Passive NFE)

Focus on:
- Entity type and structure clarity
- Country of incorporation implications
- GIIN requirements for financial institutions
- Active vs Passive NFE indicators

Be specific and actionable.`;
  };

  const handleApplySuggestion = (suggestion) => {
    if (onSuggestionApply) {
      onSuggestionApply(suggestion.field, suggestion.suggested_value);
    }
    setSuggestions(prev => prev.filter(s => s.field !== suggestion.field));
  };

  const handleDismissSuggestion = (field) => {
    setSuggestions(prev => prev.filter(s => s.field !== field));
  };

  const handleDismissIssue = (field) => {
    setValidationIssues(prev => prev.filter(i => i.field !== field));
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "error": return "bg-red-50 border-red-200 text-red-800";
      case "warning": return "bg-amber-50 border-amber-200 text-amber-800";
      default: return "bg-blue-50 border-blue-200 text-blue-800";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700";
      case "medium": return "bg-amber-100 text-amber-700";
      default: return "bg-green-100 text-green-700";
    }
  };

  // Show button if not analyzed yet, show results if analyzed
  if (!hasAnalyzed && !loading) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          onClick={analyzeData}
          className="w-full bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border-purple-200"
        >
          <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
          Get AI Help with Form
        </Button>
        <VoiceFormAssistant
          formData={formData}
          formType={formType}
          onApplyChanges={handleVoiceChanges}
          onRequestSave={onRequestSave}
          onClose={onClose}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50/50 to-indigo-50/50">
        <CardContent className="py-6">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600 mx-auto mb-2" />
            <p className="text-sm text-slate-600">Analyzing your data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions.length && !validationIssues.length) {
    return (
      <Card className="border-2 border-green-100 bg-gradient-to-br from-green-50/50 to-emerald-50/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800 font-medium">No issues found - form looks good!</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={analyzeData}
              className="text-green-700 hover:text-green-800 hover:bg-green-100"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Re-analyze
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50/50 to-indigo-50/50">
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-purple-50/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span className="font-semibold text-slate-900">AI Form Assistant</span>
          {(suggestions.length > 0 || validationIssues.length > 0) && (
            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">
              {suggestions.length + validationIssues.length} items
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              analyzeData();
            }}
            className="text-purple-700 hover:text-purple-800 hover:bg-purple-100"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Re-analyze
          </Button>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <CardContent className="pt-0 pb-4 space-y-3">
          {/* Voice input available while results are shown */}
          <VoiceFormAssistant
            formData={formData}
            formType={formType}
            onApplyChanges={handleVoiceChanges}
            onRequestSave={onRequestSave}
            onClose={onClose}
          />
          {/* Validation Issues */}
          {validationIssues.map((issue, idx) => (
            <Alert key={`issue-${idx}`} className={getSeverityColor(issue.severity)}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm capitalize">{issue.field?.replace(/_/g, " ")}</p>
                    <p className="text-sm mt-0.5">{issue.issue}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleDismissIssue(issue.field)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Alert>
          ))}

          {/* Suggestions */}
          {suggestions.map((suggestion, idx) => (
            <div 
              key={`suggestion-${idx}`}
              className="p-3 bg-white rounded-lg border border-purple-200 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-sm text-slate-900 capitalize">
                    {suggestion.field?.replace(/_/g, " ")}
                  </span>
                  <Badge className={getPriorityColor(suggestion.priority)}>
                    {suggestion.priority}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleDismissSuggestion(suggestion.field)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <p className="text-sm text-slate-600 mb-2">{suggestion.reason}</p>
              
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {suggestion.current_value && (
                    <span>Current: <span className="text-slate-700">
                      {typeof suggestion.current_value === 'object' 
                        ? JSON.stringify(suggestion.current_value) 
                        : suggestion.current_value}
                    </span></span>
                  )}
                  {suggestion.current_value && suggestion.suggested_value && " → "}
                  {suggestion.suggested_value && (
                    <span className="text-purple-700 font-medium">
                      {typeof suggestion.suggested_value === 'object' 
                        ? JSON.stringify(suggestion.suggested_value) 
                        : suggestion.suggested_value}
                    </span>
                  )}
                </div>
                
                {suggestion.suggested_value && onSuggestionApply && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-purple-50 hover:bg-purple-100 border-purple-200"
                    onClick={() => handleApplySuggestion(suggestion)}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Apply
                  </Button>
                )}
              </div>
            </div>
          ))}


        </CardContent>
      )}
    </Card>
  );
}