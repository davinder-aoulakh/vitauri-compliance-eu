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

const FIELD_GUIDE = [
  { col: "Entity ID", format: "Text (ID)", required: true, notes: "Exact ID of the RFI Entity this account belongs to" },
  { col: "Account Number", format: "Text", required: true, notes: "Unique account identifier" },
  { col: "Account Opening Date", format: "YYYY-MM-DD", required: true, notes: "e.g. 2020-01-15" },
  { col: "Account Type", format: "depository | custodial | equity_debt_interest | cash_value_insurance | annuity", required: true, notes: "Must be one of these exact values" },
  { col: "Account Holder Type", format: "individual | entity", required: true, notes: "Determines which fields are required" },
  { col: "First Name (Individual Only)", format: "Text", required: false, notes: "Required if Account Holder Type = individual" },
  { col: "Last Name (Individual Only)", format: "Text", required: false, notes: "Required if Account Holder Type = individual" },
  { col: "Account Holder Name (Entity Only)", format: "Text", required: false, notes: "Required if Account Holder Type = entity" },
  { col: "Date of Birth", format: "YYYY-MM-DD", required: false, notes: "Required for individuals" },
  { col: "Place of Birth", format: "Country name", required: false, notes: "Country of birth for individuals" },
  { col: "Pre-existing Account", format: "true | false", required: false, notes: "Account existed before Dec 31, 2015" },
  { col: "Account Holder Alive", format: "true | false", required: false, notes: "" },
  { col: "Deceased During Period", format: "true | false", required: false, notes: "" },
  { col: "Account Closed During Period", format: "true | false", required: false, notes: "" },
  { col: "Entity Classification", format: "financial_institution | active_nfe | passive_nfe | not_applicable", required: false, notes: "For entity account holders" },
  { col: "Year-end Cash Value", format: "Number", required: false, notes: "e.g. 50000" },
  { col: "Year-end Currency", format: "ISO code", required: false, notes: "e.g. USD, AUD, GBP" },
  { col: "Gross Payments", format: "Number", required: false, notes: "" },
  { col: "Gross Payments Currency", format: "ISO code", required: false, notes: "" },
  { col: "Reporting Year", format: "YYYY", required: false, notes: "e.g. 2024" },
  { col: "Current Email Address", format: "Email", required: true, notes: "Valid email format" },
  { col: "Current Phone Number", format: "Text", required: true, notes: "e.g. +12125551234" },
  { col: "Country of Residence", format: "Country name", required: false, notes: "" },
  { col: "Account Status", format: "active | closed | dormant", required: false, notes: "Defaults to active" },
  { col: "Tax Residency 1 Country", format: "Country name", required: false, notes: "Primary tax residency country" },
  { col: "Tax Residency 1 TIN", format: "Text", required: false, notes: "Tax identification number" },
  { col: "US Person Indicator", format: "true | false", required: false, notes: "FATCA US indicia flag" },
  { col: "Self Certification Obtained", format: "true | false", required: false, notes: "" },
  { col: "Self Certification Date", format: "YYYY-MM-DD", required: false, notes: "" },
];

export default function AIBulkImport({ 
  tenant, 
  entities, 
  importType = "Account",
  onComplete, 
  onCancel 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedEntityIds, setSelectedEntityIds] = useState(() => (entities || []).map(e => e.id));
  const [showFieldGuide, setShowFieldGuide] = useState(true);
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
  const [user, setUser] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);

  const downloadTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CRS Platform';
    workbook.created = new Date();

    const selectedEntities = (entities || []).filter(e => selectedEntityIds.includes(e.id));

    const styleHeader = (cell, required = false) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: required ? 'FF1E3A5F' : 'FF334155' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF4F46E5' } } };
    };

    if (importType === "Account") {
      // ── Sheet 2: Entity Reference ────────────────────────────────────────────
      const entitySheet = workbook.addWorksheet('Entity Reference', {
        properties: { tabColor: { argb: 'FF4F46E5' } }
      });
      entitySheet.columns = [
        { key: 'name', width: 42 },
        { key: 'id', width: 42 },
        { key: 'country', width: 24 },
        { key: 'type', width: 18 },
      ];
      ['Entity Name', 'Entity ID (use this in Accounts Data tab)', 'Country', 'Type'].forEach((text, i) => {
        const cell = entitySheet.getRow(1).getCell(i + 1);
        cell.value = text;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF3730A3' } } };
      });
      entitySheet.getRow(1).height = 28;
      (selectedEntities.length > 0 ? selectedEntities : []).forEach((e, i) => {
        const row = entitySheet.addRow([e.entity_name, e.id, e.country_of_incorporation || '', e.entity_type || '']);
        row.eachCell(cell => {
          cell.alignment = { vertical: 'middle' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF0F4FF' : 'FFFFFFFF' } };
        });
        row.height = 20;
      });
      entitySheet.views = [{ state: 'frozen', ySplit: 1 }];

      // ── Sheet 1: Accounts Data ───────────────────────────────────────────────
      const dataSheet = workbook.addWorksheet('Accounts Data', {
        properties: { tabColor: { argb: 'FF10B981' } }
      });

      const columns = [
        // col 1
        { header: 'Entity ID *', key: 'entity_id', width: 38, required: true, note: 'Select from dropdown — IDs are from the "Entity Reference" tab' },
        // col 2
        { header: 'Entity Name (auto-ref)', key: 'entity_name_ref', width: 30, required: false, note: 'For your reference only — not imported into the system' },
        // col 3
        { header: 'Account Number *', key: 'account_number', width: 22, required: true, note: 'Unique account identifier per entity' },
        // col 4
        { header: 'Account Opening Date *', key: 'account_creation_date', width: 24, required: true, note: 'Format: YYYY-MM-DD e.g. 2020-01-15' },
        // col 5
        { header: 'Account Type *', key: 'account_type', width: 26, required: true, note: 'Select from dropdown: depository | custodial | equity_debt_interest | cash_value_insurance | annuity' },
        // col 6
        { header: 'Account Holder Type *', key: 'account_holder_type', width: 24, required: true, note: 'Select from dropdown: individual | entity' },
        // col 7
        { header: 'First Name', key: 'first_name', width: 18, required: false, note: 'Required if Account Holder Type = individual' },
        // col 8
        { header: 'Last Name', key: 'last_name', width: 18, required: false, note: 'Required if Account Holder Type = individual' },
        // col 9
        { header: 'Account Holder Name (Entity)', key: 'account_holder_name', width: 30, required: false, note: 'Required if Account Holder Type = entity' },
        // col 10
        { header: 'Date of Birth', key: 'date_of_birth', width: 18, required: false, note: 'YYYY-MM-DD — Required for individuals' },
        // col 11
        { header: 'Place of Birth', key: 'place_of_birth', width: 20, required: false, note: 'Country name' },
        // col 12
        { header: 'Pre-existing Account', key: 'is_pre_existing', width: 22, required: false, note: 'true | false — account opened before Dec 31, 2015?' },
        // col 13
        { header: 'Account Holder Alive', key: 'account_holder_is_alive', width: 22, required: false, note: 'true | false' },
        // col 14
        { header: 'Deceased During Period', key: 'deceased_during_period', width: 24, required: false, note: 'true | false' },
        // col 15
        { header: 'Account Closed During Period', key: 'account_closed_during_period', width: 28, required: false, note: 'true | false' },
        // col 16-20: Account Holder Address
        { header: 'Acct Holder Address - Street', key: 'ah_street', width: 28, required: false, note: '' },
        { header: 'Acct Holder Address - City', key: 'ah_city', width: 22, required: false, note: '' },
        { header: 'Acct Holder Address - State', key: 'ah_state', width: 20, required: false, note: '' },
        { header: 'Acct Holder Address - Postal Code', key: 'ah_postal', width: 26, required: false, note: '' },
        { header: 'Acct Holder Address - Country', key: 'ah_country', width: 24, required: false, note: '' },
        // col 21-25: Current Address
        { header: 'Current Address - Street', key: 'curr_street', width: 26, required: false, note: '' },
        { header: 'Current Address - City', key: 'curr_city', width: 20, required: false, note: '' },
        { header: 'Current Address - State', key: 'curr_state', width: 20, required: false, note: '' },
        { header: 'Current Address - Postal Code', key: 'curr_postal', width: 24, required: false, note: '' },
        { header: 'Current Address - Country', key: 'curr_country', width: 22, required: false, note: '' },
        // col 26
        { header: 'Country of Residence', key: 'country_of_residence', width: 22, required: false, note: '' },
        // col 27
        { header: 'Current Email Address *', key: 'current_email', width: 28, required: true, note: 'Valid email format e.g. john@example.com' },
        // col 28
        { header: 'Current Phone Number *', key: 'current_phone', width: 22, required: true, note: 'e.g. +12125551234' },
        // col 29
        { header: 'Entity Classification', key: 'entity_classification', width: 26, required: false, note: 'Select from dropdown: financial_institution | active_nfe | passive_nfe | not_applicable' },
        // col 30
        { header: 'Year-end Cash Value', key: 'year_end_cash_value', width: 22, required: false, note: 'Number e.g. 50000' },
        // col 31
        { header: 'Year-end Currency', key: 'year_end_currency', width: 20, required: false, note: 'ISO code e.g. USD, AUD, GBP' },
        // col 32
        { header: 'Gross Payments', key: 'gross_payments', width: 18, required: false, note: 'Number' },
        // col 33
        { header: 'Gross Payments Currency', key: 'gross_payments_currency', width: 24, required: false, note: 'ISO code' },
        // col 34
        { header: 'Reporting Year', key: 'reporting_year', width: 18, required: false, note: 'YYYY e.g. 2024' },
        // col 35
        { header: 'US Person Indicator', key: 'us_person_indic', width: 22, required: false, note: 'true | false (FATCA flag)' },
        // col 36
        { header: 'Self Certification Obtained', key: 'self_cert_obtained', width: 28, required: false, note: 'true | false' },
        // col 37
        { header: 'Self Certification Date', key: 'self_cert_date', width: 24, required: false, note: 'YYYY-MM-DD' },
        // col 38
        { header: 'Account Status', key: 'status', width: 18, required: false, note: 'Select from dropdown: active | closed | dormant — defaults to active' },
        // col 39-42: Tax Residencies
        { header: 'Tax Residency 1 - Country', key: 'tax1_country', width: 26, required: false, note: 'Country name' },
        { header: 'Tax Residency 1 - TIN', key: 'tax1_tin', width: 22, required: false, note: 'Tax identification number' },
        { header: 'Tax Residency 2 - Country', key: 'tax2_country', width: 26, required: false, note: '' },
        { header: 'Tax Residency 2 - TIN', key: 'tax2_tin', width: 22, required: false, note: '' },
      ];

      dataSheet.columns = columns.map(c => ({ key: c.key, width: c.width }));
      const headerRow = dataSheet.getRow(1);
      columns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        styleHeader(cell, col.required);
        if (col.note) cell.note = { texts: [{ text: col.note }] };
      });
      headerRow.height = 28;
      dataSheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }];

      // Example rows
      const examples = (selectedEntities.length > 0 ? selectedEntities.slice(0, 3) : [null]).map((entity, i) => ({
        entity_id: entity?.id || 'PASTE_ENTITY_ID',
        entity_name_ref: entity?.entity_name || 'See Entity Reference tab',
        account_number: `ACC-00${i + 1}`,
        account_creation_date: '2020-01-15',
        account_type: 'depository',
        account_holder_type: 'individual',
        first_name: ['John', 'Jane', 'Robert'][i] || 'John',
        last_name: ['Smith', 'Doe', 'Johnson'][i] || 'Smith',
        account_holder_name: '',
        date_of_birth: ['1985-06-15', '1990-03-22', '1978-11-08'][i] || '1985-06-15',
        place_of_birth: ['United States', 'United Kingdom', 'Australia'][i] || 'United States',
        is_pre_existing: 'false', account_holder_is_alive: 'true',
        deceased_during_period: 'false', account_closed_during_period: 'false',
        ah_street: '123 Main St', ah_city: ['New York', 'London', 'Sydney'][i] || 'New York',
        ah_state: ['NY', '', 'NSW'][i] || '', ah_postal: ['10001', 'SW1A 1AA', '2000'][i] || '10001',
        ah_country: ['United States', 'United Kingdom', 'Australia'][i] || 'United States',
        curr_street: '123 Main St', curr_city: ['New York', 'London', 'Sydney'][i] || 'New York',
        curr_state: ['NY', '', 'NSW'][i] || '', curr_postal: ['10001', 'SW1A 1AA', '2000'][i] || '10001',
        curr_country: ['United States', 'United Kingdom', 'Australia'][i] || 'United States',
        country_of_residence: ['United States', 'United Kingdom', 'Australia'][i] || 'United States',
        current_email: [`john@example.com`, `jane@example.com`, `robert@example.com`][i],
        current_phone: ['+12125551234', '+442075551234', '+61298765432'][i],
        entity_classification: 'not_applicable',
        year_end_cash_value: [50000, 75000, 120000][i],
        year_end_currency: ['USD', 'GBP', 'AUD'][i],
        gross_payments: [5000, 10000, 15000][i],
        gross_payments_currency: ['USD', 'GBP', 'AUD'][i],
        reporting_year: '2024',
        us_person_indic: 'false', self_cert_obtained: 'false', self_cert_date: '',
        status: 'active',
        tax1_country: ['United States', 'United Kingdom', 'Australia'][i] || '',
        tax1_tin: ['123-45-6789', 'AB123456C', '123456789'][i] || '',
        tax2_country: '', tax2_tin: '',
      }));

      examples.forEach((data, i) => {
        const rowValues = columns.map(c => data[c.key] ?? '');
        const row = dataSheet.addRow(rowValues);
        row.eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle' };
        });
        row.height = 20;
      });

      // ── Data Validations ─────────────────────────────────────────────────────
      const MAX_ROW = 502;
      for (let row = 2; row <= MAX_ROW; row++) {
        // Entity ID dropdown from Entity Reference tab col B
        if (selectedEntities.length > 0) {
          dataSheet.getCell(row, 1).dataValidation = {
            type: 'list', allowBlank: false,
            formulae: [`'Entity Reference'!$B$2:$B$${selectedEntities.length + 1}`],
            showErrorMessage: true, errorTitle: 'Invalid Entity ID',
            error: 'Select a valid Entity ID from the dropdown (sourced from the Entity Reference tab)'
          };
        }
        // Account Type
        dataSheet.getCell(row, 5).dataValidation = {
          type: 'list', allowBlank: true,
          formulae: ['"depository,custodial,equity_debt_interest,cash_value_insurance,annuity"'],
          showErrorMessage: true, errorTitle: 'Invalid Account Type',
          error: 'Must be one of: depository, custodial, equity_debt_interest, cash_value_insurance, annuity'
        };
        // Account Holder Type
        dataSheet.getCell(row, 6).dataValidation = {
          type: 'list', allowBlank: true, formulae: ['"individual,entity"'],
          showErrorMessage: true, errorTitle: 'Invalid Holder Type', error: 'Must be: individual or entity'
        };
        // Boolean fields: 12,13,14,15,35,36
        [12, 13, 14, 15, 35, 36].forEach(col => {
          dataSheet.getCell(row, col).dataValidation = { type: 'list', allowBlank: true, formulae: ['"true,false"'] };
        });
        // Entity Classification col 29
        dataSheet.getCell(row, 29).dataValidation = {
          type: 'list', allowBlank: true,
          formulae: ['"financial_institution,active_nfe,passive_nfe,not_applicable"']
        };
        // Account Status col 38
        dataSheet.getCell(row, 38).dataValidation = {
          type: 'list', allowBlank: true, formulae: ['"active,closed,dormant"']
        };
      }

      // ── Sheet 3: Field Guide ─────────────────────────────────────────────────
      const guideSheet = workbook.addWorksheet('Field Guide', {
        properties: { tabColor: { argb: 'FFF59E0B' } }
      });
      guideSheet.columns = [
        { key: 'col', width: 35 }, { key: 'format', width: 55 },
        { key: 'required', width: 12 }, { key: 'notes', width: 55 },
      ];
      const guideHeaderRow = guideSheet.getRow(1);
      ['Column Name', 'Format / Allowed Values', 'Required?', 'Notes & Tips'].forEach((text, i) => {
        const cell = guideHeaderRow.getCell(i + 1);
        cell.value = text;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
        cell.font = { bold: true, color: { argb: 'FF1C1917' }, size: 11 };
        cell.alignment = { vertical: 'middle' };
      });
      guideHeaderRow.height = 25;
      FIELD_GUIDE.forEach((f, i) => {
        const row = guideSheet.addRow([f.col, f.format, f.required ? '✓ Yes' : 'No', f.notes]);
        row.getCell(1).font = { bold: true };
        row.getCell(3).font = { color: { argb: f.required ? 'FFDC2626' : 'FF64748B' } };
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFEF3C7' : 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', wrapText: true };
        });
        row.height = 18;
      });
      guideSheet.views = [{ state: 'frozen', ySplit: 1 }];

    } else {
      // ── Entity Template ──────────────────────────────────────────────────────
      const sheet = workbook.addWorksheet('Entities Data', { properties: { tabColor: { argb: 'FF10B981' } } });
      const cols = [
        { header: 'Entity Name *', key: 'entity_name', width: 35, required: true },
        { header: 'Entity Type *', key: 'entity_type', width: 22, required: true },
        { header: 'Country of Incorporation *', key: 'country_of_incorporation', width: 28, required: true },
        { header: 'Tax ID', key: 'tax_id', width: 18, required: false },
        { header: 'GIIN', key: 'giin', width: 22, required: false },
        { header: 'Street Address', key: 'street', width: 30, required: false },
        { header: 'City', key: 'city', width: 20, required: false },
        { header: 'State/Province', key: 'state', width: 18, required: false },
        { header: 'Postal Code', key: 'postal_code', width: 15, required: false },
        { header: 'Country', key: 'country', width: 20, required: false },
      ];
      sheet.columns = cols.map(c => ({ key: c.key, width: c.width }));
      const hRow = sheet.getRow(1);
      cols.forEach((col, i) => { styleHeader(hRow.getCell(i + 1), col.required); hRow.getCell(i + 1).value = col.header; });
      hRow.height = 25;
      const exRow = sheet.addRow(['ACME Corp', 'corporation', 'United States', '12-3456789', 'ABCDEF.00000.SL.840', '123 Business Ave', 'New York', 'NY', '10001', 'United States']);
      exRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }; });
      for (let row = 2; row <= 502; row++) {
        sheet.getCell(row, 2).dataValidation = { type: 'list', allowBlank: true, formulae: ['"corporation,trust,partnership,fund,branch,other"'] };
      }
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType.toLowerCase()}_import_template.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const isCsv = selectedFile.name.endsWith('.csv');
    
    if (!isExcel && !isCsv) {
      setErrors(['Please select a CSV or Excel (.xlsx) file']);
      return;
    }
    
    setFile(selectedFile);
    setErrors([]);
    
    // Audit trail upload
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setUploadedFileUrl(file_url);
      await base44.entities.AuditLog.create({
        tenant_id: tenant.id, action_type: "bulk_import_initiated",
        actor_email: currentUser.email, actor_role: currentUser.user_role,
        target_entity_type: importType, target_entity_name: selectedFile.name,
        file_url, changes: { file_name: selectedFile.name, file_size: selectedFile.size, import_type: importType },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error uploading file or creating audit log:", error);
    }

    let headers = [], data = [];

    if (isExcel) {
      // Parse Excel — read the first sheet whose name contains "Data" or the first sheet
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const buffer = await selectedFile.arrayBuffer();
      await workbook.xlsx.load(buffer);

      // Pick the data sheet: prefer "Accounts Data" / "Entities Data", fallback to first
      let sheet = workbook.worksheets.find(s => s.name.toLowerCase().includes('data')) || workbook.worksheets[0];
      
      const rows = [];
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const values = [];
        row.eachCell({ includeEmpty: true }, cell => {
          let v = cell.value;
          // ExcelJS returns rich text objects for some cells
          if (v && typeof v === 'object' && v.richText) v = v.richText.map(r => r.text).join('');
          else if (v && typeof v === 'object' && v.text) v = v.text;
          else if (v instanceof Date) v = v.toISOString().split('T')[0];
          values.push(v == null ? '' : String(v));
        });
        rows.push(values);
      });

      if (rows.length < 2) { setErrors(['No data rows found in the Excel file']); return; }
      headers = rows[0];
      data = rows.slice(1).filter(r => r.some(v => v !== '')).map(values => {
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i] || ''; });
        return row;
      });
      // Filter out the "Entity Name (auto-ref)" helper column — not a real import field
      headers = headers.filter(h => h !== 'Entity Name (auto-ref)');
      data = data.map(r => { const copy = { ...r }; delete copy['Entity Name (auto-ref)']; return copy; });
    } else {
      // Parse CSV
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
      if (lines.length < 2) { setErrors(['File must have at least a header row and one data row']); return; }
      headers = parseCSVLine(lines[0]);
      data = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i] || ''; });
        return row;
      });
    }
    
    setCsvHeaders(headers);
    setCsvData(data);
    setCurrentStep(1);
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
        } else if (targetField.startsWith('account_holder_')) {
          // Handle account_holder_address fields
          const addressField = targetField.replace('account_holder_', '');
          if (['street', 'city', 'state', 'postal_code', 'country'].includes(addressField)) {
            if (!account.account_holder_address) account.account_holder_address = {};
            account.account_holder_address[addressField] = value;
          } else {
            account[targetField] = value;
          }
        } else if (targetField.startsWith('current_')) {
          // Handle current_address fields
          const addressField = targetField.replace('current_', '');
          if (['street', 'city', 'state', 'postal_code', 'country'].includes(addressField)) {
            if (!account.current_address) account.current_address = {};
            account.current_address[addressField] = value;
          } else {
            account[targetField] = value;
          }
        } else if (['year_end_cash_value', 'gross_payments'].includes(targetField)) {
          account[targetField] = parseFloat(value?.replace(/[,$]/g, '')) || 0;
        } else if ([
          'is_pre_existing', 'account_holder_is_alive', 'account_holder_deceased_during_period',
          'account_closed_during_period', 'death_certificate_requested', 'death_certificate_received',
          'will_or_inheritance_requested', 'will_or_inheritance_received', 'legacy_of_deceased_settled',
          'entity_managed_by_fiduciary_trust', 'entity_managed_by_asset_manager',
          'gross_income_from_financial_assets', 'us_person_indic', 'self_certification_obtained'
        ].includes(targetField)) {
          const lower = String(value).toLowerCase().trim();
          account[targetField] = ['true', 'yes', '1', 'y'].includes(lower);
        } else {
          account[targetField] = value;
        }
      });
      
      // For individual accounts, construct account_holder_name from first_name and last_name
      if (account.account_holder_type === 'individual' && account.first_name && account.last_name) {
        account.account_holder_name = `${account.first_name} ${account.last_name}`.trim();
      }
      
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

  const validateRecord = (record, rowData) => {
    const errors = [];
    
    if (importType === "Account") {
      // Required fields validation
      if (!record.entity_id) errors.push("Missing Entity ID");
      if (!record.account_number) errors.push("Missing Account Number");
      if (!record.account_creation_date) errors.push("Missing Account Opening Date");
      if (!record.current_email) errors.push("Missing Current Email Address");
      if (!record.current_phone) errors.push("Missing Current Phone Number");
      
      // Email format validation
      if (record.current_email && !record.current_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        errors.push("Invalid email format");
      }
      
      // Date format validation
      if (record.account_creation_date && isNaN(Date.parse(record.account_creation_date))) {
        errors.push("Invalid Account Opening Date format");
      }
      
      // Individual-specific validations
      if (record.account_holder_type === 'individual') {
        if (!record.first_name) errors.push("Missing First Name (required for individuals)");
        if (!record.last_name) errors.push("Missing Last Name (required for individuals)");
        if (!record.date_of_birth) errors.push("Missing Date of Birth (required for individuals)");
        if (!record.place_of_birth) errors.push("Missing Place of Birth (required for individuals)");
      }
      
      // Entity-specific validations
      if (record.account_holder_type === 'entity') {
        if (!record.account_holder_name) errors.push("Missing Account Holder Name (required for entities)");
      }
    } else {
      // Entity validations
      if (!record.entity_name) errors.push("Missing Entity Name");
      if (!record.country_of_incorporation) errors.push("Missing Country of Incorporation");
    }
    
    return errors;
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
        const rowData = dataToImport[i];
        let recordName = '';
        
        try {
          const record = convertToEntity(rowData);
          recordName = record.account_holder_name || record.entity_name || `Row ${i + 2}`;
          
          // Validate before attempting to save
          const validationErrors = validateRecord(record, rowData);
          if (validationErrors.length > 0) {
            failed.push({ 
              row: i + 2, 
              name: recordName,
              error: validationErrors.join('; '),
              data: rowData,
              type: 'validation'
            });
            setProgress(Math.round(((i + 1) / dataToImport.length) * 100));
            continue;
          }
          
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
              // Trigger auto-classification for updated account
              try {
                await base44.functions.invoke('autoClassifyAccount', {
                  accountId: existing.id,
                  event_type: 'updated'
                });
              } catch (error) {
                console.error('Auto-classification failed for updated account:', error);
              }
            } else {
              await base44.entities.Entity.update(existing.id, record);
            }
            updated.push({ 
              row: i + 2, 
              name: recordName,
              action: 'updated',
              id: existing.id
            });
          } else {
            // Create
            let newRecord;
            if (importType === "Account") {
              newRecord = await base44.entities.Account.create(record);
              // Trigger auto-classification for new account
              try {
                await base44.functions.invoke('autoClassifyAccount', {
                  accountId: newRecord.id,
                  event_type: 'created'
                });
              } catch (error) {
                console.error('Auto-classification failed for new account:', error);
              }
            } else {
              newRecord = await base44.entities.Entity.create(record);
            }
            imported.push({ 
              row: i + 2, 
              name: recordName,
              action: 'created',
              id: newRecord.id
            });
          }
        } catch (err) {
          // Parse error message for more specific feedback
          let errorMsg = err.message;
          let errorType = 'database';
          
          if (errorMsg.includes('duplicate') || errorMsg.includes('unique')) {
            errorType = 'duplicate';
            errorMsg = 'Duplicate record detected';
          } else if (errorMsg.includes('foreign key') || errorMsg.includes('reference')) {
            errorType = 'reference';
            errorMsg = 'Invalid reference (e.g., Entity ID not found)';
          } else if (errorMsg.includes('required') || errorMsg.includes('null')) {
            errorType = 'missing_field';
            errorMsg = 'Missing required field: ' + errorMsg;
          }
          
          failed.push({ 
            row: i + 2, 
            name: recordName,
            error: errorMsg,
            data: rowData,
            type: errorType,
            fullError: err.message
          });
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
      
      // Create audit log entry for bulk import completion
      const currentUser = user || await base44.auth.me();
      const isSuccess = failed.length === 0;
      
      await base44.entities.AuditLog.create({
        tenant_id: tenant.id,
        action_type: isSuccess ? "bulk_import_completed" : "bulk_import_failed",
        actor_email: currentUser.email,
        actor_role: currentUser.user_role,
        target_entity_type: importType,
        target_entity_name: file?.name || "Bulk Import",
        file_url: uploadedFileUrl,
        changes: {
          file_name: file?.name,
          total_records: dataToImport.length,
          created: imported.length,
          updated: updated.length,
          failed: failed.length,
          success_rate: `${Math.round(((imported.length + updated.length) / dataToImport.length) * 100)}%`,
          imported_records: imported.map(r => ({ row: r.row, name: r.name })),
          updated_records: updated.map(r => ({ row: r.row, name: r.name })),
          failed_records: failed.map(f => ({ row: f.row, name: f.name, error: f.error, type: f.type }))
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setErrors([err.message]);
      
      // Create audit log entry for import failure
      try {
        const currentUser = user || await base44.auth.me();
        await base44.entities.AuditLog.create({
          tenant_id: tenant.id,
          action_type: "bulk_import_failed",
          actor_email: currentUser.email,
          actor_role: currentUser.user_role,
          target_entity_type: importType,
          target_entity_name: file?.name || "Bulk Import",
          file_url: uploadedFileUrl,
          changes: {
            file_name: file?.name,
            error: err.message,
            stack_trace: err.stack
          },
          timestamp: new Date().toISOString()
        });
      } catch (auditError) {
        console.error("Error creating audit log for failed import:", auditError);
      }
    } finally {
      setImporting(false);
    }
  };

  const getSampleData = () => {
    return csvData.slice(0, 5).map(row => 
      csvHeaders.map(h => row[h] || '')
    );
  };

  const downloadErrorReport = () => {
    if (!results || results.failedRecords.length === 0) return;
    
    // Create CSV with original data + error column
    const errorData = results.failedRecords.map(failure => {
      const originalRow = failure.data || csvData[failure.row - 2];
      return {
        ...originalRow,
        'ERROR_TYPE': failure.type || 'unknown',
        'ERROR_DETAILS': failure.error,
        'ROW_NUMBER': failure.row
      };
    });
    
    // Generate CSV
    const headers = [...csvHeaders, 'ERROR_TYPE', 'ERROR_DETAILS', 'ROW_NUMBER'];
    const csvContent = [
      headers.join(','),
      ...errorData.map(row => 
        headers.map(h => {
          const value = row[h] || '';
          // Escape commas and quotes
          return value.toString().includes(',') || value.toString().includes('"') 
            ? `"${value.toString().replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType.toLowerCase()}_import_errors_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const getErrorTypeLabel = (type) => {
    const labels = {
      validation: 'Validation Error',
      duplicate: 'Duplicate Record',
      reference: 'Invalid Reference',
      missing_field: 'Missing Field',
      database: 'Database Error',
      unknown: 'Unknown Error'
    };
    return labels[type] || labels.unknown;
  };

  const getErrorTypeColor = (type) => {
    const colors = {
      validation: 'bg-amber-100 text-amber-800 border-amber-200',
      duplicate: 'bg-blue-100 text-blue-800 border-blue-200',
      reference: 'bg-purple-100 text-purple-800 border-purple-200',
      missing_field: 'bg-red-100 text-red-800 border-red-200',
      database: 'bg-slate-100 text-slate-800 border-slate-200',
      unknown: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    return colors[type] || colors.unknown;
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
            <CardContent className="space-y-4">
              {/* Entity selector — Account imports only */}
              {importType === "Account" && entities && entities.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Select entities to include in template:</p>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setSelectedEntityIds(entities.map(e => e.id))} className="text-indigo-600 hover:underline">All</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={() => setSelectedEntityIds([])} className="text-slate-500 hover:underline">None</button>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-44 overflow-y-auto">
                    {entities.map(e => (
                      <label key={e.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEntityIds.includes(e.id)}
                          onChange={() => setSelectedEntityIds(prev =>
                            prev.includes(e.id) ? prev.filter(id => id !== e.id) : [...prev, e.id]
                          )}
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{e.entity_name}</p>
                          <p className="text-xs text-slate-400 font-mono">{e.id}</p>
                        </div>
                        {selectedEntityIds.includes(e.id) && (
                          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 shrink-0 text-xs">included</Badge>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">{selectedEntityIds.length} of {entities.length} selected — their real IDs will appear as example rows.</p>
                </div>
              )}

              <Button
                onClick={downloadTemplate}
                disabled={importType === "Account" && selectedEntityIds.length === 0 && entities?.length > 0}
                variant="outline"
                className="w-full"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Download {importType} Template
              </Button>

              {/* Field Guide */}
              {importType === "Account" && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
                    onClick={() => setShowFieldGuide(p => !p)}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                      <Info className="w-4 h-4" />
                      📋 Field Reference Guide — What goes in each column?
                    </span>
                    <span className="text-indigo-600 text-xs">{showFieldGuide ? 'Hide ▲' : 'Show ▼'}</span>
                  </button>
                  {showFieldGuide && (
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Column</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Format / Values</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Required</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {FIELD_GUIDE.map((f, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{f.col}</td>
                              <td className="px-3 py-2 text-slate-600 font-mono">{f.format}</td>
                              <td className="px-3 py-2">
                                {f.required
                                  ? <span className="text-red-600 font-semibold">Yes</span>
                                  : <span className="text-slate-400">No</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-500">{f.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
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
        <div className="space-y-6">
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

              {/* Detailed Tabs */}
              <Tabs defaultValue={results.failed > 0 ? "failed" : "imported"} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="imported">
                    Created ({results.imported})
                  </TabsTrigger>
                  <TabsTrigger value="updated">
                    Updated ({results.updated})
                  </TabsTrigger>
                  <TabsTrigger value="failed">
                    Failed ({results.failed})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="imported" className="space-y-3 mt-4">
                  {results.importedRecords.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-4">No records were created</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {results.importedRecords.map((record, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-900 truncate">{record.name}</p>
                            <p className="text-xs text-green-700">Row {record.row}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="updated" className="space-y-3 mt-4">
                  {results.updatedRecords.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-4">No records were updated</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {results.updatedRecords.map((record, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-amber-900 truncate">{record.name}</p>
                            <p className="text-xs text-amber-700">Row {record.row}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="failed" className="space-y-3 mt-4">
                  {results.failedRecords.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-4">No errors - all records processed successfully!</p>
                  ) : (
                    <>
                      <Alert className="bg-red-50 border-red-200">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <AlertDescription className="text-sm text-red-900">
                          {results.failed} record{results.failed !== 1 ? 's' : ''} failed to import. 
                          Review the errors below and download the error report to fix and re-import.
                        </AlertDescription>
                      </Alert>

                      <Button
                        onClick={downloadErrorReport}
                        variant="outline"
                        className="w-full border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Error Report (CSV)
                      </Button>

                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {results.failedRecords.map((failure, idx) => (
                          <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                            <div className="flex items-start gap-3">
                              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-red-900 truncate">
                                    {failure.name}
                                  </p>
                                  <Badge className={getErrorTypeColor(failure.type)}>
                                    {getErrorTypeLabel(failure.type)}
                                  </Badge>
                                </div>
                                <p className="text-xs text-red-700 mb-1">Row {failure.row}</p>
                                <p className="text-sm text-red-800">{failure.error}</p>
                                {failure.fullError && failure.fullError !== failure.error && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-red-600 cursor-pointer hover:underline">
                                      View full error details
                                    </summary>
                                    <p className="text-xs text-red-700 mt-1 p-2 bg-red-100 rounded border border-red-200 font-mono">
                                      {failure.fullError}
                                    </p>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 pt-4 border-t">
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
        </div>
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