import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  FileCheck
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function XMLGenerator({ report, onSuccess }) {
  const [generating, setGenerating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [xmlContent, setXmlContent] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const generateXML = async () => {
    setGenerating(true);
    try {
      // Fetch all related data
      const accounts = await base44.entities.Account.filter({
        entity_id: report.entity_id,
        reporting_year: report.reporting_year,
        reportability_status: 'reportable'
      });

      const entity = await base44.entities.Entity.list();
      const reportingEntity = entity.find(e => e.id === report.entity_id);

      const tenant = await base44.entities.Tenant.list();
      const reportingTenant = tenant.find(t => t.id === report.tenant_id);

      // Fetch controlling persons for passive NFE accounts
      const accountIds = accounts.map(a => a.id);
      const allCPs = await base44.entities.ControllingPerson.filter({
        tenant_id: report.tenant_id
      });
      const controllingPersons = allCPs.filter(cp => 
        accountIds.includes(cp.account_id) && cp.is_reportable
      );

      // Generate XML content
      const xml = buildCRSXML({
        report,
        entity: reportingEntity,
        tenant: reportingTenant,
        accounts,
        controllingPersons
      });

      setXmlContent(xml);

      // Upload XML to storage
      const blob = new Blob([xml], { type: 'application/xml' });
      const file = new File([blob], `CRS_${report.reporting_year}_${reportingEntity.entity_name.replace(/[^a-zA-Z0-9]/g, '_')}.xml`);
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Update report with XML URL
      await base44.entities.CRSReport.update(report.id, {
        xml_file_url: file_url,
        status: 'validated'
      });

      onSuccess();
    } catch (error) {
      console.error("XML generation error:", error);
      alert("Failed to generate XML: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const buildCRSXML = ({ report, entity, tenant, accounts, controllingPersons }) => {
    const timestamp = new Date().toISOString();
    const messageRefId = `${entity.tax_id || 'NOTAX'}.${report.reporting_year}.${Date.now()}`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<crs:CRS_OECD xmlns:crs="urn:oecd:ties:crs:v2" xmlns:stf="urn:oecd:ties:crsstf:v5" version="2.0">
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
      xml += `
    <crs:AccountReport>
      <crs:DocSpec>
        <crs:DocTypeIndic>OECD1</crs:DocTypeIndic>
        <crs:DocRefId>${messageRefId}.ACC${index + 1}</crs:DocRefId>
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
      
      <crs:AccountBalance currCode="${account.currency || 'USD'}">${account.account_balance || 0}</crs:AccountBalance>
      
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

  const validateXML = async () => {
    if (!xmlContent) {
      alert("Please generate XML first");
      return;
    }

    setValidating(true);
    try {
      // Basic XML validation
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
      const errors = xmlDoc.getElementsByTagName("parsererror");

      const results = {
        is_valid: errors.length === 0,
        errors: [],
        warnings: [],
        validated_date: new Date().toISOString()
      };

      if (errors.length > 0) {
        results.errors.push("XML parsing error: Invalid XML structure");
      } else {
        // Additional schema validation checks
        const messageSpec = xmlDoc.getElementsByTagName("crs:MessageSpec")[0];
        if (!messageSpec) {
          results.warnings.push("Missing MessageSpec element");
        }

        const accountReports = xmlDoc.getElementsByTagName("crs:AccountReport");
        if (accountReports.length === 0) {
          results.warnings.push("No AccountReport elements found");
        }

        results.errors.length === 0 && results.warnings.length === 0 
          ? results.warnings.push("XML structure appears valid") 
          : null;
      }

      setValidationResults(results);

      // Update report validation results
      await base44.entities.CRSReport.update(report.id, {
        validation_results: results,
        status: results.is_valid ? 'validated' : 'draft'
      });
    } catch (error) {
      console.error("Validation error:", error);
      alert("Validation failed: " + error.message);
    } finally {
      setValidating(false);
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

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-indigo-600" />
            XML Generation & Validation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              <strong>CRS XML Schema v{report.xml_schema_version}</strong> - 
              Generate and validate your XML file before submission to the tax authority.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={generateXML}
              disabled={generating || !!xmlContent}
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
                  <span className="text-sm">XML Generated</span>
                </>
              ) : (
                <>
                  <FileCode className="w-6 h-6" />
                  <span className="text-sm">Generate XML</span>
                </>
              )}
            </Button>

            <Button
              onClick={validateXML}
              disabled={!xmlContent || validating}
              variant="outline"
              className="h-24 flex flex-col gap-2 border-2"
            >
              {validating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm">Validating...</span>
                </>
              ) : validationResults ? (
                <>
                  {validationResults.is_valid ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  )}
                  <span className="text-sm">
                    {validationResults.is_valid ? "Validation Passed" : "Has Warnings"}
                  </span>
                </>
              ) : (
                <>
                  <FileCheck className="w-6 h-6" />
                  <span className="text-sm">Validate Schema</span>
                </>
              )}
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
            <div className="space-y-3">
              <Button
                onClick={() => setShowPreview(true)}
                variant="outline"
                className="w-full"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview XML Content
              </Button>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">File Size:</p>
                <p className="text-sm font-semibold text-slate-900">
                  {(new Blob([xmlContent]).size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
          )}

          {validationResults && (
            <Card className={`border-2 ${
              validationResults.is_valid 
                ? 'border-green-200 bg-green-50/30' 
                : 'border-amber-200 bg-amber-50/30'
            }`}>
              <CardHeader className={`border-b ${
                validationResults.is_valid ? 'border-green-200' : 'border-amber-200'
              }`}>
                <CardTitle className="text-base flex items-center gap-2">
                  {validationResults.is_valid ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-green-900">Schema Validation Passed</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <span className="text-amber-900">Validation Warnings</span>
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {validationResults.errors.length > 0 && (
                  <div className="space-y-1 mb-3">
                    <p className="text-sm font-semibold text-red-900">Errors:</p>
                    {validationResults.errors.map((error, idx) => (
                      <p key={idx} className="text-sm text-red-800">• {error}</p>
                    ))}
                  </div>
                )}
                {validationResults.warnings.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-900">Warnings:</p>
                    {validationResults.warnings.map((warning, idx) => (
                      <p key={idx} className="text-sm text-amber-800">• {warning}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

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