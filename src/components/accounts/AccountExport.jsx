import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, Building2, Loader2 } from "lucide-react";

export default function AccountExport({ accounts, entities, accessibleEntityIds, isAdmin }) {
  const [selectedEntityId, setSelectedEntityId] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState(["reportable", "non_reportable", "pending_review", "excluded"]);
  const [exporting, setExporting] = useState(false);

  const accessibleEntities = isAdmin
    ? entities
    : entities.filter(e => accessibleEntityIds?.has(e.id));

  const toggleStatus = (status) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const filteredAccounts = accounts.filter(a => {
    const entityMatch = selectedEntityId === "all" || a.entity_id === selectedEntityId;
    const statusMatch = selectedStatuses.includes(a.reportability_status);
    const accessMatch = isAdmin || accessibleEntityIds?.has(a.entity_id);
    return entityMatch && statusMatch && accessMatch;
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "CRS Platform";
      workbook.created = new Date();

      const entityMap = Object.fromEntries(entities.map(e => [e.id, e.entity_name]));

      const styleHeader = (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = { bottom: { style: "medium", color: { argb: "FF4F46E5" } } };
      };

      const columns = [
        { header: "Account Number", key: "account_number", width: 22 },
        { header: "Account Holder Name", key: "account_holder_name", width: 28 },
        { header: "Account Holder Type", key: "account_holder_type", width: 22 },
        { header: "First Name", key: "first_name", width: 18 },
        { header: "Last Name", key: "last_name", width: 18 },
        { header: "Account Type", key: "account_type", width: 22 },
        { header: "Account Opening Date", key: "account_creation_date", width: 24 },
        { header: "RFI Entity", key: "entity_name", width: 28 },
        { header: "Reportability Status", key: "reportability_status", width: 24 },
        { header: "Year-end Cash Value", key: "year_end_cash_value", width: 22 },
        { header: "Year-end Currency", key: "year_end_cash_value_currency", width: 20 },
        { header: "Gross Payments", key: "gross_payments", width: 18 },
        { header: "Gross Payments Currency", key: "gross_payments_currency", width: 24 },
        { header: "Reporting Year", key: "reporting_year", width: 18 },
        { header: "Tax Residency 1 Country", key: "tax1_country", width: 26 },
        { header: "Tax Residency 1 TIN", key: "tax1_tin", width: 22 },
        { header: "Tax Residency 2 Country", key: "tax2_country", width: 26 },
        { header: "Tax Residency 2 TIN", key: "tax2_tin", width: 22 },
        { header: "Self Certification Obtained", key: "self_certification_obtained", width: 28 },
        { header: "Self Certification Date", key: "self_certification_date", width: 24 },
        { header: "Country of Residence", key: "country_of_residence", width: 22 },
        { header: "Email", key: "current_email", width: 28 },
        { header: "Phone", key: "current_phone", width: 20 },
        { header: "Account Status", key: "status", width: 18 },
        { header: "US Person Indicator", key: "us_person_indic", width: 22 },
        { header: "Entity Classification", key: "entity_classification", width: 26 },
        { header: "Date of Birth", key: "date_of_birth", width: 18 },
        { header: "Place of Birth", key: "place_of_birth", width: 20 },
        { header: "Pre-existing Account", key: "is_pre_existing", width: 22 },
      ];

      const sheet = workbook.addWorksheet("Accounts Export", {
        properties: { tabColor: { argb: "FF10B981" } }
      });
      sheet.columns = columns.map(c => ({ key: c.key, width: c.width }));

      const headerRow = sheet.getRow(1);
      columns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        styleHeader(cell);
      });
      headerRow.height = 28;
      sheet.views = [{ state: "frozen", ySplit: 1 }];

      // Force date columns to Text format so Excel cannot auto-convert these
      // DD/MM/YYYY strings into date serials when the file is opened, which would
      // create display ambiguity if the file is later re-imported.
      const dateColumnKeys = ["account_creation_date", "self_certification_date", "date_of_birth"];
      const dateColIndexes = {};
      dateColumnKeys.forEach((key) => {
        const colIdx = columns.findIndex(c => c.key === key) + 1;
        if (colIdx > 0) {
          dateColIndexes[key] = colIdx;
          sheet.getColumn(colIdx).numFmt = "@";
        }
      });

      // Convert ISO YYYY-MM-DD (stored in DB) -> DD/MM/YYYY for export display,
      // via regex only (no Date object) to avoid timezone shifts.
      const isoToDDMMYYYY = (v) => {
        if (!v) return "";
        const s = String(v).trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        return s;
      };

      const colLetter = (idx) => {
        let letter = "";
        while (idx > 0) {
          const rem = (idx - 1) % 26;
          letter = String.fromCharCode(65 + rem) + letter;
          idx = Math.floor((idx - 1) / 26);
        }
        return letter;
      };

      filteredAccounts.forEach(a => {
        const tax1 = a.tax_residencies?.[0] || {};
        const tax2 = a.tax_residencies?.[1] || {};
        const row = sheet.addRow({
          account_number: a.account_number || "",
          account_holder_name: a.account_holder_name || "",
          account_holder_type: a.account_holder_type || "",
          first_name: a.first_name || "",
          last_name: a.last_name || "",
          account_type: a.account_type || "",
          account_creation_date: isoToDDMMYYYY(a.account_creation_date),
          entity_name: entityMap[a.entity_id] || "",
          reportability_status: a.reportability_status || "",
          year_end_cash_value: a.year_end_cash_value || "",
          year_end_cash_value_currency: a.year_end_cash_value_currency || "",
          gross_payments: a.gross_payments || "",
          gross_payments_currency: a.gross_payments_currency || "",
          reporting_year: a.reporting_year || "",
          tax1_country: tax1.country || "",
          tax1_tin: tax1.tin || "",
          tax2_country: tax2.country || "",
          tax2_tin: tax2.tin || "",
          self_certification_obtained: a.self_certification_obtained != null ? String(a.self_certification_obtained) : "",
          self_certification_date: isoToDDMMYYYY(a.self_certification_date),
          country_of_residence: a.country_of_residence || "",
          current_email: a.current_email || "",
          current_phone: a.current_phone || "",
          status: a.status || "",
          us_person_indic: a.us_person_indic != null ? String(a.us_person_indic) : "",
          entity_classification: a.entity_classification || "",
          date_of_birth: isoToDDMMYYYY(a.date_of_birth),
          place_of_birth: a.place_of_birth || "",
          is_pre_existing: a.is_pre_existing != null ? String(a.is_pre_existing) : "",
        });

        // Color rows by reportability
        const colors = {
          reportable: "FFD1FAE5",
          non_reportable: "FFF1F5F9",
          pending_review: "FFFEF3C7",
          excluded: "FFFEE2E2",
        };
        const bg = colors[a.reportability_status] || "FFFFFFFF";
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        });

        // Enforce DD/MM/YYYY as literal text on each date cell so re-opening or
        // re-importing this file doesn't let Excel auto-convert it into a date serial.
        Object.entries(dateColIndexes).forEach(([, colIdx]) => {
          const cell = row.getCell(colIdx);
          cell.numFmt = "@";
          const letter = colLetter(colIdx);
          cell.dataValidation = {
            type: "custom", allowBlank: true,
            formulae: [`AND(ISTEXT(${letter}${row.number}),LEN(${letter}${row.number})=10,MID(${letter}${row.number},3,1)="/",MID(${letter}${row.number},6,1)="/")`],
            showErrorMessage: true, errorStyle: "stop",
            errorTitle: "Invalid date format",
            error: "Please enter the date as literal text in DD/MM/YYYY format, e.g. 15/01/2020.",
          };
        });
      });

      // Summary sheet
      const summarySheet = workbook.addWorksheet("Summary", { properties: { tabColor: { argb: "FF6366F1" } } });
      summarySheet.columns = [{ key: "k", width: 30 }, { key: "v", width: 20 }];
      const summaryData = [
        ["Export Date", new Date().toLocaleDateString()],
        ["Total Accounts Exported", filteredAccounts.length],
        ["Reportable", filteredAccounts.filter(a => a.reportability_status === "reportable").length],
        ["Non-Reportable", filteredAccounts.filter(a => a.reportability_status === "non_reportable").length],
        ["Pending Review", filteredAccounts.filter(a => a.reportability_status === "pending_review").length],
        ["Excluded", filteredAccounts.filter(a => a.reportability_status === "excluded").length],
        ["Entity Filter", selectedEntityId === "all" ? "All Entities" : entityMap[selectedEntityId] || selectedEntityId],
      ];
      summaryData.forEach(([k, v], i) => {
        const row = summarySheet.addRow([k, v]);
        row.getCell(1).font = { bold: true };
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFF0F4FF" : "FFFFFFFF" } };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const entityLabel = selectedEntityId === "all" ? "All_Entities" : (entityMap[selectedEntityId] || "").replace(/\s+/g, "_");
      a.download = `CRS_Accounts_Export_${entityLabel}_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } finally {
      setExporting(false);
    }
  };

  const statuses = [
    { value: "reportable", label: "Reportable", color: "text-green-700" },
    { value: "non_reportable", label: "Non-Reportable", color: "text-slate-600" },
    { value: "pending_review", label: "Pending Review", color: "text-amber-700" },
    { value: "excluded", label: "Excluded", color: "text-red-700" },
    { value: "work_in_progress", label: "Work in progress", color: "text-red-700" },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Export Accounts to Excel
          </CardTitle>
          <CardDescription>
            Export account data based on your access permissions. Select filters then download.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Entity filter */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Filter by Entity</Label>
            <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
              <SelectTrigger className="w-full md:w-80">
                <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accessible Entities</SelectItem>
                {accessibleEntities.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Include Statuses</Label>
            <div className="flex flex-wrap gap-4">
              {statuses.map(s => (
                <div key={s.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`status-${s.value}`}
                    checked={selectedStatuses.includes(s.value)}
                    onCheckedChange={() => toggleStatus(s.value)}
                  />
                  <label htmlFor={`status-${s.value}`} className={`text-sm font-medium cursor-pointer ${s.color}`}>
                    {s.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Preview count */}
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">
                {filteredAccounts.length} account{filteredAccounts.length !== 1 ? "s" : ""} will be exported
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Based on your current filters and entity access
              </p>
            </div>
            <Button
              onClick={handleExport}
              disabled={exporting || filteredAccounts.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              {exporting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
              ) : (
                <><Download className="w-4 h-4" /> Export Excel</>
              )}
            </Button>
          </div>

          {/* Entity breakdown */}
          {selectedEntityId === "all" && accessibleEntities.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Breakdown by Entity</Label>
              <div className="space-y-1">
                {accessibleEntities.map(e => {
                  const count = filteredAccounts.filter(a => a.entity_id === e.id).length;
                  return (
                    <div key={e.id} className="flex items-center justify-between py-2 px-3 bg-white border border-slate-100 rounded-lg text-sm">
                      <span className="text-slate-700 font-medium">{e.entity_name}</span>
                      <Badge variant="outline">{count} account{count !== 1 ? "s" : ""}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}