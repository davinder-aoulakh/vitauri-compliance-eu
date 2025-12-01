import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  ArrowRight,
  Building2,
  Wallet,
  ThumbsUp,
  ThumbsDown,
  HelpCircle
} from "lucide-react";

export default function AIClassificationAssistant({ 
  record, 
  recordType, // 'entity' or 'account'
  onApplySuggestion,
  existingClassification 
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState(null);

  const analyzeRecord = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      let prompt = '';
      let responseSchema = {};

      if (recordType === 'entity') {
        prompt = `You are a CRS (Common Reporting Standard) classification expert. Analyze the following entity and suggest the most appropriate RFI (Reporting Financial Institution) classification.

ENTITY DATA:
- Name: ${record.entity_name}
- Type: ${record.entity_type}
- Country of Incorporation: ${record.country_of_incorporation}
- Tax ID: ${record.tax_id || 'Not provided'}
- GIIN: ${record.giin || 'Not provided'}
- Current Classification: ${record.rfi_status || 'Not classified'}
- FI Type: ${record.fi_type || 'Not specified'}

CRS CLASSIFICATION OPTIONS:
1. reporting_fi - Reporting Financial Institution (must report accounts)
2. non_reporting_fi - Non-Reporting Financial Institution (exempt)
3. nfe_active - Active Non-Financial Entity
4. nfe_passive - Passive Non-Financial Entity

FI TYPE OPTIONS (if reporting_fi):
- custodial_institution
- depository_institution
- investment_entity
- specified_insurance_company

Analyze the entity characteristics and provide:
1. Suggested classification with confidence level
2. Reasoning for the suggestion
3. Key factors considered
4. Any additional information needed for definitive classification
5. Potential risks if misclassified`;

        responseSchema = {
          type: "object",
          properties: {
            suggested_classification: { type: "string" },
            suggested_fi_type: { type: "string" },
            confidence_level: { type: "number" },
            reasoning: { type: "string" },
            key_factors: { type: "array", items: { type: "string" } },
            additional_info_needed: { type: "array", items: { type: "string" } },
            misclassification_risks: { type: "string" },
            alternative_classifications: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  classification: { type: "string" },
                  likelihood: { type: "string" },
                  condition: { type: "string" }
                }
              }
            }
          }
        };
      } else {
        // Account classification
        prompt = `You are a CRS (Common Reporting Standard) reportability expert. Analyze the following account and determine its reportability status.

ACCOUNT DATA:
- Account Number: ${record.account_number}
- Holder Name: ${record.account_holder_name}
- Holder Type: ${record.account_holder_type}
- Account Type: ${record.account_type}
- Balance: ${record.year_end_cash_value || record.account_balance || 'Not specified'} ${record.year_end_cash_value_currency || 'USD'}
- Is Pre-existing: ${record.is_pre_existing ? 'Yes' : 'No'}
- Country of Residence: ${record.account_holder_address?.country || 'Not specified'}
- Tax Residencies: ${JSON.stringify(record.tax_residencies || [])}
- Self-Certification: ${record.self_certification_obtained ? 'Yes' : 'No'}
- Entity Classification (if entity account): ${record.entity_classification || 'N/A'}
- Current Status: ${record.reportability_status || 'Not classified'}

REPORTABILITY OPTIONS:
1. reportable - Account is reportable to tax authorities
2. non_reportable - Account is not reportable
3. pending_review - Requires further review
4. excluded - Excluded from CRS reporting

Analyze and provide:
1. Suggested reportability status with confidence
2. Jurisdictions where reportable (if applicable)
3. Reasoning for the suggestion
4. Key indicia found
5. Missing information that could affect classification`;

        responseSchema = {
          type: "object",
          properties: {
            suggested_status: { type: "string" },
            confidence_level: { type: "number" },
            reportable_jurisdictions: { type: "array", items: { type: "string" } },
            reasoning: { type: "string" },
            key_indicia: { type: "array", items: { type: "string" } },
            missing_information: { type: "array", items: { type: "string" } },
            self_certification_required: { type: "boolean" },
            controlling_persons_required: { type: "boolean" },
            due_diligence_notes: { type: "string" }
          }
        };
      }

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: responseSchema
      });

      setSuggestion(response);
    } catch (err) {
      console.error("AI classification error:", err);
      setError("Failed to analyze record. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplySuggestion = () => {
    if (!suggestion) return;

    if (recordType === 'entity') {
      onApplySuggestion?.({
        rfi_status: suggestion.suggested_classification,
        fi_type: suggestion.suggested_fi_type
      });
    } else {
      onApplySuggestion?.({
        reportability_status: suggestion.suggested_status,
        reportable_jurisdictions: suggestion.reportable_jurisdictions
      });
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'bg-green-500';
    if (confidence >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          AI Classification Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {!suggestion && !analyzing && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {recordType === 'entity' ? (
                <Building2 className="w-8 h-8 text-indigo-600" />
              ) : (
                <Wallet className="w-8 h-8 text-indigo-600" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Get AI Classification Suggestion
            </h3>
            <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">
              Our AI will analyze the {recordType} characteristics and suggest the most appropriate 
              {recordType === 'entity' ? ' RFI classification' : ' reportability status'}.
            </p>
            <Button
              onClick={analyzeRecord}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Brain className="w-4 h-4 mr-2" />
              Analyze {recordType === 'entity' ? 'Entity' : 'Account'}
            </Button>
          </div>
        )}

        {analyzing && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Analyzing {recordType} data...</p>
            <p className="text-sm text-slate-500">This may take a few seconds</p>
          </div>
        )}

        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-sm text-red-900">{error}</AlertDescription>
          </Alert>
        )}

        {suggestion && (
          <div className="space-y-6">
            {/* Main Suggestion */}
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-indigo-600 font-medium mb-1">AI Suggestion</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {recordType === 'entity' 
                        ? suggestion.suggested_classification?.replace(/_/g, ' ').toUpperCase()
                        : suggestion.suggested_status?.replace(/_/g, ' ').toUpperCase()
                      }
                    </p>
                    {recordType === 'entity' && suggestion.suggested_fi_type && (
                      <p className="text-sm text-slate-600 mt-1">
                        FI Type: {suggestion.suggested_fi_type?.replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600 mb-1">Confidence</p>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={suggestion.confidence_level} 
                        className="w-24 h-2"
                      />
                      <span className="font-bold text-lg">{suggestion.confidence_level}%</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white/60 rounded-lg mb-4">
                  <p className="text-sm text-slate-700">{suggestion.reasoning}</p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleApplySuggestion}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Apply Suggestion
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={analyzeRecord}
                    className="flex-1"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Re-analyze
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Reportable Jurisdictions (for accounts) */}
            {recordType === 'account' && suggestion.reportable_jurisdictions?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    Reportable Jurisdictions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {suggestion.reportable_jurisdictions.map((j, idx) => (
                      <Badge key={idx} className="bg-blue-100 text-blue-800">{j}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Factors / Indicia */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  {recordType === 'entity' ? 'Key Factors Considered' : 'Key Indicia Found'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(suggestion.key_factors || suggestion.key_indicia || []).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Missing Information */}
            {(suggestion.additional_info_needed?.length > 0 || suggestion.missing_information?.length > 0) && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                    <HelpCircle className="w-4 h-4" />
                    Additional Information Needed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(suggestion.additional_info_needed || suggestion.missing_information || []).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Alternative Classifications (for entities) */}
            {recordType === 'entity' && suggestion.alternative_classifications?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Alternative Classifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {suggestion.alternative_classifications.map((alt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <div>
                          <span className="font-medium text-sm">{alt.classification?.replace(/_/g, ' ')}</span>
                          <p className="text-xs text-slate-500">{alt.condition}</p>
                        </div>
                        <Badge variant="outline">{alt.likelihood}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Risk Warning */}
            {suggestion.misclassification_risks && (
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-sm text-red-900">
                  <strong>Misclassification Risk:</strong> {suggestion.misclassification_risks}
                </AlertDescription>
              </Alert>
            )}

            {/* Due Diligence Notes (for accounts) */}
            {suggestion.due_diligence_notes && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-900">
                  <strong>Due Diligence Notes:</strong> {suggestion.due_diligence_notes}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}