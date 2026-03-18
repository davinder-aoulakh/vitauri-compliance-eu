import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Info,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import AIFieldMapper from "./AIFieldMapper";
import AIDataCleaner from "./AIDataCleaner";

const STEPS = [
  { id: 'upload', label: 'Upload File' },
  { id: 'mapping', label: 'Field Mapping' },
  { id: 'cleaning', label: 'Data Cleaning' },
  { id: 'import', label: 'Import' }
];

const FIELD_GUIDE = [
  { col: "Entity ID", format: "Text (ID)", required: true, notes: "Exact ID of the RFI Entity this account belongs to" },
  { col: "Account Number", format: "Text", required: true, notes: "Unique account identifier" },
  { col: "Account Opening Date", format: "YYYY-MM-DD", required: true, notes: "e.g. 2020-01-15" },
  { col: "Account Type", format: "depository | custodial | equity_debt_interest | cash_value_insurance | annuity", required: true, notes: "Must be one of these exact values" },
  { col: "Account Holder Type", format: "individual | entity", required: true, notes: "Determines which fields are required" },
  { col: "First Name (Individual Only)", format: "Text", required: false, notes: "Required if Account Holder Type = individual" },
  { col: "Last Name (Individual Only)", format: "Text", required: false, notes: "Required if Account Holder Type = individual" },
  { col: "Account Holder Name (Entity Only)", format: "Text", required: false, notes: "Required if Account Holder Type = entity" },
  { col: "Date of Birth", format: "YYYY-MM-DD", required: false, notes: "Required for individuals" },
  { col: "Place of Birth", format: "Country name", required: false, notes: "Country of birth for individuals" },
  { col: "Pre-existing Account", format: "true | false", required: false, notes: "Account existed before Dec 31, 2015" },
  { col: "Account Holder Alive", format: "true | false", required: false, notes: "" },
  { col: "Deceased During Period", format: "true | false", required: false, notes: "" },
  { col: "Account Closed During Period", format: "true | false", required: false, notes: "" },
  { col: "Entity Classification", format: "financial_institution | active_nfe | passive_nfe | not_applicable", required: false, notes: "For entity account holders" },
  { col: "Year-end Cash Value", format: "Number", required: false, notes: "e.g. 50000" },
  { col: "Year-end Currency", format: "ISO code", required: false, notes: "e.g. USD, AUD, GBP" },
  { col: "Gross Payments", format: "Number", required: false, notes: "" },
  { col: "Gross Payments Currency", format: "ISO code", required: false, notes: "" },
  { col: "Reporting Year", format: "YYYY", required: false, notes: "e.g. 2024" },
  { col: "Current Email Address", format: "Email", required: true, notes: "Valid email format" },
  { col: "Current Phone Number", format: "Text", required: true, notes: "e.g. +12125551234" },
  { col: "Country of Residence", format: "Country name", required: false, notes: "" },
  { col: "Account Status", format: "active | closed | dormant", required: false, notes: "Defaults to active" },
  { col: "Tax Residency 1 Country", format: "Country name", required: false, notes: "Primary tax residency country" },
  { col: "Tax Residency 1 TIN", format: "Text", required: false, notes: "Tax identification number" },
  { col: "US Person Indicator", format: "true | false", required: false, notes: "FATCA US indicia flag" },
  { col: "Self Certification Obtained", format: "true | false", required: false, notes: "" },
  { col: "Self Certification Date", format: "YYYY-MM-DD", required: false, notes: "" },
];

export default function AIBulkImport({ 
  tenant, 
  entities, 
  importType = "Account",
  onComplete, 
  onCancel 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedEntityIds, setSelectedEntityIds] = useState(() => (entities || []).map(e => e.id));
  const [showFieldGuide, setShowFieldGuide] = useState(true);
  const [file, setFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [mappings, setMappings] = useState({});
  const [cleanedData, setCleanedData] = useState(null);
  const [dataQualityIssues, setDataQualityIssues] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState([]);
  const [user, setUser] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);

  const downloadTemplate = () => {
    let csvContent;
    const selectedEntities = (entities || []).filter(e => selectedEntityIds.includes(e.id));

    if (importType === "Account") {
      const headers = [
        "Entity ID", "Account Number", "Account Opening Date", "Account Type", "Account Holder Entity Type", "Account Holder Type", 
        "Account Holder Name (Entity Only)", "First Name (Individual Only)", "Last Name (Individual Only)",
        "Date of Birth", "Place of Birth", "Pre-existing Account", "Account Holder Alive", "Deceased During Period", "Account Closed During Period",
        "Death Certificate Requested", "Death Certificate Requested Date", "Death Certificate Received", "Death Certificate Received Date",
        "Will/Inheritance Requested", "Will/Inheritance Requested Date", "Will/Inheritance Received", "Will/Inheritance Received Date",
        "Legacy of Deceased Settled", "Legacy Settlement Date",
        "Entity Managed by Fiduciary Trust", "Entity Managed by Asset Manager", "Gross Income from Financial Assets",
        "Account Holder Address Street", "Account Holder Address City", "Account Holder Address State", "Account Holder Address Postal Code", "Account Holder Address Country",
        "Current Address Street", "Current Address City", "Current Address State", "Current Address Postal Code", "Current Address Country",
        "Country of Residence", "Current Email Address", "Current Phone Number",
        "Entity Classification", "Year-end Cash Value", "Year-end Currency", "Gross Payments", "Gross Payments Currency",
        "Reporting Year", "US Person Indicator", "Self Certification Obtained", "Self Certification Date",
        "Account Status", "Tax Residency 1 Country", "Tax Residency 1 TIN", "Tax Residency 2 Country", "Tax Residency 2 TIN"
      ];

      // Entity reference comments
      const entityRef = selectedEntities.length > 0
        ? selectedEntities.map(e => `# Entity: ${e.entity_name} | ID: ${e.id}`).join('\n') + '\n'
        : '# PASTE_ENTITY_ID from your RFI Entities list\n';

      // Example rows — one per selected entity (up to 3)
      const exampleRows = (selectedEntities.length > 0 ? selectedEntities.slice(0, 3) : [null]).map((entity, i) => {
        const entityId = entity?.id || 'PASTE_ENTITY_ID_HERE';
        return `${entityId},ACC-00${i+1},2020-01-15,depository,,individual,,John,Smith,1985-06-15,United States,false,true,false,false,false,,false,,false,,false,,false,,false,false,false,123 Main St,New York,NY,10001,United States,456 Current Ave,New York,NY,10002,United States,United States,john@example.com,+12125551234,not_applicable,50000,USD,5000,USD,2024,false,false,,active,United States,123-45-6789,,`;
      });

      csvContent = entityRef + headers.join(',') + '\n' + exampleRows.join('\n');
    } else {
      const headers = ["Entity Name", "Entity Type", "Country of Incorporation", "Tax ID", "GIIN", "Street Address", "City", "State/Province", "Postal Code", "Country"];
      csvContent = headers.join(',') + '\nACME Corp,corporation,United States,12-3456789,ABCDEF.00000.SL.840,123 Business Ave,New York,NY,10001,United States';
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType.toLowerCase()}_import_template.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith('.csv')) {
      setErrors(['Please select a CSV file']);
      return;
    }
    
    setFile(selectedFile);
    setErrors([]);
    
    // Upload CSV file first for audit trail
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setUploadedFileUrl(file_url);
      
      // Create audit log entry for bulk import initiation
      await base44.entities.AuditLog.create({
        tenant_id: tenant.id,
        action_type: "bulk_import_initiated",
        actor_email: currentUser.email,
        actor_role: currentUser.user_role,
        target_entity_type: importType,
        target_entity_name: selectedFile.name,
        file_url: file_url,
        changes: {
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          import_type: importType
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error uploading file or creating audit log:", error);
    }
    
    // Parse CSV
    const text = await selectedFile.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      setErrors(['File must have at least a header row and one data row']);
      return;
    }
    
    const headers = parseCSVLine(lines[0]);
    const data = lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      return row;
    });
    
    setCsvHeaders(headers);
    setCsvData(data);
    setCurrentStep(1); // Move to mapping step
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleMappingComplete = (newMappings, qualityIssues) => {
    setMappings(newMappings);
    setDataQualityIssues(qualityIssues);
    setCurrentStep(2); // Move to cleaning step
  };

  const handleCleaningComplete = (cleaned, remainingErrors) => {
    setCleanedData(cleaned);
    if (remainingErrors.length > 0) {
      setErrors(remainingErrors.map(e => `Row ${e.row}: ${e.message}`));
    }
    setCurrentStep(3); // Move to import step
  };

  const convertToEntity = (row) => {
    if (importType === "Account") {
      const account = {
        tenant_id: tenant.id,
        reportability_status: 'pending_review',
        status: 'active'
      };
      
      // Map fields based on mappings
      Object.entries(mappings).forEach(([csvCol, targetField]) => {
        if (!targetField) return;
        const value = row[csvCol];
        
        if (targetField.startsWith('tax_residency')) {
          // Handle tax residencies specially
          if (!account.tax_residencies) account.tax_residencies = [];
          const match = targetField.match(/tax_residency_(\d+)_(country|tin)/);
          if (match) {
            const idx = parseInt(match[1]) - 1;
            const field = match[2];
            if (!account.tax_residencies[idx]) account.tax_residencies[idx] = {};
            account.tax_residencies[idx][field] = value;
          }
        } else if (targetField.startsWith('account_holder_')) {
          // Handle account_holder_address fields
          const addressField = targetField.replace('account_holder_', '');
          if (['street', 'city', 'state', 'postal_code', 'country'].includes(addressField)) {
            if (!account.account_holder_address) account.account_holder_address = {};
            account.account_holder_address[addressField] = value;
          } else {
            account[targetField] = value;
          }
        } else if (targetField.startsWith('current_')) {
          // Handle current_address fields
          const addressField = targetField.replace('current_', '');
          if (['street', 'city', 'state', 'postal_code', 'country'].includes(addressField)) {
            if (!account.current_address) account.current_address = {};
            account.current_address[addressField] = value;
          } else {
            account[targetField] = value;
          }
        } else if (['year_end_cash_value', 'gross_payments'].includes(targetField)) {
          account[targetField] = parseFloat(value?.replace(/[,$]/g, '')) || 0;
        } else if ([
          'is_pre_existing', 'account_holder_is_alive', 'account_holder_deceased_during_period',
          'account_closed_during_period', 'death_certificate_requested', 'death_certificate_received',
          'will_or_inheritance_requested', 'will_or_inheritance_received', 'legacy_of_deceased_settled',
          'entity_managed_by_fiduciary_trust', 'entity_managed_by_asset_manager',
          'gross_income_from_financial_assets', 'us_person_indic', 'self_certification_obtained'
        ].includes(targetField)) {
          const lower = String(value).toLowerCase().trim();
          account[targetField] = ['true', 'yes', '1', 'y'].includes(lower);
        } else {
          account[targetField] = value;
        }
      });
      
      // For individual accounts, construct account_holder_name from first_name and last_name
      if (account.account_holder_type === 'individual' && account.first_name && account.last_name) {
        account.account_holder_name = `${account.first_name} ${account.last_name}`.trim();
      }
      
      // Clean up tax residencies
      if (account.tax_residencies) {
        account.tax_residencies = account.tax_residencies.filter(t => t?.country);
      }
      
      return account;
    } else {
      // Entity import
      const entity = {
        tenant_id: tenant.id,
        rfi_status: 'pending_classification',
        status: 'active'
      };
      
      Object.entries(mappings).forEach(([csvCol, targetField]) => {
        if (!targetField) return;
        const value = row[csvCol];
        
        if (['street', 'city', 'state', 'postal_code', 'country'].includes(targetField)) {
          if (!entity.address) entity.address = {};
          entity.address[targetField] = value;
        } else {
          entity[targetField] = value;
        }
      });
      
      return entity;
    }
  };

  const validateRecord = (record, rowData) => {
    const errors = [];
    
    if (importType === "Account") {
      // Required fields validation
      if (!record.entity_id) errors.push("Missing Entity ID");
      if (!record.account_number) errors.push("Missing Account Number");
      if (!record.account_creation_date) errors.push("Missing Account Opening Date");
      if (!record.current_email) errors.push("Missing Current Email Address");
      if (!record.current_phone) errors.push("Missing Current Phone Number");
      
      // Email format validation
      if (record.current_email && !record.current_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        errors.push("Invalid email format");
      }
      
      // Date format validation
      if (record.account_creation_date && isNaN(Date.parse(record.account_creation_date))) {
        errors.push("Invalid Account Opening Date format");
      }
      
      // Individual-specific validations
      if (record.account_holder_type === 'individual') {
        if (!record.first_name) errors.push("Missing First Name (required for individuals)");
        if (!record.last_name) errors.push("Missing Last Name (required for individuals)");
        if (!record.date_of_birth) errors.push("Missing Date of Birth (required for individuals)");
        if (!record.place_of_birth) errors.push("Missing Place of Birth (required for individuals)");
      }
      
      // Entity-specific validations
      if (record.account_holder_type === 'entity') {
        if (!record.account_holder_name) errors.push("Missing Account Holder Name (required for entities)");
      }
    } else {
      // Entity validations
      if (!record.entity_name) errors.push("Missing Entity Name");
      if (!record.country_of_incorporation) errors.push("Missing Country of Incorporation");
    }
    
    return errors;
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    
    const dataToImport = cleanedData || csvData;
    const imported = [];
    const updated = [];
    const failed = [];
    
    try {
      // Get existing records for deduplication
      const existingRecords = importType === "Account"
        ? await base44.entities.Account.filter({ tenant_id: tenant.id })
        : await base44.entities.Entity.filter({ tenant_id: tenant.id });
      
      const existingMap = new Map();
      if (importType === "Account") {
        existingRecords.forEach(r => {
          existingMap.set(`${r.entity_id}|${r.account_number}`, r);
        });
      } else {
        existingRecords.forEach(r => {
          existingMap.set(r.entity_name?.toLowerCase(), r);
        });
      }
      
      for (let i = 0; i < dataToImport.length; i++) {
        const rowData = dataToImport[i];
        let recordName = '';
        
        try {
          const record = convertToEntity(rowData);
          recordName = record.account_holder_name || record.entity_name || `Row ${i + 2}`;
          
          // Validate before attempting to save
          const validationErrors = validateRecord(record, rowData);
          if (validationErrors.length > 0) {
            failed.push({ 
              row: i + 2, 
              name: recordName,
              error: validationErrors.join('; '),
              data: rowData,
              type: 'validation'
            });
            setProgress(Math.round(((i + 1) / dataToImport.length) * 100));
            continue;
          }
          
          let existing;
          if (importType === "Account") {
            existing = existingMap.get(`${record.entity_id}|${record.account_number}`);
          } else {
            existing = existingMap.get(record.entity_name?.toLowerCase());
          }
          
          if (existing) {
            // Update
            if (importType === "Account") {
              await base44.entities.Account.update(existing.id, record);
              // Trigger auto-classification for updated account
              try {
                await base44.functions.invoke('autoClassifyAccount', {
                  accountId: existing.id,
                  event_type: 'updated'
                });
              } catch (error) {
                console.error('Auto-classification failed for updated account:', error);
              }
            } else {
              await base44.entities.Entity.update(existing.id, record);
            }
            updated.push({ 
              row: i + 2, 
              name: recordName,
              action: 'updated',
              id: existing.id
            });
          } else {
            // Create
            let newRecord;
            if (importType === "Account") {
              newRecord = await base44.entities.Account.create(record);
              // Trigger auto-classification for new account
              try {
                await base44.functions.invoke('autoClassifyAccount', {
                  accountId: newRecord.id,
                  event_type: 'created'
                });
              } catch (error) {
                console.error('Auto-classification failed for new account:', error);
              }
            } else {
              newRecord = await base44.entities.Entity.create(record);
            }
            imported.push({ 
              row: i + 2, 
              name: recordName,
              action: 'created',
              id: newRecord.id
            });
          }
        } catch (err) {
          // Parse error message for more specific feedback
          let errorMsg = err.message;
          let errorType = 'database';
          
          if (errorMsg.includes('duplicate') || errorMsg.includes('unique')) {
            errorType = 'duplicate';
            errorMsg = 'Duplicate record detected';
          } else if (errorMsg.includes('foreign key') || errorMsg.includes('reference')) {
            errorType = 'reference';
            errorMsg = 'Invalid reference (e.g., Entity ID not found)';
          } else if (errorMsg.includes('required') || errorMsg.includes('null')) {
            errorType = 'missing_field';
            errorMsg = 'Missing required field: ' + errorMsg;
          }
          
          failed.push({ 
            row: i + 2, 
            name: recordName,
            error: errorMsg,
            data: rowData,
            type: errorType,
            fullError: err.message
          });
        }
        
        setProgress(Math.round(((i + 1) / dataToImport.length) * 100));
      }
      
      setResults({
        total: dataToImport.length,
        imported: imported.length,
        updated: updated.length,
        failed: failed.length,
        importedRecords: imported,
        updatedRecords: updated,
        failedRecords: failed
      });
      
      // Create audit log entry for bulk import completion
      const currentUser = user || await base44.auth.me();
      const isSuccess = failed.length === 0;
      
      await base44.entities.AuditLog.create({
        tenant_id: tenant.id,
        action_type: isSuccess ? "bulk_import_completed" : "bulk_import_failed",
        actor_email: currentUser.email,
        actor_role: currentUser.user_role,
        target_entity_type: importType,
        target_entity_name: file?.name || "Bulk Import",
        file_url: uploadedFileUrl,
        changes: {
          file_name: file?.name,
          total_records: dataToImport.length,
          created: imported.length,
          updated: updated.length,
          failed: failed.length,
          success_rate: `${Math.round(((imported.length + updated.length) / dataToImport.length) * 100)}%`,
          imported_records: imported.map(r => ({ row: r.row, name: r.name })),
          updated_records: updated.map(r => ({ row: r.row, name: r.name })),
          failed_records: failed.map(f => ({ row: f.row, name: f.name, error: f.error, type: f.type }))
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setErrors([err.message]);
      
      // Create audit log entry for import failure
      try {
        const currentUser = user || await base44.auth.me();
        await base44.entities.AuditLog.create({
          tenant_id: tenant.id,
          action_type: "bulk_import_failed",
          actor_email: currentUser.email,
          actor_role: currentUser.user_role,
          target_entity_type: importType,
          target_entity_name: file?.name || "Bulk Import",
          file_url: uploadedFileUrl,
          changes: {
            file_name: file?.name,
            error: err.message,
            stack_trace: err.stack
          },
          timestamp: new Date().toISOString()
        });
      } catch (auditError) {
        console.error("Error creating audit log for failed import:", auditError);
      }
    } finally {
      setImporting(false);
    }
  };

  const getSampleData = () => {
    return csvData.slice(0, 5).map(row => 
      csvHeaders.map(h => row[h] || '')
    );
  };

  const downloadErrorReport = () => {
    if (!results || results.failedRecords.length === 0) return;
    
    // Create CSV with original data + error column
    const errorData = results.failedRecords.map(failure => {
      const originalRow = failure.data || csvData[failure.row - 2];
      return {
        ...originalRow,
        'ERROR_TYPE': failure.type || 'unknown',
        'ERROR_DETAILS': failure.error,
        'ROW_NUMBER': failure.row
      };
    });
    
    // Generate CSV
    const headers = [...csvHeaders, 'ERROR_TYPE', 'ERROR_DETAILS', 'ROW_NUMBER'];
    const csvContent = [
      headers.join(','),
      ...errorData.map(row => 
        headers.map(h => {
          const value = row[h] || '';
          // Escape commas and quotes
          return value.toString().includes(',') || value.toString().includes('"') 
            ? `"${value.toString().replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType.toLowerCase()}_import_errors_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const getErrorTypeLabel = (type) => {
    const labels = {
      validation: 'Validation Error',
      duplicate: 'Duplicate Record',
      reference: 'Invalid Reference',
      missing_field: 'Missing Field',
      database: 'Database Error',
      unknown: 'Unknown Error'
    };
    return labels[type] || labels.unknown;
  };

  const getErrorTypeColor = (type) => {
    const colors = {
      validation: 'bg-amber-100 text-amber-800 border-amber-200',
      duplicate: 'bg-blue-100 text-blue-800 border-blue-200',
      reference: 'bg-purple-100 text-purple-800 border-purple-200',
      missing_field: 'bg-red-100 text-red-800 border-red-200',
      database: 'bg-slate-100 text-slate-800 border-slate-200',
      unknown: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    return colors[type] || colors.unknown;
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                idx < currentStep ? 'bg-green-600 text-white' :
                idx === currentStep ? 'bg-indigo-600 text-white' :
                'bg-slate-200 text-slate-600'
              }`}>
                {idx < currentStep ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
              </div>
              <span className={`text-sm font-medium ${
                idx <= currentStep ? 'text-slate-900' : 'text-slate-400'
              }`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 ${
                idx < currentStep ? 'bg-green-600' : 'bg-slate-200'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Upload */}
      {currentStep === 0 && (
        <>
          <Card className="border-2 border-indigo-100 bg-indigo-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                AI-Powered Import
              </CardTitle>
              <CardDescription>
                Upload your CSV file and our AI will automatically map fields, clean data, and validate entries
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-600" />
                Download Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={downloadTemplate} variant="outline" className="w-full">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Download {importType} Template
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Upload CSV File
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Click to select CSV file
                  </p>
                  <p className="text-xs text-slate-500">
                    The AI will analyze your data and suggest field mappings
                  </p>
                </label>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 2: Field Mapping */}
      {currentStep === 1 && (
        <>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(0)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Badge variant="outline" className="text-sm">
              {csvData.length} rows loaded
            </Badge>
          </div>
          
          <AIFieldMapper
            csvHeaders={csvHeaders}
            sampleData={getSampleData()}
            importType={importType}
            onMappingComplete={handleMappingComplete}
          />
        </>
      )}

      {/* Step 3: Data Cleaning */}
      {currentStep === 2 && (
        <>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Mapping
            </Button>
          </div>
          
          <AIDataCleaner
            data={csvData}
            mappings={mappings}
            importType={importType}
            onCleaningComplete={handleCleaningComplete}
          />
        </>
      )}

      {/* Step 4: Import */}
      {currentStep === 3 && !results && (
        <>
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Ready to Import</CardTitle>
              <CardDescription>
                {(cleanedData || csvData).length} records will be processed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Some records have errors:</p>
                    <ul className="text-sm space-y-1">
                      {errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                      {errors.length > 5 && <li>... and {errors.length - 5} more</li>}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              {importing ? (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    <span className="text-sm font-medium">
                      Importing... {progress}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    onClick={handleImport}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Start Import
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Import Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-slate-50 border">
                  <p className="text-2xl font-bold">{results.total}</p>
                  <p className="text-xs text-slate-600">Total</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-2xl font-bold text-green-600">{results.imported}</p>
                  <p className="text-xs text-green-700">Created</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-2xl font-bold text-amber-600">{results.updated}</p>
                  <p className="text-xs text-amber-700">Updated</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                  <p className="text-xs text-red-700">Failed</p>
                </div>
              </div>

              {/* Detailed Tabs */}
              <Tabs defaultValue={results.failed > 0 ? "failed" : "imported"} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="imported">
                    Created ({results.imported})
                  </TabsTrigger>
                  <TabsTrigger value="updated">
                    Updated ({results.updated})
                  </TabsTrigger>
                  <TabsTrigger value="failed">
                    Failed ({results.failed})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="imported" className="space-y-3 mt-4">
                  {results.importedRecords.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-4">No records were created</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {results.importedRecords.map((record, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-900 truncate">{record.name}</p>
                            <p className="text-xs text-green-700">Row {record.row}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="updated" className="space-y-3 mt-4">
                  {results.updatedRecords.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-4">No records were updated</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {results.updatedRecords.map((record, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-amber-900 truncate">{record.name}</p>
                            <p className="text-xs text-amber-700">Row {record.row}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="failed" className="space-y-3 mt-4">
                  {results.failedRecords.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-4">No errors - all records processed successfully!</p>
                  ) : (
                    <>
                      <Alert className="bg-red-50 border-red-200">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <AlertDescription className="text-sm text-red-900">
                          {results.failed} record{results.failed !== 1 ? 's' : ''} failed to import. 
                          Review the errors below and download the error report to fix and re-import.
                        </AlertDescription>
                      </Alert>

                      <Button
                        onClick={downloadErrorReport}
                        variant="outline"
                        className="w-full border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Error Report (CSV)
                      </Button>

                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {results.failedRecords.map((failure, idx) => (
                          <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                            <div className="flex items-start gap-3">
                              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-red-900 truncate">
                                    {failure.name}
                                  </p>
                                  <Badge className={getErrorTypeColor(failure.type)}>
                                    {getErrorTypeLabel(failure.type)}
                                  </Badge>
                                </div>
                                <p className="text-xs text-red-700 mb-1">Row {failure.row}</p>
                                <p className="text-sm text-red-800">{failure.error}</p>
                                {failure.fullError && failure.fullError !== failure.error && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-red-600 cursor-pointer hover:underline">
                                      View full error details
                                    </summary>
                                    <p className="text-xs text-red-700 mt-1 p-2 bg-red-100 rounded border border-red-200 font-mono">
                                      {failure.fullError}
                                    </p>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setFile(null);
                    setCsvHeaders([]);
                    setCsvData([]);
                    setMappings({});
                    setCleanedData(null);
                    setResults(null);
                    setCurrentStep(0);
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
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancel */}
      {!importing && !results && currentStep === 0 && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}