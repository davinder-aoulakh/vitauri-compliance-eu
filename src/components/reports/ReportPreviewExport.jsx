import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building2
} from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ReportPreviewExport({ 
  report, 
  entity, 
  accounts, 
  controllingPersons,
  validationResults
}) {
  const [exporting, setExporting] = useState(false);

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.year_end_cash_value || acc.account_balance || 0), 0);
  const jurisdictions = [...new Set(accounts.flatMap(acc => 
    acc.tax_residencies?.map(r => r.country) || []
  ))];

  const exportToCSV = () => {
    setExporting(true);
    try {
      // Build CSV content
      const headers = [
        "Account Number",
        "Account Holder Name",
        "Account Holder Type",
        "Account Type",
        "Balance",
        "Currency",
        "Tax Residency Countries",
        "TINs",
        "Address Country",
        "Reportability Status"
      ];

      const rows = accounts.map(acc => [
        acc.account_number || '',
        acc.account_holder_name || '',
        acc.account_holder_type || '',
        acc.account_type || '',
        acc.year_end_cash_value || acc.account_balance || 0,
        acc.year_end_cash_value_currency || 'USD',
        acc.tax_residencies?.map(r => r.country).join('; ') || '',
        acc.tax_residencies?.map(r => r.tin || 'N/A').join('; ') || '',
        acc.account_holder_address?.country || '',
        acc.reportability_status || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CRS_Report_${report.reporting_year}_${entity?.entity_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'export'}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } finally {
      setExporting(false);
    }
  };

  const generatePDFSummary = async () => {
    setExporting(true);
    try {
      // Generate PDF using LLM to format nicely
      const summaryText = `
CRS REPORT SUMMARY
==================

Report Details:
- Reporting Year: ${report.reporting_year}
- Reporting Entity: ${entity?.entity_name || 'Unknown'}
- Entity TIN: ${entity?.tax_id || 'N/A'}
- Jurisdiction: ${report.reporting_jurisdiction}
- Report Type: ${report.report_type}
- Schema Version: ${report.xml_schema_version}

Statistics:
- Total Reportable Accounts: ${accounts.length}
- Total Controlling Persons: ${controllingPersons?.length || 0}
- Total Account Balance: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalBalance)}
- Jurisdictions Reported: ${jurisdictions.join(', ') || 'None'}

Validation Status:
- Valid: ${validationResults?.is_valid ? 'Yes' : 'No'}
- Errors: ${validationResults?.errors?.length || 0}
- Warnings: ${validationResults?.warnings?.length || 0}

Account Breakdown:
${accounts.map((acc, idx) => `
${idx + 1}. ${acc.account_holder_name}
   Account #: ${acc.account_number}
   Type: ${acc.account_holder_type}
   Balance: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: acc.year_end_cash_value_currency || 'USD' }).format(acc.year_end_cash_value || acc.account_balance || 0)}
   Tax Residencies: ${acc.tax_residencies?.map(r => r.country).join(', ') || 'None'}
`).join('')}

${controllingPersons?.length > 0 ? `
Controlling Persons:
${controllingPersons.map((cp, idx) => `
${idx + 1}. ${cp.full_name}
   DOB: ${cp.date_of_birth || 'N/A'}
   Tax Residencies: ${cp.tax_residencies?.map(r => r.country).join(', ') || 'None'}
`).join('')}
` : ''}

Generated: ${new Date().toISOString()}
      `.trim();

      // Download as text file (simulating PDF for now)
      const blob = new Blob([summaryText], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CRS_Report_Summary_${report.reporting_year}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } finally {
      setExporting(false);
    }
  };

  const printPreview = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Export Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-green-50 to-transparent">
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-green-600" />
            Export & Print Options
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={exportToCSV}
              disabled={exporting}
              variant="outline"
              className="h-20 flex flex-col gap-2 border-2 hover:border-green-300 hover:bg-green-50"
            >
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
              <span>Export to CSV</span>
            </Button>

            <Button
              onClick={generatePDFSummary}
              disabled={exporting}
              variant="outline"
              className="h-20 flex flex-col gap-2 border-2 hover:border-blue-300 hover:bg-blue-50"
            >
              <FileText className="w-6 h-6 text-blue-600" />
              <span>Download Summary</span>
            </Button>

            <Button
              onClick={printPreview}
              variant="outline"
              className="h-20 flex flex-col gap-2 border-2 hover:border-purple-300 hover:bg-purple-50"
            >
              <Printer className="w-6 h-6 text-purple-600" />
              <span>Print Preview</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <Card className="border-2 border-indigo-100">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-indigo-600">{accounts.length}</p>
            <p className="text-xs text-slate-600">Reportable Accounts</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-100">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{controllingPersons?.length || 0}</p>
            <p className="text-xs text-slate-600">Controlling Persons</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-100">
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold text-green-600">
              {new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD',
                notation: 'compact'
              }).format(totalBalance)}
            </p>
            <p className="text-xs text-slate-600">Total Balance</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-amber-100">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{jurisdictions.length}</p>
            <p className="text-xs text-slate-600">Jurisdictions</p>
          </CardContent>
        </Card>
      </div>

      {/* Validation Status */}
      {validationResults && (
        <Card className={`border-2 ${
          validationResults.is_valid ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'
        }`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {validationResults.is_valid ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              )}
              <div>
                <p className="font-semibold">
                  {validationResults.is_valid ? 'Report Validated' : 'Validation Issues Found'}
                </p>
                <p className="text-sm text-slate-600">
                  {validationResults.errors?.length || 0} errors, {validationResults.warnings?.length || 0} warnings
                </p>
              </div>
            </div>
            <Badge className={validationResults.is_valid ? 'bg-green-600' : 'bg-amber-600'}>
              {validationResults.is_valid ? 'Ready for Submission' : 'Review Required'}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Accounts Preview Table */}
      <Card className="border-0 shadow-lg print:shadow-none">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Reportable Accounts ({accounts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 print:max-h-none print:overflow-visible">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50">
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Account Holder</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Tax Residencies</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account, idx) => (
                  <TableRow key={account.id}>
                    <TableCell className="text-slate-500">{idx + 1}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{account.account_holder_name}</p>
                        <p className="text-xs text-slate-500 capitalize">{account.account_holder_type}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-1 rounded">{account.account_number}</code>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">{account.account_type?.replace(/_/g, ' ')}</span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {new Intl.NumberFormat('en-US', { 
                        style: 'currency', 
                        currency: account.year_end_cash_value_currency || 'USD'
                      }).format(account.year_end_cash_value || account.account_balance || 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {account.tax_residencies?.map((res, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {res.country}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Controlling Persons Table */}
      {controllingPersons && controllingPersons.length > 0 && (
        <Card className="border-0 shadow-lg print:shadow-none">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4" />
              Controlling Persons ({controllingPersons.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead>Control Type</TableHead>
                    <TableHead>Tax Residencies</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {controllingPersons.map((cp, idx) => (
                    <TableRow key={cp.id}>
                      <TableCell className="text-slate-500">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{cp.full_name}</TableCell>
                      <TableCell>{cp.date_of_birth || 'N/A'}</TableCell>
                      <TableCell className="capitalize">{cp.control_type?.replace(/_/g, ' ')}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {cp.tax_residencies?.map((res, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {res.country}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}