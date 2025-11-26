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
  Loader2
} from "lucide-react";

export default function BulkImport({ tenant, entities, onComplete, onCancel }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState([]);

  // Field mapping: label -> technical name
  const labelToField = {
    "Account Creation Date": "created_date",
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

  const downloadTemplate = () => {
    // Create header row with user-friendly labels
    const headers = [
      "Account Creation Date", "Entity ID", "Account Number", "Account Type", "Account Holder Type", "Account Holder Name",
      "Date of Birth", "Place of Birth", "Pre-existing Account", "Account Holder Alive", "Account Closed During Period",
      "Street Address", "City", "State/Province", "Postal Code", "Country",
      "Current Street Address", "Current City", "Current State/Province", "Current Postal Code", "Current Country",
      "Country of Residence", "Email Address", "Phone Number",
      "Year-end Cash Value", "Year-end Value Currency", "Gross Payments", "Gross Payments Currency", "Reporting Year",
      "Deceased During Period", "Death Certificate Requested", "Death Cert. Requested Date",
      "Death Certificate Received", "Death Cert. Received Date",
      "Will/Inheritance Requested", "Will/Inheritance Requested Date",
      "Will/Inheritance Received", "Will/Inheritance Received Date",
      "Legacy Settled", "Legacy Settlement Date",
      "Managed by Fiduciary Trust", "Managed by Asset Manager", "Income >50% from Financial Assets",
      "Tax Residency 1 - Country", "Tax Residency 1 - TIN", "Tax Residency 2 - Country", "Tax Residency 2 - TIN"
    ];
    
    const template = `${headers.join(',')}
2017-06-15,${entities[0]?.id || 'ENTITY_ID'},ACC-001,depository,individual,John Smith,1985-06-15,United States,false,true,false,123 Main St,New York,NY,10001,United States,123 Main St,New York,NY,10001,United States,United States,john@example.com,+12125551234,50000,USD,5000,USD,2024,false,false,,false,,,false,,false,,,,,United States,123-45-6789,,
2019-03-22,${entities[0]?.id || 'ENTITY_ID'},ACC-002,custodial,individual,Jane Doe,1990-03-22,United Kingdom,true,true,false,456 Oak Ave,London,,SW1A 1AA,United Kingdom,456 Oak Ave,London,,SW1A 1AA,United Kingdom,United Kingdom,jane@example.com,+442075551234,75000,GBP,10000,GBP,2024,false,false,,false,,,false,,false,,,,,United Kingdom,AB123456C,France,1234567890
2020-01-10,${entities[0]?.id || 'ENTITY_ID'},ACC-003,depository,entity,ABC Corp,,,false,,false,789 Corporate Blvd,Tokyo,,100-0001,Japan,789 Corporate Blvd,Tokyo,,100-0001,Japan,Japan,contact@abc.jp,+81312345678,1000000,JPY,50000,JPY,2024,,,,,,,,,,,false,false,true,Japan,1234567890,,`;

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
        // Map user-friendly label to technical field name
        const fieldName = labelToField[header] || header;
        row[fieldName] = values[index]?.trim() || '';
      });
      rows.push(row);
    }

    return rows;
  };

  const validateRow = (row, index, validEntityIds) => {
    const errors = [];
    const rowNum = index + 2;

    // Required field validation
    if (!row.entity_id) errors.push(`Row ${rowNum}: Missing Entity ID`);
    if (!row.account_number) errors.push(`Row ${rowNum}: Missing Account Number`);
    if (!row.account_holder_type) errors.push(`Row ${rowNum}: Missing Account Holder Type`);
    if (!row.account_holder_name) errors.push(`Row ${rowNum}: Missing Account Holder Name`);

    // Referential integrity - validate entity_id exists
    if (row.entity_id && !validEntityIds.includes(row.entity_id)) {
      errors.push(`Row ${rowNum}: Entity ID "${row.entity_id}" does not exist`);
    }

    // Note: Removed uniqueness check - duplicates will trigger updates instead of errors
    
    // Lookup data validation - account_type
    const validAccountTypes = ['depository', 'custodial', 'equity_debt_interest', 'cash_value_insurance', 'annuity'];
    if (row.account_type && !validAccountTypes.includes(row.account_type)) {
      errors.push(`Row ${rowNum}: Invalid Account Type "${row.account_type}". Must be one of: ${validAccountTypes.join(', ')}`);
    }
    
    // Lookup data validation - account_holder_type
    const validHolderTypes = ['individual', 'entity'];
    if (row.account_holder_type && !validHolderTypes.includes(row.account_holder_type)) {
      errors.push(`Row ${rowNum}: Invalid Account Holder Type "${row.account_holder_type}". Must be: individual or entity`);
    }
    
    // Conditional validation - individual accounts
    if (row.account_holder_type === 'individual') {
      if (!row.date_of_birth) {
        errors.push(`Row ${rowNum}: Date of Birth is required for individual accounts`);
      }
      
      // Validate account_holder_is_alive for individuals
      if (row.account_holder_is_alive && !['true', 'false', '1', '0', 'yes', 'no', ''].includes(row.account_holder_is_alive.toLowerCase())) {
        errors.push(`Row ${rowNum}: Account Holder Alive must be true/false`);
      }
      
      // Conditional: if deceased, validate deceased-related fields
      const isDeceased = row.account_holder_is_alive === 'false' || row.account_holder_is_alive === '0' || row.account_holder_is_alive === 'no';
      if (isDeceased) {
        if (row.death_certificate_requested === 'true' || row.death_certificate_requested === '1' || row.death_certificate_requested === 'yes') {
          if (row.death_certificate_requested_date && !isValidDate(row.death_certificate_requested_date)) {
            errors.push(`Row ${rowNum}: Invalid Death Certificate Requested Date format. Use YYYY-MM-DD`);
          }
        }
        if (row.death_certificate_received === 'true' || row.death_certificate_received === '1' || row.death_certificate_received === 'yes') {
          if (row.death_certificate_received_date && !isValidDate(row.death_certificate_received_date)) {
            errors.push(`Row ${rowNum}: Invalid Death Certificate Received Date format. Use YYYY-MM-DD`);
          }
        }
      }
    }
    
    // Date format validation
    if (row.date_of_birth && !isValidDate(row.date_of_birth)) {
      errors.push(`Row ${rowNum}: Invalid Date of Birth format. Use YYYY-MM-DD`);
    }
    
    if (row.date_of_birth && isValidDate(row.date_of_birth)) {
      const birthDate = new Date(row.date_of_birth);
      const today = new Date();
      if (birthDate > today) {
        errors.push(`Row ${rowNum}: Date of Birth cannot be in the future`);
      }
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 0 || age > 150) {
        errors.push(`Row ${rowNum}: Date of Birth results in invalid age (${age} years)`);
      }
    }
    
    // Email format validation
    if (row.current_email && !isValidEmail(row.current_email)) {
      errors.push(`Row ${rowNum}: Invalid Email Address format`);
    }
    
    // Number validation
    if (row.year_end_cash_value && isNaN(parseFloat(row.year_end_cash_value))) {
      errors.push(`Row ${rowNum}: Year-end Cash Value must be a number`);
    }
    if (row.gross_payments && isNaN(parseFloat(row.gross_payments))) {
      errors.push(`Row ${rowNum}: Gross Payments must be a number`);
    }
    
    // Currency validation
    if (row.year_end_cash_value && parseFloat(row.year_end_cash_value) < 0) {
      errors.push(`Row ${rowNum}: Year-end Cash Value cannot be negative`);
    }
    if (row.gross_payments && parseFloat(row.gross_payments) < 0) {
      errors.push(`Row ${rowNum}: Gross Payments cannot be negative`);
    }
    
    // Boolean field validation
    const boolFields = [
      'is_pre_existing', 'account_closed_during_period', 
      'account_holder_deceased_during_period', 'death_certificate_requested',
      'death_certificate_received', 'will_or_inheritance_requested',
      'will_or_inheritance_received', 'legacy_of_deceased_settled',
      'entity_managed_by_fiduciary_trust', 'entity_managed_by_asset_manager',
      'gross_income_from_financial_assets'
    ];
    
    boolFields.forEach(field => {
      if (row[field] && !['true', 'false', '1', '0', 'yes', 'no', ''].includes(String(row[field]).toLowerCase())) {
        errors.push(`Row ${rowNum}: ${field.replace(/_/g, ' ')} must be true/false/yes/no`);
      }
    });

    return errors;
  };
  
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  };
  
  const isValidEmail = (email) => {
    if (!email) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
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
      account_holder_deceased_during_period: row.account_holder_deceased_during_period === 'true' || row.account_holder_deceased_during_period === '1' || row.account_holder_deceased_during_period === 'yes',
      death_certificate_requested: row.death_certificate_requested === 'true' || row.death_certificate_requested === '1' || row.death_certificate_requested === 'yes',
      death_certificate_requested_date: row.death_certificate_requested_date || null,
      death_certificate_received: row.death_certificate_received === 'true' || row.death_certificate_received === '1' || row.death_certificate_received === 'yes',
      death_certificate_received_date: row.death_certificate_received_date || null,
      will_or_inheritance_requested: row.will_or_inheritance_requested === 'true' || row.will_or_inheritance_requested === '1' || row.will_or_inheritance_requested === 'yes',
      will_or_inheritance_requested_date: row.will_or_inheritance_requested_date || null,
      will_or_inheritance_received: row.will_or_inheritance_received === 'true' || row.will_or_inheritance_received === '1' || row.will_or_inheritance_received === 'yes',
      will_or_inheritance_received_date: row.will_or_inheritance_received_date || null,
      legacy_of_deceased_settled: row.legacy_of_deceased_settled === 'true' || row.legacy_of_deceased_settled === '1' || row.legacy_of_deceased_settled === 'yes',
      legacy_settlement_date: row.legacy_settlement_date || null,
      entity_managed_by_fiduciary_trust: row.entity_managed_by_fiduciary_trust === 'true' || row.entity_managed_by_fiduciary_trust === '1' || row.entity_managed_by_fiduciary_trust === 'yes',
      entity_managed_by_asset_manager: row.entity_managed_by_asset_manager === 'true' || row.entity_managed_by_asset_manager === '1' || row.entity_managed_by_asset_manager === 'yes',
      gross_income_from_financial_assets: row.gross_income_from_financial_assets === 'true' || row.gross_income_from_financial_assets === '1' || row.gross_income_from_financial_assets === 'yes',
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

      // Fetch existing accounts for uniqueness check
      const existingAccounts = await base44.entities.Account.filter({ tenant_id: tenant.id });
      const existingAccountNumbers = existingAccounts.map(a => a.account_number);
      
      // Get valid entity IDs for referential integrity
      const validEntityIds = entities.map(e => e.id);
      
      // Check for duplicate account numbers within the CSV
      const csvAccountNumbers = rows.map(r => r.account_number).filter(Boolean);
      const duplicatesInCsv = csvAccountNumbers.filter((num, index) => 
        csvAccountNumbers.indexOf(num) !== index
      );
      
      if (duplicatesInCsv.length > 0) {
        setErrors([`Duplicate Account Numbers found in CSV: ${[...new Set(duplicatesInCsv)].join(', ')}`]);
        setImporting(false);
        return;
      }

      // Validate all rows first
      const allErrors = [];
      rows.forEach((row, index) => {
        const rowErrors = validateRow(row, index, validEntityIds);
        allErrors.push(...rowErrors);
      });

      if (allErrors.length > 0) {
        setErrors(allErrors);
        setImporting(false);
        return;
      }

      // Import/Update accounts with auto-classification
      const imported = [];
      const updated = [];
      const failed = [];

      // Create a map of existing accounts by account_number for quick lookup
      const existingAccountsMap = new Map(
        existingAccounts.map(acc => [acc.account_number, acc])
      );

      for (let i = 0; i < rows.length; i++) {
        try {
          const accountData = convertRowToAccount(rows[i]);

          // Apply auto-classification
          const autoClassification = autoClassifyAccount(accountData, tenant.jurisdiction);
          Object.assign(accountData, autoClassification);

          // Check if account already exists
          const existingAccount = existingAccountsMap.get(accountData.account_number);

          if (existingAccount) {
            // Update existing account
            const changes = {};
            Object.keys(accountData).forEach(key => {
              if (JSON.stringify(existingAccount[key]) !== JSON.stringify(accountData[key])) {
                changes[key] = {
                  old: existingAccount[key],
                  new: accountData[key]
                };
              }
            });

            await base44.entities.Account.update(existingAccount.id, accountData);

            // Log the update
            await auditLog.accountUpdated(existingAccount.id, changes);

            updated.push({
              row: i + 2,
              account_number: accountData.account_number,
              account_holder_name: accountData.account_holder_name,
              auto_classified: autoClassification.reportability_status !== 'pending_review',
              status: autoClassification.reportability_status,
              changes: Object.keys(changes).length
            });
          } else {
            // Create new account
            const account = await base44.entities.Account.create(accountData);

            imported.push({
              row: i + 2,
              account_number: accountData.account_number,
              account_holder_name: accountData.account_holder_name,
              auto_classified: autoClassification.reportability_status !== 'pending_review',
              status: autoClassification.reportability_status
            });
          }
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
        updated: updated.length,
        failed: failed.length,
        importedAccounts: imported,
        updatedAccounts: updated,
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
              <li>Entity ID (must match an existing entity)</li>
              <li>Account Number (unique identifier)</li>
              <li>Account Type (depository, custodial, equity_debt_interest, cash_value_insurance, annuity)</li>
              <li>Account Holder Type (individual or entity)</li>
              <li>Account Holder Name</li>
              <li>Date of Birth (required for individual accounts)</li>
              <li>Country (in address section)</li>
            </ul>
            
            <p className="mt-3"><strong>CRS Fields:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Pre-existing Account (true/false - whether account opened before Jan 1, 2018)</li>
              <li>Account Holder Alive (true/false - for individual accounts only)</li>
            </ul>
            
            <p className="mt-3"><strong>Optional Fields:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Account Creation Date (YYYY-MM-DD format - used to determine pre-existing status)</li>
              <li>Tax residencies (up to 2 per account)</li>
              <li>Address details (Street Address, City, State/Province, Postal Code)</li>
              <li>Current address (Current Street, City, State, Postal Code, Country)</li>
              <li>Place of Birth, Country of Residence, Email Address, Phone Number</li>
              <li>Year-end Cash Value, Year-end Value Currency</li>
              <li>Gross Payments, Gross Payments Currency</li>
              <li>Reporting Year</li>
              <li>CRS Classification fields (deceased information, entity management)</li>
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
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-2xl font-bold text-slate-900">{results.total}</p>
                <p className="text-xs text-slate-600">Total Rows</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                <p className="text-2xl font-bold text-green-600">{results.imported}</p>
                <p className="text-xs text-green-700">Created</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-2xl font-bold text-amber-600">{results.updated}</p>
                <p className="text-xs text-amber-700">Updated</p>
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

            {/* Created Accounts */}
            {results.importedAccounts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Successfully Created ({results.imported})
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

            {/* Updated Accounts */}
            {results.updatedAccounts?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Successfully Updated ({results.updated})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {results.updatedAccounts.map((acc, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-amber-50">
                      <div className="flex-1">
                        <span className="text-amber-900 font-medium">
                          Row {acc.row}: {acc.account_holder_name}
                        </span>
                        <span className="ml-2 text-xs text-slate-600">
                          ({acc.changes} field{acc.changes !== 1 ? 's' : ''} changed)
                        </span>
                      </div>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
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
                <strong>Summary:</strong> {results.imported} created, {results.updated} updated. 
                {results.autoClassified > 0 && ` ${results.autoClassified} accounts were auto-classified.`}
                {results.updated > 0 && ` All updates have been logged in the audit trail.`}
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