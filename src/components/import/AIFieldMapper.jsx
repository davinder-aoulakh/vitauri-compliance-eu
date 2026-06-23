import React, { useState, useEffect, useRef } from "react";
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

// ── Target field lists ────────────────────────────────────────────────────────

function buildCPFields(count) {
  const fields = [];
  for (let n = 1; n <= count; n++) {
    const p = `cp${n}`;
    const lbl = `CP${n}`;
    fields.push(
      { name: `${p}_first_name`,            label: `${lbl} First Name` },
      { name: `${p}_last_name`,             label: `${lbl} Last Name` },
      { name: `${p}_date_of_birth`,         label: `${lbl} Date of Birth` },
      { name: `${p}_place_of_birth`,        label: `${lbl} Country of Birth` },
      { name: `${p}_place_of_birth_code`,   label: `${lbl} Country of Birth Code` },
      { name: `${p}_country_of_residence`,  label: `${lbl} Country of Residence` },
      { name: `${p}_country_of_residence_code`, label: `${lbl} Country of Residence Code` },
      { name: `${p}_address_street`,        label: `${lbl} Address Street` },
      { name: `${p}_address_city`,          label: `${lbl} Address City` },
      { name: `${p}_address_state`,         label: `${lbl} Address State` },
      { name: `${p}_address_postal_code`,   label: `${lbl} Address Postal Code` },
      { name: `${p}_address_country`,       label: `${lbl} Address Country` },
      { name: `${p}_address_country_code`,  label: `${lbl} Address Country Code` },
      { name: `${p}_tax1_country`,          label: `${lbl} Tax Residency 1 Country` },
      { name: `${p}_tax1_country_code`,     label: `${lbl} Tax Residency 1 Country Code` },
      { name: `${p}_tin`,                   label: `${lbl} Tax Residency 1 TIN` },
      { name: `${p}_tax2_country`,          label: `${lbl} Tax Residency 2 Country` },
      { name: `${p}_tax2_country_code`,     label: `${lbl} Tax Residency 2 Country Code` },
      { name: `${p}_tin2`,                  label: `${lbl} Tax Residency 2 TIN` },
      { name: `${p}_control_type`,          label: `${lbl} Control Type` },
      { name: `${p}_self_cert_obtained`,    label: `${lbl} Self Cert Obtained` },
      { name: `${p}_self_cert_date`,        label: `${lbl} Self Cert Date` },
      { name: `${p}_self_cert_requested`,   label: `${lbl} Self Cert Requested` },
      { name: `${p}_self_cert_request_date`,label: `${lbl} Self Cert Request Date` },
    );
  }
  return fields;
}

const ACCOUNT_FIELDS = [
  { name: "entity_id",                          label: "Entity ID",                           required: true  },
  { name: "account_number",                     label: "Account Number",                      required: true  },
  { name: "account_creation_date",              label: "Account Opening Date",                required: true  },
  { name: "account_type",                       label: "Account Type",                        required: true  },
  { name: "account_holder_type",                label: "Account Holder Type",                 required: true  },
  { name: "account_number_type",                label: "Account Number Type",                 required: false },
  { name: "first_name",                         label: "First Name (Individual)",             required: false },
  { name: "middle_name",                        label: "Middle Name",                         required: false },
  { name: "last_name",                          label: "Last Name (Individual)",              required: false },
  { name: "name_prefix",                        label: "Name Prefix",                         required: false },
  { name: "title",                              label: "Title",                               required: false },
  { name: "account_holder_name",                label: "Account Holder Name (Entity)",        required: false },
  { name: "account_holder_entity_type",         label: "Type of Entity",                      required: false },
  { name: "type_of_financial_institution",      label: "Type of Financial Institution",       required: false },
  { name: "date_of_birth",                      label: "Date of Birth",                       required: false },
  { name: "place_of_birth",                     label: "Place of Birth",                      required: false },
  { name: "date_of_incorporation",              label: "Date of Incorporation",               required: false },
  { name: "country_of_incorporation",           label: "Country of Incorporation",            required: false },
  { name: "country_of_incorporation_code",      label: "Country of Incorporation Code",       required: false },
  { name: "is_pre_existing",                    label: "Pre-existing Account",                required: false },
  { name: "is_recalcitrant",                    label: "Is Recalcitrant",                     required: false },
  { name: "account_holder_is_alive",            label: "Account Holder Is Alive",             required: false },
  { name: "account_holder_deceased_during_period", label: "Account Holder Deceased During Period", required: false },
  { name: "account_closed_during_period",       label: "Account Closed During Period",        required: false },
  { name: "account_frozen_at_reporting_date",   label: "Account Frozen at Reporting Date",    required: false },
  { name: "account_dormant_at_reporting_date",  label: "Account Dormant at Reporting Date",   required: false },
  { name: "death_certificate_requested",        label: "Death Certificate Requested",         required: false },
  { name: "death_certificate_received",         label: "Death Certificate Received",          required: false },
  { name: "will_or_inheritance_requested",      label: "Will/Inheritance Requested",          required: false },
  { name: "will_or_inheritance_received",       label: "Will/Inheritance Received",           required: false },
  { name: "legacy_of_deceased_settled",         label: "Legacy of Deceased Settled",          required: false },
  { name: "status",                             label: "Account Status",                      required: false },
  { name: "acct_holder_address_unchanged",      label: "Account Holder Address Unchanged",    required: false },
  { name: "ah_original_street",                 label: "Original Address - Street",           required: false },
  { name: "ah_original_city",                   label: "Original Address - City",             required: false },
  { name: "ah_original_state",                  label: "Original Address - State",            required: false },
  { name: "ah_original_postal_code",            label: "Original Address - Postal Code",      required: false },
  { name: "ah_original_country",                label: "Original Address - Country",          required: false },
  { name: "ah_original_country_code",           label: "Original Address - Country Code",     required: false },
  { name: "ah_current_street",                  label: "Current Address - Street",            required: false },
  { name: "ah_current_city",                    label: "Current Address - City",              required: false },
  { name: "ah_current_state",                   label: "Current Address - State",             required: false },
  { name: "ah_current_postal_code",             label: "Current Address - Postal Code",       required: false },
  { name: "ah_current_country",                 label: "Current Address - Country",           required: false },
  { name: "ah_current_country_code",            label: "Current Address - Country Code",      required: false },
  { name: "ah_country_of_residence",            label: "Country of Residence",                required: false },
  { name: "current_email",                      label: "Current Email Address",               required: false },
  { name: "current_phone",                      label: "Current Phone Number",                required: false },
  { name: "entity_classification",              label: "Entity Classification",               required: false },
  { name: "entity_managed_by_fiduciary_trust",  label: "Entity Managed by Fiduciary Trust",   required: false },
  { name: "entity_managed_by_asset_manager",    label: "Entity Managed by Asset Manager",     required: false },
  { name: "gross_income_from_financial_assets", label: "Gross Income from Financial Assets",  required: false },
  { name: "gross_income_50_passive",            label: "50% Passive Income",                  required: false },
  { name: "non_reportable_exception_type",      label: "Non-Reportable Exception Type",       required: false },
  { name: "treasury_activities_operational",    label: "Treasury: Activities Operational",    required: false },
  { name: "treasury_part_of_nonfinancial_group",label: "Treasury: Part of Non-Financial Group",required: false },
  { name: "treasury_main_fn_finance_hedge_group",label: "Treasury: Main Function Finance/Hedge",required: false },
  { name: "treasury_50pct_passive_income_fails",label: "Treasury: <50% Passive Income",       required: false },
  { name: "treasury_still_operational_despite_failing_50pct", label: "Treasury: Operational Despite Failing 50%", required: false },
  { name: "year_end_cash_value",                label: "Year-end Balance",                    required: false },
  { name: "year_end_cash_value_currency",       label: "Year-end Currency",                   required: false },
  { name: "gross_payments",                     label: "Gross Payments",                      required: false },
  { name: "gross_payments_currency",            label: "Gross Payments Currency",             required: false },
  { name: "reporting_year",                     label: "Reporting Year",                      required: false },
  { name: "us_person_indic",                    label: "US Person Indicator",                 required: false },
  { name: "self_certification_overdue",         label: "Self Certification Overdue",          required: false },
  { name: "self_cert_requested",                label: "Self Certification Requested",        required: false },
  { name: "self_cert_request_date",             label: "Self Certification Request Date",     required: false },
  { name: "self_cert_obtained",                 label: "Self Certification Obtained",         required: false },
  { name: "self_cert_date",                     label: "Self Certification Receipt Date",     required: false },
  { name: "tax1_country",                       label: "Tax Residency 1 - Country",           required: false },
  { name: "tax1_tin",                           label: "Tax Residency 1 - TIN",               required: false },
  { name: "tax2_country",                       label: "Tax Residency 2 - Country",           required: false },
  { name: "tax2_tin",                           label: "Tax Residency 2 - TIN",               required: false },
  ...buildCPFields(4),
];

const ENTITY_FIELDS = [
  { name: "entity_name",              label: "Entity Name",           required: true  },
  { name: "entity_type",              label: "Entity Type",           required: true  },
  { name: "country_of_incorporation", label: "Country of Incorporation", required: true },
  { name: "tax_id",                   label: "Tax ID",                required: false },
  { name: "giin",                     label: "GIIN",                  required: false },
  { name: "street",                   label: "Street Address",        required: false },
  { name: "city",                     label: "City",                  required: false },
  { name: "state",                    label: "State/Province",        required: false },
  { name: "postal_code",              label: "Postal Code",           required: false },
  { name: "country",                  label: "Country",               required: false },
];

// ── Comprehensive instant rule table (lowercased, * stripped) ─────────────────
// Built at module level — never recreated per render
const INSTANT_RULES = {
  // Required
  'entity id':                   'entity_id',
  'account number':              'account_number',
  'account opening date':        'account_creation_date',
  'account type':                'account_type',
  'account holder type':         'account_holder_type',
  // Skip/display-only
  'entity name (auto-ref)':      'skip',
  'potential exception type':    'skip',
  // Account identity
  'account number type':         'account_number_type',
  'first name':                  'first_name',
  'middle name':                 'middle_name',
  'last name':                   'last_name',
  'name prefix':                 'name_prefix',
  'title':                       'title',
  'account holder name (entity)':'account_holder_name',
  'type of entity':              'account_holder_entity_type',
  'type of financial institution':'type_of_financial_institution',
  // Individual
  'date of birth':               'date_of_birth',
  'place of birth':              'place_of_birth',
  // Entity
  'date of incorporation':       'date_of_incorporation',
  'country of incorporation':    'country_of_incorporation',
  'country of incorporation code':'country_of_incorporation_code',
  // Status flags
  'pre-existing account':        'is_pre_existing',
  'is recalcitrant':             'is_recalcitrant',
  'account holder is alive':     'account_holder_is_alive',
  'account holder alive':        'account_holder_is_alive',
  'account holder deceased during period': 'account_holder_deceased_during_period',
  'deceased during period':      'account_holder_deceased_during_period',
  'account closed during period':'account_closed_during_period',
  'account frozen at reporting date':'account_frozen_at_reporting_date',
  'account dormant at reporting date':'account_dormant_at_reporting_date',
  'death certificate requested': 'death_certificate_requested',
  'death certificate received':  'death_certificate_received',
  'will / inheritance requested':'will_or_inheritance_requested',
  'will / inheritance received': 'will_or_inheritance_received',
  'legacy of deceased settled':  'legacy_of_deceased_settled',
  'account status':              'status',
  // Address
  'acct holder address unchanged':'acct_holder_address_unchanged',
  'acct holder original address - street':      'ah_original_street',
  'acct holder original address - city':        'ah_original_city',
  'acct holder original address - state':       'ah_original_state',
  'acct holder original address - postal code': 'ah_original_postal_code',
  'acct holder original address - country':     'ah_original_country',
  'acct holder original address - country code':'ah_original_country_code',
  'acct holder current address - street':       'ah_current_street',
  'acct holder current address - city':         'ah_current_city',
  'acct holder current address - state':        'ah_current_state',
  'acct holder current address - postal code':  'ah_current_postal_code',
  'acct holder current address - country':      'ah_current_country',
  'acct holder current address - country code': 'ah_current_country_code',
  'acct holder country of residence':           'ah_country_of_residence',
  'acct holder country of residence code':      'skip',
  // Contact
  'current email address':       'current_email',
  'current phone number':        'current_phone',
  // Entity classification
  'entity classification':       'entity_classification',
  'entity managed by fiduciary trust':  'entity_managed_by_fiduciary_trust',
  'entity managed by asset manager':    'entity_managed_by_asset_manager',
  'gross income from financial assets': 'gross_income_from_financial_assets',
  '50% passive income (gross income)':  'gross_income_50_passive',
  'non-reportable exception type':      'non_reportable_exception_type',
  // Treasury
  'treasury: activities functional & operational':    'treasury_activities_operational',
  'treasury: part of non-financial group':            'treasury_part_of_nonfinancial_group',
  'treasury: main function finance/hedge group':      'treasury_main_fn_finance_hedge_group',
  'treasury: <50% passive income (passes 50% test)':  'treasury_50pct_passive_income_fails',
  'treasury: operational despite failing 50% test':   'treasury_still_operational_despite_failing_50pct',
  // Financial
  'year-end balance':            'year_end_cash_value',
  'year-end currency':           'year_end_cash_value_currency',
  'gross interest paid or credited to account': 'gross_payments',
  'gross payments currency':     'gross_payments_currency',
  'reporting year':              'reporting_year',
  'us person indicator':         'us_person_indic',
  // Self cert
  'self certification overdue (90+ days)':            'self_certification_overdue',
  'account holder self certification requested':      'self_cert_requested',
  'account holder self certification request date':   'self_cert_request_date',
  'account holder self certification obtained':       'self_cert_obtained',
  'account holder self certification receipt date':   'self_cert_date',
  // Tax residency
  'account holder tax residency 1 - country':      'tax1_country',
  'account holder tax residency 1 - country code': 'tax1_country_code',
  'account holder tax residency 1 - tin':          'tax1_tin',
  'account holder tax residency 2 - country':      'tax2_country',
  'account holder tax residency 2 - country code': 'tax2_country_code',
  'account holder tax residency 2 - tin':          'tax2_tin',
};

// Build CP rules once at module level
const CP_FIELD_MAP = {
  'first name':                  'first_name',
  'last name':                   'last_name',
  'date of birth':               'date_of_birth',
  'country of birth':            'place_of_birth',
  'country of birth code':       'place_of_birth_code',
  'country of residence':        'country_of_residence',
  'country of residence code':   'country_of_residence_code',
  'current address - street':    'address_street',
  'current address - city':      'address_city',
  'current address - state':     'address_state',
  'current address - postal code':'address_postal_code',
  'current address - country':   'address_country',
  'current address - country code':'address_country_code',
  'tax residency 1 - country':   'tax1_country',
  'tax residency 1 - country code':'tax1_country_code',
  'tax residency 1 - tin':       'tax1_tin',
  'tax residency 2 - country':   'tax2_country',
  'tax residency 2 - country code':'tax2_country_code',
  'tax residency 2 - tin':       'tax2_tin',
  'self certification obtained':   'self_cert_obtained',
  'self certification receipt date':'self_cert_date',
  'self certification requested':  'self_cert_requested',
  'self certification request date':'self_cert_request_date',
  'control type':                'control_type',
};
for (let n = 1; n <= 4; n++) {
  Object.entries(CP_FIELD_MAP).forEach(([suffix, fieldSuffix]) => {
    INSTANT_RULES[`controlling person ${n} ${suffix}`]   = `cp${n}_${fieldSuffix}`;
    INSTANT_RULES[`controlling person ${n} - ${suffix}`] = `cp${n}_${fieldSuffix}`;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  // Prevent duplicate analysis when parent re-renders with same headers
  const analyzedKey = useRef(null);

  const targetFields = importType === "Account" ? ACCOUNT_FIELDS : ENTITY_FIELDS;

  // Strip trailing " *" marker before lookup so "Entity ID *" → "entity id"
  const normalizeHeader = (h) => h.toLowerCase().trim().replace(/\s*\*$/, "");

  const buildInstantMappings = (headers) => {
    const instant = {};
    headers.forEach(header => {
      const key = normalizeHeader(header);
      if (INSTANT_RULES[key]) instant[header] = INSTANT_RULES[key];
    });
    return instant;
  };

  useEffect(() => {
    if (csvHeaders.length === 0) return;
    const key = csvHeaders.join("|");
    if (analyzedKey.current === key) return; // same headers — don't re-run
    analyzedKey.current = key;

    const instant = buildInstantMappings(csvHeaders);
    setMappings(instant);
    const conf = {};
    Object.keys(instant).forEach(h => { conf[h] = 95; });
    setConfidence(conf);
    analyzeAndSuggestMappings(instant);
  }, [csvHeaders]); // intentionally only csvHeaders — sampleData identity changes every render

  const analyzeAndSuggestMappings = async (existingMappings = {}) => {
    setIsAnalyzing(true);
    try {
      const sampleRows = sampleData.slice(0, 3).map(row => {
        const obj = {};
        csvHeaders.forEach((header, idx) => { obj[header] = row[idx] || ""; });
        return obj;
      });
      const targetFieldsList = targetFields.map(f => `${f.name} (${f.label}${f.required ? ", required" : ""})`).join("\n");

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a data mapping expert for a financial compliance platform. Map CSV headers to target fields.

CSV Headers: ${csvHeaders.join(", ")}
Sample Data (first 3 rows): ${JSON.stringify(sampleRows, null, 2)}

Target Fields for ${importType}:
${targetFieldsList}

RULES:
- "First Name" → first_name (individual holders only — NOT account_holder_name)
- "Last Name" → last_name (individual holders only — NOT account_holder_name)
- "Account Holder Name (Entity)" → account_holder_name (entity holders only)
- "Entity Name (auto-ref)" → null (skip, display only)
- Headers ending with " *" are required fields — map them normally, ignore the asterisk
- Return null for columns you are not confident about

Return JSON:
{
  "mappings": { "csv_header": { "target_field": "field_name or null", "confidence": 85, "reason": "brief" } },
  "data_quality_issues": [{"header": "col", "issue": "description", "severity": "warning|error"}]
}`,
        response_json_schema: {
          type: "object",
          properties: {
            mappings: { type: "object", additionalProperties: { type: "object", properties: {
              target_field: { type: ["string", "null"] }, confidence: { type: "number" }, reason: { type: "string" }
            }}},
            data_quality_issues: { type: "array", items: { type: "object", properties: {
              header: { type: "string" }, issue: { type: "string" }, severity: { type: "string" }
            }}}
          }
        }
      });

      if (response?.mappings) {
        const newMappings = { ...existingMappings };
        const newConfidence = { ...confidence };
        Object.entries(response.mappings).forEach(([csvHeader, mapping]) => {
          if (existingMappings[csvHeader]) return; // never override instant mappings
          if (mapping.target_field) {
            newMappings[csvHeader] = mapping.target_field;
            newConfidence[csvHeader] = mapping.confidence;
          }
        });
        setMappings(newMappings);
        setConfidence(newConfidence);
        setAiSuggestions(response);
      }
    } catch (error) {
      console.error("AI mapping analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMappingChange = (csvHeader, targetField) => {
    setMappings(prev => ({ ...prev, [csvHeader]: targetField === "skip" ? null : targetField }));
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
    return { mapped: required.filter(f => Object.values(mappings).includes(f.name)).length, total: required.length };
  };

  const { mapped, total } = getMappedCount();
  const isComplete = mapped === total;

  const handleReanalyze = () => {
    analyzedKey.current = null; // allow re-run
    const instant = buildInstantMappings(csvHeaders);
    setMappings(instant);
    const conf = {};
    Object.keys(instant).forEach(h => { conf[h] = 95; });
    setConfidence(conf);
    analyzeAndSuggestMappings(instant);
  };

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
              {isAnalyzing ? "Analyzing your data and suggesting field mappings..." : `Mapped ${mapped}/${total} required fields`}
            </p>
            <Button variant="outline" size="sm" onClick={handleReanalyze} disabled={isAnalyzing}>
              <RefreshCw className={`w-3 h-3 mr-1 ${isAnalyzing ? 'animate-spin' : ''}`} />
              Re-analyze
            </Button>
          </div>
        </CardContent>
      </Card>

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
                  <Badge variant="outline" className={issue.severity === 'error' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-amber-100 text-amber-800 border-amber-300'}>
                    {issue.header}
                  </Badge>
                  <span className="text-slate-700">{issue.issue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <span className="font-medium text-slate-900">{header}</span>
                  {sampleData[0]?.[idx] && (
                    <p className="text-xs text-slate-500 truncate max-w-xs">e.g., {sampleData[0][idx]}</p>
                  )}
                </td>
                <td className="p-3 text-center"><ArrowRight className="w-4 h-4 text-slate-400" /></td>
                <td className="p-3">
                  <Select value={mappings[header] || "skip"} onValueChange={(v) => handleMappingChange(header, v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip"><span className="text-slate-400">— Skip this column —</span></SelectItem>
                      {targetFields.map(field => (
                        <SelectItem key={field.name} value={field.name}>
                          <span className={field.required ? "font-medium" : ""}>{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  {mappings[header] && getConfidenceBadge(header)}
                  {aiSuggestions?.mappings?.[header]?.reason && (
                    <p className="text-xs text-slate-500 mt-1">{aiSuggestions.mappings[header].reason}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button onClick={() => onMappingComplete(mappings, aiSuggestions?.data_quality_issues || [])} disabled={!isComplete} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {isComplete ? <><Check className="w-4 h-4 mr-2" />Apply Mappings & Continue</> : `Map ${total - mapped} more required field${total - mapped > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}