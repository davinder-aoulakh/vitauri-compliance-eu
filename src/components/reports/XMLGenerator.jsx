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
import { JURISDICTION_CONFIGS, generateFileName, generateDocRefId } from "./JurisdictionConfig";
import XMLValidator from "./XMLValidator";
import ReportPreviewExport from "./ReportPreviewExport";
import NILReportGenerator from "./NILReportGenerator";

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
    const jConfig = jurisdictionConfig || JURISDICTION_CONFIGS["DEFAULT"];
    const timestamp = new Date().toISOString();
    const messageRefId = generateDocRefId(jConfig.docRefIdFormat, {
      tin: entity?.tax_id,
      giin: entity?.giin,
      year: report.reporting_year,
      type: 'MSG',
      sequence: '001'
    });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<crs:CRS_OECD xmlns:crs="urn:oecd:ties:crs:v2" xmlns:stf="urn:oecd:ties:crsstf:v5" version="${jConfig.schemaVersion}">
  <crs:MessageSpec>
    <crs:SendingCompanyIN>${entity.tax_id || 'UNKNOWN'}</crs:SendingCompanyIN>
    <crs:TransmittingCountry>${report.reporting_jurisdiction}</crs:TransmittingCountry>
    <crs:ReceivingCountry>${report.reporting_jurisdiction}</crs:ReceivingCountry>
    <crs:MessageType>CRS</crs:MessageType>
    <crs:MessageRefId>${messageRefId}</crs:MessageRefId>
    <crs:MessageTypeIndic>CRS701</crs:MessageTypeIndic>
    <crs:ReportingPeriod>${report.reporting_year}-12-31</crs:ReportingPeriod>
    <crs:Timestamp>${timestamp}</crs:Timestamp>
  </crs:MessageSpec>
  
  <crs:CrsBody>
    <crs:ReportingFI>
      <crs:ResCountryCode>${entity.country_of_incorporation || report.reporting_jurisdiction}</crs:ResCountryCode>
      <crs:TIN>${entity.tax_id || 'UNKNOWN'}</crs:TIN>
      <crs:Name>${escapeXML(entity.entity_name)}</crs:Name>
      ${entity.address ? `
      <crs:Address>
        <crs:CountryCode>${entity.address.country || report.reporting_jurisdiction}</crs:CountryCode>
        ${entity.address.street ? `<crs:AddressFree>${escapeXML(entity.address.street)}</crs:AddressFree>` : ''}
        ${entity.address.city ? `<crs:City>${escapeXML(entity.address.city)}</crs:City>` : ''}
        ${entity.address.postal_code ? `<crs:PostCode>${escapeXML(entity.address.postal_code)}</crs:PostCode>` : ''}
      </crs:Address>
      ` : ''}
    </crs:ReportingFI>
`;

    // Add account reports
    accounts.forEach((account, index) => {
      const accDocRefId = generateDocRefId(jConfig.docRefIdFormat, {
        tin: entity?.tax_id,
        giin: entity?.giin,
        year: report.reporting_year,
        type: 'ACC',
        sequence: String(index + 1).padStart(3, '0')
      });

      xml += `
    <crs:AccountReport>
      <crs:DocSpec>
        <crs:DocTypeIndic>OECD1</crs:DocTypeIndic>
        <crs:DocRefId>${accDocRefId}</crs:DocRefId>
      </crs:DocSpec>
      
      <crs:AccountNumber>${escapeXML(account.account_number)}</crs:AccountNumber>
      
      <crs:AccountHolder>
        ${account.account_holder_type === 'individual' ? `
        <crs:Individual>
          <crs:ResCountryCode>${account.account_holder_address?.country || report.reporting_jurisdiction}</crs:ResCountryCode>
          ${account.tax_residencies && account.tax_residencies.length > 0 ? 
            account.tax_residencies.map(res => `
          <crs:TIN>${res.tin || 'NOTIN'}</crs:TIN>
          `).join('') : '<crs:TIN>NOTIN</crs:TIN>'}
          <crs:Name>
            <crs:FirstName>${escapeXML(account.account_holder_name.split(' ')[0] || 'Unknown')}</crs:FirstName>
            <crs:LastName>${escapeXML(account.account_holder_name.split(' ').slice(1).join(' ') || 'Unknown')}</crs:LastName>
          </crs:Name>
          ${account.account_holder_address ? `
          <crs:Address>
            <crs:CountryCode>${account.account_holder_address.country || report.reporting_jurisdiction}</crs:CountryCode>
            ${account.account_holder_address.street ? `<crs:AddressFree>${escapeXML(account.account_holder_address.street)}</crs:AddressFree>` : ''}
            ${account.account_holder_address.city ? `<crs:City>${escapeXML(account.account_holder_address.city)}</crs:City>` : ''}
            ${account.account_holder_address.postal_code ? `<crs:PostCode>${escapeXML(account.account_holder_address.postal_code)}</crs:PostCode>` : ''}
          </crs:Address>
          ` : ''}
          ${account.date_of_birth ? `<crs:BirthDate>${account.date_of_birth}</crs:BirthDate>` : ''}
        </crs:Individual>
        ` : `
        <crs:Organisation>
          <crs:ResCountryCode>${account.account_holder_address?.country || report.reporting_jurisdiction}</crs:ResCountryCode>
          ${account.tax_residencies && account.tax_residencies.length > 0 ? 
            account.tax_residencies.map(res => `
          <crs:TIN>${res.tin || 'NOTIN'}</crs:TIN>
          `).join('') : '<crs:TIN>NOTIN</crs:TIN>'}
          <crs:Name>${escapeXML(account.account_holder_name)}</crs:Name>
          ${account.account_holder_address ? `
          <crs:Address>
            <crs:CountryCode>${account.account_holder_address.country || report.reporting_jurisdiction}</crs:CountryCode>
            ${account.account_holder_address.street ? `<crs:AddressFree>${escapeXML(account.account_holder_address.street)}</crs:AddressFree>` : ''}
            ${account.account_holder_address.city ? `<crs:City>${escapeXML(account.account_holder_address.city)}</crs:City>` : ''}
            ${account.account_holder_address.postal_code ? `<crs:PostCode>${escapeXML(account.account_holder_address.postal_code)}</crs:PostCode>` : ''}
          </crs:Address>
          ` : ''}
        </crs:Organisation>
        `}
      </crs:AccountHolder>
      
      <crs:AccountBalance currCode="${account.year_end_cash_value_currency || account.currency || 'USD'}">${account.year_end_cash_value || account.account_balance || 0}</crs:AccountBalance>
      ${account.account_closed_during_period ? '<crs:ClosedAccount>true</crs:ClosedAccount>' : ''}
      
      ${account.tax_residencies && account.tax_residencies.length > 0 ? 
        account.tax_residencies.map(res => `
      <crs:Payment>
        <crs:Type>CRS501</crs:Type>
        <crs:PaymentAmnt currCode="${account.currency || 'USD'}">0</crs:PaymentAmnt>
      </crs:Payment>
      `).join('') : ''}
`;

      // Add controlling persons for passive NFE accounts
      const accountCPs = controllingPersons.filter(cp => cp.account_id === account.id);
      accountCPs.forEach((cp, cpIndex) => {
        xml += `
      <crs:ControllingPerson>
        <crs:Individual>
          ${cp.tax_residencies && cp.tax_residencies.length > 0 ? 
            cp.tax_residencies.map(res => `
          <crs:ResCountryCode>${res.country}</crs:ResCountryCode>
          <crs:TIN>${res.tin || 'NOTIN'}</crs:TIN>
          `).join('') : ''}
          <crs:Name>
            <crs:FirstName>${escapeXML(cp.full_name.split(' ')[0] || 'Unknown')}</crs:FirstName>
            <crs:LastName>${escapeXML(cp.full_name.split(' ').slice(1).join(' ') || 'Unknown')}</crs:LastName>
          </crs:Name>
          ${cp.address ? `
          <crs:Address>
            <crs:CountryCode>${cp.address.country || report.reporting_jurisdiction}</crs:CountryCode>
            ${cp.address.street ? `<crs:AddressFree>${escapeXML(cp.address.street)}</crs:AddressFree>` : ''}
            ${cp.address.city ? `<crs:City>${escapeXML(cp.address.city)}</crs:City>` : ''}
          </crs:Address>
          ` : ''}
          ${cp.date_of_birth ? `<crs:BirthDate>${cp.date_of_birth}</crs:BirthDate>` : ''}
        </crs:Individual>
        <crs:CtrlgPersonType>CRS801</crs:CtrlgPersonType>
      </crs:ControllingPerson>
`;
      });

      xml += `    </crs:AccountReport>
`;
    });

    xml += `  </crs:CrsBody>
</crs:CRS_OECD>`;

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
          <TabsTrigger value="nil" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            NIL Report
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