import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileSpreadsheet, Edit, RotateCcw, CheckCircle2, Upload, Download,
  Loader2, Info, Eye
} from "lucide-react";
import { FI_TYPE_TEMPLATES } from "@/lib/fiTypeTemplates";
import FITypeEditDialog from "./FITypeEditDialog";
import FITypePreviewDialog from "./FITypePreviewDialog";

const FI_TYPES = [
  "custodial_institution",
  "depository_institution",
  "investment_entity",
  "specified_insurance_company",
  "not_applicable",
];

export default function FITypeTemplateManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [saved, setSaved] = useState(null);
  const [uploading, setUploading] = useState(null); // fiType being uploaded
  const [uploadError, setUploadError] = useState(null);
  const fileInputRefs = useRef({});

  const { data: dbTemplates = [], isLoading } = useQuery({
    queryKey: ["fi-type-templates"],
    queryFn: () => base44.entities.FITypeTemplate.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ existing, data }) => {
      const user = await base44.auth.me();
      const payload = { ...data, last_updated_by: user.email };
      if (existing) return base44.entities.FITypeTemplate.update(existing.id, payload);
      return base44.entities.FITypeTemplate.create(payload);
    },
    onSuccess: (_, { data }) => {
      queryClient.invalidateQueries(["fi-type-templates"]);
      setSaved(data.fi_type);
      setEditing(null);
      setTimeout(() => setSaved(null), 3000);
    },
  });

  const resetMutation = useMutation({
    mutationFn: (record) => base44.entities.FITypeTemplate.delete(record.id),
    onSuccess: () => queryClient.invalidateQueries(["fi-type-templates"]),
  });

  const getEffectiveConfig = (fiType) => {
    const db = dbTemplates.find(t => t.fi_type === fiType);
    const defaults = FI_TYPE_TEMPLATES[fiType];
    if (db && db.is_active !== false) {
      return {
        label: db.label,
        allowedAccountTypes: db.allowed_account_types || [],
        accountTypeNote: db.account_type_note || defaults?.accountTypeNote || "",
        exampleAccountType: db.example_account_type || defaults?.exampleAccountType || "",
        columnDefinitions: db.column_definitions || null,
        notes: db.notes || "",
        isCustomised: true,
        dbRecord: db,
      };
    }
    return {
      label: defaults?.label || fiType,
      allowedAccountTypes: defaults?.allowedAccountTypes || [],
      accountTypeNote: defaults?.accountTypeNote || "",
      exampleAccountType: defaults?.exampleAccountType || "",
      columnDefinitions: null,
      notes: "",
      isCustomised: false,
      dbRecord: null,
    };
  };

  const openEdit = (fiType) => {
    const config = getEffectiveConfig(fiType);
    setEditing({
      fiType,
      dbRecord: config.dbRecord,
      form: {
        fi_type: fiType,
        label: config.label,
        allowed_account_types: [...config.allowedAccountTypes],
        account_type_note: config.accountTypeNote,
        example_account_type: config.exampleAccountType,
        notes: config.notes,
        is_active: true,
        column_definitions: config.columnDefinitions || null,
      },
    });
  };

  // Parse uploaded Excel and extract column definitions
  const handleTemplateUpload = async (fiType, file) => {
    if (!file) return;
    setUploading(fiType);
    setUploadError(null);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());

      // Find the data sheet (first sheet or one named "Accounts Data")
      const dataSheet = workbook.worksheets.find(s =>
        s.name.toLowerCase().includes("data") || s.name.toLowerCase().includes("account")
      ) || workbook.worksheets[0];

      if (!dataSheet) throw new Error("No worksheets found in the Excel file.");

      // Extract headers from row 1
      const headerRow = dataSheet.getRow(1);
      const columns = [];
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = cell.value?.toString() || "";
        if (!header) return;

        // Check if there's a dropdown validation on this column (row 2)
        const sampleCell = dataSheet.getCell(2, colNumber);
        let validationValues = null;
        const dv = sampleCell.dataValidation || dataSheet.getCell(2, colNumber)?.dataValidation;
        if (dv?.type === "list" && dv.formulae?.[0]) {
          const raw = dv.formulae[0].replace(/"/g, "");
          validationValues = raw.split(",").map(v => v.trim()).filter(Boolean);
        }

        // Get column width
        const colInfo = dataSheet.getColumn(colNumber);
        const width = colInfo?.width || 20;

        // Required = dark blue header (fgColor argb starts with FF1E or FF33)
        const fillArgb = cell.fill?.fgColor?.argb || "";
        const required = fillArgb.startsWith("FF1E") || fillArgb.startsWith("FF0");

        // Get note if any
        const note = cell.note?.texts?.[0]?.text || cell.note?.text || "";

        columns.push({
          header: header.replace(" *", "").trim(),
          key: header.toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, ""),
          width: Math.round(width),
          required: required || header.includes("*"),
          note: note,
          validation_values: validationValues,
        });
      });

      if (columns.length === 0) throw new Error("No column headers found in row 1.");

      // Get example row (row 2 from Example sheet if exists)
      let exampleRow = {};
      const exampleSheet = workbook.worksheets.find(s => s.name.toLowerCase().includes("example"));
      if (exampleSheet) {
        const exRow = exampleSheet.getRow(2);
        columns.forEach((col, idx) => {
          const cell = exRow.getCell(idx + 1);
          exampleRow[col.key] = cell.value?.toString() || "";
        });
      }

      // Save to DB
      const config = getEffectiveConfig(fiType);
      const defaults = FI_TYPE_TEMPLATES[fiType];
      const user = await base44.auth.me();

      const payload = {
        fi_type: fiType,
        label: config.label,
        allowed_account_types: config.allowedAccountTypes,
        account_type_note: config.accountTypeNote,
        example_account_type: config.exampleAccountType,
        notes: config.notes,
        is_active: true,
        last_updated_by: user.email,
        column_definitions: columns,
        example_row: exampleRow,
      };

      if (config.dbRecord) {
        await base44.entities.FITypeTemplate.update(config.dbRecord.id, payload);
      } else {
        await base44.entities.FITypeTemplate.create(payload);
      }

      queryClient.invalidateQueries(["fi-type-templates"]);
      setSaved(fiType);
      setTimeout(() => setSaved(null), 3000);
    } catch (err) {
      setUploadError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(null);
      if (fileInputRefs.current[fiType]) fileInputRefs.current[fiType].value = "";
    }
  };

  // Download current template (DB-defined or default)
  const handleDownloadTemplate = async (fiType) => {
    const config = getEffectiveConfig(fiType);
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CRS Platform";
    workbook.created = new Date();

    const styleHeader = (cell, required = false) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? "FF1E3A5F" : "FF334155" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = { bottom: { style: "medium", color: { argb: "FF4F46E5" } } };
    };

    // Use DB column_definitions if available, else use defaults
    const columns = getColumnsForFiType(config);

    // Sheet 1: Data
    const dataSheet = workbook.addWorksheet("Accounts Data", { properties: { tabColor: { argb: "FF10B981" } } });
    dataSheet.columns = columns.map(c => ({ key: c.key, width: c.width || 20 }));
    const headerRow = dataSheet.getRow(1);
    columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.required ? `${col.header} *` : col.header;
      styleHeader(cell, col.required);
      if (col.note) cell.note = { texts: [{ text: col.note }] };
    });
    headerRow.height = 28;
    dataSheet.views = [{ state: "frozen", ySplit: 1 }];

    // Apply dropdowns from column definitions
    for (let row = 2; row <= 502; row++) {
      columns.forEach((col, colIdx) => {
        if (col.validation_values?.length) {
          dataSheet.getCell(row, colIdx + 1).dataValidation = {
            type: "list", allowBlank: true,
            formulae: [`"${col.validation_values.join(",")}"`],
          };
        }
      });
    }

    // Sheet 2: Example
    const exampleSheet = workbook.addWorksheet("Example", { properties: { tabColor: { argb: "FF6366F1" } } });
    exampleSheet.columns = columns.map(c => ({ key: c.key, width: c.width || 20 }));
    const exHeaderRow = exampleSheet.getRow(1);
    columns.forEach((col, i) => {
      const cell = exHeaderRow.getCell(i + 1);
      cell.value = col.required ? `${col.header} *` : col.header;
      styleHeader(cell, col.required);
    });
    exHeaderRow.height = 28;

    const exampleRowData = {};
    columns.forEach(col => {
      exampleRowData[col.key] = col.example_value || "";
    });
    const exRow = exampleSheet.addRow(exampleRowData);
    exRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
    });

    // Sheet 3: Entity Info
    const infoSheet = workbook.addWorksheet("Template Info", { properties: { tabColor: { argb: "FF4F46E5" } } });
    infoSheet.columns = [{ key: "key", width: 30 }, { key: "value", width: 50 }];
    [
      ["FI Type", fiType],
      ["Label", config.label],
      ["Allowed Account Types", config.allowedAccountTypes.join(", ")],
      ["Template Generated", new Date().toLocaleDateString()],
      ["", ""],
      ["NOTE", "Upload this file (with your data in 'Accounts Data' sheet) via the Super Admin FI Templates tab to update the template definition."],
    ].forEach(([k, v], i) => {
      const row = infoSheet.addRow([k, v]);
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
    a.download = `FI_Template_${fiType}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-indigo-300" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">FI Type Template Configuration</h2>
          <p className="text-indigo-200 text-sm mt-1">
            Download the current template, customise it, then upload it back. The AI Bulk Import will use your updated template structure.
          </p>
        </div>
      </div>

      {saved && (
        <Alert className="bg-green-900/30 border-green-500/40 text-green-300">
          <CheckCircle2 className="w-4 h-4" />
          <AlertDescription>Template for <strong>{FI_TYPE_TEMPLATES[saved]?.label || saved}</strong> saved successfully.</AlertDescription>
        </Alert>
      )}

      {uploadError && (
        <Alert className="bg-red-900/30 border-red-500/40 text-red-300">
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4">
        {FI_TYPES.map((fiType) => {
          const config = getEffectiveConfig(fiType);
          const colCount = config.columnDefinitions?.length;
          return (
            <Card key={fiType} className="bg-white/10 backdrop-blur-sm border border-white/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white">{config.label}</p>
                        {config.isCustomised ? (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">Customised</Badge>
                        ) : (
                          <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30 text-xs">Default</Badge>
                        )}
                        {colCount && (
                          <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">{colCount} columns</Badge>
                        )}
                      </div>
                      <p className="text-xs text-indigo-300 mt-0.5">
                        Allowed: {config.allowedAccountTypes.join(", ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Download */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-indigo-300 hover:text-white hover:bg-indigo-500/20"
                      onClick={() => handleDownloadTemplate(fiType)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Download
                    </Button>

                    {/* Preview columns */}
                    {config.isCustomised && colCount && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-indigo-300 hover:text-white hover:bg-indigo-500/20"
                        onClick={() => setPreviewing({ fiType, config })}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Preview
                      </Button>
                    )}

                    {/* Upload */}
                    <Button
                      size="sm"
                      className="bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30"
                      onClick={() => fileInputRefs.current[fiType]?.click()}
                      disabled={uploading === fiType}
                    >
                      {uploading === fiType ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Parsing...</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5 mr-1" />Upload Template</>
                      )}
                    </Button>
                    <input
                      ref={el => fileInputRefs.current[fiType] = el}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={e => handleTemplateUpload(fiType, e.target.files[0])}
                    />

                    {/* Edit metadata */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-white hover:bg-white/10"
                      onClick={() => openEdit(fiType)}
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Settings
                    </Button>

                    {/* Reset */}
                    {config.isCustomised && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => resetMutation.mutate(config.dbRecord)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                {config.notes && (
                  <p className="mt-2 text-xs text-indigo-300 bg-white/5 rounded p-2 border border-white/10">
                    <Info className="w-3 h-3 inline mr-1" />{config.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editing && (
        <FITypeEditDialog
          editing={editing}
          onSave={(formData) => saveMutation.mutate({ existing: editing.dbRecord, data: formData })}
          onClose={() => setEditing(null)}
          isSaving={saveMutation.isPending}
        />
      )}

      {previewing && (
        <FITypePreviewDialog
          fiType={previewing.fiType}
          config={previewing.config}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}

// Returns the column list to use for a given config (DB-defined or hardcoded defaults)
export function getColumnsForFiType(config) {
  if (config.columnDefinitions?.length) {
    return config.columnDefinitions;
  }
  // Return the standard hardcoded columns with validation_values populated
  return getDefaultColumns(config);
}

function getDefaultColumns(config) {
  return [
    { header: "Account Number", key: "account_number", width: 22, required: true, note: "Unique account identifier", validation_values: null, example_value: "ACC-001" },
    { header: "Account Opening Date", key: "account_creation_date", width: 24, required: true, note: "Format: YYYY-MM-DD e.g. 2020-01-15", validation_values: null, example_value: "2020-01-15" },
    { header: "Account Type", key: "account_type", width: 26, required: true, note: config.accountTypeNote, validation_values: config.allowedAccountTypes, example_value: config.exampleAccountType },
    { header: "Account Holder Type", key: "account_holder_type", width: 24, required: true, note: "individual | entity", validation_values: ["individual", "entity"], example_value: "individual" },
    { header: "First Name", key: "first_name", width: 18, required: false, note: "Required if Account Holder Type = individual", validation_values: null, example_value: "John" },
    { header: "Last Name", key: "last_name", width: 18, required: false, note: "Required if Account Holder Type = individual", validation_values: null, example_value: "Smith" },
    { header: "Account Holder Name (Entity)", key: "account_holder_name", width: 30, required: false, note: "Required if Account Holder Type = entity", validation_values: null, example_value: "" },
    { header: "Date of Birth", key: "date_of_birth", width: 18, required: false, note: "YYYY-MM-DD", validation_values: null, example_value: "1985-06-15" },
    { header: "Place of Birth", key: "place_of_birth", width: 20, required: false, note: "Country name", validation_values: null, example_value: "United States" },
    { header: "Pre-existing Account", key: "is_pre_existing", width: 22, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Account Holder Alive", key: "account_holder_is_alive", width: 22, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "true" },
    { header: "Deceased During Period", key: "deceased_during_period", width: 24, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Account Closed During Period", key: "account_closed_during_period", width: 28, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Acct Holder Address - Street", key: "ah_street", width: 28, required: false, note: "", validation_values: null, example_value: "123 Main St" },
    { header: "Acct Holder Address - City", key: "ah_city", width: 22, required: false, note: "", validation_values: null, example_value: "New York" },
    { header: "Acct Holder Address - Country", key: "ah_country", width: 24, required: false, note: "", validation_values: null, example_value: "United States" },
    { header: "Country of Residence", key: "country_of_residence", width: 22, required: false, note: "", validation_values: null, example_value: "United States" },
    { header: "Current Email Address", key: "current_email", width: 28, required: true, note: "Valid email format", validation_values: null, example_value: "john@example.com" },
    { header: "Current Phone Number", key: "current_phone", width: 22, required: true, note: "e.g. +12125551234", validation_values: null, example_value: "+12125551234" },
    { header: "Entity Classification", key: "entity_classification", width: 26, required: false, note: "financial_institution | active_nfe | passive_nfe | not_applicable", validation_values: ["financial_institution", "active_nfe", "passive_nfe", "not_applicable"], example_value: "not_applicable" },
    { header: "Year-end Cash Value", key: "year_end_cash_value", width: 22, required: false, note: "Number", validation_values: null, example_value: "50000" },
    { header: "Year-end Currency", key: "year_end_currency", width: 20, required: false, note: "ISO code e.g. USD, AUD", validation_values: null, example_value: "USD" },
    { header: "Gross Payments", key: "gross_payments", width: 18, required: false, note: "Number", validation_values: null, example_value: "5000" },
    { header: "Gross Payments Currency", key: "gross_payments_currency", width: 24, required: false, note: "ISO code", validation_values: null, example_value: "USD" },
    { header: "Reporting Year", key: "reporting_year", width: 18, required: false, note: "YYYY e.g. 2024", validation_values: null, example_value: "2024" },
    { header: "US Person Indicator", key: "us_person_indic", width: 22, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Self Certification Obtained", key: "self_cert_obtained", width: 28, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Self Certification Date", key: "self_cert_date", width: 24, required: false, note: "YYYY-MM-DD", validation_values: null, example_value: "" },
    { header: "Account Status", key: "status", width: 18, required: false, note: "active | closed | dormant", validation_values: ["active", "closed", "dormant"], example_value: "active" },
    { header: "Tax Residency 1 - Country", key: "tax1_country", width: 26, required: false, note: "Country name", validation_values: null, example_value: "United States" },
    { header: "Tax Residency 1 - TIN", key: "tax1_tin", width: 22, required: false, note: "Tax identification number", validation_values: null, example_value: "123-45-6789" },
    { header: "Tax Residency 2 - Country", key: "tax2_country", width: 26, required: false, note: "", validation_values: null, example_value: "" },
    { header: "Tax Residency 2 - TIN", key: "tax2_tin", width: 22, required: false, note: "", validation_values: null, example_value: "" },
  ];
}