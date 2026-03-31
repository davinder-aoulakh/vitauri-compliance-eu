import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  FileCheck,
  Settings,
  FileSpreadsheet,
  Globe
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JURISDICTION_CONFIGS, generateFileName } from "./JurisdictionConfig";
import { generateMessageRefId, generateDocRefId, validateIdFormat } from "./idGenerator";
import XMLValidator from "./XMLValidator";
import ReportPreviewExport from "./ReportPreviewExport";
import NILReportGenerator from "./NILReportGenerator";
import TestModeGenerator from "./TestModeGenerator";

export default function XMLGenerator({ report, onSuccess }) {
  const [generating, setGenerating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [xmlContent, setXmlContent] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  
  // Data state
  const [accounts, setAccounts] = useState([]);
  const [entity, setEntity] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [controllingPersons, setControllingPersons] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Get jurisdiction config
  const jurisdictionConfig = JURISDICTION_CONFIGS[report?.reporting_jurisdiction] || JURISDICTION_CONFIGS["DEFAULT"];

  const loadReportData = async () => {
    try {
      // Fetch all related data
      const fetchedAccounts = await base44.entities.Account.filter({
        entity_id: report.entity_id,
        reportability_status: 'reportable'
      });
      setAccounts(fetchedAccounts.filter(a => 
        !a.reporting_year || a.reporting_year === report.reporting_year.toString()
      ));

      const entities = await base44.entities.Entity.list();
      const reportingEntity = entities.find(e => e.id === report.entity_id);
      setEntity(reportingEntity);

      const tenants = await base44.entities.Tenant.list();
      const reportingTenant = tenants.find(t => t.id === report.tenant_id);
      setTenant(reportingTenant);

      // Fetch controlling persons for passive NFE accounts
      const accountIds = fetchedAccounts.map(a => a.id);
      const allCPs = await base44.entities.ControllingPerson.filter({
        tenant_id: report.tenant_id
      });
      const filteredCPs = allCPs.filter(cp => 
        accountIds.includes(cp.account_id) && cp.is_reportable
      );
      setControllingPersons(filteredCPs);
      setDataLoaded(true);

      return { accounts: fetchedAccounts, entity: reportingEntity, tenant: reportingTenant, controllingPersons: filteredCPs };
    } catch (error) {
      console.error("Error loading report data:", error);
      throw error;
    }
  };

  const generateXML = async () => {
    setGenerating(true);
    try {
      const data = dataLoaded 
        ? { accounts, entity, tenant, controllingPersons }
        : await loadReportData();

      // Check for NIL report
      if (data.accounts.length === 0 || report.report_type === 'nil_report') {
        setActiveTab("nil");
        setGenerating(false);
        return;
      }

      // Generate XML content with jurisdiction config
      const xml = buildCRSXML({
        report,
        entity: data.entity,
        tenant: data.tenant,
        accounts: data.accounts,
        controllingPersons: data.controllingPersons,
        jurisdictionConfig
      });

      setXmlContent(xml);

      // Generate filename based on jurisdiction config
      const fileName = generateFileName(jurisdictionConfig.fileNamingPattern, {
        year: report.reporting_year,
        tin: data.entity?.tax_id,
        giin: data.entity?.giin,
        sequence: '001'
      });

      // Upload XML to storage
      const blob = new Blob([xml], { type: 'application/xml' });
      const file = new File([blob], fileName);
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Update report with XML URL
      await base44.entities.CRSReport.update(report.id, {
        xml_file_url: file_url,
        status: 'draft', // Keep as draft until validated
        summary_stats: {
          total_reportable_accounts: data.accounts.length,
          total_controlling_persons: data.controllingPersons.length,
          jurisdictions_reported: [...new Set(data.accounts.flatMap(a => 
            a.tax_residencies?.map(r => r.country) || []
          ))],
          total_account_balance: data.accounts.reduce((sum, a) => 
            sum + (a.year_end_cash_value || a.account_balance || 0), 0
          )
        }
      });

    } catch (error) {
      console.error("XML generation error:", error);
      alert("Failed to generate XML: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const buildCRSXML = ({ report, entity, tenant, accounts, controllingPersons, jurisdictionConfig }) => {
    // GAP 29: Timestamp must be YYYY-MM-DDTHH:MM:SS — no milliseconds, no Z
    const timestamp = new Date().toISOString().substring(0, 19);

    // CRIB number is entity.tax_id (used in all IDs per Annex 7)
    const cribNumber = entity?.tax_id || '';

    // GAP 4: MessageRefId format must be CW{YEAR}{CRIB}{SERIAL}
    const messageRefId = generateMessageRefId({
      fiscalYear: report.reporting_year,
      cribNumber: cribNumber,
      serialNumber: '001'
    });

    // Validate generated ID
    const validation = validateIdFormat(messageRefId, 'MessageRefId');
    if (!validation.isValid) {
      console.warn('MessageRefId validation warnings:', validation.errors);
    }

    // If is_test_supply is true, override MessageTypeIndic to CRS704 regardless of other settings
    const messageTypeIndic = report.is_test_supply ? 'CRS704' : (report.message_type_indic || 'CRS701');

    // GAP 31: SendingCompanyIN must be CRIB number — never 'UNKNOWN'
    const sendingCompanyIN = cribNumber;
    if (!sendingCompanyIN) {
      throw new Error('Cannot generate XML: CRIB number (tax_id) is missing for the Reporting FI. This is required as SendingCompanyIN.');
    }

    // GAP 1: Root element is FATCA_CRS Version="2.0" with FATCA-CRS v2.0 namespaces
    // GAP 2: TransmittingCountry and ReceivingCountry must always be 'CW'
    // GAP 3: MessageType must be 'FATCA-CRS'
    // GAP 5: CorrMessageRefId logic — only for CRS702, must NOT appear for CRS701
    const corrMessageRefIdXml = (() => {
      if (messageTypeIndic === 'CRS701') return ''; // Must NOT appear
      if (messageTypeIndic === 'CRS702') {
        if (!report.correction_message_ref_id) {
          throw new Error('CorrMessageRefId is mandatory for correction reports (CRS702) but is not set.');
        }
        return `<CorrMessageRefId>${report.correction_message_ref_id}</CorrMessageRefId>`;
      }
      return report.correction_message_ref_id
        ? `<CorrMessageRefId>${report.correction_message_ref_id}</CorrMessageRefId>`
        : '';
    })();

    // filer_category is optional — only include if set on the report
    const filerCategoryAttr = report.filer_category ? ` FilerCategory="${report.filer_category}"` : '';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<FATCA_CRS Version="2.0"${filerCategoryAttr}
  xmlns="urn:oecd:ties:fatcacrs:v2"
  xmlns:ftc="urn:oecd:ties:fatcacrstypes:v2"
  xmlns:stf="urn:oecd:ties:stffatcatypes:v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <MessageSpec>
    <SendingCompanyIN>${sendingCompanyIN}</SendingCompanyIN>
    <TransmittingCountry>CW</TransmittingCountry>
    <ReceivingCountry>CW</ReceivingCountry>
    <MessageType>FATCA-CRS</MessageType>
    <MessageRefId>${messageRefId}</MessageRefId>
    ${corrMessageRefIdXml}
    <MessageTypeIndic>${messageTypeIndic}</MessageTypeIndic>
    <ReportingPeriod>${report.reporting_year}-12-31</ReportingPeriod>
    <Timestamp>${timestamp}</Timestamp>
  </MessageSpec>
  
  <CrsBody>
    <ReportingFI>
      <ResCountryCode>CW</ResCountryCode>
      <TIN>${escapeXML(cribNumber)}</TIN>
      <Name>${escapeXML(entity.entity_name)}</Name>
      ${entity.address ? `
      <Address>
        <CountryCode>CW</CountryCode>
        ${entity.address.street ? `<AddressFree>${escapeXML(entity.address.street)}</AddressFree>` : ''}
        ${entity.address.city ? `<City>${escapeXML(entity.address.city)}</City>` : ''}
      </Address>
      ` : ''}
    </ReportingFI>
`;

    // Add account reports
    accounts.forEach((account, index) => {
      const accDocRefId = generateDocRefId({
        fiscalYear: report.reporting_year,
        cribNumber,
        serialNumber: String(index + 1),
        type: 'ACC'
      });

      // GAP 6: DocTypeIndic mapping — test supply uses OECD11/12/13, production uses OECD1/2/3
      let docTypeIndic;
      if (report.is_test_supply) {
        if (report.message_type_indic === 'CRS702') docTypeIndic = 'OECD12';
        else if (report.message_type_indic === 'CRS703') docTypeIndic = 'OECD13';
        else docTypeIndic = 'OECD11'; // CRS701 → OECD11
      } else {
        if (report.message_type_indic === 'CRS702') docTypeIndic = 'OECD2';
        else if (report.message_type_indic === 'CRS703') docTypeIndic = 'OECD3';
        else docTypeIndic = 'OECD1'; // CRS701 → OECD1
      }

      // GAP 30: CorrDocRefId must NOT appear for CRS701
      const corrDocRefIdXml = (() => {
        if (messageTypeIndic === 'CRS701') return '';
        if (messageTypeIndic === 'CRS702' && report.correction_doc_ref_id) {
          return `<CorrDocRefId>${report.correction_doc_ref_id}_ACC${String(index + 1).padStart(3, '0')}</CorrDocRefId>`;
        }
        return '';
      })();

      // GAP 26: ClosedAccount is an attribute on AccountNumber, not a child element
      const closedAttr = account.account_closed_during_period ? ' ClosedAccount="true"' : '';
      const accountNumberVal = account.account_number ? escapeXML(account.account_number) : 'NANUM';

      // GAP 25: AccountBalance is year-end value only, not summed with payments
      const balanceValue = Math.max(0, account.year_end_cash_value || 0).toFixed(2);
      const balanceCurrency = account.year_end_cash_value_currency || account.gross_payments_currency || 'USD';

      xml += `
    <AccountReport>
      <DocSpec>
        <DocTypeIndic>${docTypeIndic}</DocTypeIndic>
        <DocRefId>${accDocRefId}</DocRefId>
        ${corrDocRefIdXml}
      </DocSpec>
      
      <AccountNumber${closedAttr}>${accountNumberVal}</AccountNumber>
      
      <AccountHolder>
        ${account.account_holder_type === 'individual' ? `
        <Individual>
          <ResCountryCode>${account.account_holder_address?.country || 'CW'}</ResCountryCode>
          ${account.tax_residencies && account.tax_residencies.length > 0 ?
            account.tax_residencies.map(res => res.tin
              ? `<TIN IssuedBy="${res.country}">${escapeXML(res.tin)}</TIN>`
              : (res.country === 'US' ? `<TIN IssuedBy="US">000000000</TIN>` : '')
            ).join('') : ''}
          <Name>
            <FirstName>${escapeXML(account.first_name || (account.account_holder_name || '').split(' ')[0] || 'NFN')}</FirstName>
            <LastName>${escapeXML(account.last_name || (account.account_holder_name || '').split(' ').slice(1).join(' ') || 'NFN')}</LastName>
          </Name>
          ${account.account_holder_address ? `
          <Address>
            <CountryCode>${account.account_holder_address.country || 'CW'}</CountryCode>
            <AddressFix>
              ${account.account_holder_address.street ? `<Street>${escapeXML(account.account_holder_address.street)}</Street>` : ''}
              <City>${escapeXML(account.account_holder_address.city || '')}</City>
            </AddressFix>
          </Address>
          ` : ''}
          ${account.date_of_birth ? `<BirthInfo><BirthDate>${account.date_of_birth}</BirthDate></BirthInfo>` : ''}
        </Individual>
        ` : `
        <Organisation>
          <ResCountryCode>${account.account_holder_address?.country || 'CW'}</ResCountryCode>
          ${account.tax_residencies && account.tax_residencies.length > 0 ?
            account.tax_residencies.map(res => res.tin
              ? `<TIN IssuedBy="${res.country}">${escapeXML(res.tin)}</TIN>`
              : (res.country === 'US' ? `<TIN IssuedBy="US">000000000</TIN>` : '')
            ).join('') : ''}
          <Name>${escapeXML(account.account_holder_name)}</Name>
          ${account.account_holder_address ? `
          <Address>
            <CountryCode>${account.account_holder_address.country || 'CW'}</CountryCode>
            <AddressFix>
              ${account.account_holder_address.street ? `<Street>${escapeXML(account.account_holder_address.street)}</Street>` : ''}
              <City>${escapeXML(account.account_holder_address.city || '')}</City>
            </AddressFix>
          </Address>
          ` : ''}
        </Organisation>
        `}
      </AccountHolder>
      
      <AccountBalance currCode="${balanceCurrency}">${balanceValue}</AccountBalance>
`;

      // Add controlling persons for passive NFE accounts
      const accountCPs = controllingPersons.filter(cp => cp.account_id === account.id);
      accountCPs.forEach((cp) => {
        // GAP 21: Map control_type to CRS801-CRS813 codes
        const ctrlTypeMap = {
          legal_person_ownership: 'CRS801',
          legal_person_other_means: 'CRS802',
          legal_person_senior_managing_official: 'CRS803',
          trust_settlor: 'CRS804',
          trust_trustee: 'CRS805',
          trust_protector: 'CRS806',
          trust_beneficiary: 'CRS807',
          trust_other: 'CRS808',
          legal_arrangement_settlor_equivalent: 'CRS809',
          legal_arrangement_trustee_equivalent: 'CRS810',
          legal_arrangement_protector_equivalent: 'CRS811',
          legal_arrangement_beneficiary_equivalent: 'CRS812',
          legal_arrangement_other_equivalent: 'CRS813'
        };
        const ctrlgPersonType = cp.control_type ? (ctrlTypeMap[cp.control_type] || 'CRS801') : 'CRS801';

        xml += `
      <ControllingPerson>
        <Individual>
          ${cp.tax_residencies && cp.tax_residencies.length > 0 ?
            cp.tax_residencies.map(res => `
          <ResCountryCode>${res.country}</ResCountryCode>
          ${res.tin ? `<TIN IssuedBy="${res.country}">${escapeXML(res.tin)}</TIN>` : (res.country === 'US' ? `<TIN IssuedBy="US">000000000</TIN>` : '')}
          `).join('') : ''}
          <Name>
            <FirstName>${escapeXML(cp.first_name || (cp.full_name || '').split(' ')[0] || 'NFN')}</FirstName>
            <LastName>${escapeXML(cp.last_name || (cp.full_name || '').split(' ').slice(1).join(' ') || 'NFN')}</LastName>
          </Name>
          ${cp.address ? `
          <Address>
            <CountryCode>${cp.address.country || 'CW'}</CountryCode>
            <AddressFix>
              ${cp.address.street ? `<Street>${escapeXML(cp.address.street)}</Street>` : ''}
              ${cp.address.city ? `<City>${escapeXML(cp.address.city)}</City>` : ''}
            </AddressFix>
          </Address>
          ` : ''}
          ${cp.date_of_birth ? `<BirthInfo><BirthDate>${cp.date_of_birth}</BirthDate></BirthInfo>` : ''}
        </Individual>
        <CtrlgPersonType>${ctrlgPersonType}</CtrlgPersonType>
      </ControllingPerson>
`;
      });

      xml += `    </AccountReport>
`;
    });

    xml += `  </CrsBody>
</FATCA_CRS>`;

    return xml;
  };

  const escapeXML = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const handleValidationComplete = async (results) => {
    setValidationResults(results);
    
    // Update report validation results
    await base44.entities.CRSReport.update(report.id, {
      validation_results: results,
      status: results.is_valid ? 'validated' : 'draft'
    });

    if (results.is_valid) {
      onSuccess?.();
    }
  };

  const downloadXML = () => {
    if (!xmlContent) {
      alert("Please generate XML first");
      return;
    }

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CRS_${report.reporting_year}_${report.id}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  // Load data on mount
  React.useEffect(() => {
    if (report && !dataLoaded) {
      loadReportData();
    }
  }, [report]);

  return (
    <div className="space-y-6">
      {/* Jurisdiction Info Banner */}
      <Alert className="bg-blue-50 border-blue-200">
        <Globe className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>{jurisdictionConfig.name}</strong> - CRS XML Schema v{jurisdictionConfig.schemaVersion}
          {jurisdictionConfig.reportingDeadline && (
            <span className="ml-2 text-blue-700">• Deadline: {jurisdictionConfig.reportingDeadline}</span>
          )}
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="validate" className="flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Validate
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Preview & Export
          </TabsTrigger>
          <TabsTrigger value="nil" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            NIL Report
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Test Mode
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-600" />
                XML Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={generateXML}
                  disabled={generating}
                  className="h-24 flex flex-col gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-sm">Generating...</span>
                    </>
                  ) : xmlContent ? (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      <span className="text-sm">Regenerate XML</span>
                    </>
                  ) : (
                    <>
                      <FileCode className="w-6 h-6" />
                      <span className="text-sm">Generate XML</span>
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => setShowPreview(true)}
                  disabled={!xmlContent}
                  variant="outline"
                  className="h-24 flex flex-col gap-2 border-2"
                >
                  <Eye className="w-6 h-6" />
                  <span className="text-sm">Preview XML</span>
                </Button>

                <Button
                  onClick={downloadXML}
                  disabled={!xmlContent}
                  variant="outline"
                  className="h-24 flex flex-col gap-2 border-2 border-green-200 hover:bg-green-50"
                >
                  <Download className="w-6 h-6 text-green-600" />
                  <span className="text-sm">Download XML</span>
                </Button>
              </div>

              {xmlContent && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-600">File Size</p>
                    <p className="text-sm font-semibold">{(new Blob([xmlContent]).size / 1024).toFixed(2)} KB</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Accounts</p>
                    <p className="text-sm font-semibold">{accounts.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Status</p>
                    <Badge variant="outline" className={validationResults?.is_valid ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}>
                      {validationResults?.is_valid ? "Validated" : "Pending Validation"}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validate" className="mt-6">
          <XMLValidator
            xmlContent={xmlContent}
            report={report}
            accounts={accounts}
            controllingPersons={controllingPersons}
            entity={entity}
            onValidationComplete={handleValidationComplete}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <ReportPreviewExport
            report={report}
            entity={entity}
            accounts={accounts}
            controllingPersons={controllingPersons}
            validationResults={validationResults}
          />
        </TabsContent>

        <TabsContent value="nil" className="mt-6">
          <NILReportGenerator
            report={report}
            entity={entity}
            tenant={tenant}
            onSuccess={onSuccess}
          />
        </TabsContent>

        <TabsContent value="test" className="mt-6">
          <TestModeGenerator
            entity={entity}
            tenant={tenant}
            jurisdiction={report?.reporting_jurisdiction}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>XML Content Preview</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
              {xmlContent}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}