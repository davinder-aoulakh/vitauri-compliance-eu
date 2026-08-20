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
  const [uploading, setUploading] = useState(null);
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

      const dataSheet = workbook.worksheets.find(s =>
        s.name.toLowerCase().includes("data") || s.name.toLowerCase().includes("account")
      ) || workbook.worksheets[0];

      if (!dataSheet) throw new Error("No worksheets found in the Excel file.");

      const headerRow = dataSheet.getRow(1);
      const columns = [];
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = cell.value?.toString() || "";
        if (!header) return;

        const sampleCell = dataSheet.getCell(2, colNumber);
        let validationValues = null;
        const dv = sampleCell.dataValidation || dataSheet.getCell(2, colNumber)?.dataValidation;
        if (dv?.type === "list" && dv.formulae?.[0]) {
          const raw = dv.formulae[0].replace(/"/g, "");
          validationValues = raw.split(",").map(v => v.trim()).filter(Boolean);
        }

        const colInfo = dataSheet.getColumn(colNumber);
        const width = colInfo?.width || 20;

        const fillArgb = cell.fill?.fgColor?.argb || "";
        const required = fillArgb.startsWith("FF1E") || fillArgb.startsWith("FF0");

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

      let exampleRow = {};
      const exampleSheet = workbook.worksheets.find(s => s.name.toLowerCase().includes("example"));
      if (exampleSheet) {
        const exRow = exampleSheet.getRow(2);
        columns.forEach((col, idx) => {
          const cell = exRow.getCell(idx + 1);
          exampleRow[col.key] = cell.value?.toString() || "";
        });
      }

      const config = getEffectiveConfig(fiType);
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

    // Fetch country and currency data for Referenced Data sheet
    const [crsCountries, currencyRecords] = await Promise.all([
      base44.entities.CrsCountryInfo.list("country_name", 500),
      base44.entities.ReferencedData.filter({ entity_name: "Global", field_name: "currency" }, "order", 300),
    ]);
    const seen = new Map();
    crsCountries.forEach(c => {
      if (c.country_name && c.country_code) {
        const key = c.country_name.toLowerCase();
        if (!seen.has(key)) seen.set(key, { name: c.country_name, code: c.country_code });
      }
    });
    const countryData = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
    const currencyCodes = currencyRecords
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(c => c.value)
      .filter(Boolean);

    const styleHeader = (cell, required = false) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? "FF1E3A5F" : "FF334155" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = { bottom: { style: "medium", color: { argb: "FF4F46E5" } } };
    };

    // Use DB column_definitions if available, else use defaults
    const columns = getColumnsForFiType(config);

    const CURRENCY_KEYS = new Set([
      "year_end_currency", "year_end_cash_value_currency", "gross_payments_currency",
    ]);

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
      "place_of_birth", "country_of_incorporation",
      "ah_original_country", "ah_current_country", "ah_country_of_residence",
      "tax1_country", "tax2_country",
      ...([1,2,3,4].flatMap(n => [
        `cp${n}_place_of_birth`, `cp${n}_country_of_residence`,
        `cp${n}_address_country`, `cp${n}_tax1_country`, `cp${n}_tax2_country`,
      ])),
    ]);

    const CODE_TO_NAME_KEY = {
      country_of_incorporation_code: "country_of_incorporation",
      ah_original_country_code: "ah_original_country",
      ah_current_country_code: "ah_current_country",
      ah_country_of_residence_code: "ah_country_of_residence",
      tax1_country_code: "tax1_country",
      tax2_country_code: "tax2_country",
      ...Object.fromEntries([1,2,3,4].flatMap(n => [
        [`cp${n}_place_of_birth_code`, `cp${n}_place_of_birth`],
        [`cp${n}_country_of_residence_code`, `cp${n}_country_of_residence`],
        [`cp${n}_address_country_code`, `cp${n}_address_country`],
        [`cp${n}_tax1_country_code`, `cp${n}_tax1_country`],
        [`cp${n}_tax2_country_code`, `cp${n}_tax2_country`],
      ])),
    };

    // ── Build column groups for Instructions sheet navigation ──────────────────
    const COLUMN_GROUPS = buildColumnGroups(columns);

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

    // Apply dropdowns, country dropdowns from ref sheet, and VLOOKUP formulas
    const refDataRows = countryData.length;
    for (let row = 2; row <= 502; row++) {
      columns.forEach((col, colIdx) => {
        const cell = dataSheet.getCell(row, colIdx + 1);

        if (CODE_TO_NAME_KEY[col.key]) {
          const nameKey = CODE_TO_NAME_KEY[col.key];
          const nameColIdx = colIndexMap[nameKey];
          if (nameColIdx) {
            const nameLetter = colLetter(nameColIdx);
            cell.value = {
              formula: `IFERROR(VLOOKUP(${nameLetter}${row},'Referenced Data'!$A$2:$B$${refDataRows + 1},2,FALSE),"")`,
            };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
          }
        }
        else if (CURRENCY_KEYS.has(col.key) && currencyCodes.length) {
          cell.dataValidation = {
            type: "list", allowBlank: true,
            formulae: [`'Referenced Data'!$F$2:$F$${currencyCodes.length + 1}`],
            showErrorMessage: false,
          };
        }
        else if (COUNTRY_NAME_KEYS.has(col.key)) {
          cell.dataValidation = {
            type: "list", allowBlank: true,
            formulae: [`'Referenced Data'!$A$2:$A$${refDataRows + 1}`],
            showErrorMessage: false,
          };
        }
        else if (col.validation_values?.length) {
          cell.dataValidation = {
            type: "list", allowBlank: true,
            formulae: [`"${col.validation_values.join(",")}"`],
          };
        }
      });
    }

    // Conditional Formatting: Grey out fields based on Account Holder Type
    const ahtColIdx = colIndexMap["account_holder_type"];
    if (ahtColIdx) {
      const ahtLetter = colLetter(ahtColIdx);

      const INDIVIDUAL_ONLY_KEYS = new Set([
        "first_name", "middle_name", "last_name", "name_prefix", "title",
        "date_of_birth", "place_of_birth", "is_recalcitrant",
        "account_holder_is_alive", "account_holder_deceased_during_period",
      ]);
      const ENTITY_ONLY_KEYS = new Set([
        "account_holder_entity_type", "account_holder_name",
        "date_of_incorporation", "country_of_incorporation", "country_of_incorporation_code",
        "type_of_financial_institution",
        "entity_managed_by_fiduciary_trust", "entity_managed_by_asset_manager",
        "gross_income_from_financial_assets", "entity_classification",
      ]);
      const CP_KEY_PREFIX_RE = /^cp\d_/;

      const greyFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      const greyFont = { color: { argb: "FFFFFFFF" }, italic: true };

      columns.forEach((col, colIdx) => {
        const excelColLetter = colLetter(colIdx + 1);
        const sqRef = `${excelColLetter}2:${excelColLetter}502`;

        if (INDIVIDUAL_ONLY_KEYS.has(col.key)) {
          dataSheet.addConditionalFormatting({
            ref: sqRef,
            rules: [{ type: "expression", priority: 1, formulae: [`$${ahtLetter}2="entity"`], style: { fill: greyFill, font: greyFont } }],
          });
          for (let r = 2; r <= 502; r++) {
            dataSheet.getCell(r, colIdx + 1).dataValidation = {
              type: "custom", allowBlank: true,
              formulae: [`$${ahtLetter}${r}<>"entity"`],
              showErrorMessage: true, errorStyle: "stop",
              errorTitle: "Not applicable",
              error: `This field is only for Individual account holders. Set Account Holder Type to "individual" to enter a value here.`,
            };
          }
        } else if (ENTITY_ONLY_KEYS.has(col.key) || CP_KEY_PREFIX_RE.test(col.key)) {
          dataSheet.addConditionalFormatting({
            ref: sqRef,
            rules: [{ type: "expression", priority: 1, formulae: [`$${ahtLetter}2="individual"`], style: { fill: greyFill, font: greyFont } }],
          });
          for (let r = 2; r <= 502; r++) {
            dataSheet.getCell(r, colIdx + 1).dataValidation = {
              type: "custom", allowBlank: true,
              formulae: [`$${ahtLetter}${r}<>"individual"`],
              showErrorMessage: true, errorStyle: "stop",
              errorTitle: "Not applicable",
              error: `This field is only for Entity account holders. Set Account Holder Type to "entity" to enter a value here.`,
            };
          }
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

    // Sheet 3: Instructions (with clickable group navigation)
    const instrSheet = workbook.addWorksheet("Instructions", { properties: { tabColor: { argb: "FFFF8C00" } } });
    instrSheet.columns = [
      { key: "col_a", width: 38 },
      { key: "col_b", width: 18 },
      { key: "col_c", width: 60 },
    ];

    // Title
    const titleRow = instrSheet.getRow(1);
    titleRow.height = 36;
    const titleCell = titleRow.getCell(1);
    titleCell.value = "📋  Accounts Data Import — Instructions";
    titleCell.font = { bold: true, size: 16, color: { argb: "FF1E3A5F" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
    instrSheet.mergeCells("A1:C1");
    titleCell.alignment = { vertical: "middle", horizontal: "left" };

    // Subtitle
    const subRow = instrSheet.getRow(2);
    subRow.height = 20;
    const subCell = subRow.getCell(1);
    subCell.value = "Click any group name below to jump directly to those columns in the Accounts Data sheet.";
    subCell.font = { italic: true, size: 10, color: { argb: "FF475569" } };
    instrSheet.mergeCells("A2:C2");

    // Blank row
    instrSheet.getRow(3).height = 8;

    // Column headers for group table
    const ghRow = instrSheet.getRow(4);
    ghRow.height = 22;
    ["Column Group", "Columns", "Description"].forEach((h, i) => {
      const c = ghRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      c.alignment = { vertical: "middle", horizontal: "left" };
      c.border = { bottom: { style: "medium", color: { argb: "FF4F46E5" } } };
    });

    // Group rows with hyperlinks
    const rowColors = ["FFFAFAFA", "FFF0F4FF"];
    COLUMN_GROUPS.forEach((group, gIdx) => {
      const r = instrSheet.getRow(5 + gIdx);
      r.height = 20;

      // Column A: clickable group name linking to first col of that group in Accounts Data
      const linkCell = r.getCell(1);
      const targetCol = colLetter(group.startColIndex);
      linkCell.value = {
        text: group.name,
        hyperlink: `#'Accounts Data'!${targetCol}1`,
      };
      linkCell.font = { color: { argb: "FF4F46E5" }, underline: true, size: 10, bold: true };
      linkCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowColors[gIdx % 2] } };
      linkCell.alignment = { vertical: "middle" };

      // Column B: col count
      const countCell = r.getCell(2);
      countCell.value = `${group.count} column${group.count !== 1 ? "s" : ""}`;
      countCell.font = { size: 10, color: { argb: "FF64748B" } };
      countCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowColors[gIdx % 2] } };
      countCell.alignment = { vertical: "middle" };

      // Column C: description
      const descCell = r.getCell(3);
      descCell.value = group.description;
      descCell.font = { size: 10, color: { argb: "FF334155" } };
      descCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowColors[gIdx % 2] } };
      descCell.alignment = { vertical: "middle", wrapText: true };
    });

    // General notes section
    const notesStartRow = 5 + COLUMN_GROUPS.length + 2;
    const notesHeaderRow = instrSheet.getRow(notesStartRow);
    notesHeaderRow.height = 22;
    const nhCell = notesHeaderRow.getCell(1);
    nhCell.value = "📌  General Notes";
    nhCell.font = { bold: true, size: 11, color: { argb: "FF1E3A5F" } };
    nhCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
    instrSheet.mergeCells(`A${notesStartRow}:C${notesStartRow}`);

    const notes = [
      ["Required fields", "Columns marked with * are mandatory. Dark blue headers indicate required fields."],
      ["Date format", "All dates must be in YYYY-MM-DD format (e.g. 2024-01-15)."],
      ["Boolean fields", 'Enter true or false (lowercase) for all boolean fields.'],
      ["Country fields", "Select country names from the dropdown. Country codes are auto-filled by formula."],
      ["Auto-filled columns", "Columns with a light blue background are formula-driven — do not edit them."],
      ["Greyed-out columns", "Black cells indicate the column is not applicable for the selected Account Holder Type."],
      ["Row limit", "Up to 500 data rows can be imported per file."],
    ];
    notes.forEach(([key, val], i) => {
      const nr = instrSheet.getRow(notesStartRow + 1 + i);
      nr.height = 18;
      const kc = nr.getCell(1);
      kc.value = key;
      kc.font = { bold: true, size: 10, color: { argb: "FF374151" } };
      kc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFFFF7ED" : "FFFFFFFF" } };
      const vc = nr.getCell(2);
      vc.value = val;
      vc.font = { size: 10, color: { argb: "FF374151" } };
      vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFFFF7ED" : "FFFFFFFF" } };
      instrSheet.mergeCells(`B${notesStartRow + 1 + i}:C${notesStartRow + 1 + i}`);
    });

    // Sheet 4: Field Guide
    const fieldGuideSheet = workbook.addWorksheet("Field Guide", { properties: { tabColor: { argb: "FF0EA5E9" } } });
    fieldGuideSheet.columns = [
      { key: "col_a", width: 36 },
      { key: "col_b", width: 14 },
      { key: "col_c", width: 14 },
      { key: "col_d", width: 50 },
      { key: "col_e", width: 30 },
      { key: "col_f", width: 24 },
    ];

    // Field Guide title
    const fgTitleRow = fieldGuideSheet.getRow(1);
    fgTitleRow.height = 36;
    const fgTitleCell = fgTitleRow.getCell(1);
    fgTitleCell.value = "📖  Field Guide — Data Entry Reference";
    fgTitleCell.font = { bold: true, size: 16, color: { argb: "FF0C4A6E" } };
    fgTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
    fieldGuideSheet.mergeCells("A1:F1");
    fgTitleCell.alignment = { vertical: "middle", horizontal: "left" };

    const fgSubRow = fieldGuideSheet.getRow(2);
    fgSubRow.height = 18;
    const fgSubCell = fgSubRow.getCell(1);
    fgSubCell.value = "Complete reference for every column in the Accounts Data sheet. Required fields are highlighted.";
    fgSubCell.font = { italic: true, size: 10, color: { argb: "FF475569" } };
    fieldGuideSheet.mergeCells("A2:F2");

    fieldGuideSheet.getRow(3).height = 8;

    // Field Guide headers
    const fgHeaderRow = fieldGuideSheet.getRow(4);
    fgHeaderRow.height = 24;
    ["Column Name", "Required", "Data Type", "Description / Instructions", "Allowed Values", "Example"].forEach((h, i) => {
      const c = fgHeaderRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C4A6E" } };
      c.alignment = { vertical: "middle", horizontal: "left" };
      c.border = { bottom: { style: "medium", color: { argb: "FF0EA5E9" } } };
    });
    fieldGuideSheet.views = [{ state: "frozen", ySplit: 4 }];

    // Fill each column's field guide row
    const fgRowColors = ["FFFFFFFF", "FFF0F9FF"];
    columns.forEach((col, i) => {
      const r = fieldGuideSheet.getRow(5 + i);
      r.height = 20;
      const bg = col.required ? "FFFFF7ED" : fgRowColors[i % 2];

      const nameCell = r.getCell(1);
      nameCell.value = col.header;
      nameCell.font = { bold: col.required, size: 10, color: { argb: col.required ? "FF92400E" : "FF1E3A5F" } };
      nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      nameCell.alignment = { vertical: "middle" };

      const reqCell = r.getCell(2);
      reqCell.value = col.required ? "✔ Required" : "Optional";
      reqCell.font = { size: 10, bold: col.required, color: { argb: col.required ? "FF B45309" : "FF64748B" } };
      reqCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      reqCell.alignment = { vertical: "middle", horizontal: "center" };

      const typeCell = r.getCell(3);
      typeCell.value = inferDataType(col);
      typeCell.font = { size: 10, color: { argb: "FF0369A1" } };
      typeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      typeCell.alignment = { vertical: "middle", horizontal: "center" };

      const descCell = r.getCell(4);
      descCell.value = col.note || col.header;
      descCell.font = { size: 10, color: { argb: "FF374151" } };
      descCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      descCell.alignment = { vertical: "middle", wrapText: true };

      const valCell = r.getCell(5);
      valCell.value = col.validation_values?.length
        ? col.validation_values.join(", ")
        : CODE_TO_NAME_KEY_GUIDE[col.key]
          ? "Auto-filled by formula"
          : COUNTRY_NAME_KEYS.has(col.key)
            ? "Select from country dropdown"
            : CURRENCY_KEYS.has(col.key)
              ? "Select from currency dropdown"
              : "Free text";
      valCell.font = { size: 9, color: { argb: "FF475569" } };
      valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      valCell.alignment = { vertical: "middle", wrapText: true };

      const exCell = r.getCell(6);
      exCell.value = col.example_value || "";
      exCell.font = { size: 10, color: { argb: "FF059669" }, italic: true };
      exCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      exCell.alignment = { vertical: "middle" };
    });

    // Sheet 5: Template Info
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

    // Sheet 6: Referenced Data — hidden + protected
    const DROPDOWN_SECTIONS = [
      { label: "Account Types",                   values: config.allowedAccountTypes },
      { label: "Account Number Types",             values: ACCOUNT_NUMBER_TYPES },
      { label: "Account Holder Types",             values: ["individual", "entity"] },
      { label: "Entity Classification",            values: ["financial_institution", "active_nfe", "passive_nfe", "not_applicable"] },
      { label: "Account Status",                   values: ["active", "closed", "dormant"] },
      { label: "Boolean Fields (true / false)",    values: ["true", "false"] },
      { label: "Type of Financial Institution",    values: FI_INSTITUTION_TYPES },
      { label: "Type of Entity",                   values: ENTITY_TYPES },
      { label: "Controlling Person Control Types", values: CP_CONTROL_TYPES },
    ];

    const refSheet = workbook.addWorksheet("Referenced Data", {
      state: "veryHidden",
      properties: { tabColor: { argb: "FFCBD5E1" } },
    });
    refSheet.columns = [
      { key: "col_a", width: 40 },
      { key: "col_b", width: 14 },
      { key: "col_c", width: 4 },
      { key: "col_d", width: 50 },
      { key: "col_e", width: 4 },
      { key: "col_f", width: 16 },
    ];
    const refHeader = refSheet.getRow(1);
    refHeader.getCell(1).value = "Country Name";
    refHeader.getCell(2).value = "Country Code";
    refHeader.getCell(4).value = "Dropdown Reference Values";
    refHeader.getCell(6).value = "Currency Codes";
    [1, 2, 4, 6].forEach(c => styleHeader(refHeader.getCell(c), false));
    refHeader.height = 24;
    refSheet.views = [{ state: "frozen", ySplit: 1 }];
    refSheet.addRows(countryData.map(c => [c.name, c.code]));

    currencyCodes.forEach((code, i) => {
      const cell = refSheet.getCell(i + 2, 6);
      cell.value = code;
      cell.font = { size: 9 };
    });

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
      dRow++;
    });

    // Protect the referenced data sheet so users cannot unhide or modify it
    await refSheet.protect("CRS_Template_Protected", {
      sheet: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertRows: false,
      insertColumns: false,
      insertHyperlinks: false,
      deleteRows: false,
      deleteColumns: false,
      sort: false,
      autoFilter: false,
      pivotTables: false,
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-indigo-300 hover:text-white hover:bg-indigo-500/20"
                      onClick={() => handleDownloadTemplate(fiType)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Download
                    </Button>

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

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-white hover:bg-white/10"
                      onClick={() => openEdit(fiType)}
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Settings
                    </Button>

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

// ── Helper: infer a human-readable data type label from the column definition ──
function inferDataType(col) {
  if (col.note?.includes("YYYY-MM-DD") || col.key?.includes("date")) return "Date";
  if (col.validation_values?.includes("true") && col.validation_values?.includes("false")) return "Boolean";
  if (col.note?.includes("Number") || col.key?.includes("value") || col.key?.includes("payment") || col.key?.includes("year_end")) return "Number";
  if (col.note?.includes("email") || col.key?.includes("email")) return "Email";
  if (col.validation_values?.length) return "Dropdown";
  if (col.note?.includes("Auto-filled") || col.note?.includes("auto")) return "Auto";
  return "Text";
}

// ── Helper: build column groups with start index for Instructions navigation ──
function buildColumnGroups(columns) {
  const GROUP_PATTERNS = [
    { name: "Account Identity",          description: "Core account identifiers: Entity ID, Account Number, Account Type, Account Holder Type.",           keys: ["entity_id","entity_name_ref","account_number","account_number_type","account_creation_date","account_type","account_holder_type"] },
    { name: "Individual Account Holder", description: "Name fields for individual holders (First, Middle, Last Name, Prefix, Title). Greyed out for entity holders.", keys: ["first_name","middle_name","last_name","name_prefix","title"] },
    { name: "Entity Account Holder",     description: "Fields for entity holders: entity type, name, incorporation details, FI type. Greyed out for individual holders.", keys: ["type_of_financial_institution","account_holder_entity_type","account_holder_name","date_of_incorporation","country_of_incorporation","country_of_incorporation_code"] },
    { name: "Demographics",              description: "Individual date/place of birth and related individual-only fields.",                                 keys: ["date_of_birth","place_of_birth"] },
    { name: "Account Flags",             description: "Boolean status flags: pre-existing, recalcitrant, alive/deceased, frozen, dormant, closed.",        keys: ["is_pre_existing","is_recalcitrant","account_holder_is_alive","account_holder_deceased_during_period","death_certificate_requested","death_certificate_received","will_or_inheritance_requested","will_or_inheritance_received","legacy_of_deceased_settled","status","account_closed_during_period","account_frozen_at_reporting_date","account_dormant_at_reporting_date"] },
    { name: "Original Address",          description: "Account holder's original registered address (street, city, state, postal code, country).",         keys: ["ah_original_street","ah_original_city","ah_original_state","ah_original_postal_code","ah_original_country","ah_original_country_code","acct_holder_address_unchanged"] },
    { name: "Current Address",           description: "Account holder's current address and country of residence.",                                        keys: ["ah_current_street","ah_current_city","ah_current_state","ah_current_postal_code","ah_current_country","ah_current_country_code","ah_country_of_residence","ah_country_of_residence_code"] },
    { name: "Account Contact",           description: "Contact details: email address and phone number.",                                                  keys: ["current_email","current_phone"] },
    { name: "Entity Classification",     description: "CRS entity classification fields: FI type, NFE flags, fiduciary/asset manager flags.",              keys: ["entity_classification","entity_managed_by_fiduciary_trust","entity_managed_by_asset_manager","gross_income_from_financial_assets"] },
    { name: "CRS Non-Reportable Exception", description: "CRS S3 gate field: non-reportable exception type classification.",                                keys: ["non_reportable_exception_type"] },
    { name: "Treasury Center Criteria",  description: "Treasury Center (S4E) criteria fields — only complete if Potential Exception Type = TreasuryCtr.", keys: ["treasury_activities_operational","treasury_part_of_nonfinancial_group","treasury_main_fn_finance_hedge_group","treasury_50pct_passive_income_fails","treasury_still_operational_despite_failing_50pct"] },
    { name: "Financial Values",          description: "Year-end balance, gross payments, currency codes, 50% passive income test, and reporting year.",    keys: ["year_end_cash_value","year_end_currency","gross_payments","gross_payments_currency","gross_income_50_passive","reporting_year"] },
    { name: "Compliance & Self-Cert",    description: "US person indicator, self-certification request/receipt flags and dates.",                          keys: ["us_person_indic","self_certification_overdue","self_cert_requested","self_cert_request_date","self_cert_obtained","self_cert_date"] },
    { name: "Account Holder Tax Residency", description: "Up to 2 tax residency entries with country name, country code (auto), and TIN.",               keys: ["tax1_country","tax1_country_code","tax1_tin","tax2_country","tax2_country_code","tax2_tin"] },
  ];

  // Add a group for each CP block
  for (let n = 1; n <= 4; n++) {
    GROUP_PATTERNS.push({
      name: `Controlling Person ${n}`,
      description: `All fields for Controlling Person ${n}: name, DOB, address, tax residency, self-certification. Greyed out for individual account holders.`,
      keys: columns.filter(c => c.key.startsWith(`cp${n}_`)).map(c => c.key),
    });
  }

  const keyToIndex = {};
  columns.forEach((col, i) => { keyToIndex[col.key] = i + 1; }); // 1-based

  return GROUP_PATTERNS
    .map(group => {
      // Find the first column in this group that actually exists in the template
      const matchingIndices = group.keys
        .map(k => keyToIndex[k])
        .filter(Boolean);
      if (matchingIndices.length === 0) return null;
      const startColIndex = Math.min(...matchingIndices);
      return {
        name: group.name,
        description: group.description,
        startColIndex,
        count: matchingIndices.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startColIndex - b.startColIndex);
}

// Used in field guide for auto-filled column display
const CODE_TO_NAME_KEY_GUIDE = {
  country_of_incorporation_code: true,
  ah_original_country_code: true,
  ah_current_country_code: true,
  ah_country_of_residence_code: true,
  tax1_country_code: true,
  tax2_country_code: true,
};
for (let n = 1; n <= 4; n++) {
  CODE_TO_NAME_KEY_GUIDE[`cp${n}_place_of_birth_code`] = true;
  CODE_TO_NAME_KEY_GUIDE[`cp${n}_country_of_residence_code`] = true;
  CODE_TO_NAME_KEY_GUIDE[`cp${n}_address_country_code`] = true;
  CODE_TO_NAME_KEY_GUIDE[`cp${n}_tax1_country_code`] = true;
  CODE_TO_NAME_KEY_GUIDE[`cp${n}_tax2_country_code`] = true;
}

// Returns the column list to use for a given config (DB-defined or hardcoded defaults)
export function getColumnsForFiType(config) {
  if (config.columnDefinitions?.length) {
    return config.columnDefinitions;
  }
  return getDefaultColumns(config);
}

const ACCOUNT_NUMBER_TYPES = [
  "IBAN",
  "Bank account number (non-IBAN)",
  "ISIN",
  "Securities account number (non-ISIN)",
  "Other account identifier",
  "No account number exists",
];

const CP_CONTROL_TYPES = [
  "legal_person_ownership", "legal_person_other_means", "legal_person_senior_managing_official",
  "trust_settlor", "trust_trustee", "trust_protector", "trust_beneficiary", "trust_other",
  "legal_arrangement_settlor_equivalent", "legal_arrangement_trustee_equivalent",
  "legal_arrangement_protector_equivalent", "legal_arrangement_beneficiary_equivalent",
  "legal_arrangement_other_equivalent"
];

const FI_INSTITUTION_TYPES = [
  "Depository",
  "Specialized Insurance",
  "Investment Entity Type A",
  "Investment Entity Type B",
  "Custodial",
];

const ENTITY_TYPES = [
  "Naamloze Vennootschap (N.V.) (Limited Liability Company)",
  "Besloten Vennootschap (B.V.) (Private Limited Liability Company)",
  "N.V. or B.V. acting with one 100% shareholder/director (100% DGA)",
  "Stichting (Foundation) or other Non-Profit Organization",
  "Stichting Particulier Fonds (SPF) (Private Foundation)",
  "Stichting Administratiekantoor (STAK)",
  "Curaçao Trust Arrangement",
  "Holding Company",
  "Treasury Center",
  "Partnership",
  "Real Estate Fund",
  "Vereniging met rechtspersoonlijkheid (Association with corporate capacity)",
  "Cooperatie (Cooperation)",
  "Onderlinge Waarborgmaatschappij (Mutual Guarantee Company)",
];

// Reference sets needed inside handleDownloadTemplate scope — re-declared here for field guide
const CURRENCY_KEYS = new Set([
  "year_end_currency", "year_end_cash_value_currency", "gross_payments_currency",
]);
const COUNTRY_NAME_KEYS = new Set([
  "place_of_birth", "country_of_incorporation",
  "ah_original_country", "ah_current_country", "ah_country_of_residence",
  "tax1_country", "tax2_country",
  ...([1,2,3,4].flatMap(n => [
    `cp${n}_place_of_birth`, `cp${n}_country_of_residence`,
    `cp${n}_address_country`, `cp${n}_tax1_country`, `cp${n}_tax2_country`,
  ])),
]);

function cpColumns(n) {
  const p = `cp${n}`;
  const label = `Controlling Person ${n}`;
  return [
    { header: `${label} First Name`, key: `${p}_first_name`, width: 22, required: false, note: `First name of controlling person ${n}`, validation_values: null, example_value: n === 1 ? "Jane" : "" },
    { header: `${label} Last Name`, key: `${p}_last_name`, width: 22, required: false, note: `Last name of controlling person ${n}`, validation_values: null, example_value: n === 1 ? "Doe" : "" },
    { header: `${label} Date of Birth`, key: `${p}_date_of_birth`, width: 20, required: false, note: "YYYY-MM-DD", validation_values: null, example_value: n === 1 ? "1970-03-22" : "" },
    { header: `${label} Country of Birth`, key: `${p}_place_of_birth`, width: 22, required: false, note: "Country name", validation_values: null, example_value: n === 1 ? "United Kingdom" : "" },
    { header: `${label} Country of Birth Code`, key: `${p}_place_of_birth_code`, width: 22, required: false, note: "Auto-filled from country name", validation_values: null, example_value: n === 1 ? "GB" : "" },
    { header: `${label} Self Certification Requested`, key: `${p}_self_cert_requested`, width: 28, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "" },
    { header: `${label} Self Certification Request Date`, key: `${p}_self_cert_request_date`, width: 30, required: false, note: "YYYY-MM-DD", validation_values: null, example_value: "" },
    { header: `${label} Self Certification Obtained`, key: `${p}_self_cert_obtained`, width: 28, required: false, note: "true | false", validation_values: ["true", "false"], example_value: n === 1 ? "true" : "" },
    { header: `${label} Self Certification Receipt Date`, key: `${p}_self_cert_date`, width: 30, required: false, note: "YYYY-MM-DD", validation_values: null, example_value: n === 1 ? "2024-01-15" : "" },
    { header: `${label} Current Address - Street`, key: `${p}_street`, width: 26, required: false, note: "", validation_values: null, example_value: n === 1 ? "45 Queen St" : "" },
    { header: `${label} Current Address - City`, key: `${p}_city`, width: 20, required: false, note: "", validation_values: null, example_value: n === 1 ? "Sydney" : "" },
    { header: `${label} Current Address - State`, key: `${p}_state`, width: 20, required: false, note: "", validation_values: null, example_value: "" },
    { header: `${label} Current Address - Postal Code`, key: `${p}_postal_code`, width: 22, required: false, note: "", validation_values: null, example_value: "" },
    { header: `${label} Current Address - Country`, key: `${p}_address_country`, width: 22, required: false, note: "Country name", validation_values: null, example_value: n === 1 ? "Australia" : "" },
    { header: `${label} Current Address - Country Code`, key: `${p}_address_country_code`, width: 24, required: false, note: "Auto-filled from country name", validation_values: null, example_value: n === 1 ? "AU" : "" },
    { header: `${label} Country of Residence`, key: `${p}_country_of_residence`, width: 26, required: false, note: "Country name", validation_values: null, example_value: n === 1 ? "Australia" : "" },
    { header: `${label} Country of Residence Code`, key: `${p}_country_of_residence_code`, width: 26, required: false, note: "Auto-filled from country name", validation_values: null, example_value: n === 1 ? "AU" : "" },
    { header: `${label} Tax Residency 1 - Country`, key: `${p}_tax1_country`, width: 26, required: false, note: "Country name", validation_values: null, example_value: n === 1 ? "Australia" : "" },
    { header: `${label} Tax Residency 1 - Country Code`, key: `${p}_tax1_country_code`, width: 26, required: false, note: "Auto-filled from country name", validation_values: null, example_value: n === 1 ? "AU" : "" },
    { header: `${label} Tax Residency 1 - TIN`, key: `${p}_tin`, width: 20, required: false, note: "Tax identification number", validation_values: null, example_value: n === 1 ? "987654321" : "" },
    { header: `${label} Tax Residency 2 - Country`, key: `${p}_tax2_country`, width: 26, required: false, note: "Country name", validation_values: null, example_value: "" },
    { header: `${label} Tax Residency 2 - Country Code`, key: `${p}_tax2_country_code`, width: 26, required: false, note: "Auto-filled from country name", validation_values: null, example_value: "" },
    { header: `${label} Tax Residency 2 - TIN`, key: `${p}_tin2`, width: 20, required: false, note: "Tax identification number", validation_values: null, example_value: "" },
  ];
}

function getDefaultColumns(config) {
  return [
    { header: "Entity ID", key: "entity_id", width: 28, required: true, note: "Exact ID of the RFI Entity this account belongs to", validation_values: null, example_value: "" },
    { header: "Entity Name (auto-ref)", key: "entity_name_ref", width: 28, required: false, note: "Auto-populated — do not edit", validation_values: null, example_value: "" },
    { header: "Account Number", key: "account_number", width: 22, required: true, note: "Unique account identifier", validation_values: null, example_value: "ACC-001" },
    { header: "Account Number Type", key: "account_number_type", width: 32, required: false, note: "IBAN | Bank account number (non-IBAN) | ISIN | Securities account number (non-ISIN) | Other account identifier | No account number exists", validation_values: ACCOUNT_NUMBER_TYPES, example_value: "IBAN" },
    { header: "Account Opening Date", key: "account_creation_date", width: 24, required: true, note: "Format: YYYY-MM-DD e.g. 2020-01-15", validation_values: null, example_value: "2020-01-15" },
    { header: "Account Type", key: "account_type", width: 26, required: true, note: config.accountTypeNote, validation_values: config.allowedAccountTypes, example_value: config.exampleAccountType },
    { header: "Account Holder Type", key: "account_holder_type", width: 24, required: true, note: "individual | entity", validation_values: ["individual", "entity"], example_value: "individual" },
    { header: "First Name", key: "first_name", width: 22, required: false, note: "Required for individuals", validation_values: null, example_value: "John" },
    { header: "Middle Name", key: "middle_name", width: 22, required: false, note: "Optional for individuals", validation_values: null, example_value: "" },
    { header: "Last Name", key: "last_name", width: 22, required: false, note: "Required for individuals", validation_values: null, example_value: "Smith" },
    { header: "Name Prefix", key: "name_prefix", width: 18, required: false, note: "e.g. Mr, Mrs, Dr", validation_values: null, example_value: "Mr" },
    { header: "Title", key: "title", width: 18, required: false, note: "Optional title", validation_values: null, example_value: "" },
    { header: "Type of Financial Institution", key: "type_of_financial_institution", width: 30, required: false, note: "If account holder is an FI", validation_values: FI_INSTITUTION_TYPES, example_value: "" },
    { header: "Type of Entity", key: "account_holder_entity_type", width: 30, required: false, note: "Legal entity type", validation_values: ENTITY_TYPES, example_value: "" },
    { header: "Account Holder Name (Entity)", key: "account_holder_name", width: 30, required: false, note: "Required if Account Holder Type = entity", validation_values: null, example_value: "" },
    { header: "Date of Incorporation", key: "date_of_incorporation", width: 24, required: false, note: "YYYY-MM-DD. For entity account holders", validation_values: null, example_value: "" },
    { header: "Country of Incorporation", key: "country_of_incorporation", width: 26, required: false, note: "For entity account holders", validation_values: null, example_value: "" },
    { header: "Country of Incorporation Code", key: "country_of_incorporation_code", width: 28, required: false, note: "Auto-filled from country name", validation_values: null, example_value: "" },
    { header: "Date of Birth", key: "date_of_birth", width: 20, required: false, note: "YYYY-MM-DD. For individual account holders", validation_values: null, example_value: "1980-01-15" },
    { header: "Place of Birth", key: "place_of_birth", width: 22, required: false, note: "Country of birth — for individual account holders", validation_values: null, example_value: "United States" },
    { header: "Pre-existing Account", key: "is_pre_existing", width: 22, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Is Recalcitrant", key: "is_recalcitrant", width: 22, required: false, note: "true | false — individual holders only", validation_values: ["true", "false"], example_value: "false" },
    { header: "Account Holder Is Alive", key: "account_holder_is_alive", width: 26, required: false, note: "true | false — individual account holders only", validation_values: ["true", "false"], example_value: "true" },
    { header: "Account Holder Deceased During Period", key: "account_holder_deceased_during_period", width: 36, required: false, note: "true | false — whether holder deceased during reporting period", validation_values: ["true", "false"], example_value: "false" },
    { header: "Death Certificate Requested", key: "death_certificate_requested", width: 28, required: false, note: "true | false — individual holders only", validation_values: ["true", "false"], example_value: "" },
    { header: "Death Certificate Received", key: "death_certificate_received", width: 28, required: false, note: "true | false — individual holders only", validation_values: ["true", "false"], example_value: "" },
    { header: "Will / Inheritance Requested", key: "will_or_inheritance_requested", width: 28, required: false, note: "true | false — individual holders only", validation_values: ["true", "false"], example_value: "" },
    { header: "Will / Inheritance Received", key: "will_or_inheritance_received", width: 28, required: false, note: "true | false — individual holders only", validation_values: ["true", "false"], example_value: "" },
    { header: "Legacy of Deceased Settled", key: "legacy_of_deceased_settled", width: 28, required: false, note: "true | false — individual holders only", validation_values: ["true", "false"], example_value: "" },
    { header: "Account Status", key: "status", width: 18, required: false, note: "active | closed | dormant", validation_values: ["active", "closed", "dormant"], example_value: "active" },
    { header: "Account Closed During Period", key: "account_closed_during_period", width: 28, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Account Frozen at Reporting Date", key: "account_frozen_at_reporting_date", width: 30, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Account Dormant at Reporting Date", key: "account_dormant_at_reporting_date", width: 30, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Acct Holder Original Address - Street", key: "ah_original_street", width: 30, required: false, note: "", validation_values: null, example_value: "123 Main St" },
    { header: "Acct Holder Original Address - City", key: "ah_original_city", width: 22, required: false, note: "", validation_values: null, example_value: "New York" },
    { header: "Acct Holder Original Address - State", key: "ah_original_state", width: 22, required: false, note: "", validation_values: null, example_value: "NY" },
    { header: "Acct Holder Original Address - Postal Code", key: "ah_original_postal_code", width: 26, required: false, note: "", validation_values: null, example_value: "10001" },
    { header: "Acct Holder Original Address - Country", key: "ah_original_country", width: 26, required: false, note: "Country name", validation_values: null, example_value: "United States" },
    { header: "Acct Holder Original Address - Country Code", key: "ah_original_country_code", width: 28, required: false, note: "Auto-filled from country name", validation_values: null, example_value: "" },
    { header: "Acct Holder Address Unchanged", key: "acct_holder_address_unchanged", width: 30, required: false, note: "true | false - unchanged since last period", validation_values: ["true", "false"], example_value: "false" },
    { header: "Acct Holder Current Address - Street", key: "ah_current_street", width: 30, required: false, note: "", validation_values: null, example_value: "123 Main St" },
    { header: "Acct Holder Current Address - City", key: "ah_current_city", width: 22, required: false, note: "", validation_values: null, example_value: "New York" },
    { header: "Acct Holder Current Address - State", key: "ah_current_state", width: 22, required: false, note: "", validation_values: null, example_value: "NY" },
    { header: "Acct Holder Current Address - Postal Code", key: "ah_current_postal_code", width: 26, required: false, note: "", validation_values: null, example_value: "10001" },
    { header: "Acct Holder Current Address - Country", key: "ah_current_country", width: 26, required: false, note: "Country name", validation_values: null, example_value: "United States" },
    { header: "Acct Holder Current Address - Country Code", key: "ah_current_country_code", width: 28, required: false, note: "Auto-filled from country name", validation_values: null, example_value: "" },
    { header: "Acct Holder Country of Residence", key: "ah_country_of_residence", width: 28, required: false, note: "Country name", validation_values: null, example_value: "United States" },
    { header: "Acct Holder Country of Residence Code", key: "ah_country_of_residence_code", width: 30, required: false, note: "Auto-filled from country name", validation_values: null, example_value: "" },
    { header: "Current Email Address", key: "current_email", width: 28, required: true, note: "Valid email format", validation_values: null, example_value: "john@example.com" },
    { header: "Current Phone Number", key: "current_phone", width: 22, required: true, note: "e.g. +12125551234", validation_values: null, example_value: "+12125551234" },
    { header: "Entity Classification", key: "entity_classification", width: 26, required: false, note: "financial_institution | active_nfe | passive_nfe | not_applicable", validation_values: ["financial_institution", "active_nfe", "passive_nfe", "not_applicable"], example_value: "not_applicable" },
    { header: "Entity Managed by Fiduciary Trust", key: "entity_managed_by_fiduciary_trust", width: 32, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Entity Managed by Asset Manager", key: "entity_managed_by_asset_manager", width: 30, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Gross Income from Financial Assets", key: "gross_income_from_financial_assets", width: 32, required: false, note: "true | false — whether entity derives gross income from financial assets", validation_values: ["true", "false"], example_value: "false" },
    { header: "Non-Reportable Exception Type", key: "non_reportable_exception_type", width: 44, required: false,
      note: "S3-1 gate — select the applicable exception or 'None of the above'",
      validation_values: [
        "Publicly Traded NFEs and NFEs affiliates thereof",
        "Entity in liquidation/bankruptcy",
        "Governmental entities",
        "International Organizations",
        "Central Banks",
        "Holding NFE's of Nonfinancial Groups",
        "None of the above",
      ],
      example_value: "None of the above" },
    { header: "Treasury: Activities Functional & Operational", key: "treasury_activities_operational", width: 38, required: false, note: "S4E criterion 1. true | false", validation_values: ["true","false"], example_value: "" },
    { header: "Treasury: Part of Non-Financial Group", key: "treasury_part_of_nonfinancial_group", width: 36, required: false, note: "S4E criterion 2. true | false", validation_values: ["true","false"], example_value: "" },
    { header: "Treasury: Main Function Finance/Hedge Group", key: "treasury_main_fn_finance_hedge_group", width: 38, required: false, note: "S4E criterion 3. true | false", validation_values: ["true","false"], example_value: "" },
    { header: "Treasury: <50% Passive Income (Passes 50% Test)", key: "treasury_50pct_passive_income_fails", width: 40, required: false, note: "S4E criterion 4. true = <50% passive (passes). false = ≥50% passive (fails). Inverted vs Excel column name.", validation_values: ["true","false"], example_value: "" },
    { header: "Treasury: Operational Despite Failing 50% Test", key: "treasury_still_operational_despite_failing_50pct", width: 42, required: false, note: "GAP 1 FIX. Fill only when treasury_50pct_passive_income_fails = false. true = A-NFE (operational). false = P-NFE (passive).", validation_values: ["true","false"], example_value: "" },
    { header: "Year-end Balance", key: "year_end_cash_value", width: 22, required: false, note: "Number", validation_values: null, example_value: "50000" },
    { header: "Year-end Currency", key: "year_end_currency", width: 20, required: false, note: "ISO code e.g. USD, AUD", validation_values: null, example_value: "USD" },
    { header: "Gross interest paid or credited to account", key: "gross_payments", width: 36, required: false, note: "Number", validation_values: null, example_value: "5000" },
    { header: "Gross Payments Currency", key: "gross_payments_currency", width: 24, required: false, note: "ISO code", validation_values: null, example_value: "USD" },
    { header: "50% Passive Income (Gross Income)", key: "gross_income_50_passive", width: 30, required: false, note: "true | false — whether 50% or more of gross income is passive", validation_values: ["true", "false"], example_value: "false" },
    { header: "Reporting Year", key: "reporting_year", width: 18, required: false, note: "YYYY e.g. 2024", validation_values: null, example_value: "2024" },
    { header: "US Person Indicator", key: "us_person_indic", width: 22, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Self Certification Overdue (90+ days)", key: "self_certification_overdue", width: 34, required: false, note: "true | false — set true if 90 days have passed since self-cert request with no response", validation_values: ["true", "false"], example_value: "false" },
    { header: "Account Holder Self Certification Requested", key: "self_cert_requested", width: 36, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Account Holder Self Certification Request Date", key: "self_cert_request_date", width: 38, required: false, note: "YYYY-MM-DD", validation_values: null, example_value: "" },
    { header: "Account Holder Self Certification Obtained", key: "self_cert_obtained", width: 34, required: false, note: "true | false", validation_values: ["true", "false"], example_value: "false" },
    { header: "Account Holder Self Certification Receipt Date", key: "self_cert_date", width: 38, required: false, note: "YYYY-MM-DD", validation_values: null, example_value: "" },
    { header: "Account Holder Tax Residency 1 - Country", key: "tax1_country", width: 32, required: false, note: "Country name", validation_values: null, example_value: "United States" },
    { header: "Account Holder Tax Residency 1 - Country Code", key: "tax1_country_code", width: 34, required: false, note: "Auto-filled from country name", validation_values: null, example_value: "" },
    { header: "Account Holder Tax Residency 1 - TIN", key: "tax1_tin", width: 28, required: false, note: "Tax identification number", validation_values: null, example_value: "123-45-6789" },
    { header: "Account Holder Tax Residency 2 - Country", key: "tax2_country", width: 32, required: false, note: "", validation_values: null, example_value: "" },
    { header: "Account Holder Tax Residency 2 - Country Code", key: "tax2_country_code", width: 34, required: false, note: "Auto-filled from country name", validation_values: null, example_value: "" },
    { header: "Account Holder Tax Residency 2 - TIN", key: "tax2_tin", width: 28, required: false, note: "", validation_values: null, example_value: "" },
    ...cpColumns(1),
    ...cpColumns(2),
    ...cpColumns(3),
    ...cpColumns(4),
  ];
}