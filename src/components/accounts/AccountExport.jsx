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
      const entityMap = Object.fromEntries(entities.map(e => [e.id, e.entity_name]));

      const columns = [
        { header: "Account Number", key: "account_number" },
        { header: "Account Holder Name", key: "account_holder_name" },
        { header: "Account Holder Type", key: "account_holder_type" },
        { header: "First Name", key: "first_name" },
        { header: "Last Name", key: "last_name" },
        { header: "Account Type", key: "account_type" },
        { header: "Account Opening Date", key: "account_creation_date" },
        { header: "RFI Entity", key: "entity_name" },
        { header: "Reportability Status", key: "reportability_status" },
        { header: "Year-end Cash Value", key: "year_end_cash_value" },
        { header: "Year-end Currency", key: "year_end_cash_value_currency" },
        { header: "Gross Payments", key: "gross_payments" },
        { header: "Gross Payments Currency", key: "gross_payments_currency" },
        { header: "Reporting Year", key: "reporting_year" },
        { header: "Tax Residency 1 Country", key: "tax1_country" },
        { header: "Tax Residency 1 TIN", key: "tax1_tin" },
        { header: "Tax Residency 2 Country", key: "tax2_country" },
        { header: "Tax Residency 2 TIN", key: "tax2_tin" },
        { header: "Self Certification Obtained", key: "self_certification_obtained" },
        { header: "Self Certification Date", key: "self_certification_date" },
        { header: "Country of Residence", key: "country_of_residence" },
        { header: "Email", key: "current_email" },
        { header: "Phone", key: "current_phone" },
        { header: "Account Status", key: "status" },
        { header: "US Person Indicator", key: "us_person_indic" },
        { header: "Entity Classification", key: "entity_classification" },
        { header: "Date of Birth", key: "date_of_birth" },
        { header: "Place of Birth", key: "place_of_birth" },
        { header: "Pre-existing Account", key: "is_pre_existing" },
      ];

      const escapeCSV = (val) => {
        const str = val == null ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"` : str;
      };

      const rows = [columns.map(c => escapeCSV(c.header)).join(",")];
      filteredAccounts.forEach(a => {
        const tax1 = a.tax_residencies?.[0] || {};
        const tax2 = a.tax_residencies?.[1] || {};
        const rowData = {
          account_number: a.account_number || "",
          account_holder_name: a.account_holder_name || "",
          account_holder_type: a.account_holder_type || "",
          first_name: a.first_name || "",
          last_name: a.last_name || "",
          account_type: a.account_type || "",
          account_creation_date: a.account_creation_date || "",
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
          self_certification_date: a.self_certification_date || "",
          country_of_residence: a.country_of_residence || "",
          current_email: a.current_email || "",
          current_phone: a.current_phone || "",
          status: a.status || "",
          us_person_indic: a.us_person_indic != null ? String(a.us_person_indic) : "",
          entity_classification: a.entity_classification || "",
          date_of_birth: a.date_of_birth || "",
          place_of_birth: a.place_of_birth || "",
          is_pre_existing: a.is_pre_existing != null ? String(a.is_pre_existing) : "",
        };
        rows.push(columns.map(c => escapeCSV(rowData[c.key])).join(","));
      });

      const csvContent = rows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const entityLabel = selectedEntityId === "all" ? "All_Entities" : (entityMap[selectedEntityId] || "").replace(/\s+/g, "_");
      a.download = `CRS_Accounts_Export_${entityLabel}_${new Date().toISOString().split("T")[0]}.csv`;
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
                <><Download className="w-4 h-4" /> Export CSV</>
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