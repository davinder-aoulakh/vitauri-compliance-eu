import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, FileSpreadsheet, FileCode } from "lucide-react";
import { toast } from "sonner";

export default function ReportExportDialog({ report, accounts, controllingPersons, open, onOpenChange }) {
  const [exportFormat, setExportFormat] = useState("pdf");
  const [includeFields, setIncludeFields] = useState({
    summary: true,
    accounts: true,
    controllingPersons: true,
    validation: true,
    metadata: true
  });
  const [exporting, setExporting] = useState(false);

  const handleFieldToggle = (field) => {
    setIncludeFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const response = await base44.functions.invoke('generateDetailedPDF', {
        report,
        accounts,
        controllingPersons,
        includeFields
      });

      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CRS_Report_${report.reporting_year}_${report.reporting_jurisdiction}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  const exportToCSV = () => {
    if (!accounts || accounts.length === 0) {
      toast.error("No accounts to export");
      return;
    }

    const headers = [
      "Account Number",
      "Account Holder",
      "Account Type",
      "Reportability Status",
      "Year End Balance",
      "Currency",
      "Country of Residence",
      "Tax Residencies"
    ];

    const rows = accounts.map(account => [
      account.account_number,
      account.account_holder_name,
      account.account_type,
      account.reportability_status,
      account.year_end_cash_value || "",
      account.year_end_cash_value_currency || "",
      account.country_of_residence || "",
      account.tax_residencies?.map(tr => tr.country).join("; ") || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CRS_Report_${report.reporting_year}_Data.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const exportToJSON = () => {
    const exportData = {
      report: {
        reporting_year: report.reporting_year,
        reporting_jurisdiction: report.reporting_jurisdiction,
        status: report.status,
        report_type: report.report_type,
        schema_version: report.schema_version,
        ...(includeFields.summary && { summary_stats: report.summary_stats }),
        ...(includeFields.validation && { validation_results: report.validation_results }),
        ...(includeFields.metadata && {
          created_date: report.created_date,
          submission_date: report.submission_date,
          submitted_by: report.submitted_by
        })
      },
      ...(includeFields.accounts && { accounts: accounts }),
      ...(includeFields.controllingPersons && { controlling_persons: controllingPersons })
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CRS_Report_${report.reporting_year}_Complete.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const handleExport = async () => {
    try {
      switch (exportFormat) {
        case "pdf":
          await exportToPDF();
          toast.success(`Report exported as PDF`);
          onOpenChange(false);
          break;
        case "csv":
          exportToCSV();
          toast.success(`Report exported as CSV`);
          onOpenChange(false);
          break;
        case "json":
          exportToJSON();
          toast.success(`Report exported as JSON`);
          onOpenChange(false);
          break;
        case "xml":
          if (report.xml_file_url) {
            window.open(report.xml_file_url, '_blank');
            toast.success(`Downloaded XML file`);
            onOpenChange(false);
          } else {
            toast.error("XML file not available");
          }
          break;
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export report");
    }
  };

  const formatIcons = {
    pdf: FileText,
    csv: FileSpreadsheet,
    json: FileCode,
    xml: FileCode
  };

  const FormatIcon = formatIcons[exportFormat] || FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Report</DialogTitle>
          <DialogDescription>
            Choose export format and customize the data you want to include
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Format */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF Summary Report
                  </div>
                </SelectItem>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    CSV Data (Accounts)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    JSON (Complete Data)
                  </div>
                </SelectItem>
                <SelectItem value="xml">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    CRS XML
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Include Fields */}
          {exportFormat !== "csv" && exportFormat !== "xml" && (
            <div className="space-y-3">
              <Label>Include in Export</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="summary"
                    checked={includeFields.summary}
                    onCheckedChange={() => handleFieldToggle("summary")}
                  />
                  <label htmlFor="summary" className="text-sm cursor-pointer">
                    Summary Statistics
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="accounts"
                    checked={includeFields.accounts}
                    onCheckedChange={() => handleFieldToggle("accounts")}
                  />
                  <label htmlFor="accounts" className="text-sm cursor-pointer">
                    Account Details
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="controllingPersons"
                    checked={includeFields.controllingPersons}
                    onCheckedChange={() => handleFieldToggle("controllingPersons")}
                  />
                  <label htmlFor="controllingPersons" className="text-sm cursor-pointer">
                    Controlling Persons
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="validation"
                    checked={includeFields.validation}
                    onCheckedChange={() => handleFieldToggle("validation")}
                  />
                  <label htmlFor="validation" className="text-sm cursor-pointer">
                    Validation Results
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="metadata"
                    checked={includeFields.metadata}
                    onCheckedChange={() => handleFieldToggle("metadata")}
                  />
                  <label htmlFor="metadata" className="text-sm cursor-pointer">
                    Report Metadata
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : `Export ${exportFormat.toUpperCase()}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}