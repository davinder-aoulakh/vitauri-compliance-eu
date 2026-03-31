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
import TestModeGenerator from "./TestModeGenerator";

export default function XMLGenerator({ report, onSuccess }) {
  const [generating, setGenerating] = useState(false);
  const [xmlContent, setXmlContent] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  const [isNilReport, setIsNilReport] = useState(false);

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
      const fetchedAccounts = await base44.entities.Account.filter({
        entity_id: report.entity_id,
        reportability_status: 'reportable'
      });
      const filteredAccounts = fetchedAccounts.filter(a =>
        !a.reporting_year || a.reporting_year === report.reporting_year.toString()
      );
      setAccounts(filteredAccounts);

      const entities = await base44.entities.Entity.list();
      const reportingEntity = entities.find(e => e.id === report.entity_id);
      setEntity(reportingEntity);

      const tenants = await base44.entities.Tenant.list();
      const reportingTenant = tenants.find(t => t.id === report.tenant_id);
      setTenant(reportingTenant);

      const accountIds = fetchedAccounts.map(a => a.id);
      const allCPs = await base44.entities.ControllingPerson.filter({
        tenant_id: report.tenant_id
      });
      const filteredCPs = allCPs.filter(cp =>
        accountIds.includes(cp.account_id) && cp.is_reportable
      );
      setControllingPersons(filteredCPs);
      setDataLoaded(true);

      return { accounts: filteredAccounts, entity: reportingEntity, tenant: reportingTenant, controllingPersons: filteredCPs };
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

      // GAP 13: Determine if this is a NIL report scenario inline
      const nilScenario = data.accounts.length === 0 || report.report_type === 'nil_report';
      setIsNilReport(nilScenario);

      const xml = buildCRSXML({
        report,
        entity: data.entity,
        tenant: data.tenant,
        accounts: data.accounts,
        controllingPersons: data.controllingPersons,
        jurisdictionConfig,
        isNilReport: nilScenario
      });

      setXmlContent(xml);

      const fileName = generateFileName(jurisdictionConfig.fileNamingPattern, {
        year: report.reporting_year,
        tin: data.entity?.tax_id,
        giin: data.entity?.giin,
        sequence: '001'
      });

      const blob = new Blob([xml], { type: 'application/xml' });
      const file = new File([blob], nilScenario ? fileName.replace('.xml', '_NIL.xml') : fileName);

      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      await base44.entities.CRSReport.update(report.id, {
        xml_file_url: file_url,
        status: nilScenario ? 'validated' : 'draft',
        ...(nilScenario ? {
          report_type: 'nil_report',
          validation_results: {
            is_valid: true,
            errors: [],
            warnings: [],
            validated_date: new Date().toISOString()
          }
        } : {}),
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

      if (nilScenario) onSuccess?.();

    } catch (error) {
      console.error("XML generation error:", error);
      alert("Failed to generate XML: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const buildCRSXML = ({ report, entity, tenant, accounts, controllingPersons, jurisdictionConfig, isNilReport }) => {
    // GAP 29: Timestamp must be YYYY-MM-DDTHH:MM:SS — no milliseconds, no Z
    const timestamp = new Date().toISOString().substring(0, 19);

    const cribNumber = entity?.tax_id || '';

    // GAP 4: MessageRefId format
    const messageRefId = generateMessageRefId({
      fiscalYear: report.reporting_year,
      cribNumber,
      serialNumber: '001'
    });

    const validation = validateIdFormat(messageRefId, 'MessageRefId');
    if (!validation.isValid) {
      console.warn('MessageRefId validation warnings:', validation.errors);
    }

    // GAP 13: NIL reports must use CRS703. Test supply overrides to CRS704.
    let messageTypeIndic;
    if (report.is_test_supply) {
      messageTypeIndic = 'CRS704';
    } else if (isNilReport) {
      messageTypeIndic = 'CRS703';
    } else {
      messageTypeIndic = report.message_type_indic || 'CRS701';
    }

    // GAP 31: SendingCompanyIN must be CRIB number
    const sendingCompanyIN = cribNumber;
    if (!sendingCompanyIN) {
      throw new Error('Cannot generate XML: CRIB number (tax_id) is missing for the Reporting FI.');
    }

    // GAP 8: TIN logic
    const isFfi = entity?.is_ffi === true;
    const tinValue = isFfi ? entity?.giin : cribNumber;
    const tinIssuedBy = isFfi ? 'US' : 'CW';
    if (!tinValue) {
      throw new Error(
        isFfi
          ? 'Cannot generate XML: GIIN is missing for this FFI ReportingFI.'
          : 'Cannot generate XML: CRIB number (tax_id) is missing for this ReportingFI.'
      );
    }

    // GAP 11: FilerCategory
    const FATCA_FILER_CATEGORY_MAP = {
      "Participating FFI (standard FATCA-registered institution)": "FATCA601",
      "Registered Deemed-Compliant FFI": "FATCA602",
      "Limited FFI or Limited Branch": "FATCA603",
      "Qualified Intermediary / Withholding Foreign Partnership or Trust": "FATCA605",
      "Direct Reporting NFFE": "FATCA606",
      "Reporting Model 1 FFI / Withholding Agent": "FATCA610"
    };
    let filerCategoryXml = '';
    if (isFfi && !entity?.is_sponsored_ffi) {
      if (!entity?.fi_registration_type) {
        throw new Error(`Please select the institution registration type for "${entity?.entity_name}" before generating the report.`);
      }
      const fatcaCode = FATCA_FILER_CATEGORY_MAP[entity.fi_registration_type];
      if (fatcaCode) {
        filerCategoryXml = `\n    <FilerCategory>${fatcaCode}</FilerCategory>`;
      }
    }

    // GAP 12: ReportingFI DocSpec
    const fiDocRefId = generateDocRefId({
      fiscalYear: report.reporting_year,
      cribNumber,
      serialNumber: '001',
      type: 'FI'
    });

    // DocTypeIndic mapping — test supply uses OECD11/12/13, production uses OECD1/2/3
    // GAP 13: NilReport uses OECD1/OECD11 (new blank supply) or OECD3/OECD13 (deletion).
    //         OECD2/OECD12 is NOT applicable for NilReport.
    let fiDocTypeIndic;
    if (report.is_test_supply) {
      if (report.message_type_indic === 'CRS702') fiDocTypeIndic = 'OECD12';
      else if (isNilReport && report.message_type_indic === 'CRS703') fiDocTypeIndic = 'OECD13'; // delete prior NIL
      else fiDocTypeIndic = 'OECD11'; // new supply (CRS701) or new NIL supply
    } else {
      if (report.message_type_indic === 'CRS702') fiDocTypeIndic = 'OECD2';
      else if (isNilReport && report.message_type_indic === 'CRS703') fiDocTypeIndic = 'OECD3'; // delete prior NIL
      else fiDocTypeIndic = 'OECD1'; // new supply or new NIL supply
    }

    // Rules 108/109: CorrDocRefId
    const fiCorrDocRefIdXml = (() => {
      if (messageTypeIndic === 'CRS701' || messageTypeIndic === 'CRS703') return ''; // Rule 108 + NIL
      if (messageTypeIndic === 'CRS702') {
        if (!report.correction_doc_ref_id) {
          throw new Error('CorrDocRefId is mandatory for the ReportingFI DocSpec in correction reports (CRS702) but correction_doc_ref_id is not set.');
        }
        return `<CorrDocRefId>${report.correction_doc_ref_id}_FI</CorrDocRefId>`;
      }
      return '';
    })();

    // GAP 5: CorrMessageRefId
    const corrMessageRefIdXml = (() => {
      if (messageTypeIndic === 'CRS701' || messageTypeIndic === 'CRS703') return '';
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

    // Build NIL ReportingGroup — GAP 13 (Sections 6.3.2.2, 6.3.2.2.1, 6.3.2.2.2)
    // Rule 114: NilReport must NOT appear when MessageTypeIndic = CRS701
    const buildReportingGroup = () => {
      if (isNilReport && messageTypeIndic !== 'CRS701') {
        const nilDocRefId = generateDocRefId({
          fiscalYear: report.reporting_year,
          cribNumber,
          serialNumber: '002',
          type: 'NIL'
        });

        // NilReport DocTypeIndic: OECD1/OECD11 = new blank supply, OECD3/OECD13 = delete prior NIL
        // OECD2/OECD12 is NOT applicable for NilReport
        let nilDocTypeIndic;
        if (report.is_test_supply) {
          nilDocTypeIndic = (report.message_type_indic === 'CRS703') ? 'OECD13' : 'OECD11';
        } else {
          nilDocTypeIndic = (report.message_type_indic === 'CRS703') ? 'OECD3' : 'OECD1';
        }

        const nilCorrDocRefIdXml = (report.message_type_indic === 'CRS703' && report.correction_doc_ref_id)
          ? `\n          <CorrDocRefId>${report.correction_doc_ref_id}_NIL</CorrDocRefId>`
          : '';

        return `
    <ReportingGroup>
      <NilReport>
        <DocSpec>
          <DocTypeIndic>${nilDocTypeIndic}</DocTypeIndic>
          <DocRefId>${nilDocRefId}</DocRefId>${nilCorrDocRefIdXml}
        </DocSpec>
        <NoAccountToReport>yes</NoAccountToReport>
      </NilReport>
    </ReportingGroup>`;
      }

      // Standard AccountReport blocks
      const accountBlocks = accounts.map((account, index) => {
        const accDocRefId = generateDocRefId({
          fiscalYear: report.reporting_year,
          cribNumber,
          serialNumber: String(index + 1),
          type: 'ACC'
        });

        let docTypeIndic;
        if (report.is_test_supply) {
          if (report.message_type_indic === 'CRS702') docTypeIndic = 'OECD12';
          else if (report.message_type_indic === 'CRS703') docTypeIndic = 'OECD13';
          else docTypeIndic = 'OECD11';
        } else {
          if (report.message_type_indic === 'CRS702') docTypeIndic = 'OECD2';
          else if (report.message_type_indic === 'CRS703') docTypeIndic = 'OECD3';
          else docTypeIndic = 'OECD1';
        }

        // GAP 30: CorrDocRefId must NOT appear for CRS701
        const corrDocRefIdXml = (() => {
          if (messageTypeIndic === 'CRS701') return '';
          if (messageTypeIndic === 'CRS702' && report.correction_doc_ref_id) {
            return `<CorrDocRefId>${report.correction_doc_ref_id}_ACC${String(index + 1).padStart(3, '0')}</CorrDocRefId>`;
          }
          return '';
        })();

        // GAP 26: ClosedAccount attribute
        const closedAttr = account.account_closed_during_period ? ' ClosedAccount="true"' : '';
        const accountNumberVal = account.account_number ? escapeXML(account.account_number) : 'NANUM';

        // GAP 25: AccountBalance is year-end value only
        const balanceValue = Math.max(0, account.year_end_cash_value || 0).toFixed(2);
        const balanceCurrency = account.year_end_cash_value_currency || account.gross_payments_currency || 'USD';

        const accountCPs = controllingPersons.filter(cp => cp.account_id === account.id);
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

        const cpBlocks = accountCPs.map(cp => {
          const ctrlgPersonType = cp.control_type ? (ctrlTypeMap[cp.control_type] || 'CRS801') : 'CRS801';
          return `
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
      </ControllingPerson>`;
        }).join('');

        return `
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
      ${cpBlocks}
    </AccountReport>`;
      }).join('');

      return `
    <ReportingGroup>
      ${accountBlocks}
    </ReportingGroup>`;
    };

    return `<?xml version="1.0" encoding="UTF-8"?>
<FATCA_CRS Version="2.0"
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
      <TIN IssuedBy="${tinIssuedBy}">${escapeXML(tinValue)}</TIN>
      <Name NameType="OECD207">${escapeXML(entity.entity_name)}</Name>
      <Address AddressType="OECD303">
        <CountryCode>CW</CountryCode>
        <AddressFix>
          ${entity.address?.street ? `<Street>${escapeXML(entity.address.street)}</Street>` : ''}
          <City>${escapeXML(entity.address?.city || '')}</City>
        </AddressFix>
      </Address>${filerCategoryXml}
      <DocSpec>
        <DocTypeIndic>${fiDocTypeIndic}</DocTypeIndic>
        <DocRefId>${fiDocRefId}</DocRefId>
        ${fiCorrDocRefIdXml}
      </DocSpec>
    </ReportingFI>
    ${buildReportingGroup()}
  </CrsBody>
</FATCA_CRS>`;
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
    await base44.entities.CRSReport.update(report.id, {
      validation_results: results,
      status: results.is_valid ? 'validated' : 'draft'
    });
    if (results.is_valid) onSuccess?.();
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
    a.download = `CRS_${isNilReport ? 'NIL_' : ''}${report.reporting_year}_${report.id}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  React.useEffect(() => {
    if (report && !dataLoaded) {
      loadReportData();
    }
  }, [report]);

  return (
    <div className="space-y-6">
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
        <TabsList className="grid w-full grid-cols-4">
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
                {isNilReport && xmlContent && (
                  <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200">
                    NIL Report (CRS703)
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {isNilReport && xmlContent && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-sm text-amber-900">
                    <strong>NIL Report generated.</strong> No reportable accounts found. A <code>NilReport</code> block 
                    with <code>NoAccountToReport: yes</code> and <code>MessageTypeIndic: CRS703</code> has been included 
                    in the XML per Section 6.3.2.2.
                  </AlertDescription>
                </Alert>
              )}

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
                    <p className="text-sm font-semibold">{isNilReport ? 'NIL' : accounts.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Status</p>
                    <Badge variant="outline" className={
                      isNilReport
                        ? "bg-amber-50 text-amber-700"
                        : validationResults?.is_valid
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                    }>
                      {isNilReport ? "NIL — Auto Validated" : validationResults?.is_valid ? "Validated" : "Pending Validation"}
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