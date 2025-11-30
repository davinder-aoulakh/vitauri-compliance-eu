import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Check, AlertTriangle, ArrowRight, Loader2, RefreshCw } from "lucide-react";

const ACCOUNT_FIELDS = [
  { name: "entity_id", label: "Entity ID", required: true },
  { name: "account_number", label: "Account Number", required: true },
  { name: "account_type", label: "Account Type", required: false },
  { name: "account_holder_type", label: "Account Holder Type", required: true },
  { name: "account_holder_name", label: "Account Holder Name", required: true },
  { name: "date_of_birth", label: "Date of Birth", required: false },
  { name: "place_of_birth", label: "Place of Birth", required: false },
  { name: "is_pre_existing", label: "Pre-existing Account", required: false },
  { name: "account_holder_is_alive", label: "Account Holder Alive", required: false },
  { name: "account_closed_during_period", label: "Account Closed", required: false },
  { name: "street", label: "Street Address", required: false },
  { name: "city", label: "City", required: false },
  { name: "state", label: "State/Province", required: false },
  { name: "postal_code", label: "Postal Code", required: false },
  { name: "country", label: "Country", required: false },
  { name: "country_of_residence", label: "Country of Residence", required: false },
  { name: "current_email", label: "Email Address", required: false },
  { name: "current_phone", label: "Phone Number", required: false },
  { name: "year_end_cash_value", label: "Year-end Cash Value", required: false },
  { name: "year_end_cash_value_currency", label: "Year-end Currency", required: false },
  { name: "gross_payments", label: "Gross Payments", required: false },
  { name: "gross_payments_currency", label: "Gross Payments Currency", required: false },
  { name: "reporting_year", label: "Reporting Year", required: false },
  { name: "tax_residency_1_country", label: "Tax Residency 1 - Country", required: false },
  { name: "tax_residency_1_tin", label: "Tax Residency 1 - TIN", required: false },
  { name: "tax_residency_2_country", label: "Tax Residency 2 - Country", required: false },
  { name: "tax_residency_2_tin", label: "Tax Residency 2 - TIN", required: false },
];

const ENTITY_FIELDS = [
  { name: "entity_name", label: "Entity Name", required: true },
  { name: "entity_type", label: "Entity Type", required: true },
  { name: "country_of_incorporation", label: "Country of Incorporation", required: true },
  { name: "tax_id", label: "Tax ID", required: false },
  { name: "giin", label: "GIIN", required: false },
  { name: "street", label: "Street Address", required: false },
  { name: "city", label: "City", required: false },
  { name: "state", label: "State/Province", required: false },
  { name: "postal_code", label: "Postal Code", required: false },
  { name: "country", label: "Country", required: false },
];

export default function AIFieldMapper({ 
  csvHeaders, 
  sampleData, 
  importType = "Account",
  onMappingComplete 
}) {
  const [mappings, setMappings] = useState({});
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [confidence, setConfidence] = useState({});

  const targetFields = importType === "Account" ? ACCOUNT_FIELDS : ENTITY_FIELDS;

  useEffect(() => {
    if (csvHeaders.length > 0 && sampleData.length > 0) {
      analyzeAndSuggestMappings();
    }
  }, [csvHeaders, sampleData]);

  const analyzeAndSuggestMappings = async () => {
    setIsAnalyzing(true);
    try {
      const sampleRows = sampleData.slice(0, 5).map(row => {
        const obj = {};
        csvHeaders.forEach((header, idx) => {
          obj[header] = row[idx] || "";
        });
        return obj;
      });

      const targetFieldsList = targetFields.map(f => `${f.name} (${f.label}${f.required ? ", required" : ""})`).join("\n");

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a data mapping expert. Analyze these CSV headers and sample data, then suggest the best mapping to target fields.

CSV Headers: ${csvHeaders.join(", ")}

Sample Data (first 5 rows):
${JSON.stringify(sampleRows, null, 2)}

Target Fields for ${importType}:
${targetFieldsList}

For each CSV header, suggest:
1. The best matching target field name (use exact field name from target list)
2. A confidence score (0-100)
3. Any data quality issues you notice

Return JSON format:
{
  "mappings": {
    "csv_header_name": {
      "target_field": "field_name or null if no match",
      "confidence": 85,
      "reason": "brief explanation"
    }
  },
  "data_quality_issues": [
    {"header": "column_name", "issue": "description", "severity": "warning|error"}
  ]
}`,
        response_json_schema: {
          type: "object",
          properties: {
            mappings: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  target_field: { type: ["string", "null"] },
                  confidence: { type: "number" },
                  reason: { type: "string" }
                }
              }
            },
            data_quality_issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  header: { type: "string" },
                  issue: { type: "string" },
                  severity: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (response?.mappings) {
        const newMappings = {};
        const newConfidence = {};
        const newSuggestions = {};

        Object.entries(response.mappings).forEach(([csvHeader, mapping]) => {
          if (mapping.target_field) {
            newMappings[csvHeader] = mapping.target_field;
            newConfidence[csvHeader] = mapping.confidence;
            newSuggestions[csvHeader] = mapping;
          }
        });

        setMappings(newMappings);
        setConfidence(newConfidence);
        setAiSuggestions(response);
      }
    } catch (error) {
      console.error("AI mapping analysis failed:", error);
      // Fall back to simple matching
      const simpleMappings = {};
      csvHeaders.forEach(header => {
        const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const match = targetFields.find(f => 
          f.name === normalized || 
          f.label.toLowerCase().replace(/[^a-z0-9]/g, "_") === normalized
        );
        if (match) {
          simpleMappings[header] = match.name;
        }
      });
      setMappings(simpleMappings);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMappingChange = (csvHeader, targetField) => {
    setMappings(prev => ({
      ...prev,
      [csvHeader]: targetField === "skip" ? null : targetField
    }));
  };

  const getConfidenceBadge = (header) => {
    const conf = confidence[header];
    if (!conf) return null;
    
    if (conf >= 90) return <Badge className="bg-green-100 text-green-800 text-xs">High ({conf}%)</Badge>;
    if (conf >= 70) return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Medium ({conf}%)</Badge>;
    return <Badge className="bg-red-100 text-red-800 text-xs">Low ({conf}%)</Badge>;
  };

  const getMappedCount = () => {
    const required = targetFields.filter(f => f.required);
    const mappedRequired = required.filter(f => 
      Object.values(mappings).includes(f.name)
    );
    return { mapped: mappedRequired.length, total: required.length };
  };

  const { mapped, total } = getMappedCount();
  const isComplete = mapped === total;

  return (
    <div className="space-y-4">
      <Card className="border-indigo-200 bg-indigo-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            AI Field Mapping
            {isAnalyzing && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {isAnalyzing 
                ? "Analyzing your data and suggesting field mappings..." 
                : `Mapped ${mapped}/${total} required fields`}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={analyzeAndSuggestMappings}
              disabled={isAnalyzing}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isAnalyzing ? 'animate-spin' : ''}`} />
              Re-analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality Issues */}
      {aiSuggestions?.data_quality_issues?.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4" />
              Data Quality Issues Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {aiSuggestions.data_quality_issues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Badge 
                    variant="outline" 
                    className={issue.severity === 'error' 
                      ? 'bg-red-100 text-red-800 border-red-300' 
                      : 'bg-amber-100 text-amber-800 border-amber-300'}
                  >
                    {issue.header}
                  </Badge>
                  <span className="text-slate-700">{issue.issue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapping Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium text-slate-700">CSV Column</th>
              <th className="p-3 w-8"></th>
              <th className="text-left p-3 font-medium text-slate-700">Target Field</th>
              <th className="text-left p-3 font-medium text-slate-700">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {csvHeaders.map((header, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="p-3">
                  <div>
                    <span className="font-medium text-slate-900">{header}</span>
                    {sampleData[0]?.[idx] && (
                      <p className="text-xs text-slate-500 truncate max-w-xs">
                        e.g., {sampleData[0][idx]}
                      </p>
                    )}
                  </div>
                </td>
                <td className="p-3 text-center">
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </td>
                <td className="p-3">
                  <Select
                    value={mappings[header] || "skip"}
                    onValueChange={(value) => handleMappingChange(header, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">
                        <span className="text-slate-400">— Skip this column —</span>
                      </SelectItem>
                      {targetFields.map(field => (
                        <SelectItem key={field.name} value={field.name}>
                          <span className={field.required ? "font-medium" : ""}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  {mappings[header] && getConfidenceBadge(header)}
                  {aiSuggestions?.mappings?.[header]?.reason && (
                    <p className="text-xs text-slate-500 mt-1">
                      {aiSuggestions.mappings[header].reason}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Apply Mappings Button */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          onClick={() => onMappingComplete(mappings, aiSuggestions?.data_quality_issues || [])}
          disabled={!isComplete || isAnalyzing}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isComplete ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Apply Mappings & Continue
            </>
          ) : (
            `Map ${total - mapped} more required field${total - mapped > 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  );
}