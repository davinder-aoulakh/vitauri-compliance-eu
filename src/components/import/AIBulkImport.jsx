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

export default function AIBulkImport({ 
  tenant, 
  entities, 
  importType = "Account",
  onComplete, 
  onCancel 
}) {
  const [currentStep, setCurrentStep] = useState(0);
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

  const downloadTemplate = () => {
    let headers, example;
    
    if (importType === "Account") {
      headers = [
        "Entity ID", "Account Number", "Account Creation Date", "Account Type", "Account Holder Type", "Account Holder Name",
        "Date of Birth", "Place of Birth", "Pre-existing Account", "Account Holder Alive",
        "Street Address", "City", "State/Province", "Postal Code", "Country",
        "Country of Residence", "Email Address", "Phone Number",
        "Year-end Cash Value", "Year-end Currency", "Gross Payments", "Gross Payments Currency",
        "Reporting Year", "Tax Residency 1 Country", "Tax Residency 1 TIN"
      ];
      example = `${entities[0]?.id || 'ENTITY_ID'},ACC-001,2020-01-15,depository,individual,John Smith,1985-06-15,United States,false,true,123 Main St,New York,NY,10001,United States,United States,john@example.com,+12125551234,50000,USD,5000,USD,2024,United States,123-45-6789`;
    } else {
      headers = [
        "Entity Name", "Entity Type", "Country of Incorporation", "Tax ID", "GIIN",
        "Street Address", "City", "State/Province", "Postal Code", "Country"
      ];
      example = `ACME Corp,corporation,United States,12-3456789,ABCDEF.00000.SL.840,123 Business Ave,New York,NY,10001,United States`;
    }
    
    const template = `${headers.join(',')}\n${example}`;
    const blob = new Blob([template], { type: 'text/csv' });
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
        } else if (['street', 'city', 'state', 'postal_code', 'country'].includes(targetField)) {
          // Handle address fields
          if (!account.account_holder_address) account.account_holder_address = {};
          account.account_holder_address[targetField] = value;
        } else if (['year_end_cash_value', 'gross_payments'].includes(targetField)) {
          account[targetField] = parseFloat(value?.replace(/[,$]/g, '')) || 0;
        } else if (['is_pre_existing', 'account_holder_is_alive', 'account_closed_during_period'].includes(targetField)) {
          const lower = String(value).toLowerCase().trim();
          account[targetField] = ['true', 'yes', '1', 'y'].includes(lower);
        } else {
          account[targetField] = value;
        }
      });
      
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
        try {
          const record = convertToEntity(dataToImport[i]);
          
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
            } else {
              await base44.entities.Entity.update(existing.id, record);
            }
            updated.push({ row: i + 2, name: record.account_holder_name || record.entity_name });
          } else {
            // Create
            if (importType === "Account") {
              await base44.entities.Account.create(record);
            } else {
              await base44.entities.Entity.create(record);
            }
            imported.push({ row: i + 2, name: record.account_holder_name || record.entity_name });
          }
        } catch (err) {
          failed.push({ row: i + 2, error: err.message });
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
    } catch (err) {
      setErrors([err.message]);
    } finally {
      setImporting(false);
    }
  };

  const getSampleData = () => {
    return csvData.slice(0, 5).map(row => 
      csvHeaders.map(h => row[h] || '')
    );
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

            <div className="flex gap-3">
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