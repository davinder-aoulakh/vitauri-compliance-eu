import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  RefreshCw,
  Link2,
  Wrench,
  ArrowRight,
  Copy,
  Check,
  Lightbulb,
  GitCompare,
  Shield
} from "lucide-react";

export default function AIDataValidator({ accounts, entities, controllingPersons, onIssueSelect }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("issues");
  const [copiedCorrection, setCopiedCorrection] = useState(null);
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (err) {
        console.error("Error loading user:", err);
      }
    };
    loadUser();
  }, []);

  const copyCorrection = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCorrection(id);
    setTimeout(() => setCopiedCorrection(null), 2000);
  };

  const runAIValidation = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      // Fetch historical audit logs for trend analysis
      const auditLogs = user?.tenant_id 
        ? await base44.entities.AuditLog.filter({ tenant_id: user.tenant_id })
        : [];

      // Fetch custom validation rules
      const customRules = user?.tenant_id
        ? await base44.entities.CustomValidationRule.filter({ 
            tenant_id: user.tenant_id,
            is_active: true
          })
        : [];

      // Build entity-account relationship map for cross-referencing
      const entityAccountMap = {};
      accounts.forEach(a => {
        if (a.entity_id) {
          if (!entityAccountMap[a.entity_id]) entityAccountMap[a.entity_id] = [];
          entityAccountMap[a.entity_id].push(a);
        }
      });

      // Analyze historical trends from audit logs
      const accountChanges = {};
      const entityChanges = {};
      
      auditLogs.forEach(log => {
        if (log.target_entity_type === 'Account' && log.target_entity_id) {
          if (!accountChanges[log.target_entity_id]) {
            accountChanges[log.target_entity_id] = [];
          }
          accountChanges[log.target_entity_id].push({
            action: log.action_type,
            date: log.timestamp || log.created_date,
            changes: log.changes,
            actor: log.actor_email
          });
        } else if (log.target_entity_type === 'Entity' && log.target_entity_id) {
          if (!entityChanges[log.target_entity_id]) {
            entityChanges[log.target_entity_id] = [];
          }
          entityChanges[log.target_entity_id].push({
            action: log.action_type,
            date: log.timestamp || log.created_date,
            changes: log.changes,
            actor: log.actor_email
          });
        }
      });

      // Identify accounts with frequent reportability status changes
      const frequentStatusChanges = Object.entries(accountChanges).map(([accountId, changes]) => {
        const statusChanges = changes.filter(c => 
          c.changes?.reportability_status || 
          (c.action === 'account_classified' && c.changes)
        );
        return {
          account_id: accountId,
          change_count: statusChanges.length,
          changes: statusChanges,
          account_name: accounts.find(a => a.id === accountId)?.account_holder_name
        };
      }).filter(a => a.change_count >= 2);

      // Prepare enriched data summary for AI analysis with historical context
      const dataSummary = {
        historical_trends: {
          account_changes: Object.keys(accountChanges).length,
          entity_changes: Object.keys(entityChanges).length,
          accounts_with_frequent_status_changes: frequentStatusChanges.map(a => ({
            account_id: a.account_id,
            account_name: a.account_name,
            change_count: a.change_count,
            recent_changes: a.changes.slice(-3)
          })),
          total_audit_events: auditLogs.length
        },
        custom_validation_rules: customRules.map(rule => ({
          rule_name: rule.rule_name,
          description: rule.description,
          target_entity_type: rule.target_entity_type,
          severity: rule.severity,
          rule_type: rule.rule_type,
          field_name: rule.field_name,
          condition: rule.condition,
          error_message: rule.error_message,
          suggested_action: rule.suggested_action
        })),
        accounts: accounts.map(a => {
          const linkedEntity = entities.find(e => e.id === a.entity_id);
          return {
            id: a.id,
            account_number: a.account_number,
            holder_name: a.account_holder_name,
            holder_type: a.account_holder_type,
            balance: a.year_end_cash_value || a.account_balance,
            currency: a.year_end_cash_value_currency || 'USD',
            country: a.account_holder_address?.country,
            address: a.account_holder_address,
            current_address: a.current_address,
            tax_residencies: a.tax_residencies,
            is_pre_existing: a.is_pre_existing,
            account_type: a.account_type,
            status: a.status,
            reportability_status: a.reportability_status,
            date_of_birth: a.date_of_birth,
            place_of_birth: a.place_of_birth,
            self_certification_obtained: a.self_certification_obtained,
            self_certification_date: a.self_certification_date,
            entity_classification: a.entity_classification,
            gross_payments: a.gross_payments,
            account_closed_during_period: a.account_closed_during_period,
            // Cross-reference data
            linked_entity_id: a.entity_id,
            linked_entity_name: linkedEntity?.entity_name,
            linked_entity_country: linkedEntity?.country_of_incorporation,
            linked_entity_rfi_status: linkedEntity?.rfi_status
          };
        }),
        entities: entities.map(e => ({
          id: e.id,
          name: e.entity_name,
          type: e.entity_type,
          country: e.country_of_incorporation,
          address: e.address,
          rfi_status: e.rfi_status,
          fi_type: e.fi_type,
          tax_id: e.tax_id,
          giin: e.giin,
          classification_completed_date: e.classification_completed_date,
          // Cross-reference: accounts linked to this entity
          linked_accounts_count: entityAccountMap[e.id]?.length || 0,
          linked_accounts_total_balance: entityAccountMap[e.id]?.reduce((sum, a) => sum + (a.year_end_cash_value || 0), 0) || 0
        })),
        controllingPersons: controllingPersons?.map(cp => {
          const linkedAccount = accounts.find(a => a.id === cp.account_id);
          return {
            id: cp.id,
            name: cp.full_name,
            date_of_birth: cp.date_of_birth,
            address: cp.address,
            account_id: cp.account_id,
            account_holder_name: linkedAccount?.account_holder_name,
            tax_residencies: cp.tax_residencies,
            ownership_percentage: cp.ownership_percentage,
            control_type: cp.control_type,
            is_reportable: cp.is_reportable
          };
        }) || [],
        // Statistical patterns for anomaly detection
        statistics: {
          total_accounts: accounts.length,
          total_entities: entities.length,
          total_controlling_persons: controllingPersons?.length || 0,
          avg_account_balance: accounts.length > 0 
            ? accounts.reduce((sum, a) => sum + (a.year_end_cash_value || 0), 0) / accounts.length 
            : 0,
          reportable_accounts: accounts.filter(a => a.reportability_status === 'reportable').length,
          pending_accounts: accounts.filter(a => a.reportability_status === 'pending_review').length,
          accounts_without_self_cert: accounts.filter(a => a.reportability_status === 'reportable' && !a.self_certification_obtained).length,
          entity_accounts: accounts.filter(a => a.account_holder_type === 'entity').length,
          individual_accounts: accounts.filter(a => a.account_holder_type === 'individual').length
        }
      };

      const prompt = `You are an expert CRS (Common Reporting Standard) compliance analyst with advanced anomaly detection capabilities. Perform a deep analysis of the following financial data, focusing on sophisticated pattern recognition, cross-entity validation, historical trend analysis, and custom rule validation.

DATA TO ANALYZE:
${JSON.stringify(dataSummary, null, 2)}

CRITICAL: For EVERY issue you identify, you MUST provide:
1. **Explainable AI**: Detailed step-by-step reasoning showing WHY this is an issue
2. **Data Point References**: Specific field values and data that led to this conclusion
3. **Rule Applied**: Which validation rule or logic pattern was applied

PERFORM THE FOLLOWING ADVANCED ANALYSES:

0. **CUSTOM VALIDATION RULES** (HIGHEST PRIORITY):
   - Apply ALL custom_validation_rules provided in the data
   - For each rule, check if the condition is violated for relevant records
   - Flag violations with the severity and messages defined in the rule
   - Provide detailed explanation of which rule was violated and why

1. **HISTORICAL TREND ANALYSIS**:
   - Review accounts_with_frequent_status_changes - accounts with 2+ reportability changes may indicate:
     * Data quality issues (inconsistent information)
     * Complex classification scenarios requiring expert review
     * Potential systematic problems with classification workflows
   - Identify patterns in account changes over time
   - Flag entities or accounts with unusual change patterns
   - Detect if changes correlate with specific actors or time periods

2. **CROSS-REFERENCE VALIDATION**:
   - Compare Entity details (name, country, address) with linked Account holder details - flag mismatches
   - Check if Entity's country_of_incorporation matches the country in linked account addresses
   - Verify controlling persons' addresses align with account holder information
   - Validate that entity classification (rfi_status) is consistent with account reportability

3. **STATISTICAL ANOMALY DETECTION**:
   - Identify account balances that deviate significantly from the average (>3 standard deviations)
   - Flag round number balances (ending in 000, 00000) that may indicate estimates
   - Detect duplicate or near-duplicate account numbers, names, or TINs
   - Identify accounts with zero or negative balances that are marked as reportable

4. **TEMPORAL CONSISTENCY CHECKS**:
   - Flag accounts with future dates of birth
   - Check for self-certification dates that are after the current date
   - Identify stale classifications (>12 months old) that may need review
   - Detect accounts marked as closed but with recent activity

5. **IDENTITY & TIN VALIDATION**:
   - Cross-check TIN formats against declared tax residency countries
   - Flag accounts with tax residencies but missing TINs (without valid unavailable reason)
   - Identify potential name mismatches between account holder and controlling persons
   - Detect implausible ages (too young for account holder, too old, etc.)

6. **RELATIONSHIP INTEGRITY**:
   - Entity accounts without any controlling persons defined
   - Controlling person ownership percentages that don't sum correctly
   - Passive NFE accounts without documented controlling persons
   - Orphaned accounts (linked to non-existent entities)

7. **COMPLIANCE RISK SCORING**:
   - High-risk jurisdictions without enhanced documentation
   - Reportable accounts missing required self-certifications
   - Large balance accounts with incomplete information
   - Pattern of similar issues across multiple accounts (systematic problems)

For each issue, provide ACTIONABLE CORRECTIONS with specific field values AND EXPLAINABLE AI REASONING:

Return a JSON object with this structure:
{
  "summary": {
    "total_issues": number,
    "high_severity": number,
    "medium_severity": number,
    "low_severity": number,
    "data_quality_score": number (0-100),
    "cross_reference_issues": number,
    "statistical_anomalies": number,
    "custom_rule_violations": number,
    "historical_trend_issues": number
  },
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "category": "custom_rule_violation" | "historical_trend" | "cross_reference_mismatch" | "statistical_anomaly" | "temporal_inconsistency" | "identity_issue" | "relationship_integrity" | "compliance_risk" | "classification_concern" | "address_issue",
      "affected_record_id": "id",
      "affected_record_type": "account" | "entity" | "controlling_person",
      "affected_record_name": "name for display",
      "description": "clear explanation of the issue",
      "recommendation": "suggested action to resolve",
      "cross_referenced_with": {
        "record_type": "entity" | "account" | "controlling_person" | null,
        "record_id": "id or null",
        "record_name": "name or null",
        "discrepancy_details": "what doesn't match"
      },
      "suggested_correction": {
        "field_name": "the field that needs correction",
        "current_value": "current incorrect value",
        "suggested_value": "recommended correct value",
        "confidence": "high" | "medium" | "low",
        "rationale": "why this correction is suggested"
      },
      "explainable_ai": {
        "reasoning_steps": ["step 1: what was checked", "step 2: what was found", "step 3: why it's an issue"],
        "data_points_referenced": [{"field": "field_name", "value": "actual_value", "why_relevant": "explanation"}],
        "rule_applied": "description of the validation rule or logic pattern applied",
        "confidence_score": number (0-100)
      },
      "related_issues": ["array of related issue descriptions if this is part of a pattern"],
      "historical_context": "if relevant, describe the historical pattern or trend that led to this issue"
    }
  ],
  "cross_reference_insights": [
    {
      "insight_type": "entity_account_mismatch" | "address_discrepancy" | "classification_inconsistency",
      "description": "description of the cross-reference finding",
      "affected_records": [{"type": "string", "id": "string", "name": "string"}],
      "resolution_steps": ["step 1", "step 2"]
    }
  ],
  "positive_findings": ["array of strings noting good data quality aspects"],
  "pattern_analysis": {
    "systematic_issues": ["description of recurring patterns that suggest systematic data quality problems"],
    "data_entry_recommendations": ["suggestions to prevent future issues"]
  }
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
                data_quality_score: { type: "number" },
                cross_reference_issues: { type: "number" },
                statistical_anomalies: { type: "number" },
                custom_rule_violations: { type: "number" },
                historical_trend_issues: { type: "number" }
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
                  recommendation: { type: "string" },
                  cross_referenced_with: {
                    type: "object",
                    properties: {
                      record_type: { type: "string" },
                      record_id: { type: "string" },
                      record_name: { type: "string" },
                      discrepancy_details: { type: "string" }
                    }
                  },
                  suggested_correction: {
                    type: "object",
                    properties: {
                      field_name: { type: "string" },
                      current_value: { type: "string" },
                      suggested_value: { type: "string" },
                      confidence: { type: "string" },
                      rationale: { type: "string" }
                    }
                  },
                  explainable_ai: {
                    type: "object",
                    properties: {
                      reasoning_steps: {
                        type: "array",
                        items: { type: "string" }
                      },
                      data_points_referenced: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            field: { type: "string" },
                            value: { type: "string" },
                            why_relevant: { type: "string" }
                          }
                        }
                      },
                      rule_applied: { type: "string" },
                      confidence_score: { type: "number" }
                    }
                  },
                  related_issues: {
                    type: "array",
                    items: { type: "string" }
                  },
                  historical_context: { type: "string" }
                }
              }
            },
            cross_reference_insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  insight_type: { type: "string" },
                  description: { type: "string" },
                  affected_records: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        id: { type: "string" },
                        name: { type: "string" }
                      }
                    }
                  },
                  resolution_steps: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            positive_findings: {
              type: "array",
              items: { type: "string" }
            },
            pattern_analysis: {
              type: "object",
              properties: {
                systematic_issues: {
                  type: "array",
                  items: { type: "string" }
                },
                data_entry_recommendations: {
                  type: "array",
                  items: { type: "string" }
                }
              }
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
      case 'custom_rule_violation': return <Shield className="w-4 h-4" />;
      case 'historical_trend': return <TrendingUp className="w-4 h-4" />;
      case 'financial_anomaly': return <DollarSign className="w-4 h-4" />;
      case 'statistical_anomaly': return <TrendingUp className="w-4 h-4" />;
      case 'address_issue': return <MapPin className="w-4 h-4" />;
      case 'identity_issue': return <Users className="w-4 h-4" />;
      case 'classification_concern': return <Flag className="w-4 h-4" />;
      case 'controlling_person_issue': return <Users className="w-4 h-4" />;
      case 'relationship_integrity': return <Link2 className="w-4 h-4" />;
      case 'compliance_risk': return <AlertTriangle className="w-4 h-4" />;
      case 'cross_reference_mismatch': return <GitCompare className="w-4 h-4" />;
      case 'temporal_inconsistency': return <Calendar className="w-4 h-4" />;
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
    custom_rule_violation: 'Custom Rule Violations',
    historical_trend: 'Historical Trends',
    financial_anomaly: 'Financial Anomalies',
    statistical_anomaly: 'Statistical Anomalies',
    address_issue: 'Address Issues',
    identity_issue: 'Identity Issues',
    classification_concern: 'Classification Concerns',
    controlling_person_issue: 'Controlling Person Issues',
    relationship_integrity: 'Relationship Integrity',
    compliance_risk: 'Compliance Risks',
    cross_reference_mismatch: 'Cross-Reference Mismatches',
    temporal_inconsistency: 'Temporal Inconsistencies'
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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold">{results.summary?.data_quality_score || 0}</p>
                  <p className="text-xs opacity-90">Quality Score</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-slate-200">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-slate-700">{results.summary?.total_issues || 0}</p>
                  <p className="text-xs text-slate-500">Total Issues</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-red-200 bg-red-50">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-red-700">{results.summary?.high_severity || 0}</p>
                  <p className="text-xs text-red-600">High</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-amber-200 bg-amber-50">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-amber-700">{results.summary?.medium_severity || 0}</p>
                  <p className="text-xs text-amber-600">Medium</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-cyan-200 bg-cyan-50">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-cyan-700">{results.summary?.cross_reference_issues || 0}</p>
                  <p className="text-xs text-cyan-600">Cross-Ref</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-violet-200 bg-violet-50">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-violet-700">{results.summary?.statistical_anomalies || 0}</p>
                  <p className="text-xs text-violet-600">Anomalies</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-purple-200 bg-purple-50">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-purple-700">{results.summary?.custom_rule_violations || 0}</p>
                  <p className="text-xs text-purple-600">Rule Violations</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-orange-200 bg-orange-50">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-orange-700">{results.summary?.historical_trend_issues || 0}</p>
                  <p className="text-xs text-orange-600">Trend Issues</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for different views */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 w-full max-w-2xl">
                <TabsTrigger value="issues" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Issues
                </TabsTrigger>
                <TabsTrigger value="explainable" className="gap-1">
                  <Brain className="w-3 h-3" />
                  AI Reasoning
                </TabsTrigger>
                <TabsTrigger value="crossref" className="gap-1">
                  <GitCompare className="w-3 h-3" />
                  Cross-Ref
                </TabsTrigger>
                <TabsTrigger value="corrections" className="gap-1">
                  <Wrench className="w-3 h-3" />
                  Corrections
                </TabsTrigger>
                <TabsTrigger value="patterns" className="gap-1">
                  <Lightbulb className="w-3 h-3" />
                  Patterns
                </TabsTrigger>
              </TabsList>

              {/* Issues Tab */}
              <TabsContent value="issues" className="space-y-4 mt-4">
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
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge className={getSeverityColor(issue.severity)}>
                                        {issue.severity?.toUpperCase()}
                                      </Badge>
                                      <span className="text-sm text-slate-500">
                                        {issue.affected_record_type}: {issue.affected_record_name}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-sm text-slate-700">{issue.description}</p>
                                  
                                  {/* Cross-reference info */}
                                  {issue.cross_referenced_with?.record_name && (
                                    <div className="p-2 bg-cyan-50 border border-cyan-200 rounded text-sm">
                                      <div className="flex items-center gap-2 text-cyan-700 font-medium mb-1">
                                        <GitCompare className="w-3 h-3" />
                                        Cross-referenced with: {issue.cross_referenced_with.record_type} "{issue.cross_referenced_with.record_name}"
                                      </div>
                                      <p className="text-cyan-600 text-xs">{issue.cross_referenced_with.discrepancy_details}</p>
                                    </div>
                                  )}

                                  {/* Suggested correction */}
                                  {issue.suggested_correction?.field_name && (
                                    <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-purple-700 flex items-center gap-1">
                                          <Wrench className="w-3 h-3" />
                                          Suggested Correction
                                          <Badge variant="outline" className={`ml-2 text-xs ${
                                            issue.suggested_correction.confidence === 'high' ? 'bg-green-50 text-green-700 border-green-200' :
                                            issue.suggested_correction.confidence === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-slate-50 text-slate-700 border-slate-200'
                                          }`}>
                                            {issue.suggested_correction.confidence} confidence
                                          </Badge>
                                        </span>
                                      </div>
                                      <div className="text-sm space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-slate-500">Field:</span>
                                          <code className="px-1.5 py-0.5 bg-white rounded text-purple-700 text-xs">{issue.suggested_correction.field_name}</code>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-slate-500">Change:</span>
                                          <code className="px-1.5 py-0.5 bg-red-50 rounded text-red-600 text-xs line-through">{issue.suggested_correction.current_value || '(empty)'}</code>
                                          <ArrowRight className="w-3 h-3 text-slate-400" />
                                          <code className="px-1.5 py-0.5 bg-green-50 rounded text-green-700 text-xs font-medium">{issue.suggested_correction.suggested_value}</code>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-2"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              copyCorrection(issue.suggested_correction.suggested_value, `${issue.affected_record_id}-${issue.suggested_correction.field_name}`);
                                            }}
                                          >
                                            {copiedCorrection === `${issue.affected_record_id}-${issue.suggested_correction.field_name}` ? (
                                              <Check className="w-3 h-3 text-green-600" />
                                            ) : (
                                              <Copy className="w-3 h-3" />
                                            )}
                                          </Button>
                                        </div>
                                        <p className="text-xs text-purple-600 mt-1">{issue.suggested_correction.rationale}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Historical context */}
                                  {issue.historical_context && (
                                    <div className="p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                                      <div className="flex items-center gap-2 text-orange-700 font-medium mb-1">
                                        <TrendingUp className="w-3 h-3" />
                                        Historical Context
                                      </div>
                                      <p className="text-orange-600 text-xs">{issue.historical_context}</p>
                                    </div>
                                  )}

                                  <div className="p-2 bg-slate-50 rounded text-sm">
                                    <span className="font-medium text-slate-600">Recommendation: </span>
                                    <span className="text-slate-700">{issue.recommendation}</span>
                                  </div>

                                  {/* Related issues */}
                                  {issue.related_issues?.length > 0 && (
                                    <div className="text-xs text-slate-500">
                                      <span className="font-medium">Related issues: </span>
                                      {issue.related_issues.join(', ')}
                                    </div>
                                  )}
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
              </TabsContent>

              {/* Explainable AI Tab */}
              <TabsContent value="explainable" className="space-y-4 mt-4">
                {results.issues?.filter(i => i.explainable_ai).length > 0 ? (
                  <div className="space-y-3">
                    {results.issues.filter(i => i.explainable_ai).map((issue, idx) => (
                      <Card key={idx} className="border-l-4 border-l-indigo-500">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-slate-900">{issue.affected_record_name}</p>
                              <p className="text-xs text-slate-500">{issue.affected_record_type}</p>
                            </div>
                            <Badge className={getSeverityColor(issue.severity)}>
                              {issue.severity?.toUpperCase()}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-slate-700">{issue.description}</p>

                          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded space-y-3">
                            <div className="flex items-center gap-2">
                              <Brain className="w-4 h-4 text-indigo-600" />
                              <span className="text-sm font-semibold text-indigo-800">AI Reasoning</span>
                              {issue.explainable_ai.confidence_score && (
                                <Badge variant="outline" className="ml-auto text-xs">
                                  {issue.explainable_ai.confidence_score}% confidence
                                </Badge>
                              )}
                            </div>

                            {/* Reasoning Steps */}
                            {issue.explainable_ai.reasoning_steps?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-indigo-700 mb-1">Reasoning Steps:</p>
                                <ol className="list-decimal list-inside space-y-1">
                                  {issue.explainable_ai.reasoning_steps.map((step, sidx) => (
                                    <li key={sidx} className="text-xs text-indigo-600">{step}</li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {/* Data Points Referenced */}
                            {issue.explainable_ai.data_points_referenced?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-indigo-700 mb-1">Data Points Referenced:</p>
                                <div className="space-y-1">
                                  {issue.explainable_ai.data_points_referenced.map((dp, dpidx) => (
                                    <div key={dpidx} className="flex items-start gap-2 text-xs">
                                      <code className="px-1.5 py-0.5 bg-white rounded text-indigo-700 font-mono">
                                        {dp.field}
                                      </code>
                                      <span className="text-slate-600">= "{dp.value}"</span>
                                      <span className="text-indigo-600 flex-1">→ {dp.why_relevant}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Rule Applied */}
                            {issue.explainable_ai.rule_applied && (
                              <div>
                                <p className="text-xs font-semibold text-indigo-700 mb-1">Validation Rule Applied:</p>
                                <p className="text-xs text-indigo-600 bg-white p-2 rounded">
                                  {issue.explainable_ai.rule_applied}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-8 text-center">
                      <Brain className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-slate-700">No AI Reasoning Available</h3>
                      <p className="text-sm text-slate-500">No detailed AI explanations were generated.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Cross-Reference Insights Tab */}
              <TabsContent value="crossref" className="space-y-4 mt-4">
                {results.cross_reference_insights?.length > 0 ? (
                  <div className="space-y-4">
                    {results.cross_reference_insights.map((insight, idx) => (
                      <Card key={idx} className="border-l-4 border-l-cyan-500">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <GitCompare className="w-5 h-5 text-cyan-600" />
                            <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 capitalize">
                              {insight.insight_type?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-700">{insight.description}</p>
                          
                          {insight.affected_records?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {insight.affected_records.map((rec, ridx) => (
                                <Badge key={ridx} variant="outline" className="text-xs">
                                  {rec.type}: {rec.name}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {insight.resolution_steps?.length > 0 && (
                            <div className="p-3 bg-slate-50 rounded">
                              <p className="text-xs font-semibold text-slate-600 mb-2">Resolution Steps:</p>
                              <ol className="list-decimal list-inside space-y-1">
                                {insight.resolution_steps.map((step, sidx) => (
                                  <li key={sidx} className="text-sm text-slate-700">{step}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-8 text-center">
                      <GitCompare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-slate-700">No Cross-Reference Issues</h3>
                      <p className="text-sm text-slate-500">Data is consistent across entities and accounts.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Corrections Tab */}
              <TabsContent value="corrections" className="space-y-4 mt-4">
                {results.issues?.filter(i => i.suggested_correction?.field_name).length > 0 ? (
                  <div className="space-y-3">
                    {results.issues.filter(i => i.suggested_correction?.field_name).map((issue, idx) => (
                      <Card key={idx} className="border-l-4 border-l-purple-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium text-slate-900">{issue.affected_record_name}</p>
                              <p className="text-xs text-slate-500">{issue.affected_record_type}</p>
                            </div>
                            <Badge className={`${
                              issue.suggested_correction.confidence === 'high' ? 'bg-green-100 text-green-700' :
                              issue.suggested_correction.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {issue.suggested_correction.confidence} confidence
                            </Badge>
                          </div>
                          
                          <div className="p-3 bg-purple-50 rounded space-y-2">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-medium text-purple-700">{issue.suggested_correction.field_name}</code>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="px-2 py-1 bg-red-50 border border-red-200 rounded text-red-600 text-sm line-through">
                                {issue.suggested_correction.current_value || '(empty)'}
                              </code>
                              <ArrowRight className="w-4 h-4 text-slate-400" />
                              <code className="px-2 py-1 bg-green-50 border border-green-200 rounded text-green-700 text-sm font-medium">
                                {issue.suggested_correction.suggested_value}
                              </code>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1"
                                onClick={() => copyCorrection(issue.suggested_correction.suggested_value, `corr-${idx}`)}
                              >
                                {copiedCorrection === `corr-${idx}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-green-600" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-purple-600">{issue.suggested_correction.rationale}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-8 text-center">
                      <Wrench className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-slate-700">No Corrections Suggested</h3>
                      <p className="text-sm text-slate-500">No specific field corrections were identified.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Patterns Tab */}
              <TabsContent value="patterns" className="space-y-4 mt-4">
                {results.pattern_analysis && (
                  <div className="space-y-4">
                    {results.pattern_analysis.systematic_issues?.length > 0 && (
                      <Card className="border-l-4 border-l-amber-500">
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Systematic Issues Detected
                          </h4>
                          <ul className="space-y-2">
                            {results.pattern_analysis.systematic_issues.map((issue, idx) => (
                              <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                                <span className="text-amber-500 mt-1">•</span>
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {results.pattern_analysis.data_entry_recommendations?.length > 0 && (
                      <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" />
                            Data Entry Recommendations
                          </h4>
                          <ul className="space-y-2">
                            {results.pattern_analysis.data_entry_recommendations.map((rec, idx) => (
                              <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                                <span className="text-blue-500 mt-1">→</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {(!results.pattern_analysis.systematic_issues?.length && !results.pattern_analysis.data_entry_recommendations?.length) && (
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-8 text-center">
                          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
                          <h3 className="text-lg font-semibold text-green-800">No Systematic Issues</h3>
                          <p className="text-sm text-green-700">No recurring patterns or systematic data problems detected.</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}