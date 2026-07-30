import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { normalizeFIType, FI_TYPE_OPTIONS } from "@/lib/fiTypeConstants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, 
  Check, 
  AlertTriangle, 
  Loader2, 
  Wand2,
  ArrowRight,
  XCircle,
  CheckCircle2
} from "lucide-react";

export default function AIDataCleaner({ 
  data, 
  mappings, 
  importType = "Account",
  onCleaningComplete 
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [issues, setIssues] = useState([]);
  const [fixes, setFixes] = useState({});
  const [selectedFixes, setSelectedFixes] = useState(new Set());
  const [cleanedData, setCleanedData] = useState(null);

  useEffect(() => {
    if (data.length > 0) {
      analyzeData();
    }
  }, [data, mappings]);

  const analyzeData = async () => {
    setIsAnalyzing(true);
    setProgress(0);
    
    const allIssues = [];
    const suggestedFixes = {};
    
    // Batch analyze in chunks to avoid rate limits
    const chunkSize = 20;
    const totalChunks = Math.ceil(data.length / chunkSize);
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkIssues = await analyzeChunk(chunk, i, mappings);
      allIssues.push(...chunkIssues);
      setProgress(Math.round(((i + chunkSize) / data.length) * 100));
    }

    // Get AI suggestions for fixing common issues
    if (allIssues.length > 0) {
      const fixSuggestions = await getSuggestedFixes(allIssues.slice(0, 50));
      Object.assign(suggestedFixes, fixSuggestions);
    }

    setIssues(allIssues);
    setFixes(suggestedFixes);
    
    // Auto-select all safe fixes + always auto-select fi_type normalization fixes
    const safeFixes = new Set(
      Object.entries(suggestedFixes)
        .filter(([_, fix]) => fix.safe)
        .map(([key]) => key)
    );
    // Auto-select FI type normalization fixes (they are deterministic, always safe)
    allIssues.forEach(issue => {
      if (issue.type === 'invalid_fi_type') {
        safeFixes.add(`${issue.type}|${issue.field}`);
      }
    });
    setSelectedFixes(safeFixes);
    
    setIsAnalyzing(false);
  };

  const analyzeChunk = async (chunk, startIndex, mappings) => {
    const issues = [];
    
    chunk.forEach((row, idx) => {
      const rowNum = startIndex + idx + 2; // +2 for header row and 0-indexing
      
      // Check each mapped field
      Object.entries(mappings).forEach(([csvCol, targetField]) => {
        if (!targetField) return;
        
        const value = row[csvCol];
        
        // Date validation
        if (targetField.includes('date') || targetField === 'date_of_birth') {
          if (value && !isValidDate(value)) {
            issues.push({
              row: rowNum,
              column: csvCol,
              field: targetField,
              value: value,
              type: 'invalid_date',
              message: `Invalid date format: "${value}"`,
              severity: 'error'
            });
          }
        }
        
        // Email validation
        if (targetField === 'current_email' && value) {
          if (!isValidEmail(value)) {
            issues.push({
              row: rowNum,
              column: csvCol,
              field: targetField,
              value: value,
              type: 'invalid_email',
              message: `Invalid email format: "${value}"`,
              severity: 'warning'
            });
          }
        }
        
        // Number validation
        if (['year_end_cash_value', 'gross_payments'].includes(targetField) && value) {
          const cleaned = value.replace(/[,$€£¥]/g, '');
          if (isNaN(parseFloat(cleaned))) {
            issues.push({
              row: rowNum,
              column: csvCol,
              field: targetField,
              value: value,
              type: 'invalid_number',
              message: `Invalid number: "${value}"`,
              severity: 'error'
            });
          }
        }
        
        // Boolean validation
        if (['is_pre_existing', 'account_holder_is_alive', 'account_closed_during_period'].includes(targetField) && value) {
          const normalized = String(value).toLowerCase().trim();
          if (!['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(normalized)) {
            issues.push({
              row: rowNum,
              column: csvCol,
              field: targetField,
              value: value,
              type: 'invalid_boolean',
              message: `Should be true/false: "${value}"`,
              severity: 'warning'
            });
          }
        }
        
        // Enum validation for account_type
        if (targetField === 'account_type' && value) {
          const validTypes = ['depository', 'custodial', 'equity_debt_interest', 'cash_value_insurance', 'annuity'];
          if (!validTypes.includes(value.toLowerCase())) {
            issues.push({
              row: rowNum,
              column: csvCol,
              field: targetField,
              value: value,
              type: 'invalid_enum',
              message: `Unknown account type: "${value}"`,
              severity: 'error'
            });
          }
        }
        
        // Enum validation for account_holder_type
        if (targetField === 'account_holder_type' && value) {
          const validTypes = ['individual', 'entity'];
          if (!validTypes.includes(value.toLowerCase())) {
            issues.push({
              row: rowNum,
              column: csvCol,
              field: targetField,
              value: value,
              type: 'invalid_enum',
              message: `Should be individual/entity: "${value}"`,
              severity: 'error'
            });
          }
        }

        // Enum validation + normalization for type_of_financial_institution
        if (targetField === 'type_of_financial_institution' && value) {
          const validValues = FI_TYPE_OPTIONS.map(o => o.value);
          if (!validValues.includes(value)) {
            const normalized = normalizeFIType(value);
            if (normalized) {
              issues.push({
                row: rowNum,
                column: csvCol,
                field: targetField,
                value: value,
                type: 'invalid_fi_type',
                normalizedValue: normalized,
                message: `Non-standard FI type "${value}" — will be mapped to "${FI_TYPE_OPTIONS.find(o => o.value === normalized)?.label}"`,
                severity: 'warning'
              });
            } else {
              issues.push({
                row: rowNum,
                column: csvCol,
                field: targetField,
                value: value,
                type: 'unknown_fi_type',
                message: `Unknown FI type "${value}" — please set manually after import`,
                severity: 'warning'
              });
            }
          }
        }
        
        // Whitespace issues
        if (value && value !== value.trim()) {
          issues.push({
            row: rowNum,
            column: csvCol,
            field: targetField,
            value: value,
            type: 'whitespace',
            message: `Has leading/trailing whitespace`,
            severity: 'info'
          });
        }
      });
      
      // Check for required fields
      if (importType === 'Account') {
        const baseRequired = ['entity_id', 'account_number', 'account_holder_type'];
        baseRequired.forEach(field => {
          const csvCol = Object.entries(mappings).find(([_, f]) => f === field)?.[0];
          if (csvCol && !row[csvCol]?.trim()) {
            issues.push({ row: rowNum, column: csvCol, field, value: '', type: 'missing_required', message: `Missing required field: ${field}`, severity: 'error' });
          }
        });

        // Determine holder type from the row to apply conditional required checks
        const holderTypeCol = Object.entries(mappings).find(([_, f]) => f === 'account_holder_type')?.[0];
        const holderType = holderTypeCol ? (row[holderTypeCol] || '').toLowerCase().trim() : '';

        if (holderType === 'entity') {
          const col = Object.entries(mappings).find(([_, f]) => f === 'account_holder_name')?.[0];
          const val = col ? String(row[col] ?? '').trim() : '';
          if (col && !val) {
            issues.push({ row: rowNum, column: col, field: 'account_holder_name', value: '', type: 'missing_required', message: 'Missing required field: account_holder_name (required for entity holders)', severity: 'warning' });
          }
        } else if (holderType === 'individual') {
          ['first_name', 'last_name'].forEach(field => {
            const col = Object.entries(mappings).find(([_, f]) => f === field)?.[0];
            if (col && !row[col]?.trim()) {
              issues.push({ row: rowNum, column: col, field, value: '', type: 'missing_required', message: `Missing required field: ${field} (required for individual holders)`, severity: 'error' });
            }
          });
        }
      } else {
        ['entity_name', 'entity_type', 'country_of_incorporation'].forEach(field => {
          const csvCol = Object.entries(mappings).find(([_, f]) => f === field)?.[0];
          if (csvCol && !row[csvCol]?.trim()) {
            issues.push({ row: rowNum, column: csvCol, field, value: '', type: 'missing_required', message: `Missing required field: ${field}`, severity: 'error' });
          }
        });
      }
    });
    
    return issues;
  };

  const getSuggestedFixes = async (issues) => {
    const fixes = {};
    
    // Group similar issues for batch processing
    const groupedIssues = {};
    issues.forEach(issue => {
      const key = `${issue.type}|${issue.field}`;
      if (!groupedIssues[key]) {
        groupedIssues[key] = [];
      }
      groupedIssues[key].push(issue);
    });

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a data cleaning expert. Suggest fixes for these data issues:

${JSON.stringify(Object.entries(groupedIssues).slice(0, 10).map(([key, issues]) => ({
  type: key.split('|')[0],
  field: key.split('|')[1],
  examples: issues.slice(0, 3).map(i => i.value)
})), null, 2)}

For each issue type, suggest:
1. A fix function description
2. Whether it's safe to auto-apply
3. Example transformation

Return JSON:
{
  "fixes": {
    "issue_type|field": {
      "description": "What the fix does",
      "safe": true/false,
      "transform": "description of transformation",
      "examples": [{"from": "original", "to": "fixed"}]
    }
  }
}`,
        response_json_schema: {
          type: "object",
          properties: {
            fixes: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  safe: { type: "boolean" },
                  transform: { type: "string" },
                  examples: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        from: { type: "string" },
                        to: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      return response?.fixes || {};
    } catch (error) {
      console.error("AI fix suggestions failed:", error);
      return {};
    }
  };

  const isValidDate = (str) => {
    if (!str) return false;
    
    // Boolean strings are not dates — treat as empty/missing, not invalid
    const lower = String(str).toLowerCase().trim();
    if (lower === 'true' || lower === 'false') return true; // skip validation, let boolean pass silently
    
    // Accept YYYY-MM-DD format (target format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const date = new Date(str);
      return !isNaN(date.getTime());
    }
    
    // Reject other formats (need conversion)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      return false; // DD/MM/YYYY needs conversion
    }
    
    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
      return false; // DD-MM-YYYY needs conversion
    }
    
    // Numeric-only values (Excel serial dates) — not a valid date string
    if (/^\d+$/.test(str)) return false;
    
    // Try parsing as standard date
    const date = new Date(str);
    return !isNaN(date.getTime());
  };

  const isValidEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

  const toggleFix = (key) => {
    setSelectedFixes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const applyFixes = () => {
    const newData = data.map((row, idx) => {
      const newRow = { ...row };
      
      // Apply selected fixes
      issues
      .filter(issue => issue.row === idx + 2)
      .forEach(issue => {
        const fixKey = `${issue.type}|${issue.field}`;
        if (selectedFixes.has(fixKey)) {
          const csvCol = issue.column;
          newRow[csvCol] = applyFix(issue.type, row[csvCol], issue);
        }
      });
      
      return newRow;
    });
    
    setCleanedData(newData);
    onCleaningComplete(newData, issues.filter(i => i.severity === 'error'));
  };

  const applyFix = (type, value, issue) => {
    switch (type) {
      case 'invalid_fi_type':
        return issue?.normalizedValue || normalizeFIType(value) || value;
      case 'whitespace':
        return value?.trim() || '';
      case 'invalid_date':
        // Try to parse and standardize date from various formats
        if (!value) return value;
        
        // Boolean strings in date fields — treat as empty
        const valLower = String(value).toLowerCase().trim();
        if (valLower === 'true' || valLower === 'false') return '';
        
        // Excel serial date number (e.g., 28347)
        if (/^\d+$/.test(value)) {
          const serial = parseInt(value, 10);
          if (serial > 1000 && serial < 100000) {
            // Excel serial: days since 1900-01-01 (with Lotus 1-2-3 bug correction)
            const excelEpoch = new Date(1899, 11, 30);
            const d = new Date(excelEpoch.getTime() + serial * 86400000);
            if (!isNaN(d.getTime())) {
              const yr = d.getFullYear();
              const mo = String(d.getMonth() + 1).padStart(2, '0');
              const dy = String(d.getDate()).padStart(2, '0');
              return `${yr}-${mo}-${dy}`;
            }
          }
          return '';
        }
        
        // Check for DD/MM/YYYY format
        const ddmmyyyyMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (ddmmyyyyMatch) {
          const [, day, month, year] = ddmmyyyyMatch;
          return `${year}-${month}-${day}`;
        }
        
        // Check for DD-MM-YYYY format
        const ddmmyyyyDashMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (ddmmyyyyDashMatch) {
          const [, day, month, year] = ddmmyyyyDashMatch;
          return `${year}-${month}-${day}`;
        }
        
        // Try parsing as standard date
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        return value;
      case 'invalid_boolean':
        const lower = String(value).toLowerCase().trim();
        if (['yes', 'y', '1', 'true'].includes(lower)) return 'true';
        if (['no', 'n', '0', 'false'].includes(lower)) return 'false';
        return value;
      case 'invalid_number':
        return value?.replace(/[,$€£¥\s]/g, '') || '';
      default:
        return value;
    }
  };

  const skipCleaning = () => {
    onCleaningComplete(data, issues.filter(i => i.severity === 'error'));
  };

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  return (
    <div className="space-y-4">
      {isAnalyzing ? (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="text-sm font-medium text-indigo-900">
                Analyzing data quality... {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-indigo-600" />
                Data Quality Analysis
              </CardTitle>
              <CardDescription>
                Analyzed {data.length} rows for potential issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-slate-50 border">
                  <p className="text-2xl font-bold text-slate-900">{data.length}</p>
                  <p className="text-xs text-slate-600">Total Rows</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                  <p className="text-xs text-red-700">Errors</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-2xl font-bold text-amber-600">{warningCount}</p>
                  <p className="text-xs text-amber-700">Warnings</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-2xl font-bold text-blue-600">{infoCount}</p>
                  <p className="text-xs text-blue-700">Info</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suggested Fixes */}
          {Object.keys(fixes).length > 0 && (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  AI-Suggested Fixes
                </CardTitle>
                <CardDescription>
                  Select fixes to apply automatically
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(fixes).map(([key, fix]) => {
                    const [type, field] = key.split('|');
                    const affectedCount = issues.filter(i => 
                      `${i.type}|${i.field}` === key
                    ).length;
                    
                    return (
                      <div 
                        key={key} 
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedFixes.has(key)}
                          onCheckedChange={() => toggleFix(key)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-900">
                              {fix.description}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {affectedCount} rows
                            </Badge>
                            {fix.safe && (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                Safe
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Field: {field} • Transform: {fix.transform}
                          </p>
                          {fix.examples?.[0] && (
                            <div className="flex items-center gap-2 mt-2 text-xs">
                              <code className="px-2 py-1 bg-red-50 text-red-700 rounded">
                                {fix.examples[0].from}
                              </code>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <code className="px-2 py-1 bg-green-50 text-green-700 rounded">
                                {fix.examples[0].to}
                              </code>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Issue Details */}
          {issues.length > 0 && (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Issue Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {issues.slice(0, 100).map((issue, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-start gap-3 p-2 rounded text-sm ${
                          issue.severity === 'error' ? 'bg-red-50' :
                          issue.severity === 'warning' ? 'bg-amber-50' : 'bg-blue-50'
                        }`}
                      >
                        {issue.severity === 'error' ? (
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                        ) : issue.severity === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5" />
                        )}
                        <div>
                          <span className="font-medium">Row {issue.row}:</span>{' '}
                          <span className="text-slate-600">{issue.message}</span>
                        </div>
                      </div>
                    ))}
                    {issues.length > 100 && (
                      <p className="text-sm text-slate-500 text-center py-2">
                        ... and {issues.length - 100} more issues
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={skipCleaning}>
              Skip Cleaning
            </Button>
            <Button
              onClick={applyFixes}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Check className="w-4 h-4 mr-2" />
              {selectedFixes.size > 0 ? `Apply ${selectedFixes.size} Fixes & Continue` : "Continue to Import"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}