import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
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
  Loader2
} from "lucide-react";

export default function BulkImport({ tenant, entities, onComplete, onCancel }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState([]);

  const downloadTemplate = () => {
    const template = `entity_id,account_number,account_type,account_holder_type,account_holder_name,date_of_birth,place_of_birth,is_pre_existing,account_holder_is_alive,account_closed_during_period,street,city,state,postal_code,country,current_street,current_city,current_state,current_postal_code,current_country,country_of_residence,current_email,current_phone,year_end_cash_value,year_end_cash_value_currency,gross_payments,gross_payments_currency,reporting_year,tax_residency_1_country,tax_residency_1_tin,tax_residency_2_country,tax_residency_2_tin
${entities[0]?.id || 'ENTITY_ID'},ACC-001,depository,individual,John Smith,1985-06-15,United States,false,true,false,123 Main St,New York,NY,10001,United States,123 Main St,New York,NY,10001,United States,United States,john@example.com,+12125551234,50000,USD,5000,USD,2024,United States,123-45-6789,,
${entities[0]?.id || 'ENTITY_ID'},ACC-002,custodial,individual,Jane Doe,1990-03-22,United Kingdom,true,true,false,456 Oak Ave,London,,SW1A 1AA,United Kingdom,456 Oak Ave,London,,SW1A 1AA,United Kingdom,United Kingdom,jane@example.com,+442075551234,75000,GBP,10000,GBP,2024,United Kingdom,AB123456C,France,1234567890
${entities[0]?.id || 'ENTITY_ID'},ACC-003,depository,entity,ABC Corp,,,false,,false,789 Corporate Blvd,Tokyo,,100-0001,Japan,789 Corporate Blvd,Tokyo,,100-0001,Japan,Japan,contact@abc.jp,+81312345678,1000000,JPY,50000,JPY,2024,Japan,1234567890,,`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accounts_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        alert('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setResults(null);
      setErrors([]);
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      rows.push(row);
    }

    return rows;
  };

  const validateRow = (row, index) => {
    const errors = [];
    
    if (!row.entity_id) errors.push(`Row ${index + 2}: Missing entity_id`);
    if (!row.account_number) errors.push(`Row ${index + 2}: Missing account_number`);
    if (!row.account_holder_type) errors.push(`Row ${index + 2}: Missing account_holder_type`);
    if (!row.account_holder_name) errors.push(`Row ${index + 2}: Missing account_holder_name`);
    
    if (row.account_holder_type === 'individual' && !row.date_of_birth) {
      errors.push(`Row ${index + 2}: Individual accounts require date_of_birth`);
    }
    
    if (!['depository', 'custodial', 'equity_debt_interest', 'cash_value_insurance', 'annuity'].includes(row.account_type)) {
      errors.push(`Row ${index + 2}: Invalid account_type "${row.account_type}"`);
    }
    
    if (!['individual', 'entity'].includes(row.account_holder_type)) {
      errors.push(`Row ${index + 2}: Invalid account_holder_type "${row.account_holder_type}"`);
    }

    return errors;
  };

  const convertRowToAccount = (row) => {
    const account = {
      tenant_id: tenant.id,
      entity_id: row.entity_id,
      account_number: row.account_number,
      account_type: row.account_type,
      account_holder_type: row.account_holder_type,
      account_holder_name: row.account_holder_name,
      date_of_birth: row.date_of_birth || null,
      place_of_birth: row.place_of_birth || null,
      is_pre_existing: row.is_pre_existing === 'true' || row.is_pre_existing === '1' || row.is_pre_existing === 'yes',
      account_holder_is_alive: row.account_holder_type === 'individual' ? 
        (row.account_holder_is_alive !== 'false' && row.account_holder_is_alive !== '0' && row.account_holder_is_alive !== 'no') : 
        undefined,
      account_closed_during_period: row.account_closed_during_period === 'true' || row.account_closed_during_period === '1' || row.account_closed_during_period === 'yes',
      country_of_residence: row.country_of_residence || '',
      current_email: row.current_email || '',
      current_phone: row.current_phone || '',
      year_end_cash_value: parseFloat(row.year_end_cash_value) || 0,
      year_end_cash_value_currency: row.year_end_cash_value_currency || 'USD',
      gross_payments: parseFloat(row.gross_payments) || 0,
      gross_payments_currency: row.gross_payments_currency || 'USD',
      reporting_year: row.reporting_year || new Date().getFullYear().toString(),
      reportability_status: 'pending_review',
      status: 'active',
      account_holder_address: {
        street: row.street || '',
        city: row.city || '',
        state: row.state || '',
        postal_code: row.postal_code || '',
        country: row.country || ''
      },
      current_address: {
        street: row.current_street || '',
        city: row.current_city || '',
        state: row.current_state || '',
        postal_code: row.current_postal_code || '',
        country: row.current_country || ''
      },
      tax_residencies: []
    };

    // Parse tax residencies
    for (let i = 1; i <= 5; i++) {
      const countryKey = `tax_residency_${i}_country`;
      const tinKey = `tax_residency_${i}_tin`;
      
      if (row[countryKey]) {
        account.tax_residencies.push({
          country: row[countryKey],
          tin: row[tinKey] || '',
          tin_unavailable_reason: row[tinKey] ? '' : 'Not provided in import'
        });
      }
    }

    return account;
  };

  const autoClassifyAccount = (accountData, tenantJurisdiction) => {
    // Auto-classification logic
    let autoReportabilityStatus = 'pending_review';
    let autoReportabilityReason = 'Requires manual classification';
    let autoIndicia = [];

    // Check for foreign address
    if (accountData.account_holder_address?.country && 
        accountData.account_holder_address.country !== tenantJurisdiction) {
      autoIndicia.push('foreign_address');
    }

    // Check for foreign tax residencies
    const hasForeignTaxResidency = accountData.tax_residencies.some(
      r => r.country && r.country !== tenantJurisdiction
    );

    // Simple auto-classification rules
    if (accountData.account_holder_type === 'individual') {
      if (hasForeignTaxResidency) {
        autoReportabilityStatus = 'reportable';
        autoReportabilityReason = 'Foreign tax residency detected in import data';
        autoIndicia.push('foreign_tax_residency');
      } else if (autoIndicia.length > 0) {
        autoReportabilityStatus = 'pending_review';
        autoReportabilityReason = 'Foreign indicia found - requires self-certification';
      } else if (!hasForeignTaxResidency && accountData.tax_residencies.length > 0) {
        // Has tax residency info and all are local
        autoReportabilityStatus = 'non_reportable';
        autoReportabilityReason = 'Local tax resident only (auto-classified from import)';
      }
    } else if (accountData.account_holder_type === 'entity') {
      // Entity accounts always need manual classification
      autoReportabilityStatus = 'pending_review';
      autoReportabilityReason = 'Entity account requires classification workflow';
    }

    return {
      reportability_status: autoReportabilityStatus,
      reportability_reason: autoReportabilityReason,
      indicia_found: autoIndicia.length > 0 ? autoIndicia : undefined
    };
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setResults(null);
    setErrors([]);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        throw new Error('No data found in CSV file');
      }

      // Validate all rows first
      const allErrors = [];
      rows.forEach((row, index) => {
        const rowErrors = validateRow(row, index);
        allErrors.push(...rowErrors);
      });

      if (allErrors.length > 0) {
        setErrors(allErrors);
        setImporting(false);
        return;
      }

      // Import accounts with auto-classification
      const imported = [];
      const failed = [];

      for (let i = 0; i < rows.length; i++) {
        try {
          const accountData = convertRowToAccount(rows[i]);
          
          // Apply auto-classification
          const autoClassification = autoClassifyAccount(accountData, tenant.jurisdiction);
          Object.assign(accountData, autoClassification);

          const account = await base44.entities.Account.create(accountData);
          imported.push({
            row: i + 2,
            account_number: accountData.account_number,
            account_holder_name: accountData.account_holder_name,
            auto_classified: autoClassification.reportability_status !== 'pending_review',
            status: autoClassification.reportability_status
          });
        } catch (error) {
          failed.push({
            row: i + 2,
            account_number: rows[i].account_number,
            error: error.message
          });
        }

        setProgress(Math.round(((i + 1) / rows.length) * 100));
      }

      setResults({
        total: rows.length,
        imported: imported.length,
        failed: failed.length,
        importedAccounts: imported,
        failedAccounts: failed,
        autoClassified: imported.filter(a => a.auto_classified).length
      });

    } catch (error) {
      setErrors([error.message]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Card className="border-2 border-blue-100 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="w-5 h-5 text-blue-600" />
            Bulk Import Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-slate-700">
            <p><strong>Step 1:</strong> Download the CSV template below</p>
            <p><strong>Step 2:</strong> Fill in your account data following the template format</p>
            <p><strong>Step 3:</strong> Upload the completed CSV file</p>
          </div>
          
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-900">
              <strong>Important:</strong> All imported accounts will have status "Pending Review". 
              You'll need to run the classification workflow for each account after import.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-xs text-slate-600">
            <p><strong>Required Fields:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>entity_id (must match an existing entity)</li>
              <li>account_number (unique identifier)</li>
              <li>account_type (depository, custodial, equity_debt_interest, cash_value_insurance, annuity)</li>
              <li>account_holder_type (individual or entity)</li>
              <li>account_holder_name</li>
              <li>date_of_birth (required for individual accounts)</li>
              <li>country (in address section)</li>
            </ul>
            
            <p className="mt-3"><strong>CRS Fields:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>is_pre_existing (true/false - whether account opened before Jan 1, 2018)</li>
              <li>account_holder_is_alive (true/false - for individual accounts only)</li>
            </ul>
            
            <p className="mt-3"><strong>Optional Fields:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Tax residencies (up to 5 per account)</li>
              <li>Address details (street, city, state, postal_code)</li>
              <li>Current address (current_street, current_city, current_state, current_postal_code, current_country)</li>
              <li>place_of_birth, country_of_residence, current_email, current_phone</li>
              <li>year_end_cash_value, year_end_cash_value_currency</li>
              <li>gross_payments, gross_payments_currency</li>
              <li>reporting_year</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Download Template */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600" />
            Download Template
          </CardTitle>
          <CardDescription>
            Get a CSV template with example data and proper formatting
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Button
            onClick={downloadTemplate}
            variant="outline"
            className="w-full border-2 border-indigo-200 hover:bg-indigo-50"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download accounts_import_template.csv
          </Button>
        </CardContent>
      </Card>

      {/* Upload File */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            Upload CSV File
          </CardTitle>
          <CardDescription>
            Select your completed CSV file to import accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
              disabled={importing}
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-sm font-medium text-slate-700 mb-1">
                {file ? file.name : 'Click to select CSV file'}
              </p>
              <p className="text-xs text-slate-500">
                or drag and drop your file here
              </p>
            </label>
          </div>

          {file && !importing && !results && (
            <Button
              onClick={handleImport}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              size="lg"
            >
              <Upload className="w-4 h-4 mr-2" />
              Start Import
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Progress */}
      {importing && (
        <Card className="border-2 border-indigo-200 bg-indigo-50/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="text-sm font-medium text-indigo-900">
                Importing accounts... {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Card className="border-2 border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-red-900">
              <XCircle className="w-5 h-5" />
              Validation Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {errors.map((error, idx) => (
                <p key={idx} className="text-sm text-red-800">• {error}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-2xl font-bold text-slate-900">{results.total}</p>
                <p className="text-xs text-slate-600">Total Rows</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                <p className="text-2xl font-bold text-green-600">{results.imported}</p>
                <p className="text-xs text-green-700">Imported</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-2xl font-bold text-blue-600">{results.autoClassified}</p>
                <p className="text-xs text-blue-700">Auto-Classified</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                <p className="text-xs text-red-700">Failed</p>
              </div>
            </div>

            {/* Auto-Classification Info */}
            {results.autoClassified > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-900">
                  <strong>{results.autoClassified} accounts</strong> were automatically classified based on import data. 
                  Accounts with foreign tax residencies were marked as <strong>reportable</strong>. 
                  Accounts with local residency only were marked as <strong>non-reportable</strong>.
                </AlertDescription>
              </Alert>
            )}

            {/* Imported Accounts */}
            {results.importedAccounts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Successfully Imported ({results.imported})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {results.importedAccounts.map((acc, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-green-50">
                      <div className="flex-1">
                        <span className="text-green-900 font-medium">
                          Row {acc.row}: {acc.account_holder_name}
                        </span>
                        {acc.auto_classified && (
                          <span className="ml-2 text-xs text-blue-600">
                            (Auto: {acc.status})
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
                        {acc.account_number}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed Accounts */}
            {results.failedAccounts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Failed Imports ({results.failed})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {results.failedAccounts.map((acc, idx) => (
                    <div key={idx} className="text-sm p-2 rounded bg-red-50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-red-900 font-medium">
                          Row {acc.row}: {acc.account_number}
                        </span>
                      </div>
                      <p className="text-xs text-red-700">Error: {acc.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900">
                <strong>Next Steps:</strong> {results.autoClassified > 0 
                  ? `${results.autoClassified} accounts were auto-classified. Review remaining ${results.imported - results.autoClassified} accounts for manual classification.`
                  : 'Navigate to the Accounts page to classify imported accounts for reportability.'
                }
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setFile(null);
                  setResults(null);
                  setErrors([]);
                }}
                variant="outline"
                className="flex-1"
              >
                Import Another File
              </Button>
              <Button
                onClick={onComplete}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Close & View Accounts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel Button (if no import in progress) */}
      {!importing && !results && (
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}