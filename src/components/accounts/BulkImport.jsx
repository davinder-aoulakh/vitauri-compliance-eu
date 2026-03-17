import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { auditLog } from "../utils/auditLogger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Eye,
  RefreshCw
} from "lucide-react";

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ currentStep }) {
  const steps = ["Download Template", "Upload & Validate", "Preview & Confirm", "Done"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isComplete = currentStep > stepNum;
        const isActive = currentStep === stepNum;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                isComplete ? "bg-green-500 border-green-500 text-white" :
                isActive   ? "bg-indigo-600 border-indigo-600 text-white" :
                             "bg-white border-slate-300 text-slate-400"
              }`}>
                {isComplete ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
              </div>
              <span className={`text-xs mt-1 text-center w-20 ${isActive ? "text-indigo-600 font-medium" : "text-slate-500"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 mx-1 ${currentStep > stepNum ? "bg-green-500" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Collapsible field guide ────────────────────────────────────────────────────
function FieldGuide() {
  const [open, setOpen] = useState(true);
  const fields = [
    { name: "Account Creation Date", format: "YYYY-MM-DD", required: false, note: "e.g. 2017-06-15" },
    { name: "Entity ID", format: "Text (UUID)", required: true, note: "Copy from the Entity ID column in the template" },
    { name: "Account Number", format: "Text", required: true, note: "Unique per entity" },
    { name: "Account Type", format: "Enum", required: true, note: "depository | custodial | equity_debt_interest | cash_value_insurance | annuity" },
    { name: "Account Holder Type", format: "Enum", required: true, note: "individual | entity" },
    { name: "Account Holder Name", format: "Text", required: true, note: "Full legal name" },
    { name: "Date of Birth", format: "YYYY-MM-DD", required: "Individual only", note: "Required for individual account holders" },
    { name: "Place of Birth", format: "Text", required: false, note: "Country name" },
    { name: "Pre-existing Account", format: "true / false", required: false, note: "Was account opened before Jan 1 2018?" },
    { name: "Account Holder Alive", format: "true / false", required: false, note: "For individual accounts" },
    { name: "Street Address / City / State / Postal Code / Country", format: "Text", required: false, note: "Account holder address fields" },
    { name: "Current Street / City / State / Postal Code / Country", format: "Text", required: false, note: "Current mailing address" },
    { name: "Email Address", format: "Email", required: false, note: "e.g. john@example.com" },
    { name: "Phone Number", format: "Text", required: false, note: "e.g. +12125551234" },
    { name: "Year-end Cash Value", format: "Number", required: false, note: "Positive number" },
    { name: "Year-end Value Currency", format: "ISO Code", required: false, note: "e.g. USD, EUR, GBP" },
    { name: "Gross Payments", format: "Number", required: false, note: "Positive number" },
    { name: "Gross Payments Currency", format: "ISO Code", required: false, note: "e.g. USD" },
    { name: "Reporting Year", format: "YYYY", required: false, note: "e.g. 2024" },
    { name: "Tax Residency 1 - Country", format: "Text", required: false, note: "Country name or ISO code" },
    { name: "Tax Residency 1 - TIN", format: "Text", required: false, note: "Tax identification number" },
    { name: "Tax Residency 2 - Country / TIN", format: "Text", required: false, note: "Second residency (optional)" },
  ];
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Info className="w-4 h-4 text-indigo-500" /> Field Reference Guide
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-3 py-2 text-left font-semibold">Column Name</th>
                <th className="px-3 py-2 text-left font-semibold">Format</th>
                <th className="px-3 py-2 text-left font-semibold">Required?</th>
                <th className="px-3 py-2 text-left font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-1.5 font-medium text-slate-800">{f.name}</td>
                  <td className="px-3 py-1.5 text-indigo-700 font-mono">{f.format}</td>
                  <td className="px-3 py-1.5">
                    {f.required === true
                      ? <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Required</Badge>
                      : f.required === false
                      ? <Badge variant="outline" className="text-xs">Optional</Badge>
                      : <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{f.required}</Badge>}
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BulkImport({ tenant, entities, onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [selectedEntityIds, setSelectedEntityIds] = useState(() => entities.map(e => e.id));
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [previewData, setPreviewData] = useState(null); // { toCreate, toUpdate, invalidRows }
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);

  // ── Label → field mapping ──────────────────────────────────────────────────
  const labelToField = {
    "Account Creation Date": "account_creation_date",
    "Entity ID": "entity_id",
    "Account Number": "account_number",
    "Account Type": "account_type",
    "Account Holder Type": "account_holder_type",
    "Account Holder Name": "account_holder_name",
    "Date of Birth": "date_of_birth",
    "Place of Birth": "place_of_birth",
    "Pre-existing Account": "is_pre_existing",
    "Account Holder Alive": "account_holder_is_alive",
    "Account Closed During Period": "account_closed_during_period",
    "Street Address": "street",
    "City": "city",
    "State/Province": "state",
    "Postal Code": "postal_code",
    "Country": "country",
    "Current Street Address": "current_street",
    "Current City": "current_city",
    "Current State/Province": "current_state",
    "Current Postal Code": "current_postal_code",
    "Current Country": "current_country",
    "Country of Residence": "country_of_residence",
    "Email Address": "current_email",
    "Phone Number": "current_phone",
    "Year-end Cash Value": "year_end_cash_value",
    "Year-end Value Currency": "year_end_cash_value_currency",
    "Gross Payments": "gross_payments",
    "Gross Payments Currency": "gross_payments_currency",
    "Reporting Year": "reporting_year",
    "Deceased During Period": "account_holder_deceased_during_period",
    "Death Certificate Requested": "death_certificate_requested",
    "Death Cert. Requested Date": "death_certificate_requested_date",
    "Death Certificate Received": "death_certificate_received",
    "Death Cert. Received Date": "death_certificate_received_date",
    "Will/Inheritance Requested": "will_or_inheritance_requested",
    "Will/Inheritance Requested Date": "will_or_inheritance_requested_date",
    "Will/Inheritance Received": "will_or_inheritance_received",
    "Will/Inheritance Received Date": "will_or_inheritance_received_date",
    "Legacy Settled": "legacy_of_deceased_settled",
    "Legacy Settlement Date": "legacy_settlement_date",
    "Managed by Fiduciary Trust": "entity_managed_by_fiduciary_trust",
    "Managed by Asset Manager": "entity_managed_by_asset_manager",
    "Income >50% from Financial Assets": "gross_income_from_financial_assets",
    "Tax Residency 1 - Country": "tax_residency_1_country",
    "Tax Residency 1 - TIN": "tax_residency_1_tin",
    "Tax Residency 2 - Country": "tax_residency_2_country",
    "Tax Residency 2 - TIN": "tax_residency_2_tin"
  };

  // ── Download template with real entity data ────────────────────────────────
  const downloadTemplate = () => {
    const headers = Object.keys(labelToField);

    // Build example rows using real entity IDs if available
    const exampleRows = entities.slice(0, 3).map((entity, i) => {
      const examples = [
        `2017-06-15,${entity.id},ACC-00${i+1},depository,individual,John Smith,1985-06-15,United States,false,true,false,123 Main St,New York,NY,10001,United States,123 Main St,New York,NY,10001,United States,United States,john@example.com,+12125551234,50000,USD,5000,USD,2024,false,false,,false,,,false,,false,,,,,United States,123-45-6789,,`,
        `2019-03-22,${entity.id},ACC-00${i+4},custodial,individual,Jane Doe,1990-03-22,United Kingdom,true,true,false,456 Oak Ave,London,,SW1A 1AA,United Kingdom,456 Oak Ave,London,,SW1A 1AA,United Kingdom,United Kingdom,jane@example.com,+442075551234,75000,GBP,10000,GBP,2024,false,false,,false,,,false,,false,,,,,United Kingdom,AB123456C,France,1234567890`,
        `2020-01-10,${entity.id},ACC-00${i+7},depository,entity,ABC Corp,,,false,,false,789 Corp Blvd,Tokyo,,100-0001,Japan,789 Corp Blvd,Tokyo,,100-0001,Japan,Japan,contact@abc.jp,+81312345678,1000000,JPY,50000,JPY,2024,,,,,,,,,,,false,false,true,Japan,1234567890,,`,
      ];
      return examples[i % 3];
    });

    // Fallback if no entities
    if (exampleRows.length === 0) {
      exampleRows.push(
        `2017-06-15,PASTE_ENTITY_ID_HERE,ACC-001,depository,individual,John Smith,1985-06-15,United States,false,true,false,123 Main St,New York,NY,10001,United States,123 Main St,New York,NY,10001,United States,United States,john@example.com,+12125551234,50000,USD,5000,USD,2024,false,false,,false,,,false,,false,,,,,United States,123-45-6789,,`
      );
    }

    // Add entity reference sheet as comments at the top
    const entityRef = entities.map(e => `# Entity: ${e.entity_name} | ID: ${e.id}`).join('\n');
    const content = `${entityRef}\n${headers.join(',')}\n${exampleRows.join('\n')}`;

    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accounts_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  // ── Parsers & validators ───────────────────────────────────────────────────
  const isValidDate = (d) => {
    if (!d) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    return !isNaN(new Date(d));
  };
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const parseCSV = (text) => {
    // Strip comment lines (starting with #)
    const lines = text.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const row = {};
      headers.forEach((header, idx) => {
        const fieldName = labelToField[header] || header;
        row[fieldName] = values[idx]?.trim() || '';
      });
      return row;
    });
  };

  const validateRow = (row, index, validEntityIds) => {
    const errors = [];
    const rowNum = index + 2;

    if (!row.entity_id) errors.push({ row: rowNum, field: "Entity ID", msg: "Missing Entity ID" });
    else if (!validEntityIds.includes(row.entity_id)) errors.push({ row: rowNum, field: "Entity ID", msg: `Entity ID "${row.entity_id}" does not exist in this tenant` });

    if (!row.account_number) errors.push({ row: rowNum, field: "Account Number", msg: "Missing Account Number" });
    if (!row.account_holder_type) errors.push({ row: rowNum, field: "Account Holder Type", msg: "Missing Account Holder Type" });
    if (!row.account_holder_name) errors.push({ row: rowNum, field: "Account Holder Name", msg: "Missing Account Holder Name" });

    const validAccountTypes = ['depository', 'custodial', 'equity_debt_interest', 'cash_value_insurance', 'annuity'];
    if (row.account_type && !validAccountTypes.includes(row.account_type)) {
      errors.push({ row: rowNum, field: "Account Type", msg: `"${row.account_type}" is not valid. Use: ${validAccountTypes.join(', ')}` });
    }

    const validHolderTypes = ['individual', 'entity'];
    if (row.account_holder_type && !validHolderTypes.includes(row.account_holder_type)) {
      errors.push({ row: rowNum, field: "Account Holder Type", msg: `"${row.account_holder_type}" is not valid. Use: individual or entity` });
    }

    if (row.account_holder_type === 'individual' && !row.date_of_birth) {
      errors.push({ row: rowNum, field: "Date of Birth", msg: "Required for individual accounts" });
    }

    if (row.date_of_birth && !isValidDate(row.date_of_birth)) {
      errors.push({ row: rowNum, field: "Date of Birth", msg: `"${row.date_of_birth}" is not a valid date — use YYYY-MM-DD` });
    }

    if (row.current_email && !isValidEmail(row.current_email)) {
      errors.push({ row: rowNum, field: "Email Address", msg: `"${row.current_email}" is not a valid email` });
    }

    if (row.year_end_cash_value && isNaN(parseFloat(row.year_end_cash_value))) {
      errors.push({ row: rowNum, field: "Year-end Cash Value", msg: "Must be a number" });
    }
    if (row.gross_payments && isNaN(parseFloat(row.gross_payments))) {
      errors.push({ row: rowNum, field: "Gross Payments", msg: "Must be a number" });
    }

    const boolFields = [
      'is_pre_existing', 'account_holder_is_alive', 'account_closed_during_period',
      'account_holder_deceased_during_period', 'death_certificate_requested',
      'death_certificate_received', 'will_or_inheritance_requested',
      'will_or_inheritance_received', 'legacy_of_deceased_settled',
      'entity_managed_by_fiduciary_trust', 'entity_managed_by_asset_manager',
      'gross_income_from_financial_assets'
    ];
    boolFields.forEach(field => {
      if (row[field] && !['true', 'false', '1', '0', 'yes', 'no', ''].includes(String(row[field]).toLowerCase())) {
        errors.push({ row: rowNum, field, msg: `Must be true or false (got "${row[field]}")` });
      }
    });

    return errors;
  };

  // ── Convert row to account object ──────────────────────────────────────────
  const convertRowToAccount = (row) => {
    const toBool = (v) => ['true', '1', 'yes'].includes(String(v).toLowerCase());
    return {
      tenant_id: tenant.id,
      entity_id: row.entity_id,
      account_number: row.account_number,
      account_creation_date: row.account_creation_date || null,
      account_type: row.account_type,
      account_holder_type: row.account_holder_type,
      account_holder_name: row.account_holder_name,
      first_name: row.account_holder_name?.split(' ')[0] || '',
      last_name: row.account_holder_name?.split(' ').slice(1).join(' ') || '',
      date_of_birth: row.date_of_birth || null,
      place_of_birth: row.place_of_birth || null,
      is_pre_existing: toBool(row.is_pre_existing),
      account_holder_is_alive: row.account_holder_type === 'individual' ? !toBool(row.account_holder_is_alive === '' ? 'false' : (row.account_holder_is_alive === 'false' || row.account_holder_is_alive === '0' || row.account_holder_is_alive === 'no' ? 'true' : 'false')) : undefined,
      account_closed_during_period: toBool(row.account_closed_during_period),
      country_of_residence: row.country_of_residence || '',
      current_email: row.current_email || '',
      current_phone: row.current_phone || '',
      year_end_cash_value: parseFloat(row.year_end_cash_value) || 0,
      year_end_cash_value_currency: row.year_end_cash_value_currency || 'USD',
      gross_payments: parseFloat(row.gross_payments) || 0,
      gross_payments_currency: row.gross_payments_currency || 'USD',
      reporting_year: row.reporting_year || new Date().getFullYear().toString(),
      account_holder_deceased_during_period: toBool(row.account_holder_deceased_during_period),
      death_certificate_requested: toBool(row.death_certificate_requested),
      death_certificate_requested_date: row.death_certificate_requested_date || null,
      death_certificate_received: toBool(row.death_certificate_received),
      death_certificate_received_date: row.death_certificate_received_date || null,
      will_or_inheritance_requested: toBool(row.will_or_inheritance_requested),
      will_or_inheritance_requested_date: row.will_or_inheritance_requested_date || null,
      will_or_inheritance_received: toBool(row.will_or_inheritance_received),
      will_or_inheritance_received_date: row.will_or_inheritance_received_date || null,
      legacy_of_deceased_settled: toBool(row.legacy_of_deceased_settled),
      legacy_settlement_date: row.legacy_settlement_date || null,
      entity_managed_by_fiduciary_trust: toBool(row.entity_managed_by_fiduciary_trust),
      entity_managed_by_asset_manager: toBool(row.entity_managed_by_asset_manager),
      gross_income_from_financial_assets: toBool(row.gross_income_from_financial_assets),
      reportability_status: 'pending_review',
      status: 'active',
      account_holder_address: { street: row.street || '', city: row.city || '', state: row.state || '', postal_code: row.postal_code || '', country: row.country || '' },
      current_address: { street: row.current_street || '', city: row.current_city || '', state: row.current_state || '', postal_code: row.current_postal_code || '', country: row.current_country || '' },
      tax_residencies: [1, 2, 3, 4, 5].reduce((arr, i) => {
        if (row[`tax_residency_${i}_country`]) arr.push({ country: row[`tax_residency_${i}_country`], tin: row[`tax_residency_${i}_tin`] || '', tin_unavailable_reason: row[`tax_residency_${i}_tin`] ? '' : 'Not provided in import' });
        return arr;
      }, [])
    };
  };

  const autoClassifyAccount = (accountData) => {
    const hasForeignTaxResidency = accountData.tax_residencies.some(r => r.country && r.country !== tenant.jurisdiction);
    const hasForeignAddress = accountData.account_holder_address?.country && accountData.account_holder_address.country !== tenant.jurisdiction;
    const autoIndicia = [];
    if (hasForeignAddress) autoIndicia.push('foreign_address');
    let status = 'pending_review', reason = 'Requires manual classification';
    if (accountData.account_holder_type === 'individual') {
      if (hasForeignTaxResidency) { status = 'reportable'; reason = 'Foreign tax residency detected'; autoIndicia.push('foreign_tax_residency'); }
      else if (hasForeignAddress) { status = 'pending_review'; reason = 'Foreign address found — requires self-certification'; }
      else if (accountData.tax_residencies.length > 0) { status = 'non_reportable'; reason = 'Local tax resident only (auto-classified from import)'; }
    }
    return { reportability_status: status, reportability_reason: reason, indicia_found: autoIndicia };
  };

  // ── Step 2: Validate file ─────────────────────────────────────────────────
  const handleFileAndValidate = async (selectedFile) => {
    if (!selectedFile || !selectedFile.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }
    setFile(selectedFile);
    setValidationErrors([]);
    setPreviewData(null);

    const text = await selectedFile.text();
    const rows = parseCSV(text);
    if (rows.length === 0) {
      setValidationErrors([{ row: '-', field: 'File', msg: 'No data rows found in the CSV (is the file empty?)' }]);
      return;
    }
    setParsedRows(rows);

    const validEntityIds = entities.map(e => e.id);
    const allErrors = [];
    rows.forEach((row, i) => allErrors.push(...validateRow(row, i, validEntityIds)));

    // Check for duplicate account+entity combos in the CSV itself
    const combos = rows.map(r => `${r.entity_id}|${r.account_number}`).filter(c => c !== '|');
    combos.forEach((combo, idx) => {
      if (combos.indexOf(combo) !== idx) {
        const [, accNum] = combo.split('|');
        allErrors.push({ row: idx + 2, field: 'Account Number', msg: `Duplicate account number "${accNum}" for the same entity within this file` });
      }
    });

    setValidationErrors(allErrors);

    // Build preview
    const existingAccounts = await base44.entities.Account.filter({ tenant_id: tenant.id });
    const existingMap = new Map(existingAccounts.map(a => [`${a.entity_id}|${a.account_number}`, a]));
    const invalidRowNums = new Set(allErrors.map(e => e.row));

    const toCreate = [], toUpdate = [], invalidRows = [];
    rows.forEach((row, i) => {
      const rowNum = i + 2;
      if (invalidRowNums.has(rowNum)) { invalidRows.push({ rowNum, account_number: row.account_number, account_holder_name: row.account_holder_name }); return; }
      const key = `${row.entity_id}|${row.account_number}`;
      if (existingMap.has(key)) toUpdate.push({ rowNum, account_number: row.account_number, account_holder_name: row.account_holder_name });
      else toCreate.push({ rowNum, account_number: row.account_number, account_holder_name: row.account_holder_name });
    });

    setPreviewData({ toCreate, toUpdate, invalidRows });
    setStep(3);
  };

  // ── Step 4: Import ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setResults(null);

    const existingAccounts = await base44.entities.Account.filter({ tenant_id: tenant.id });
    const existingMap = new Map(existingAccounts.map(a => [`${a.entity_id}|${a.account_number}`, a]));
    const validEntityIds = entities.map(e => e.id);
    const invalidRowNums = new Set(validationErrors.map(e => e.row));

    const imported = [], updated = [], failed = [];

    const validRows = parsedRows.filter((_, i) => !invalidRowNums.has(i + 2));
    for (let i = 0; i < validRows.length; i++) {
      try {
        const accountData = convertRowToAccount(validRows[i]);
        const autoClassification = autoClassifyAccount(accountData);
        Object.assign(accountData, autoClassification);
        const existing = existingMap.get(`${accountData.entity_id}|${accountData.account_number}`);
        if (existing) {
          const changes = {};
          Object.keys(accountData).forEach(k => { if (JSON.stringify(existing[k]) !== JSON.stringify(accountData[k])) changes[k] = { old: existing[k], new: accountData[k] }; });
          await base44.entities.Account.update(existing.id, accountData);
          await auditLog.accountUpdated(existing.id, changes);
          updated.push({ account_number: accountData.account_number, account_holder_name: accountData.account_holder_name, changes: Object.keys(changes).length, status: autoClassification.reportability_status });
        } else {
          await base44.entities.Account.create(accountData);
          imported.push({ account_number: accountData.account_number, account_holder_name: accountData.account_holder_name, status: autoClassification.reportability_status, auto_classified: autoClassification.reportability_status !== 'pending_review' });
        }
      } catch (err) {
        failed.push({ account_number: validRows[i].account_number, error: err.message });
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setResults({ imported, updated, failed, autoClassified: imported.filter(a => a.auto_classified).length });
    setStep(4);
    setImporting(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <StepIndicator currentStep={step} />

      {/* ── STEP 1: Download Template ───────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-600" />
                Download Template
              </CardTitle>
              <CardDescription>
                Get a pre-filled CSV template with your actual Entity IDs and example data
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* Entity reference */}
              {entities.length > 0 && (
                <Alert className="bg-indigo-50 border-indigo-200">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <AlertDescription className="text-sm text-indigo-900">
                    <strong>Your entities will be pre-filled in the template:</strong>
                    <div className="mt-2 space-y-1">
                      {entities.map(e => (
                        <div key={e.id} className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="font-mono text-xs">{e.id.slice(-8)}</Badge>
                          <span className="text-indigo-800 font-medium">{e.entity_name}</span>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              <Button onClick={downloadTemplate} variant="outline" className="w-full border-2 border-indigo-200 hover:bg-indigo-50 h-12">
                <FileSpreadsheet className="w-5 h-5 mr-2 text-indigo-600" />
                Download accounts_import_template.csv
              </Button>
            </CardContent>
          </Card>

          <FieldGuide />

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => setStep(2)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              Next: Upload File <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Upload & Validate ───────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Upload & Validate
              </CardTitle>
              <CardDescription>Select your completed CSV — it will be validated before any data is changed</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <label htmlFor="csv-upload" className="block border-2 border-dashed border-slate-300 rounded-lg p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
                <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">{file ? file.name : 'Click to select your CSV file'}</p>
                <p className="text-xs text-slate-400 mt-1">Only .csv files accepted</p>
                <input id="csv-upload" type="file" accept=".csv" className="hidden"
                  onChange={e => { if (e.target.files[0]) handleFileAndValidate(e.target.files[0]); }} />
              </label>
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-500" />
                <AlertDescription className="text-xs text-blue-800">
                  Your file will be <strong>validated first</strong> — no accounts will be created or modified until you confirm on the next step.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          <div className="flex justify-start">
            <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Preview & Confirm ───────────────────────────────────────── */}
      {step === 3 && previewData && (
        <div className="space-y-4">
          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <Card className="border-2 border-red-200 bg-red-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-red-800 text-base">
                  <XCircle className="w-5 h-5" />
                  {validationErrors.length} Validation Issue{validationErrors.length !== 1 ? 's' : ''} Found
                </CardTitle>
                <CardDescription className="text-red-600 text-xs">
                  Rows with errors will be skipped. Fix them and re-upload, or proceed to import only the valid rows.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-48 overflow-y-auto space-y-1">
                {validationErrors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-800 bg-red-100/60 rounded px-2 py-1.5">
                    <span className="font-bold shrink-0">Row {e.row}:</span>
                    <span className="text-red-600 font-medium shrink-0">[{e.field}]</span>
                    <span>{e.msg}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Import preview summary */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600" />
                Import Preview
              </CardTitle>
              <CardDescription>Here's exactly what will happen when you confirm the import</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-xl bg-green-50 border border-green-200">
                  <p className="text-3xl font-bold text-green-600">{previewData.toCreate.length}</p>
                  <p className="text-xs text-green-700 font-medium mt-1">New accounts will be created</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-3xl font-bold text-amber-600">{previewData.toUpdate.length}</p>
                  <p className="text-xs text-amber-700 font-medium mt-1">Existing accounts will be updated</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-3xl font-bold text-red-600">{previewData.invalidRows.length}</p>
                  <p className="text-xs text-red-700 font-medium mt-1">Rows will be skipped (errors)</p>
                </div>
              </div>

              {previewData.toCreate.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-2">Will be created:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {previewData.toCreate.map((r, i) => (
                      <div key={i} className="flex justify-between items-center text-xs px-2 py-1 bg-green-50 rounded">
                        <span className="text-slate-700">{r.account_holder_name || '—'}</span>
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300">{r.account_number}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewData.toUpdate.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-2">Will be updated:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {previewData.toUpdate.map((r, i) => (
                      <div key={i} className="flex justify-between items-center text-xs px-2 py-1 bg-amber-50 rounded">
                        <span className="text-slate-700">{r.account_holder_name || '—'}</span>
                        <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">{r.account_number}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-500" />
                <AlertDescription className="text-xs text-blue-800">
                  All imported accounts will start as <strong>Pending Review</strong>. Accounts with foreign tax residencies may be auto-classified as reportable.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => { setStep(2); setFile(null); setParsedRows([]); setPreviewData(null); setValidationErrors([]); }}>
              <RefreshCw className="w-4 h-4 mr-2" /> Upload Different File
            </Button>
            <Button
              onClick={handleImport}
              disabled={(previewData.toCreate.length + previewData.toUpdate.length) === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              Confirm Import {previewData.toCreate.length + previewData.toUpdate.length} Account{(previewData.toCreate.length + previewData.toUpdate.length) !== 1 ? 's' : ''} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Importing progress ──────────────────────────────────────────────── */}
      {importing && (
        <Card className="border-2 border-indigo-200 bg-indigo-50/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="text-sm font-medium text-indigo-900">Importing accounts... {progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* ── STEP 4: Results ─────────────────────────────────────────────────── */}
      {step === 4 && results && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-green-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Created', value: results.imported.length, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Updated', value: results.updated.length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
                { label: 'Auto-Classified', value: results.autoClassified, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
                { label: 'Failed', value: results.failed.length, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
              ].map(s => (
                <div key={s.label} className={`text-center p-4 rounded-xl border ${s.bg}`}>
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs font-medium text-slate-600 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {results.failed.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-red-700">Failed rows:</p>
                {results.failed.map((f, i) => (
                  <div key={i} className="text-xs bg-red-50 rounded px-3 py-1.5 text-red-800">
                    <strong>{f.account_number}</strong>: {f.error}
                  </div>
                ))}
              </div>
            )}

            {results.autoClassified > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-500" />
                <AlertDescription className="text-xs text-blue-800">
                  <strong>{results.autoClassified} accounts</strong> were auto-classified based on tax residency data. Review them in the Accounts list.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep(1); setFile(null); setParsedRows([]); setPreviewData(null); setValidationErrors([]); setResults(null); setProgress(0); }}>
                Import Another File
              </Button>
              <Button onClick={onComplete} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                View Accounts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}