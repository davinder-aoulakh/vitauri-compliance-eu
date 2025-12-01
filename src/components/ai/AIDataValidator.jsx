import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  TrendingUp,
  MapPin,
  Users,
  DollarSign,
  Calendar,
  Flag,
  RefreshCw
} from "lucide-react";

export default function AIDataValidator({ accounts, entities, controllingPersons, onIssueSelect }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runAIValidation = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      // Prepare data summary for AI analysis
      const dataSummary = {
        accounts: accounts.map(a => ({
          id: a.id,
          account_number: a.account_number,
          holder_name: a.account_holder_name,
          holder_type: a.account_holder_type,
          balance: a.year_end_cash_value || a.account_balance,
          currency: a.year_end_cash_value_currency || 'USD',
          country: a.account_holder_address?.country,
          tax_residencies: a.tax_residencies,
          is_pre_existing: a.is_pre_existing,
          account_type: a.account_type,
          status: a.status,
          reportability_status: a.reportability_status,
          date_of_birth: a.date_of_birth,
          self_certification_obtained: a.self_certification_obtained
        })),
        entities: entities.map(e => ({
          id: e.id,
          name: e.entity_name,
          type: e.entity_type,
          country: e.country_of_incorporation,
          rfi_status: e.rfi_status,
          fi_type: e.fi_type,
          tax_id: e.tax_id,
          giin: e.giin
        })),
        controllingPersons: controllingPersons?.map(cp => ({
          id: cp.id,
          name: cp.full_name,
          account_id: cp.account_id,
          tax_residencies: cp.tax_residencies,
          ownership_percentage: cp.ownership_percentage
        })) || []
      };

      const prompt = `You are a CRS (Common Reporting Standard) compliance expert. Analyze the following financial account and entity data for potential anomalies, inconsistencies, and compliance risks.

DATA TO ANALYZE:
${JSON.stringify(dataSummary, null, 2)}

Please identify:
1. DATA ANOMALIES: Unusual patterns in financial figures (e.g., round numbers suggesting estimates, unusually high/low balances, suspicious patterns)
2. ADDRESS INCONSISTENCIES: Mismatches between declared tax residencies and addresses, incomplete address data
3. IDENTITY ISSUES: Missing or potentially invalid TINs, date of birth issues, name format problems
4. CLASSIFICATION CONCERNS: Accounts that may be incorrectly classified, missing self-certifications for reportable accounts
5. CONTROLLING PERSON ISSUES: Missing controlling persons for entity accounts, ownership percentage issues
6. COMPLIANCE RISKS: High-risk indicators that may require additional due diligence

For each issue found, provide:
- severity: "high", "medium", or "low"
- category: one of "financial_anomaly", "address_issue", "identity_issue", "classification_concern", "controlling_person_issue", "compliance_risk"
- affected_record_id: the id of the affected account/entity
- affected_record_type: "account", "entity", or "controlling_person"
- affected_record_name: name for display
- description: clear explanation of the issue
- recommendation: suggested action to resolve

Return a JSON object with this structure:
{
  "summary": {
    "total_issues": number,
    "high_severity": number,
    "medium_severity": number,
    "low_severity": number,
    "data_quality_score": number (0-100)
  },
  "issues": [array of issues as described above],
  "positive_findings": [array of strings noting good data quality aspects]
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            summary: {
              type: "object",
              properties: {
                total_issues: { type: "number" },
                high_severity: { type: "number" },
                medium_severity: { type: "number" },
                low_severity: { type: "number" },
                data_quality_score: { type: "number" }
              }
            },
            issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string" },
                  category: { type: "string" },
                  affected_record_id: { type: "string" },
                  affected_record_type: { type: "string" },
                  affected_record_name: { type: "string" },
                  description: { type: "string" },
                  recommendation: { type: "string" }
                }
              }
            },
            positive_findings: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setResults(response);
    } catch (err) {
      console.error("AI validation error:", err);
      setError("Failed to run AI validation. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'financial_anomaly': return <DollarSign className="w-4 h-4" />;
      case 'address_issue': return <MapPin className="w-4 h-4" />;
      case 'identity_issue': return <Users className="w-4 h-4" />;
      case 'classification_concern': return <Flag className="w-4 h-4" />;
      case 'controlling_person_issue': return <Users className="w-4 h-4" />;
      case 'compliance_risk': return <AlertTriangle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const groupedIssues = results?.issues?.reduce((acc, issue) => {
    const cat = issue.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(issue);
    return acc;
  }, {}) || {};

  const categoryLabels = {
    financial_anomaly: 'Financial Anomalies',
    address_issue: 'Address Issues',
    identity_issue: 'Identity Issues',
    classification_concern: 'Classification Concerns',
    controlling_person_issue: 'Controlling Person Issues',
    compliance_risk: 'Compliance Risks'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            AI-Powered Data Validation
          </CardTitle>
          <Button
            onClick={runAIValidation}
            disabled={analyzing || (!accounts?.length && !entities?.length)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : results ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-analyze
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Run AI Analysis
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {!results && !analyzing && (
          <Alert className="bg-purple-50 border-purple-200">
            <Brain className="w-4 h-4 text-purple-600" />
            <AlertDescription className="text-sm text-purple-900">
              AI-powered validation analyzes your data for anomalies, inconsistencies, and compliance risks 
              that traditional schema validation might miss. Click "Run AI Analysis" to start.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-sm text-red-900">{error}</AlertDescription>
          </Alert>
        )}

        {results && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold">{results.summary?.data_quality_score || 0}</p>
                  <p className="text-xs opacity-90">Quality Score</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-slate-200">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-slate-700">{results.summary?.total_issues || 0}</p>
                  <p className="text-xs text-slate-500">Total Issues</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-red-200 bg-red-50">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{results.summary?.high_severity || 0}</p>
                  <p className="text-xs text-red-600">High Severity</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-amber-200 bg-amber-50">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700">{results.summary?.medium_severity || 0}</p>
                  <p className="text-xs text-amber-600">Medium</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{results.summary?.low_severity || 0}</p>
                  <p className="text-xs text-blue-600">Low</p>
                </CardContent>
              </Card>
            </div>

            {/* Positive Findings */}
            {results.positive_findings?.length > 0 && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Positive Findings
                  </h4>
                  <ul className="space-y-1">
                    {results.positive_findings.map((finding, idx) => (
                      <li key={idx} className="text-sm text-green-700 flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        {finding}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Issues by Category */}
            {Object.keys(groupedIssues).length > 0 && (
              <Accordion type="multiple" className="space-y-2">
                {Object.entries(groupedIssues).map(([category, issues]) => (
                  <AccordionItem key={category} value={category} className="border rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        {getCategoryIcon(category)}
                        <span className="font-medium">{categoryLabels[category] || category}</span>
                        <Badge variant="outline" className="ml-2">
                          {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3">
                        {issues.map((issue, idx) => (
                          <Card 
                            key={idx} 
                            className={`border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
                              issue.severity === 'high' ? 'border-l-red-500' :
                              issue.severity === 'medium' ? 'border-l-amber-500' : 'border-l-blue-500'
                            }`}
                            onClick={() => onIssueSelect?.(issue)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge className={getSeverityColor(issue.severity)}>
                                    {issue.severity?.toUpperCase()}
                                  </Badge>
                                  <span className="text-sm text-slate-500">
                                    {issue.affected_record_type}: {issue.affected_record_name}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-slate-700 mb-2">{issue.description}</p>
                              <div className="p-2 bg-slate-50 rounded text-sm">
                                <span className="font-medium text-slate-600">Recommendation: </span>
                                <span className="text-slate-700">{issue.recommendation}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}

            {results.issues?.length === 0 && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-green-800">No Issues Detected</h3>
                  <p className="text-sm text-green-700">Your data appears to be consistent and well-formed.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}