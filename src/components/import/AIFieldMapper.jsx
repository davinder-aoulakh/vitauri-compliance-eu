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

// Generate CP field descriptors for N controlling persons
function buildCPFields(count) {
  const fields = [];
  for (let n = 1; n <= count; n++) {
    const p = `cp${n}`;
    const label = `CP${n}`;
    fields.push(
      { name: `${p}_first_name`, label: `${label} First Name`, required: false },
      { name: `${p}_last_name`, label: `${label} Last Name`, required: false },
      { name: `${p}_date_of_birth`, label: `${label} Date of Birth`, required: false },
      { name: `${p}_place_of_birth`, label: `${label} Place of Birth`, required: false },
      { name: `${p}_country_of_residence`, label: `${label} Country of Residence`, required: false },
      { name: `${p}_street`, label: `${label} Address Street`, required: false },
      { name: `${p}_city`, label: `${label} Address City`, required: false },
      { name: `${p}_address_country`, label: `${label} Address Country`, required: false },
      { name: `${p}_tax_country`, label: `${label} Tax Residency Country`, required: false },
      { name: `${p}_tin`, label: `${label} TIN`, required: false },
      { name: `${p}_control_type`, label: `${label} Control Type`, required: false },
      { name: `${p}_ownership_percentage`, label: `${label} Ownership %`, required: false },
      { name: `${p}_self_cert_obtained`, label: `${label} Self Cert Obtained`, required: false },
      { name: `${p}_self_cert_date`, label: `${label} Self Cert Date`, required: false },
    );
  }
  return fields;
}

const ACCOUNT_FIELDS = [
  { name: "entity_id", label: "Entity ID", required: true },
  { name: "account_number", label: "Account Number", required: true },
  { name: "account_creation_date", label: "Account Opening Date", required: false },
  { name: "account_type", label: "Account Type", required: false },
  { name: "account_holder_entity_type", label: "Account Holder Entity Type", required: false },
  { name: "account_holder_type", label: "Account Holder Type", required: true },
  { name: "first_name", label: "First Name (Individual)", required: false },
  { name: "last_name", label: "Last Name (Individual)", required: false },
  { name: "account_holder_name", label: "Account Holder Name (Entity)", required: false },
  { name: "date_of_birth", label: "Date of Birth", required: false },
  { name: "place_of_birth", label: "Place of Birth", required: false },
  { name: "date_of_incorporation", label: "Date of Incorporation", required: false },
  { name: "country_of_incorporation", label: "Country of Incorporation", required: false },
  { name: "country_of_incorporation_code", label: "Country of Incorporation Code", required: false },
  { name: "type_of_financial_institution", label: "Type of Financial Institution", required: false },
  { name: "is_pre_existing", label: "Pre-existing Account", required: false },
  { name: "account_holder_is_alive", label: "Account Holder Alive", required: false },
  { name: "account_holder_deceased_during_period", label: "Deceased During Period", required: false },
  { name: "account_closed_during_period", label: "Account Closed During Period", required: false },
  { name: "account_frozen_at_reporting_date", label: "Account Frozen at Reporting Date", required: false },
  { name: "account_dormant_at_reporting_date", label: "Account Dormant at Reporting Date", required: false },
  { name: "acct_holder_address_unchanged", label: "Account Holder Address Unchanged", required: false },
  { name: "death_certificate_requested", label: "Death Certificate Requested", required: false },
  { name: "death_certificate_requested_date", label: "Death Certificate Requested Date", required: false },
  { name: "death_certificate_received", label: "Death Certificate Received", required: false },
  { name: "death_certificate_received_date", label: "Death Certificate Received Date", required: false },
  { name: "will_or_inheritance_requested", label: "Will/Inheritance Requested", required: false },
  { name: "will_or_inheritance_requested_date", label: "Will/Inheritance Requested Date", required: false },
  { name: "will_or_inheritance_received", label: "Will/Inheritance Received", required: false },
  { name: "will_or_inheritance_received_date", label: "Will/Inheritance Received Date", required: false },
  { name: "legacy_of_deceased_settled", label: "Legacy of Deceased Settled", required: false },
  { name: "legacy_settlement_date", label: "Legacy Settlement Date", required: false },
  { name: "entity_managed_by_fiduciary_trust", label: "Entity Managed by Fiduciary Trust", required: false },
  { name: "entity_managed_by_asset_manager", label: "Entity Managed by Asset Manager", required: false },
  { name: "gross_income_from_financial_assets", label: "Gross Income from Financial Assets", required: false },
  { name: "account_holder_street", label: "Account Holder Address Street", required: false },
  { name: "account_holder_city", label: "Account Holder Address City", required: false },
  { name: "account_holder_state", label: "Account Holder Address State", required: false },
  { name: "account_holder_postal_code", label: "Account Holder Address Postal Code", required: false },
  { name: "account_holder_country", label: "Account Holder Address Country", required: false },
  { name: "current_street", label: "Current Address Street", required: false },
  { name: "current_city", label: "Current Address City", required: false },
  { name: "current_state", label: "Current Address State", required: false },
  { name: "current_postal_code", label: "Current Address Postal Code", required: false },
  { name: "current_country", label: "Current Address Country", required: false },
  { name: "country_of_residence", label: "Country of Residence", required: false },
  { name: "current_email", label: "Current Email Address", required: false },
  { name: "current_phone", label: "Current Phone Number", required: false },
  { name: "entity_classification", label: "Entity Classification", required: false },
  { name: "year_end_cash_value", label: "Year-end Cash Value", required: false },
  { name: "year_end_cash_value_currency", label: "Year-end Currency", required: false },
  { name: "gross_payments", label: "Gross Payments", required: false },
  { name: "gross_payments_currency", label: "Gross Payments Currency", required: false },
  { name: "reporting_year", label: "Reporting Year", required: false },
  { name: "us_person_indic", label: "US Person Indicator", required: false },
  { name: "self_certification_obtained", label: "Self Certification Obtained", required: false },
  { name: "self_certification_date", label: "Self Certification Date", required: false },
  { name: "status", label: "Account Status", required: false },
  { name: "tax_residency_1_country", label: "Tax Residency 1 - Country", required: false },
  { name: "tax_residency_1_tin", label: "Tax Residency 1 - TIN", required: false },
  { name: "tax_residency_2_country", label: "Tax Residency 2 - Country", required: false },
  { name: "tax_residency_2_tin", label: "Tax Residency 2 - TIN", required: false },
  ...buildCPFields(4),
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

  // Rule-based instant mapping applied before AI
  const buildInstantMappings = () => {
    const instant = {};
    const RULES = {
      // exact key matches (lowercased, stripped)
      'entity id *': 'entity_id', 'entity id': 'entity_id',
      'account number *': 'account_number', 'account number': 'account_number',
      'account opening date *': 'account_creation_date', 'account opening date': 'account_creation_date',
      'account type *': 'account_type', 'account type': 'account_type',
      'account holder type *': 'account_holder_type', 'account holder type': 'account_holder_type',
      'first name': 'first_name',
      'last name': 'last_name',
      'account holder name (entity)': 'account_holder_name',
      'date of birth': 'date_of_birth',
      'place of birth': 'place_of_birth',
      'pre-existing account': 'is_pre_existing',
      'account holder alive': 'account_holder_is_alive',
      'deceased during period': 'account_holder_deceased_during_period',
      'account closed during period': 'account_closed_during_period',
      'acct holder address - street': 'account_holder_street',
      'acct holder address - city': 'account_holder_city',
      'acct holder address - state': 'account_holder_state',
      'acct holder address - postal code': 'account_holder_postal_code',
      'acct holder address - country': 'account_holder_country',
      'current address - street': 'current_street',
      'current address - city': 'current_city',
      'current address - state': 'current_state',
      'current address - postal code': 'current_postal_code',
      'current address - country': 'current_country',
      'country of residence': 'country_of_residence',
      'current email address *': 'current_email', 'current email address': 'current_email',
      'current phone number *': 'current_phone', 'current phone number': 'current_phone',
      'entity classification': 'entity_classification',
      'year-end cash value': 'year_end_cash_value',
      'year-end currency': 'year_end_cash_value_currency',
      'gross payments': 'gross_payments',
      'gross payments currency': 'gross_payments_currency',
      'reporting year': 'reporting_year',
      'us person indicator': 'us_person_indic',
      'self certification obtained': 'self_certification_obtained',
      'self certification date': 'self_certification_date',
      'account status': 'status',
      'tax residency 1 - country': 'tax_residency_1_country',
      'tax residency 1 - tin': 'tax_residency_1_tin',
      'tax residency 2 - country': 'tax_residency_2_country',
      'tax residency 2 - tin': 'tax_residency_2_tin',
      // New account fields
      'date of incorporation': 'date_of_incorporation',
      'country of incorporation': 'country_of_incorporation',
      'country of incorporation code': 'country_of_incorporation_code',
      'type of financial institution': 'type_of_financial_institution',
      'account frozen at reporting date': 'account_frozen_at_reporting_date',
      'account dormant at reporting date': 'account_dormant_at_reporting_date',
      'account holder address unchanged': 'acct_holder_address_unchanged',
    };
    // Add CP flat column rules dynamically for CP1–CP4
    const CP_FIELD_MAP = {
      'first name': 'first_name', 'last name': 'last_name', 'date of birth': 'date_of_birth',
      'place of birth': 'place_of_birth', 'country of residence': 'country_of_residence',
      'address street': 'street', 'address city': 'city', 'address country': 'address_country',
      'tax residency country': 'tax_country', 'tin': 'tin', 'control type': 'control_type',
      'ownership %': 'ownership_percentage', 'self cert obtained': 'self_cert_obtained',
      'self cert date': 'self_cert_date',
    };
    for (let n = 1; n <= 4; n++) {
      const prefix = `controlling person ${n} - `;
      Object.entries(CP_FIELD_MAP).forEach(([suffix, fieldSuffix]) => {
        RULES[`${prefix}${suffix}`] = `cp${n}_${fieldSuffix}`;
      });
    }
    csvHeaders.forEach(header => {
      const key = header.toLowerCase().trim();
      if (RULES[key]) instant[header] = RULES[key];
    });
    return instant;
  };

  useEffect(() => {
    if (csvHeaders.length > 0 && sampleData.length > 0) {
      // Apply instant mappings immediately so UI is usable right away
      const instant = buildInstantMappings();
      if (Object.keys(instant).length > 0) {
        setMappings(instant);
        const conf = {};
        Object.keys(instant).forEach(h => { conf[h] = 95; });
        setConfidence(conf);
      }
      analyzeAndSuggestMappings(instant);
    }
  }, [csvHeaders, sampleData]);

  const analyzeAndSuggestMappings = async (existingMappings = {}) => {
    setIsAnalyzing(true);
    try {
      const sampleRows = sampleData.slice(0, 3).map(row => {
        const obj = {};
        csvHeaders.forEach((header, idx) => {
          obj[header] = row[idx] || "";
        });
        return obj;
      });

      const targetFieldsList = targetFields.map(f => `${f.name} (${f.label}${f.required ? ", required" : ""})`).join("\n");

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a data mapping expert for a financial compliance platform. Map CSV headers to target fields.

CSV Headers: ${csvHeaders.join(", ")}
Sample Data (first 3 rows): ${JSON.stringify(sampleRows, null, 2)}

Target Fields for ${importType}:
${targetFieldsList}

CRITICAL MAPPING RULES:
- "First Name" → MUST map to "first_name" (NOT account_holder_name)
- "Last Name" → MUST map to "last_name" (NOT account_holder_name)
- "Account Holder Name (Entity)" → MUST map to "account_holder_name" (only for entity account holders)
- "Entity Name (auto-ref)" → map to null (skip, reference only)
- first_name and last_name are for individual account holders; account_holder_name is for entity account holders

Return JSON:
{
  "mappings": { "csv_header": { "target_field": "field_name or null", "confidence": 85, "reason": "brief" } },
  "data_quality_issues": [{"header": "col", "issue": "description", "severity": "warning|error"}]
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
        const newMappings = { ...existingMappings };
        const newConfidence = {};
        Object.entries(response.mappings).forEach(([csvHeader, mapping]) => {
          if (mapping.target_field) {
            newMappings[csvHeader] = mapping.target_field;
            newConfidence[csvHeader] = mapping.confidence;
          } else {
            // AI said skip — respect it unless we had a high-confidence instant match
            if (!existingMappings[csvHeader]) delete newMappings[csvHeader];
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
              onClick={() => analyzeAndSuggestMappings(buildInstantMappings())}
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
          disabled={!isComplete}
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