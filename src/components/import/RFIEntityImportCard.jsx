import React, { useState, useEffect, useMemo } from "react";
import ExcelJS from "exceljs";
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
  { col: "Account Number Type", format: "See dropdown", required: false, notes: "IBAN | Bank account number (non-IBAN) | ISIN | etc." },
  { col: "Account Opening Date", format: "YYYY-MM-DD", required: true, notes: "e.g. 2020-01-15" },
  { col: "Account Type", format: "See FI Type", required: true, notes: "Valid types depend on FI Type" },
  { col: "Account Holder Type", format: "individual | entity", required: true, notes: "" },
  { col: "First Name", format: "Text", required: false, notes: "Required for individuals" },
  { col: "Middle Name", format: "Text", required: false, notes: "Optional for individuals" },
  { col: "Last Name", format: "Text", required: false, notes: "Required for individuals" },
  { col: "Name Prefix", format: "Text", required: false, notes: "e.g. Mr, Mrs, Dr" },
  { col: "Title", format: "Text", required: false, notes: "Optional title for individuals" },
  { col: "Account Holder Name", format: "Text", required: false, notes: "Required for entity holders" },
  { col: "Date of Birth", format: "YYYY-MM-DD", required: false, notes: "Required for individuals" },
  { col: "Place of Birth", format: "Country name", required: false, notes: "" },
  { col: "Is Recalcitrant", format: "true | false", required: false, notes: "Individual account holders only" },
  { col: "Pre-existing Account", format: "true | false", required: false, notes: "" },
  { col: "Account Frozen at Reporting Date", format: "true | false", required: false, notes: "" },
  { col: "Account Dormant at Reporting Date", format: "true | false", required: false, notes: "" },
  { col: "Acct Holder Address Unchanged", format: "true | false", required: false, notes: "" },
  { col: "US Person Indicator", format: "true | false", required: false, notes: "" },
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
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CRS Platform";
    workbook.created = new Date();

    // Fetch country and currency data for Referenced Data sheet
    const [crsCountries, currencyRecords] = await Promise.all([
      base44.entities.CrsCountryInfo.list("-country_name", 300),
      base44.entities.ReferencedData.filter({ entity_name: "Global", field_name: "currency" }, "order", 300),
    ]);
    const countryData = crsCountries
      .map(c => ({ name: c.country_name, code: c.country_code }))
      .filter(c => c.name && c.code)
      .sort((a, b) => a.name.localeCompare(b.name));
    const refDataRows = countryData.length;
    const currencyCodes = currencyRecords
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(c => c.value)
      .filter(Boolean);

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
      "place_of_birth", "country_of_incorporation",
      "ah_original_country", "ah_current_country", "ah_country_of_residence",
      "tax1_country", "tax2_country",
      ...[1,2,3,4].flatMap(n => [
        `cp${n}_place_of_birth`, `cp${n}_country_of_residence`,
        `cp${n}_address_country`, `cp${n}_tax1_country`, `cp${n}_tax2_country`,
      ]),
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

    // ── Define all dropdown sections (used for both validation ranges and the legend)
    const DROPDOWN_SECTIONS = [
      { key: "account_types",        label: "Account Types",                    values: effectiveConfig.allowedAccountTypes },
      { key: "account_number_types", label: "Account Number Types",             values: ["IBAN", "Bank account number (non-IBAN)", "ISIN", "Securities account number (non-ISIN)", "Other account identifier", "No account number exists"] },
      { key: "account_holder_types", label: "Account Holder Types",             values: ["individual", "entity"] },
      { key: "entity_class",         label: "Entity Classification",            values: ["financial_institution", "active_nfe", "passive_nfe", "not_applicable"] },
      { key: "account_status",       label: "Account Status",                   values: ["active", "closed", "dormant"] },
      { key: "boolean",              label: "Boolean Fields (true / false)",    values: ["true", "false"] },
      { key: "fi_institution_types", label: "Type of Financial Institution",    values: ["Depository", "Specialized Insurance", "Investment Entity Type A", "Investment Entity Type B", "Custodial"] },
      { key: "entity_types",         label: "Type of Entity",                   values: [
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
      ]},
      { key: "control_types",        label: "Controlling Person Control Types", values: [
        "legal_person_ownership", "legal_person_other_means", "legal_person_senior_managing_official",
        "trust_settlor", "trust_trustee", "trust_protector", "trust_beneficiary", "trust_other",
        "legal_arrangement_settlor_equivalent", "legal_arrangement_trustee_equivalent",
        "legal_arrangement_protector_equivalent", "legal_arrangement_beneficiary_equivalent",
        "legal_arrangement_other_equivalent"
      ]},
    { key: "non_reportable_exception_types",
      label: "Non-Reportable Exception Types",
      values: ["inheritance_estate","escrow_court_decree","qualifying_pension",
        "overdraft_deposit","pre_existing_dormant_below_1k","publicly_traded",
        "purely_domestic","international_organization","liquidation_dissolution","none"] },
    { key: "potential_exception_types",
      label: "Potential Exception Types",
      values: ["None","DGA","Foundation","STAK","HoldCo","TreasuryCtr","RealEstateFund"] },
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

    // Currency columns — validated against column F of Referenced Data sheet
    const CURRENCY_KEYS = new Set([
      "year_end_currency", "year_end_cash_value_currency", "gross_payments_currency",
    ]);

    // Map from column key -> dropdown section key
    const COL_DROPDOWN_SECTION = {
      account_type:                  "account_types",
      account_number_type:           "account_number_types",
      account_holder_type:           "account_holder_types",
      entity_classification:         "entity_class",
      status:                        "account_status",
      type_of_financial_institution: "fi_institution_types",
      account_holder_entity_type:    "entity_types",
      is_pre_existing:               "boolean",
      is_recalcitrant:               "boolean",
      account_holder_is_alive: "boolean",
      account_holder_deceased_during_period: "boolean",
      account_closed_during_period: "boolean",
      account_frozen_at_reporting_date: "boolean",
      account_dormant_at_reporting_date: "boolean",
      acct_holder_address_unchanged: "boolean",
      us_person_indic: "boolean",
      self_cert_obtained: "boolean",
      self_cert_requested: "boolean",
      self_certification_obtained: "boolean",
      entity_managed_by_fiduciary_trust: "boolean",
      entity_managed_by_asset_manager: "boolean",
      gross_income_50_passive: "boolean",
      gross_income_from_financial_assets: "boolean",
      self_certification_overdue: "boolean",
      death_certificate_requested: "boolean",
      death_certificate_received: "boolean",
      will_or_inheritance_requested: "boolean",
      will_or_inheritance_received: "boolean",
      legacy_of_deceased_settled: "boolean",
      non_reportable_exception_type:                    "non_reportable_exception_types",
      potential_exception_type:                         "potential_exception_types",
      treasury_activities_operational:                  "boolean",
      treasury_part_of_nonfinancial_group:              "boolean",
      treasury_main_fn_finance_hedge_group:             "boolean",
      treasury_50pct_passive_income_fails:              "boolean",
      treasury_still_operational_despite_failing_50pct: "boolean",
      ...Object.fromEntries([1,2,3,4].flatMap(n => [
        [`cp${n}_control_type`,          "control_types"],
        [`cp${n}_self_cert_obtained`,    "boolean"],
        [`cp${n}_self_cert_requested`,   "boolean"],
      ])),
    };

    // ── Section definitions: label, header colour, light fill, whether to collapse by default
    const SECTION_GROUPS = [
      {
        id: "required",
        label: "🔴 ALWAYS REQUIRED",
        sublabel: "Fill for every account row",
        hdrArgb: "FF1E3A5F",
        lightArgb: "FFE8EDF4",
        collapsed: false,
        keyMatch: (key) => ["entity_id","account_number","account_number_type","account_opening_date","account_type","account_holder_type"].includes(key),
      },
      {
        id: "individual",
        label: "👤 INDIVIDUAL ONLY",
        sublabel: "Skip if Account Holder Type = entity",
        hdrArgb: "FF1565C0",
        lightArgb: "FFE3F0FC",
        collapsed: false,
        keyMatch: (key) => ["first_name","middle_name","last_name","name_prefix","title","date_of_birth","place_of_birth"].includes(key),
      },
      {
        id: "entity",
        label: "🏢 ENTITY ONLY",
        sublabel: "Skip if Account Holder Type = individual",
        hdrArgb: "FF0A7373",
        lightArgb: "FFE0F5F5",
        collapsed: false,
        keyMatch: (key) => ["type_of_financial_institution","account_holder_entity_type","account_holder_name",
          "date_of_incorporation","country_of_incorporation","country_of_incorporation_code"].includes(key),
      },
      {
        id: "status",
        label: "📋 ACCOUNT STATUS",
        sublabel: "Fill as applicable",
        hdrArgb: "FF37474F",
        lightArgb: "FFECEFF1",
        collapsed: false,
        keyMatch: (key) => ["is_pre_existing","is_recalcitrant","account_holder_is_alive",
          "account_holder_deceased_during_period","account_closed_during_period",
          "account_frozen_at_reporting_date","account_dormant_at_reporting_date","status"].includes(key),
      },
      {
        id: "deceased",
        label: "⚰️ DECEASED ONLY",
        sublabel: "Skip unless account holder is deceased — expand if needed",
        hdrArgb: "FF6A1B9A",
        lightArgb: "FFF3E5F5",
        collapsed: true,
        keyMatch: (key) => ["death_certificate_requested","death_certificate_received",
          "will_or_inheritance_requested","will_or_inheritance_received","legacy_of_deceased_settled"].includes(key),
      },
      {
        id: "address",
        label: "📍 ADDRESS & CONTACT",
        sublabel: "Original and current address fields",
        hdrArgb: "FF2E7D32",
        lightArgb: "FFE8F5E9",
        collapsed: false,
        keyMatch: (key) => key.startsWith("ah_original") || key.startsWith("ah_current")
          || key.startsWith("ah_country_of_res") || ["acct_holder_address_unchanged",
            "current_email","current_phone"].includes(key),
      },
      {
        id: "classif",
        label: "🏷️ ENTITY CLASSIFICATION",
        sublabel: "CRS classification — entities only",
        hdrArgb: "FFE65100",
        lightArgb: "FFFFF3E0",
        collapsed: false,
        keyMatch: (key) => ["entity_classification","entity_managed_by_fiduciary_trust",
          "entity_managed_by_asset_manager","gross_income_from_financial_assets",
          "gross_income_50_passive","non_reportable_exception_type","potential_exception_type"].includes(key),
      },
      {
        id: "treasury",
        label: "🏦 TREASURY CENTER ONLY",
        sublabel: "Fill only when Potential Exception Type = TreasuryCtr — expand if needed",
        hdrArgb: "FFBF360C",
        lightArgb: "FFFBE9E7",
        collapsed: true,
        keyMatch: (key) => key.startsWith("treasury_"),
      },
      {
        id: "financial",
        label: "💰 FINANCIAL DATA",
        sublabel: "Year-end balances and reporting year",
        hdrArgb: "FF1B5E20",
        lightArgb: "FFF1F8E9",
        collapsed: false,
        keyMatch: (key) => ["year_end_cash_value","year_end_cash_value_currency","gross_payments",
          "gross_payments_currency","reporting_year","us_person_indic"].includes(key),
      },
      {
        id: "scert",
        label: "📄 SELF CERTIFICATION",
        sublabel: "SC request and receipt tracking",
        hdrArgb: "FF4A148C",
        lightArgb: "FFEDE7F6",
        collapsed: false,
        keyMatch: (key) => ["self_certification_overdue","self_cert_requested","self_cert_request_date",
          "self_certification_obtained","self_cert_receipt_date"].includes(key),
      },
      {
        id: "taxres",
        label: "🌍 TAX RESIDENCY",
        sublabel: "Account holder tax residency — up to 2 countries",
        hdrArgb: "FF004D40",
        lightArgb: "FFE0F2F1",
        collapsed: false,
        keyMatch: (key) => ["tax1_country","tax1_country_code","tax1_tin",
          "tax2_country","tax2_country_code","tax2_tin"].includes(key),
      },
      {
        id: "cp1",
        label: "👥 CONTROLLING PERSON 1",
        sublabel: "Required for P-NFE / FI entity accounts",
        hdrArgb: "FFB71C1C",
        lightArgb: "FFFFEBEE",
        collapsed: false,
        keyMatch: (key) => key.startsWith("cp1_"),
      },
      {
        id: "cp2",
        label: "👥 CONTROLLING PERSON 2",
        sublabel: "Add if more than 1 controlling person — expand if needed",
        hdrArgb: "FF880E4F",
        lightArgb: "FFFCE4EC",
        collapsed: true,
        keyMatch: (key) => key.startsWith("cp2_"),
      },
      {
        id: "cp3",
        label: "👥 CONTROLLING PERSON 3",
        sublabel: "Add if more than 2 controlling persons — expand if needed",
        hdrArgb: "FF4A148C",
        lightArgb: "FFF3E5F5",
        collapsed: true,
        keyMatch: (key) => key.startsWith("cp3_"),
      },
      {
        id: "cp4",
        label: "👥 CONTROLLING PERSON 4",
        sublabel: "Add if more than 3 controlling persons — expand if needed",
        hdrArgb: "FF1A237E",
        lightArgb: "FFE8EAF6",
        collapsed: true,
        keyMatch: (key) => key.startsWith("cp4_"),
      },
    ];

    // Helper: find section for a given column key
    const getSectionForKey = (key) => {
      return SECTION_GROUPS.find(sg => sg.keyMatch(key)) || SECTION_GROUPS[0];
    };

    // Helper: style a section guide cell (row 2)
    const styleGuideCell = (cell, section, isFirstInSection) => {
      cell.fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: isFirstInSection ? section.hdrArgb : section.lightArgb },
      };
      cell.font = {
        bold: isFirstInSection,
        color: { argb: isFirstInSection ? "FFFFFFFF" : "FF222222" },
        size: isFirstInSection ? 9 : 8,
        italic: !isFirstInSection,
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    };

    // ── Sheet 1: Accounts Data  (with section bands, column groups, freeze panes)
    const dataSheet = workbook.addWorksheet("Accounts Data", {
      properties: { tabColor: { argb: "FF1E3A5F" } },
    });
    dataSheet.columns = columns.map(c => ({ key: c.key, width: c.width || 20 }));

    // ROW 1: Colour-coded column headers
    const headerRow = dataSheet.getRow(1);
    headerRow.height = 36;
    columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.required ? `${col.header} *` : col.header;
      if (col.note) cell.note = { texts: [{ text: col.note }] };

      // Use section colour instead of the generic styleHeader colours
      const section = getSectionForKey(col.key);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: section.hdrArgb } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9, name: "Calibri" };
      cell.alignment = { vertical: "bottom", horizontal: "center", wrapText: true };
      cell.border = {
        right: { style: "thin", color: { argb: "33FFFFFF" } },
        bottom: { style: "thin", color: { argb: "33FFFFFF" } },
      };
    });

    // ROW 2: Section guide band
    const guideRow = dataSheet.getRow(2);
    guideRow.height = 20;
    const seenSections = new Set();
    columns.forEach((col, i) => {
      const cell = guideRow.getCell(i + 1);
      const section = getSectionForKey(col.key);
      const isFirst = !seenSections.has(section.id);
      if (isFirst) {
        cell.value = section.label;
        seenSections.add(section.id);
      } else if (!seenSections.has(section.id + "_sub_written")) {
        cell.value = section.sublabel;
        seenSections.add(section.id + "_sub_written");
      }
      styleGuideCell(cell, section, isFirst);
    });

    // COLUMN GROUPS: set outline level 1 on all non-required columns
    // Collapsed sections start hidden so the user only sees ~79 columns
    columns.forEach((col, i) => {
      const section = getSectionForKey(col.key);
      if (section.id !== "required") {
        const excelCol = dataSheet.getColumn(i + 1);
        excelCol.outlineLevel = 1;
        if (section.collapsed) {
          excelCol.hidden = true;
        }
      }
    });

    // Show outline summary above columns (so +/− buttons appear at top)
    dataSheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    // FREEZE PANES: freeze first 5 cols (mandatory) + first 2 rows (header + guide)
    dataSheet.views = [{
      state: "frozen",
      xSplit: 5,
      ySplit: 2,
      topLeftCell: "F3",
      activeCell: "F3",
    }];

    // Apply dropdowns, country dropdowns from ref sheet, and VLOOKUP formulas
    for (let row = 3; row <= 503; row++) {
      columns.forEach((col, colIdx) => {
        const cell = dataSheet.getCell(row, colIdx + 1);
        if (CODE_TO_NAME_KEY[col.key]) {
          const nameKey = CODE_TO_NAME_KEY[col.key];
          const nameColIdx = colIndexMap[nameKey];
          if (nameColIdx) {
            cell.value = { formula: `IFERROR(VLOOKUP(${colLetter(nameColIdx)}${row},'Referenced Data'!$A$2:$B$${refDataRows + 1},2,FALSE),"")` };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
          }
        } else if (CURRENCY_KEYS.has(col.key) && currencyCodes.length) {
          cell.dataValidation = {
            type: "list", allowBlank: true,
            formulae: [`'Referenced Data'!$F$2:$F$${currencyCodes.length + 1}`],
            showErrorMessage: false,
          };
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
        "first_name", "middle_name", "last_name", "name_prefix", "title",
        "date_of_birth", "place_of_birth", "is_recalcitrant",
        "account_holder_is_alive", "account_holder_deceased_during_period",
        "death_certificate_requested", "death_certificate_received",
        "will_or_inheritance_requested", "will_or_inheritance_received",
        "legacy_of_deceased_settled",
      ]);
      // Fields only relevant for entity holders → grey out when type = "individual"
      const ENTITY_ONLY_KEYS = new Set([
        "account_holder_entity_type", "account_holder_name",
        "date_of_incorporation", "country_of_incorporation", "country_of_incorporation_code",
        "type_of_financial_institution",
        "entity_managed_by_fiduciary_trust", "entity_managed_by_asset_manager",
        "gross_income_from_financial_assets", "gross_income_50_passive", "entity_classification",
        "non_reportable_exception_type",
        "potential_exception_type",
        "treasury_activities_operational",
        "treasury_part_of_nonfinancial_group",
        "treasury_main_fn_finance_hedge_group",
        "treasury_50pct_passive_income_fails",
        "treasury_still_operational_despite_failing_50pct",
      ]);
      // CP fields → grey out when type = "individual"
      const CP_KEY_PREFIX_RE = /^cp\d_/;

      const greyFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      const greyFont = { color: { argb: "FFFFFFFF" }, italic: true };

      columns.forEach((col, colIdx) => {
        const excelColLetter = colLetter(colIdx + 1);
        const sqRef = `${excelColLetter}3:${excelColLetter}503`;

        if (INDIVIDUAL_ONLY_KEYS.has(col.key)) {
          // Black fill + block input when type = "entity"
          // Formula references first row of range with absolute col, relative row (ExcelJS requirement)
          dataSheet.addConditionalFormatting({
            ref: sqRef,
            rules: [{ type: "expression", priority: 1, formulae: [`$${ahtLetter}3="entity"`], style: { fill: greyFill, font: greyFont } }],
          });
          for (let r = 3; r <= 503; r++) {
            dataSheet.getCell(r, colIdx + 1).dataValidation = {
              type: "custom", allowBlank: true,
              formulae: [`$${ahtLetter}${r}<>"entity"`],
              showErrorMessage: true, errorStyle: "stop",
              errorTitle: "Not applicable",
              error: `This field is only for Individual account holders. Set Account Holder Type to "individual" to enter a value here.`,
            };
          }
        } else if (ENTITY_ONLY_KEYS.has(col.key) || CP_KEY_PREFIX_RE.test(col.key)) {
          // Black fill + block input when type = "individual"
          dataSheet.addConditionalFormatting({
            ref: sqRef,
            rules: [{ type: "expression", priority: 1, formulae: [`$${ahtLetter}3="individual"`], style: { fill: greyFill, font: greyFont } }],
          });
          for (let r = 3; r <= 503; r++) {
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

    // ── Sheet 2: Instructions (rich guide tab)
    const instrSheet = workbook.addWorksheet("📋 Instructions", {
      properties: { tabColor: { argb: "FF0A7373" } },
    });
    instrSheet.columns = [
      { key: "num",   width: 5  },
      { key: "label", width: 30 },
      { key: "cols",  width: 22 },
      { key: "when",  width: 28 },
      { key: "note",  width: 54 },
    ];

    // Title row
    instrSheet.mergeCells("B1:E1");
    const instrTitle = instrSheet.getCell("B1");
    instrTitle.value = "Vitauri Compliance EU — Bulk Import Template Guide";
    instrTitle.font  = { bold: true, size: 15, color: { argb: "FF1E3A5F" }, name: "Calibri" };
    instrTitle.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF4" } };
    instrTitle.alignment = { vertical: "middle", horizontal: "left" };
    instrSheet.getRow(1).height = 34;

    // Subtitle row
    instrSheet.mergeCells("B2:E2");
    const instrSub = instrSheet.getCell("B2");
    instrSub.value = "Use the +/− buttons above the column headers to collapse sections you don't need. Sections collapsed by default are rarely used — expand only if applicable.";
    instrSub.font  = { italic: true, size: 10, color: { argb: "FF444444" }, name: "Calibri" };
    instrSub.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9F0" } };
    instrSub.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    instrSheet.getRow(2).height = 30;

    // Column header row
    const instrHdrRow = instrSheet.getRow(4);
    instrHdrRow.height = 20;
    [null, "Section", "Columns", "When to fill", "Notes"].forEach((v, i) => {
      if (!v) return;
      const c = instrHdrRow.getCell(i + 1);
      c.value = v;
      c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      c.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
      c.alignment = { vertical: "middle", horizontal: "left" };
    });

    // Section rows
    const INSTR_ROWS = [
      { label: "🔴 ALWAYS REQUIRED",     cols: "First 6 columns",              when: "Every row",                             note: "Mandatory for the import to process. These columns never collapse." },
      { label: "👤 INDIVIDUAL ONLY",      cols: "First Name … Place of Birth",   when: "Account Holder Type = individual",     note: "Leave blank for entity accounts. These cells block input for entity rows." },
      { label: "🏢 ENTITY ONLY",          cols: "FI Type … Incorporation Code",  when: "Account Holder Type = entity",         note: "Leave blank for individual accounts. These cells block input for individual rows." },
      { label: "📋 ACCOUNT STATUS",       cols: "Pre-existing … Dormant",        when: "All accounts as applicable",           note: "Boolean dropdowns — select true or false from the dropdown list." },
      { label: "⚰️ DECEASED ONLY",        cols: "Death Cert … Legacy",           when: "Account Holder Is Alive = false",      note: "COLLAPSED by default. Click the + button to expand only if account holder is deceased." },
      { label: "📍 ADDRESS & CONTACT",    cols: "Original Addr … Phone",         when: "All accounts",                         note: "Country Code columns auto-fill from VLOOKUP — type the country name and the code appears." },
      { label: "🏷️ ENTITY CLASSIFICATION", cols: "Entity Class … Potential Exception", when: "Entity accounts only",          note: "Used for CRS Section 3 and 4 routing. Set Non-Reportable Exception Type to none if no exception applies." },
      { label: "🏦 TREASURY CENTER ONLY", cols: "Treasury: Activities … 50% Test", when: "Potential Exception Type = TreasuryCtr", note: "COLLAPSED by default. Expand only when the entity is a Treasury Center." },
      { label: "💰 FINANCIAL DATA",       cols: "Year-end Balance … Reporting Year", when: "All accounts",                    note: "Year-end balance in the account currency. Reporting Year is the 4-digit calendar year." },
      { label: "📄 SELF CERTIFICATION",   cols: "SC Overdue … Receipt Date",     when: "All accounts",                         note: "Track SC request and receipt dates. SC Overdue is system-derived — leave blank on import." },
      { label: "🌍 TAX RESIDENCY",        cols: "Tax Res 1 Country … Tax Res 2 TIN", when: "All accounts (min 1)",            note: "At least one tax residency country and TIN is required for reportable accounts." },
      { label: "👥 CONTROLLING PERSON 1", cols: "CP1 First Name … CP1 Tax2 TIN", when: "P-NFE and FI entities",              note: "Required when entity classification = passive_nfe or financial_institution." },
      { label: "👥 CONTROLLING PERSON 2", cols: "CP2 First Name … CP2 Tax2 TIN", when: "2+ controlling persons",             note: "COLLAPSED by default. Expand and fill if the entity has a second controlling person." },
      { label: "👥 CONTROLLING PERSON 3", cols: "CP3 First Name … CP3 Tax2 TIN", when: "3+ controlling persons",             note: "COLLAPSED by default. Expand and fill if the entity has a third controlling person." },
      { label: "👥 CONTROLLING PERSON 4", cols: "CP4 First Name … CP4 Tax2 TIN", when: "4+ controlling persons",             note: "COLLAPSED by default. Expand and fill if the entity has a fourth controlling person." },
    ];

    INSTR_ROWS.forEach((row, i) => {
      const r = instrSheet.getRow(5 + i);
      r.height = 28;
      const section = SECTION_GROUPS.find(sg => sg.label === row.label) || SECTION_GROUPS[0];
      r.getCell(1).value = "";
      r.getCell(2).value = row.label;
      r.getCell(2).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: section.hdrArgb } };
      r.getCell(2).font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
      r.getCell(2).alignment = { vertical: "middle", horizontal: "left" };
      [3, 4, 5].forEach(ci => {
        const c = r.getCell(ci);
        c.value = [row.cols, row.when, row.note][ci - 3];
        c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? section.lightArgb : "FFFFFFFF" } };
        c.font  = { size: ci === 5 ? 9 : 10, color: { argb: "FF222222" }, name: "Calibri", italic: ci === 4 };
        c.alignment = { vertical: "middle", horizontal: "left", wrapText: ci === 5 };
        c.border = { bottom: { style: "thin", color: { argb: "FFDDDDDD" } } };
      });
    });

    // Quick Tips section
    const tipsStartRow = 5 + INSTR_ROWS.length + 2;
    instrSheet.mergeCells(`B${tipsStartRow}:E${tipsStartRow}`);
    const tipHdr = instrSheet.getCell(`B${tipsStartRow}`);
    tipHdr.value = "💡 Quick Tips";
    tipHdr.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A7373" } };
    tipHdr.font  = { bold: true, size: 12, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    tipHdr.alignment = { vertical: "middle", horizontal: "left" };
    instrSheet.getRow(tipsStartRow).height = 26;

    const TIPS = [
      "Use the +/− buttons above the column header row to expand or collapse section groups.",
      "Country Code columns (e.g. Country of Incorporation Code) auto-fill via VLOOKUP — type the country name and the code fills automatically. Do not type the code manually.",
      "Dropdown columns have a pick-list. Click the cell and choose from the dropdown — do not type freehand text in dropdown columns or the import will reject the row.",
      "The * symbol in a column header means the field is mandatory. The import will fail if these are blank.",
      "Delete unused rows before uploading. Do not leave blank rows between data rows — they stop the parser.",
      "Do not rename column headers or change their order — the import parser matches by exact header text.",
      "For Controlling Persons: expand CP2/CP3/CP4 sections only if the entity has more than 1/2/3 controlling persons.",
      "For Treasury Center entities: set Potential Exception Type = TreasuryCtr then expand the Treasury Center section to fill the 5 criteria fields.",
    ];
    TIPS.forEach((tip, i) => {
      const r = instrSheet.getRow(tipsStartRow + 1 + i);
      r.height = 28;
      instrSheet.mergeCells(`C${tipsStartRow + 1 + i}:E${tipsStartRow + 1 + i}`);
      r.getCell(2).value = String(i + 1);
      r.getCell(2).font  = { bold: true, size: 10, color: { argb: "FF0A7373" }, name: "Calibri" };
      r.getCell(2).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F5F5" } };
      r.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      r.getCell(3).value = tip;
      r.getCell(3).font  = { size: 10, color: { argb: "FF1A1A1A" }, name: "Calibri" };
      r.getCell(3).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFF0FAFA" : "FFE0F5F5" } };
      r.getCell(3).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      r.getCell(3).border = { bottom: { style: "thin", color: { argb: "FFB2DFDB" } } };
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

    // ── Sheet 4: Referenced Data (country lookup + dropdown legends + currencies)
    const refSheet = workbook.addWorksheet("Referenced Data", { properties: { tabColor: { argb: "FFCBD5E1" } } });
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

    // Write currency codes into column F (col 6)
    currencyCodes.forEach((code, i) => {
      const cell = refSheet.getCell(i + 2, 6);
      cell.value = code;
      cell.font = { size: 9 };
    });

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

    // ── Sheet 5: Export (existing accounts — read-only reference)
    const exportSheet = workbook.addWorksheet("Export", {
      properties: { tabColor: { argb: "FF0A7373" } },
    });
    const exportColumns = columns.filter(c => !c.key.startsWith("entity_"));
    exportSheet.columns = [
      { key: "entity_id",   width: 28 },
      { key: "entity_name", width: 28 },
      ...exportColumns.map(c => ({ key: c.key, width: c.width || 20 })),
    ];

    // ROW 1: Colour-coded column headers — same section colours as Accounts Data
    const expHeaderRow = exportSheet.getRow(1);
    expHeaderRow.height = 36;

    [
      { cell: expHeaderRow.getCell(1), value: "Entity ID" },
      { cell: expHeaderRow.getCell(2), value: "Entity Name" },
    ].forEach(({ cell, value }) => {
      cell.value = value;
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      cell.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 9, name: "Calibri" };
      cell.alignment = { vertical: "bottom", horizontal: "center", wrapText: true };
      cell.border = {
        right:  { style: "thin", color: { argb: "33FFFFFF" } },
        bottom: { style: "thin", color: { argb: "33FFFFFF" } },
      };
    });

    exportColumns.forEach((col, i) => {
      const cell    = expHeaderRow.getCell(i + 3);
      cell.value    = col.header;
      const section = getSectionForKey(col.key);
      cell.fill     = { type: "pattern", pattern: "solid", fgColor: { argb: section.hdrArgb } };
      cell.font     = { bold: true, color: { argb: "FFFFFFFF" }, size: 9, name: "Calibri" };
      cell.alignment = { vertical: "bottom", horizontal: "center", wrapText: true };
      cell.border   = {
        right:  { style: "thin", color: { argb: "33FFFFFF" } },
        bottom: { style: "thin", color: { argb: "33FFFFFF" } },
      };
    });

    // ROW 2: Section guide band
    const expGuideRow = exportSheet.getRow(2);
    expGuideRow.height = 20;

    const expGuideEnt1 = expGuideRow.getCell(1);
    expGuideEnt1.value = "🔴 ENTITY & ACCOUNT ID";
    expGuideEnt1.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    expGuideEnt1.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 9, name: "Calibri" };
    expGuideEnt1.alignment = { vertical: "center", horizontal: "left" };

    const expGuideEnt2 = expGuideRow.getCell(2);
    expGuideEnt2.value = "Read-only export — do not edit";
    expGuideEnt2.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF4" } };
    expGuideEnt2.font  = { italic: true, size: 8, color: { argb: "FF444444" }, name: "Calibri" };
    expGuideEnt2.alignment = { vertical: "center", horizontal: "left" };

    const expSeenSections = new Set();
    exportColumns.forEach((col, i) => {
      const cell    = expGuideRow.getCell(i + 3);
      const section = getSectionForKey(col.key);
      const isFirst = !expSeenSections.has(section.id);
      if (isFirst) {
        cell.value = section.label;
        expSeenSections.add(section.id);
      } else if (!expSeenSections.has(section.id + "_sub")) {
        cell.value = section.sublabel;
        expSeenSections.add(section.id + "_sub");
      }
      styleGuideCell(cell, section, isFirst);
    });

    // COLUMN GROUPS: same collapsed sections as Accounts Data (offset by 2)
    exportColumns.forEach((col, i) => {
      const section = getSectionForKey(col.key);
      if (section.id !== "required") {
        const excelCol = exportSheet.getColumn(i + 3);
        excelCol.outlineLevel = 1;
        if (section.collapsed) excelCol.hidden = true;
      }
    });

    exportSheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    // FREEZE PANES: lock Entity ID + Entity Name (cols 1–2) and both header rows
    exportSheet.views = [{
      state:       "frozen",
      xSplit:      2,
      ySplit:      2,
      topLeftCell: "C3",
      activeCell:  "C3",
    }];

    // Fetch existing accounts for this entity
    const existingAccounts = await base44.entities.Account.filter({ entity_id: entity.id });

    // Fetch controlling persons for those accounts
    const cpMap = {};
    if (existingAccounts.length > 0) {
      const cpRecords = await base44.entities.ControllingPerson.filter({ tenant_id: entity.tenant_id });
      cpRecords.forEach(cp => {
        if (!cpMap[cp.account_id]) cpMap[cp.account_id] = [];
        cpMap[cp.account_id].push(cp);
      });
    }

    existingAccounts.forEach(acc => {
      const cps = cpMap[acc.id] || [];
      const rowData = { entity_id: entity.id, entity_name: entity.entity_name };

      exportColumns.forEach(col => {
        const k = col.key;
        // Address fields
        if (k === "ah_original_street") rowData[k] = acc.account_holder_address?.street || "";
        else if (k === "ah_original_city") rowData[k] = acc.account_holder_address?.city || "";
        else if (k === "ah_original_state") rowData[k] = acc.account_holder_address?.state || "";
        else if (k === "ah_original_postal_code") rowData[k] = acc.account_holder_address?.postal_code || "";
        else if (k === "ah_original_country") rowData[k] = acc.account_holder_address?.country || "";
        else if (k === "ah_original_country_code") rowData[k] = acc.account_holder_address?.country_code || "";
        else if (k === "ah_current_street") rowData[k] = acc.current_address?.street || "";
        else if (k === "ah_current_city") rowData[k] = acc.current_address?.city || "";
        else if (k === "ah_current_state") rowData[k] = acc.current_address?.state || "";
        else if (k === "ah_current_postal_code") rowData[k] = acc.current_address?.postal_code || "";
        else if (k === "ah_current_country") rowData[k] = acc.current_address?.country || "";
        else if (k === "ah_current_country_code") rowData[k] = acc.current_address?.country_code || "";
        else if (k === "ah_country_of_residence") rowData[k] = acc.country_of_residence || "";
        else if (k === "ah_country_of_residence_code") rowData[k] = "";
        // Tax residencies
        else if (k === "tax1_country") rowData[k] = acc.tax_residencies?.[0]?.country || "";
        else if (k === "tax1_country_code") rowData[k] = acc.tax_residencies?.[0]?.country_code || "";
        else if (k === "tax1_tin") rowData[k] = acc.tax_residencies?.[0]?.tin || "";
        else if (k === "tax2_country") rowData[k] = acc.tax_residencies?.[1]?.country || "";
        else if (k === "tax2_country_code") rowData[k] = acc.tax_residencies?.[1]?.country_code || "";
        else if (k === "tax2_tin") rowData[k] = acc.tax_residencies?.[1]?.tin || "";
        // Controlling persons
        else if (/^cp(\d)_(.+)$/.test(k)) {
          const m = k.match(/^cp(\d)_(.+)$/);
          const cpIdx = parseInt(m[1]) - 1;
          const cpField = m[2];
          const cp = cps[cpIdx];
          if (!cp) { rowData[k] = ""; return; }
          if (cpField === "first_name") rowData[k] = cp.first_name || "";
          else if (cpField === "last_name") rowData[k] = cp.last_name || "";
          else if (cpField === "date_of_birth") rowData[k] = cp.date_of_birth || "";
          else if (cpField === "place_of_birth") rowData[k] = cp.place_of_birth || "";
          else if (cpField === "place_of_birth_code") rowData[k] = cp.place_of_birth_code || "";
          else if (cpField === "country_of_residence") rowData[k] = cp.country_of_residence || "";
          else if (cpField === "country_of_residence_code") rowData[k] = cp.country_of_residence_code || "";
          else if (cpField === "self_cert_obtained") rowData[k] = cp.self_certification_obtained != null ? String(cp.self_certification_obtained) : "";
          else if (cpField === "self_cert_date") rowData[k] = cp.self_certification_receipt_date || "";
          else if (cpField === "self_cert_requested") rowData[k] = cp.self_certification_request_date ? "true" : "false";
          else if (cpField === "self_cert_request_date") rowData[k] = cp.self_certification_request_date || "";
          else if (cpField === "street") rowData[k] = cp.address?.street || "";
          else if (cpField === "city") rowData[k] = cp.address?.city || "";
          else if (cpField === "state") rowData[k] = cp.address?.state || "";
          else if (cpField === "postal_code") rowData[k] = cp.address?.postal_code || "";
          else if (cpField === "address_country") rowData[k] = cp.address?.country || "";
          else if (cpField === "address_country_code") rowData[k] = cp.address?.country_code || "";
          else if (cpField === "tax1_country") rowData[k] = cp.tax_residencies?.[0]?.country || "";
          else if (cpField === "tax1_country_code") rowData[k] = cp.tax_residencies?.[0]?.country_code || "";
          else if (cpField === "tin") rowData[k] = cp.tax_residencies?.[0]?.tin || "";
          else if (cpField === "tax2_country") rowData[k] = cp.tax_residencies?.[1]?.country || "";
          else if (cpField === "tax2_country_code") rowData[k] = cp.tax_residencies?.[1]?.country_code || "";
          else if (cpField === "tin2") rowData[k] = cp.tax_residencies?.[1]?.tin || "";
          else rowData[k] = "";
        }
        // Boolean fields
        else if (typeof acc[k] === "boolean") rowData[k] = String(acc[k]);
        // Direct mapping
        else rowData[k] = acc[k] != null ? String(acc[k]) : "";
      });

      const expRowIdx = exportSheet.rowCount; // 1-based, rows 1+2 are headers
      const row = exportSheet.addRow(rowData);
      const bandArgb = expRowIdx % 2 === 0 ? "FFF0F9FF" : "FFFFFFFF";
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bandArgb } };
        cell.font = { size: 9 };
      });
    });

    // Add a note if no accounts yet
    if (existingAccounts.length === 0) {
      const noteRow = exportSheet.addRow({ entity_id: "No existing accounts found for this entity." });
      noteRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

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
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await selectedFile.arrayBuffer());
      const sheet = workbook.worksheets.find(s => s.name.toLowerCase().includes("data")) || workbook.worksheets[0];
      const rows = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const values = [];
        row.eachCell({ includeEmpty: true }, cell => {
          let v = cell.value;
          // Skip formula results (VLOOKUP auto-fill cells) — treat as empty
          if (v && typeof v === "object" && v.formula) v = v.result ?? "";
          else if (v && typeof v === "object" && v.richText) v = v.richText.map(r => r.text).join("");
          else if (v && typeof v === "object" && v.text) v = v.text;
          else if (v instanceof Date) v = v.toISOString().split("T")[0];
          values.push(v == null ? "" : String(v));
        });
        rows.push(values);
      });
      if (rows.length < 3) { setErrors(["No data rows found in the Excel file"]); return; }
      headers = rows[0];
      // Row index 1 is the section guide band — skip it, data starts at index 2
      // Filter out rows where the key identifier columns (account number, account holder type) are all empty
      // This avoids including the 500 empty template rows that still have formula cells
      const accountNumberIdx = headers.findIndex(h => h.replace(" *", "").trim().toLowerCase() === "account number");
      const holderTypeIdx = headers.findIndex(h => h.replace(" *", "").trim().toLowerCase() === "account holder type");
      data = rows.slice(2).filter(r => {
        const hasAccountNum = accountNumberIdx >= 0 && r[accountNumberIdx] && r[accountNumberIdx].trim() !== "";
        const hasHolderType = holderTypeIdx >= 0 && r[holderTypeIdx] && r[holderTypeIdx].trim() !== "";
        // Row is valid if it has at least one of these key fields
        return hasAccountNum || hasHolderType;
      }).map(values => {
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
    "is_pre_existing", "is_recalcitrant", "account_holder_is_alive", "account_holder_deceased_during_period",
    "account_closed_during_period", "us_person_indic", "self_certification_obtained",
    "account_frozen_at_reporting_date", "account_dormant_at_reporting_date", "acct_holder_address_unchanged",
    "self_cert_requested", "entity_managed_by_fiduciary_trust", "entity_managed_by_asset_manager",
    "gross_income_50_passive", "gross_income_from_financial_assets",
    "self_certification_overdue",
    "death_certificate_requested", "death_certificate_received",
    "will_or_inheritance_requested", "will_or_inheritance_received",
    "legacy_of_deceased_settled",
    "treasury_activities_operational",
    "treasury_part_of_nonfinancial_group",
    "treasury_main_fn_finance_hedge_group",
    "treasury_50pct_passive_income_fails",
    "treasury_still_operational_despite_failing_50pct",
  ]);

  const parseBool = (v) => ["true", "yes", "1", "y"].includes(String(v).toLowerCase().trim());

  const convertToAccount = (row) => {
    const account = { tenant_id: tenant.id, entity_id: entity.id, reportability_status: "pending_review", status: "active" };
    const cpData = { 1: {}, 2: {}, 3: {}, 4: {} };

    const EXTRA_BOOL_FIELDS = BOOL_FIELDS;

    Object.entries(mappings).forEach(([csvCol, targetField]) => {
      if (!targetField) return;
      const value = row[csvCol];
      if (value === null || value === undefined || value === "") return;

      // Controlling person fields: cp1_first_name, cp2_control_type, etc.
      const cpMatch = targetField.match(/^cp(\d)_(.+)$/);
      if (cpMatch) {
        const idx = parseInt(cpMatch[1]);
        const field = cpMatch[2];
        if (cpData[idx]) cpData[idx][field] = value;
        return;
      }

      // Tax residency: tax1_country, tax1_tin, tax2_country, tax2_tin
      if (targetField === "tax1_country") {
        if (!account.tax_residencies) account.tax_residencies = [];
        if (!account.tax_residencies[0]) account.tax_residencies[0] = {};
        account.tax_residencies[0].country = value;
        return;
      }
      if (targetField === "tax1_tin") {
        if (!account.tax_residencies) account.tax_residencies = [];
        if (!account.tax_residencies[0]) account.tax_residencies[0] = {};
        account.tax_residencies[0].tin = String(value);
        return;
      }
      if (targetField === "tax2_country") {
        if (!account.tax_residencies) account.tax_residencies = [];
        if (!account.tax_residencies[1]) account.tax_residencies[1] = {};
        account.tax_residencies[1].country = value;
        return;
      }
      if (targetField === "tax2_tin") {
        if (!account.tax_residencies) account.tax_residencies = [];
        if (!account.tax_residencies[1]) account.tax_residencies[1] = {};
        account.tax_residencies[1].tin = String(value);
        return;
      }
      // Skip auto-filled country code columns (VLOOKUP results)
      if (["tax1_country_code", "tax2_country_code"].includes(targetField)) return;

      // Address fields mapping to nested account_holder_address / current_address
      if (targetField.startsWith("ah_original_") || targetField.startsWith("ah_current_") || targetField === "ah_country_of_residence") {
        // Map to account_holder_address (original) and current_address fields
        if (targetField === "ah_original_street") { account.account_holder_address = { ...(account.account_holder_address || {}), street: value }; return; }
        if (targetField === "ah_original_city")   { account.account_holder_address = { ...(account.account_holder_address || {}), city: value }; return; }
        if (targetField === "ah_original_state")  { account.account_holder_address = { ...(account.account_holder_address || {}), state: value }; return; }
        if (targetField === "ah_original_postal_code") { account.account_holder_address = { ...(account.account_holder_address || {}), postal_code: value }; return; }
        if (targetField === "ah_original_country") { account.account_holder_address = { ...(account.account_holder_address || {}), country: value }; return; }
        if (targetField === "ah_current_street") { account.current_address = { ...(account.current_address || {}), street: value }; return; }
        if (targetField === "ah_current_city")   { account.current_address = { ...(account.current_address || {}), city: value }; return; }
        if (targetField === "ah_current_state")  { account.current_address = { ...(account.current_address || {}), state: value }; return; }
        if (targetField === "ah_current_postal_code") { account.current_address = { ...(account.current_address || {}), postal_code: value }; return; }
        if (targetField === "ah_current_country") { account.current_address = { ...(account.current_address || {}), country: value }; return; }
        if (targetField === "ah_country_of_residence") { account.country_of_residence = value; return; }
        // Skip auto-fill code columns
        return;
      }

      // Dot-notation fields used by auto-classification rules
      if (targetField === "account_holder_address.country") { account.account_holder_address = { ...(account.account_holder_address || {}), country: value }; return; }
      if (targetField === "current_address.country") { account.current_address = { ...(account.current_address || {}), country: value }; return; }

      // Self certification field key normalization
      if (targetField === "self_cert_requested") {
        account["self_certification_request_date"] = parseBool(value) ? (account["self_certification_request_date"] || new Date().toISOString().split("T")[0]) : null;
        return;
      }
      if (targetField === "self_cert_request_date") { account["self_certification_request_date"] = value; return; }
      if (targetField === "self_cert_obtained") { account["self_certification_obtained"] = parseBool(value); return; }
      if (targetField === "self_cert_date") { account["self_certification_date"] = value; return; }

      if (["year_end_cash_value", "gross_payments"].includes(targetField)) {
        account[targetField] = parseFloat(String(value).replace(/[,$]/g, "")) || null;
      } else if (targetField === "year_end_currency") {
        account["year_end_cash_value_currency"] = value;
      } else if (EXTRA_BOOL_FIELDS.has(targetField)) {
        account[targetField] = parseBool(value);
      } else if (targetField === "entity_id" || targetField === "entity_name_ref" || targetField === "skip") {
        // skip — entity_id is set from entity prop, entity_name_ref/skip are display-only
      } else if (targetField === "status") {
        // Normalize status to lowercase
        account[targetField] = String(value).toLowerCase().trim();
      } else if (targetField === "account_type") {
        // Normalize account_type labels to enum values
        const typeMap = {
          "depository account": "depository",
          "custodial account": "custodial",
          "equity interest in investment entity": "equity_debt_interest",
          "debt interest in investment entity": "equity_debt_interest",
          "equity or debt interest in investment entity": "equity_debt_interest",
          "equity or debt interest": "equity_debt_interest",
          "cash value insurance": "cash_value_insurance",
          "cash value insurance or annuity contract": "cash_value_insurance",
          "annuity contract": "annuity",
          "annuity": "annuity",
        };
        const normalized = typeMap[String(value).toLowerCase().trim()] || String(value).toLowerCase().trim();
        account[targetField] = normalized;
      } else {
        account[targetField] = value;
      }
    });

    // Normalize account_holder_type to lowercase
    if (account.account_holder_type) {
      account.account_holder_type = String(account.account_holder_type).toLowerCase().trim();
    }

    if (account.account_holder_type === "individual" && account.first_name && account.last_name) {
      account.account_holder_name = `${account.first_name} ${account.last_name}`.trim();
    }
    if (account.tax_residencies) account.tax_residencies = account.tax_residencies.filter(t => t?.country);

    // Build controlling person objects from flat cp data
    const controllingPersons = [];
    for (let n = 1; n <= 4; n++) {
    const cp = cpData[n];
    if (!cp.first_name && !cp.last_name) continue;
    const tax_residencies = [];
    if (cp.tax1_country) tax_residencies.push({ country: cp.tax1_country, tin: cp.tax1_tin || "" });
    if (cp.tax2_country) tax_residencies.push({ country: cp.tax2_country, tin: cp.tax2_tin || "" });
    const cpRecord = {
      tenant_id: tenant.id,
      first_name: (cp.first_name || "").trim(),
      last_name: (cp.last_name || "").trim(),
      full_name: `${(cp.first_name || "").trim()} ${(cp.last_name || "").trim()}`.trim(),
      date_of_birth: cp.date_of_birth || null,
      place_of_birth: cp.place_of_birth || null,
      place_of_birth_code: cp.place_of_birth_code || null,
      country_of_residence: cp.country_of_residence || null,
      country_of_residence_code: cp.country_of_residence_code || null,
      address: {
        street: cp.address_street || "",
        city: cp.address_city || "",
        state: cp.address_state || "",
        postal_code: cp.address_postal_code || "",
        country: cp.address_country || "",
      },
      tax_residencies,
      control_type: cp.control_type || null,
      ownership_percentage: cp.ownership_percentage ? parseFloat(cp.ownership_percentage) || null : null,
      self_certification_obtained: cp.self_cert_obtained ? parseBool(cp.self_cert_obtained) : false,
      self_certification_receipt_date: cp.self_cert_date || null,
      self_certification_request_date: cp.self_cert_request_date || null,
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