import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, Download, CheckCircle2, XCircle, AlertTriangle,
  FileSpreadsheet, Loader2, ArrowRight, ArrowLeft, Building2, ChevronDown, ChevronUp
} from "lucide-react";
import AIFieldMapper from "./AIFieldMapper";
import AIDataCleaner from "./AIDataCleaner";
import { getFiTypeConfig, FI_TYPE_TEMPLATES } from "@/lib/fiTypeTemplates";
import { getColumnsForFiType } from "@/components/superadmin/FITypeTemplateManager";

const STEPS = [
  { id: "upload", label: "Upload File" },
  { id: "mapping", label: "Field Mapping" },
  { id: "cleaning", label: "Data Cleaning" },
  { id: "import", label: "Import" },
];

const FIELD_GUIDE = [
  { col: "Account Number", format: "Text", required: true, notes: "Unique account identifier per entity" },
  { col: "Account Opening Date", format: "YYYY-MM-DD", required: true, notes: "e.g. 2020-01-15" },
  { col: "Account Type", format: "See FI Type", required: true, notes: "Valid types depend on FI Type" },
  { col: "Account Holder Type", format: "individual | entity", required: true, notes: "" },
  { col: "First Name", format: "Text", required: false, notes: "Required for individuals" },
  { col: "Last Name", format: "Text", required: false, notes: "Required for individuals" },
  { col: "Account Holder Name", format: "Text", required: false, notes: "Required for entity holders" },
  { col: "Date of Birth", format: "YYYY-MM-DD", required: false, notes: "Required for individuals" },
  { col: "Place of Birth", format: "Country name", required: false, notes: "" },
  { col: "Pre-existing Account", format: "true | false", required: false, notes: "" },
  { col: "Year-end Cash Value", format: "Number", required: false, notes: "e.g. 50000" },
  { col: "Year-end Currency", format: "ISO code", required: false, notes: "e.g. USD, AUD, GBP" },
  { col: "Gross Payments", format: "Number", required: false, notes: "" },
  { col: "Gross Payments Currency", format: "ISO code", required: false, notes: "" },
  { col: "Reporting Year", format: "YYYY", required: false, notes: "e.g. 2024" },
  { col: "Current Email Address", format: "Email", required: true, notes: "Valid email format" },
  { col: "Current Phone Number", format: "Text", required: true, notes: "e.g. +12125551234" },
  { col: "Account Status", format: "active | closed | dormant", required: false, notes: "Defaults to active" },
  { col: "Tax Residency 1 Country", format: "Country name", required: false, notes: "" },
  { col: "Tax Residency 1 TIN", format: "Text", required: false, notes: "" },
];

export default function RFIEntityImportCard({ entity, tenant, onComplete }) {
  const [expanded, setExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [mappings, setMappings] = useState({});
  const [cleanedData, setCleanedData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState([]);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [dbTemplate, setDbTemplate] = useState(null);
  const [templateLoaded, setTemplateLoaded] = useState(false);

  const ftConfig = getFiTypeConfig(entity.fi_type);

  // Load DB template override once on mount
  React.useEffect(() => {
    base44.entities.FITypeTemplate.filter({ fi_type: entity.fi_type, is_active: true })
      .then(results => {
        if (results?.[0]) setDbTemplate(results[0]);
      })
      .catch(() => {})
      .finally(() => setTemplateLoaded(true));
  }, [entity.fi_type]);

  // Build effective config merging DB override with hardcoded defaults
  const effectiveConfig = React.useMemo(() => {
    if (dbTemplate) {
      return {
        ...ftConfig,
        label: dbTemplate.label || ftConfig.label,
        allowedAccountTypes: dbTemplate.allowed_account_types?.length ? dbTemplate.allowed_account_types : ftConfig.allowedAccountTypes,
        accountTypeNote: dbTemplate.account_type_note || ftConfig.accountTypeNote,
        exampleAccountType: dbTemplate.example_account_type || ftConfig.exampleAccountType,
        accountTypeValidation: dbTemplate.allowed_account_types?.length
          ? `"${dbTemplate.allowed_account_types.join(",")}"`
          : ftConfig.accountTypeValidation,
        columnDefinitions: dbTemplate.column_definitions || null,
      };
    }
    return { ...ftConfig, columnDefinitions: null };
  }, [ftConfig, dbTemplate]);

  const styleHeader = (cell, required = false) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? "FF1E3A5F" : "FF334155" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "medium", color: { argb: "FF4F46E5" } } };
  };

  const downloadTemplate = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CRS Platform";
    workbook.created = new Date();

    // Fetch country data for Referenced Data sheet
    const crsCountries = await base44.entities.CrsCountryInfo.list("-country_name", 300);
    const countryData = crsCountries
      .map(c => ({ name: c.country_name, code: c.country_code }))
      .filter(c => c.name && c.code)
      .sort((a, b) => a.name.localeCompare(b.name));
    const refDataRows = countryData.length;

    // Use dynamic columns from DB template if available, else defaults
    const columns = getColumnsForFiType(effectiveConfig);

    // Build column index map for VLOOKUP references
    const colIndexMap = {};
    columns.forEach((col, i) => { colIndexMap[col.key] = i + 1; });

    const colLetter = (idx) => {
      let letter = "";
      while (idx > 0) {
        const rem = (idx - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        idx = Math.floor((idx - 1) / 26);
      }
      return letter;
    };

    const COUNTRY_NAME_KEYS = new Set([
      "place_of_birth", "country_of_incorporation", "ah_country", "country_of_residence",
      "tax1_country", "tax2_country",
      ...[1,2,3,4].flatMap(n => [
        `cp${n}_place_of_birth`, `cp${n}_country_of_residence`,
        `cp${n}_address_country`, `cp${n}_tax_country`,
      ]),
    ]);

    const CODE_TO_NAME_KEY = {
      country_of_incorporation_code: "country_of_incorporation",
      ...Object.fromEntries([1,2,3,4].flatMap(n => [
        [`cp${n}_place_of_birth_code`, `cp${n}_place_of_birth`],
        [`cp${n}_country_of_residence_code`, `cp${n}_country_of_residence`],
        [`cp${n}_address_country_code`, `cp${n}_address_country`],
        [`cp${n}_tax_country_code`, `cp${n}_tax_country`],
      ])),
    };

    // ── Define all dropdown sections (used for both validation ranges and the legend)
    const DROPDOWN_SECTIONS = [
      { key: "account_types",        label: "Account Types",                    values: effectiveConfig.allowedAccountTypes },
      { key: "account_holder_types", label: "Account Holder Types",             values: ["individual", "entity"] },
      { key: "entity_class",         label: "Entity Classification",            values: ["financial_institution", "active_nfe", "passive_nfe", "not_applicable"] },
      { key: "account_status",       label: "Account Status",                   values: ["active", "closed", "dormant"] },
      { key: "boolean",              label: "Boolean Fields (true / false)",    values: ["true", "false"] },
      { key: "control_types",        label: "Controlling Person Control Types", values: [
        "legal_person_ownership", "legal_person_other_means", "legal_person_senior_managing_official",
        "trust_settlor", "trust_trustee", "trust_protector", "trust_beneficiary", "trust_other",
        "legal_arrangement_settlor_equivalent", "legal_arrangement_trustee_equivalent",
        "legal_arrangement_protector_equivalent", "legal_arrangement_beneficiary_equivalent",
        "legal_arrangement_other_equivalent"
      ]},
    ];

    // Pre-compute row ranges for each section in column D of the Referenced Data sheet
    const dropdownRanges = {};
    let sectionStartRow = refDataRows + 3;
    DROPDOWN_SECTIONS.forEach(section => {
      dropdownRanges[section.key] = {
        start: sectionStartRow + 1,
        end: sectionStartRow + section.values.length,
      };
      sectionStartRow += section.values.length + 2;
    });

    // Map from column key -> dropdown section key
    const COL_DROPDOWN_SECTION = {
      account_type:         "account_types",
      account_holder_type:  "account_holder_types",
      entity_classification:"entity_class",
      status:               "account_status",
      is_pre_existing:      "boolean",
      account_holder_is_alive: "boolean",
      account_holder_deceased_during_period: "boolean",
      account_closed_during_period: "boolean",
      account_frozen_at_reporting_date: "boolean",
      account_dormant_at_reporting_date: "boolean",
      acct_holder_address_unchanged: "boolean",
      us_person_indic: "boolean",
      self_cert_obtained: "boolean",
      self_certification_obtained: "boolean",
      ...Object.fromEntries([1,2,3,4].flatMap(n => [
        [`cp${n}_control_type`,       "control_types"],
        [`cp${n}_self_cert_obtained`, "boolean"],
      ])),
    };

    // ── Sheet 1: Accounts Data
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

    // Apply dropdowns, country dropdowns from ref sheet, and VLOOKUP formulas
    for (let row = 2; row <= 502; row++) {
      columns.forEach((col, colIdx) => {
        const cell = dataSheet.getCell(row, colIdx + 1);
        if (CODE_TO_NAME_KEY[col.key]) {
          const nameKey = CODE_TO_NAME_KEY[col.key];
          const nameColIdx = colIndexMap[nameKey];
          if (nameColIdx) {
            cell.value = { formula: `IFERROR(VLOOKUP(${colLetter(nameColIdx)}${row},'Referenced Data'!$A$2:$B$${refDataRows + 1},2,FALSE),"")` };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
          }
        } else if (COUNTRY_NAME_KEYS.has(col.key)) {
          cell.dataValidation = {
            type: "list", allowBlank: true,
            formulae: [`'Referenced Data'!$A$2:$A$${refDataRows + 1}`],
            showErrorMessage: false,
          };
        } else if (COL_DROPDOWN_SECTION[col.key]) {
          const range = dropdownRanges[COL_DROPDOWN_SECTION[col.key]];
          if (range) {
            cell.dataValidation = {
              type: "list", allowBlank: true,
              formulae: [`'Referenced Data'!$D$${range.start}:$D$${range.end}`],
              showErrorMessage: false,
            };
          }
        } else if (col.validation_values?.length) {
          cell.dataValidation = {
            type: "list", allowBlank: true,
            formulae: [`"${col.validation_values.join(",")}"`],
          };
        }
      });
    }

    // ── Conditional Formatting: Grey out fields based on Account Holder Type
    const ahtColIdx = colIndexMap["account_holder_type"];
    if (ahtColIdx) {
      const ahtLetter = colLetter(ahtColIdx);

      // Fields only relevant for individuals → grey out when type = "entity"
      const INDIVIDUAL_ONLY_KEYS = new Set([
        "first_name", "last_name", "date_of_birth", "place_of_birth",
        "account_holder_is_alive", "account_holder_deceased_during_period",
      ]);
      // Fields only relevant for entity holders → grey out when type = "individual"
      const ENTITY_ONLY_KEYS = new Set([
        "account_holder_name", "date_of_incorporation", "country_of_incorporation",
        "country_of_incorporation_code", "type_of_financial_institution",
        "entity_managed_by_fiduciary_trust", "entity_managed_by_asset_manager",
        "gross_income_from_financial_assets", "entity_classification",
      ]);
      // CP fields → grey out when type = "individual"
      const CP_KEY_PREFIX_RE = /^cp\d_/;

      const greyFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      const greyFont = { color: { argb: "FFFFFFFF" }, italic: true };

      columns.forEach((col, colIdx) => {
        const excelColLetter = colLetter(colIdx + 1);
        const sqRef = `${excelColLetter}2:${excelColLetter}502`;

        if (INDIVIDUAL_ONLY_KEYS.has(col.key)) {
          // Grey out + block input when type = "entity"
          dataSheet.addConditionalFormatting({
            ref: sqRef,
            rules: [{ type: "expression", priority: 1, formulae: [`$${ahtLetter}2="entity"`], style: { fill: greyFill, font: greyFont } }],
          });
          for (let r = 2; r <= 502; r++) {
            dataSheet.getCell(r, colIdx + 1).dataValidation = {
              type: "custom", allowBlank: true,
              formulae: [`NOT($${ahtLetter}${r}="entity")`],
              showErrorMessage: true, errorStyle: "stop",
              errorTitle: "Not applicable",
              error: `This field is only for Individual account holders. Set Account Holder Type to "individual" to enter a value here.`,
            };
          }
        } else if (ENTITY_ONLY_KEYS.has(col.key) || CP_KEY_PREFIX_RE.test(col.key)) {
          // Grey out + block input when type = "individual"
          dataSheet.addConditionalFormatting({
            ref: sqRef,
            rules: [{ type: "expression", priority: 1, formulae: [`$${ahtLetter}2="individual"`], style: { fill: greyFill, font: greyFont } }],
          });
          for (let r = 2; r <= 502; r++) {
            dataSheet.getCell(r, colIdx + 1).dataValidation = {
              type: "custom", allowBlank: true,
              formulae: [`NOT($${ahtLetter}${r}="individual")`],
              showErrorMessage: true, errorStyle: "stop",
              errorTitle: "Not applicable",
              error: `This field is only for Entity account holders. Set Account Holder Type to "entity" to enter a value here.`,
            };
          }
        }
      });
    }

    // ── Sheet 2: Example
    const exampleSheet = workbook.addWorksheet("Example", { properties: { tabColor: { argb: "FF6366F1" } } });
    exampleSheet.columns = columns.map(c => ({ key: c.key, width: c.width || 20 }));
    const exHeaderRow = exampleSheet.getRow(1);
    columns.forEach((col, i) => {
      const cell = exHeaderRow.getCell(i + 1);
      cell.value = col.required ? `${col.header} *` : col.header;
      styleHeader(cell, col.required);
    });
    exHeaderRow.height = 28;

    const exampleRowData = dbTemplate?.example_row || {};
    if (!dbTemplate?.example_row) {
      columns.forEach(col => { exampleRowData[col.key] = col.example_value || ""; });
    }
    const exRow = exampleSheet.addRow(exampleRowData);
    exRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
    });

    // ── Sheet 3: Entity Info
    const infoSheet = workbook.addWorksheet("Entity Info", { properties: { tabColor: { argb: "FF4F46E5" } } });
    infoSheet.columns = [{ key: "key", width: 30 }, { key: "value", width: 50 }];
    [
      ["Entity Name", entity.entity_name],
      ["Entity ID", entity.id],
      ["FI Type", effectiveConfig.label],
      ["Country", entity.country_of_incorporation || ""],
      ["Template Generated", new Date().toLocaleDateString()],
      ["", ""],
      ["NOTE", `All accounts in this file will be imported for: ${entity.entity_name}`],
      ["NOTE", `Account Type must be one of: ${effectiveConfig.allowedAccountTypes.join(", ")}`],
      ...(dbTemplate?.column_definitions ? [["NOTE", "This template uses a custom column structure defined by your Super Admin."]] : []),
    ].forEach(([k, v], i) => {
      const row = infoSheet.addRow([k, v]);
      row.getCell(1).font = { bold: true };
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFF0F4FF" : "FFFFFFFF" } };
      });
    });

    // ── Sheet 4: Referenced Data (country lookup + all dropdown legends)
    const refSheet = workbook.addWorksheet("Referenced Data", { properties: { tabColor: { argb: "FFCBD5E1" } } });
    refSheet.columns = [
      { key: "col_a", width: 40 },
      { key: "col_b", width: 14 },
      { key: "col_c", width: 4 },
      { key: "col_d", width: 50 },
    ];
    const refHeader = refSheet.getRow(1);
    refHeader.getCell(1).value = "Country Name";
    refHeader.getCell(2).value = "Country Code";
    refHeader.getCell(4).value = "Dropdown Reference Values";
    [1, 2, 4].forEach(c => styleHeader(refHeader.getCell(c), false));
    refHeader.height = 24;
    refSheet.views = [{ state: "frozen", ySplit: 1 }];
    refSheet.addRows(countryData.map(c => [c.name, c.code]));

    // Write dropdown sections into column D
    let dRow = refDataRows + 3;
    DROPDOWN_SECTIONS.forEach(section => {
      const labelCell = refSheet.getCell(dRow, 4);
      labelCell.value = `── ${section.label}`;
      labelCell.font = { bold: true, color: { argb: "FF1E3A5F" }, size: 9 };
      labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
      dRow++;
      section.values.forEach(v => {
        const vc = refSheet.getCell(dRow, 4);
        vc.value = v;
        vc.font = { size: 9 };
        dRow++;
      });
      dRow++; // blank separator
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entity.entity_name.replace(/\s+/g, "_")}_${entity.fi_type || "template"}_import.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    const isExcel = selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls");
    const isCsv = selectedFile.name.endsWith(".csv");
    if (!isExcel && !isCsv) { setErrors(["Please select a CSV or Excel (.xlsx) file"]); return; }

    setFile(selectedFile);
    setErrors([]);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setUploadedFileUrl(file_url);
      const currentUser = await base44.auth.me();
      await base44.entities.AuditLog.create({
        tenant_id: tenant.id, action_type: "bulk_import_initiated",
        actor_email: currentUser.email, actor_role: currentUser.user_role,
        target_entity_type: "Account", target_entity_name: selectedFile.name,
        file_url, changes: { file_name: selectedFile.name, entity_id: entity.id, entity_name: entity.entity_name },
        timestamp: new Date().toISOString()
      });
    } catch (err) { console.error("Audit log error:", err); }

    let headers = [], data = [];

    if (isExcel) {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await selectedFile.arrayBuffer());
      const sheet = workbook.worksheets.find(s => s.name.toLowerCase().includes("data")) || workbook.worksheets[0];
      const rows = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const values = [];
        row.eachCell({ includeEmpty: true }, cell => {
          let v = cell.value;
          if (v && typeof v === "object" && v.richText) v = v.richText.map(r => r.text).join("");
          else if (v && typeof v === "object" && v.text) v = v.text;
          else if (v instanceof Date) v = v.toISOString().split("T")[0];
          values.push(v == null ? "" : String(v));
        });
        rows.push(values);
      });
      if (rows.length < 2) { setErrors(["No data rows found in the Excel file"]); return; }
      headers = rows[0];
      data = rows.slice(1).filter(r => r.some(v => v !== "")).map(values => {
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
      });
    } else {
      const text = await selectedFile.text();
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) { setErrors(["File must have at least a header row and one data row"]); return; }
      headers = parseCSVLine(lines[0]);
      data = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
      });
    }

    setCsvHeaders(headers);
    setCsvData(data);
    setCurrentStep(1);
  };

  const handleMappingComplete = (newMappings) => {
    setMappings(newMappings);
    setCurrentStep(2);
  };

  const handleCleaningComplete = (cleaned, remainingErrors) => {
    setCleanedData(cleaned);
    if (remainingErrors.length > 0) setErrors(remainingErrors.map(e => `Row ${e.row}: ${e.message}`));
    setCurrentStep(3);
  };

  const BOOL_FIELDS = new Set([
    "is_pre_existing", "account_holder_is_alive", "account_holder_deceased_during_period",
    "account_closed_during_period", "us_person_indic", "self_certification_obtained",
    "account_frozen_at_reporting_date", "account_dormant_at_reporting_date", "acct_holder_address_unchanged",
  ]);

  const parseBool = (v) => ["true", "yes", "1", "y"].includes(String(v).toLowerCase().trim());

  const convertToAccount = (row) => {
    const account = { tenant_id: tenant.id, entity_id: entity.id, reportability_status: "pending_review", status: "active" };
    // Flat CP data extracted per person slot
    const cpData = { 1: {}, 2: {}, 3: {}, 4: {} };

    Object.entries(mappings).forEach(([csvCol, targetField]) => {
      if (!targetField) return;
      const value = row[csvCol];
      if (!value && value !== 0) return;

      // Controlling person fields: cp1_first_name, cp2_control_type, etc.
      const cpMatch = targetField.match(/^cp(\d)_(.+)$/);
      if (cpMatch) {
        const idx = parseInt(cpMatch[1]);
        const field = cpMatch[2];
        if (cpData[idx]) cpData[idx][field] = value;
        return;
      }

      if (targetField.startsWith("tax_residency")) {
        if (!account.tax_residencies) account.tax_residencies = [];
        const match = targetField.match(/tax_residency_(\d+)_(country|tin)/);
        if (match) {
          const idx = parseInt(match[1]) - 1;
          if (!account.tax_residencies[idx]) account.tax_residencies[idx] = {};
          account.tax_residencies[idx][match[2]] = value;
        }
      } else if (["year_end_cash_value", "gross_payments"].includes(targetField)) {
        account[targetField] = parseFloat(String(value).replace(/[,$]/g, "")) || 0;
      } else if (BOOL_FIELDS.has(targetField)) {
        account[targetField] = parseBool(value);
      } else {
        account[targetField] = value;
      }
    });

    if (account.account_holder_type === "individual" && account.first_name && account.last_name) {
      account.account_holder_name = `${account.first_name} ${account.last_name}`.trim();
    }
    if (account.tax_residencies) account.tax_residencies = account.tax_residencies.filter(t => t?.country);

    // Build controlling person objects from flat cp data
    const controllingPersons = [];
    for (let n = 1; n <= 4; n++) {
      const cp = cpData[n];
      if (!cp.first_name && !cp.last_name) continue; // skip empty slots
      const cpRecord = {
        tenant_id: tenant.id,
        first_name: cp.first_name || "",
        last_name: cp.last_name || "",
        full_name: `${cp.first_name || ""} ${cp.last_name || ""}`.trim(),
        date_of_birth: cp.date_of_birth || null,
        place_of_birth: cp.place_of_birth || null,
        country_of_residence: cp.country_of_residence || null,
        address: {
          street: cp.street || "",
          city: cp.city || "",
          country: cp.address_country || "",
        },
        tax_residencies: cp.tax_country ? [{ country: cp.tax_country, tin: cp.tin || "" }] : [],
        control_type: cp.control_type || null,
        ownership_percentage: cp.ownership_percentage ? parseFloat(cp.ownership_percentage) || null : null,
        self_certification_obtained: cp.self_cert_obtained ? parseBool(cp.self_cert_obtained) : false,
        self_certification_receipt_date: cp.self_cert_date || null,
      };
      controllingPersons.push(cpRecord);
    }

    return { account, controllingPersons };
  };

  const validateRecord = (record) => {
    const errs = [];
    if (!record.account_number) errs.push("Missing Account Number");
    if (!record.account_creation_date) errs.push("Missing Account Opening Date");
    if (!record.current_email) errs.push("Missing Current Email Address");
    if (!record.current_phone) errs.push("Missing Current Phone Number");
    if (record.current_email && !record.current_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.push("Invalid email format");
    if (record.account_holder_type === "individual") {
      if (!record.first_name) errs.push("Missing First Name");
      if (!record.last_name) errs.push("Missing Last Name");
    }
    if (record.account_holder_type === "entity" && !record.account_holder_name) errs.push("Missing Account Holder Name");
    return errs;
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    const dataToImport = cleanedData || csvData;
    const imported = [], updated = [], failed = [];

    try {
      const existingAccounts = await base44.entities.Account.filter({ tenant_id: tenant.id, entity_id: entity.id });
      const existingMap = new Map();
      existingAccounts.forEach(r => existingMap.set(r.account_number, r));

      for (let i = 0; i < dataToImport.length; i++) {
        const rowData = dataToImport[i];
        try {
          const { account: record, controllingPersons } = convertToAccount(rowData);
          const recordName = record.account_holder_name || `Row ${i + 2}`;
          const validationErrors = validateRecord(record);
          if (validationErrors.length > 0) {
            failed.push({ row: i + 2, name: recordName, error: validationErrors.join("; "), type: "validation" });
            setProgress(Math.round(((i + 1) / dataToImport.length) * 100));
            continue;
          }
          const existing = existingMap.get(record.account_number);
          let savedAccountId;
          if (existing) {
            await base44.entities.Account.update(existing.id, record);
            savedAccountId = existing.id;
            updated.push({ row: i + 2, name: recordName });
          } else {
            const newRecord = await base44.entities.Account.create(record);
            savedAccountId = newRecord.id;
            try { await base44.functions.invoke("autoClassifyAccount", { accountId: newRecord.id, event_type: "created" }); } catch (e) { }
            imported.push({ row: i + 2, name: recordName });
          }
          // Create controlling person records linked to this account
          for (const cp of controllingPersons) {
            await base44.entities.ControllingPerson.create({ ...cp, account_id: savedAccountId });
          }
        } catch (err) {
          failed.push({ row: i + 2, name: `Row ${i + 2}`, error: err.message, type: "database" });
        }
        setProgress(Math.round(((i + 1) / dataToImport.length) * 100));
      }

      setResults({ total: dataToImport.length, imported: imported.length, updated: updated.length, failed: failed.length, importedRecords: imported, updatedRecords: updated, failedRecords: failed });
      if (onComplete) onComplete({ entity, imported: imported.length, updated: updated.length, failed: failed.length });
    } catch (err) {
      setErrors([err.message]);
    } finally {
      setImporting(false);
    }
  };

  const resetFlow = () => {
    setCurrentStep(0); setFile(null); setCsvHeaders([]); setCsvData([]);
    setMappings({}); setCleanedData(null); setResults(null); setErrors([]);
  };

  const fiTypeLabel = effectiveConfig.label;
  const hasResult = !!results;
  const resultColor = hasResult
    ? (results.failed === 0 ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50")
    : "border-slate-200 bg-white";

  return (
    <Card className={`border-2 transition-all ${resultColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{entity.entity_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">{fiTypeLabel}</Badge>
                {dbTemplate?.column_definitions && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Custom Template</Badge>
                )}
                {entity.country_of_incorporation && (
                  <span className="text-xs text-slate-400">{entity.country_of_incorporation}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasResult && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-700 font-medium">{results.imported} created</span>
                {results.updated > 0 && <span className="text-amber-700 font-medium">{results.updated} updated</span>}
                {results.failed > 0 && <span className="text-red-700 font-medium">{results.failed} failed</span>}
              </div>
            )}
            {!expanded && !hasResult && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={downloadTemplate} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Template
                </Button>
                <Button size="sm" onClick={() => setExpanded(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Import
                </Button>
              </div>
            )}
            {(expanded || hasResult) && (
              <Button size="sm" variant="ghost" onClick={() => setExpanded(p => !p)}>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-between border-t pt-4">
            {STEPS.map((step, idx) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    idx < currentStep ? "bg-green-600 text-white" :
                    idx === currentStep ? "bg-indigo-600 text-white" :
                    "bg-slate-200 text-slate-500"
                  }`}>
                    {idx < currentStep ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${idx <= currentStep ? "text-slate-800" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${idx < currentStep ? "bg-green-500" : "bg-slate-200"}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step 0: Upload */}
          {currentStep === 0 && !results && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                  Download Template
                </Button>
              </div>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" id={`upload-${entity.id}`} />
                <label htmlFor={`upload-${entity.id}`} className="cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">Click to upload file</p>
                  <p className="text-xs text-slate-500 mt-1">Accepts .xlsx or .csv</p>
                </label>
              </div>
              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{errors[0]}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 1: Mapping */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(0)}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
                </Button>
                <Badge variant="outline">{csvData.length} rows</Badge>
              </div>
              <AIFieldMapper
                csvHeaders={csvHeaders}
                sampleData={csvData.slice(0, 5).map(row => csvHeaders.map(h => row[h] || ""))}
                importType="Account"
                onMappingComplete={handleMappingComplete}
              />
            </div>
          )}

          {/* Step 2: Cleaning */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
              </Button>
              <AIDataCleaner
                data={csvData}
                mappings={mappings}
                importType="Account"
                onCleaningComplete={handleCleaningComplete}
              />
            </div>
          )}

          {/* Step 3: Ready to Import */}
          {currentStep === 3 && !results && (
            <div className="space-y-3">
              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    {errors.slice(0, 3).map((e, i) => <div key={i}>{e}</div>)}
                    {errors.length > 3 && <div>...and {errors.length - 3} more</div>}
                  </AlertDescription>
                </Alert>
              )}
              {importing ? (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm text-slate-700">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    Importing... {progress}%
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)}>
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
                  </Button>
                  <Button onClick={handleImport} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Upload className="w-4 h-4 mr-2" />
                    Import {(cleanedData || csvData).length} Records
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Total", value: results.total, color: "bg-slate-50 border" },
                  { label: "Created", value: results.imported, color: "bg-green-50 border-green-200 text-green-700" },
                  { label: "Updated", value: results.updated, color: "bg-amber-50 border-amber-200 text-amber-700" },
                  { label: "Failed", value: results.failed, color: "bg-red-50 border-red-200 text-red-700" },
                ].map(s => (
                  <div key={s.label} className={`text-center p-2 rounded-lg border ${s.color}`}>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs">{s.label}</p>
                  </div>
                ))}
              </div>
              {results.failedRecords.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {results.failedRecords.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                      <XCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-red-800">Row {f.row}: {f.error}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={resetFlow}>
                Import Another File
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}