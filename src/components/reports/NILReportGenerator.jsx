import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  FileX,
  CheckCircle2,
  Download,
  Loader2,
  Info,
  FileCode
} from "lucide-react";
import { JURISDICTION_CONFIGS, generateFileName } from "./JurisdictionConfig";
import { generateMessageRefId, generateDocRefId } from "./idGenerator";

export default function NILReportGenerator({ report, entity, tenant, onSuccess }) {
  const [generating, setGenerating] = useState(false);
  const [xmlContent, setXmlContent] = useState(null);
  const [generated, setGenerated] = useState(false);

  const escapeXML = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const generateNILReport = async () => {
    setGenerating(true);
    try {
      const jurisdiction = report.reporting_jurisdiction;
      const config = JURISDICTION_CONFIGS[jurisdiction] || JURISDICTION_CONFIGS["DEFAULT"];
      
      // GAP 29: Timestamp must be YYYY-MM-DDTHH:MM:SS — no milliseconds, no Z
      const timestamp = new Date().toISOString().substring(0, 19);
      const cribNumber = entity?.tax_id || '';

      const messageRefId = generateMessageRefId({
        fiscalYear: report.reporting_year,
        cribNumber,
        serialNumber: '001'
      });

      // GAP 12: ReportingFI DocSpec — FI-typed DocRefId
      const fiDocRefId = generateDocRefId({
        fiscalYear: report.reporting_year,
        cribNumber,
        serialNumber: '001',
        type: 'FI'
      });

      // NIL reports always use CRS703 → DocTypeIndic is OECD3 (or OECD13 for test supply)
      const fiDocTypeIndic = report.is_test_supply ? 'OECD13' : 'OECD3';

      // GAP 11: FilerCategory — required for FFI entities that file independently (not through a Sponsor)
      const FATCA_FILER_CATEGORY_MAP = {
        "Participating FFI (standard FATCA-registered institution)": "FATCA601",
        "Registered Deemed-Compliant FFI": "FATCA602",
        "Limited FFI or Limited Branch": "FATCA603",
        "Qualified Intermediary / Withholding Foreign Partnership or Trust": "FATCA605",
        "Direct Reporting NFFE": "FATCA606",
        "Reporting Model 1 FFI / Withholding Agent": "FATCA610"
      };
      let filerCategoryXml = '';
      if (entity?.is_ffi === true && !entity?.is_sponsored_ffi) {
        if (!entity?.fi_registration_type) {
          throw new Error(`Please select the institution registration type for "${entity?.entity_name}" before generating the report.`);
        }
        const fatcaCode = FATCA_FILER_CATEGORY_MAP[entity.fi_registration_type];
        if (fatcaCode) {
          filerCategoryXml = `\n      <crs:FilerCategory>${fatcaCode}</crs:FilerCategory>`;
        }
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<crs:CRS_OECD xmlns:crs="urn:oecd:ties:crs:v2" xmlns:stf="urn:oecd:ties:crsstf:v5" version="${config.schemaVersion}">
  <crs:MessageSpec>
    <crs:SendingCompanyIN>${escapeXML(entity?.tax_id || 'UNKNOWN')}</crs:SendingCompanyIN>
    <crs:TransmittingCountry>${escapeXML(report.reporting_jurisdiction)}</crs:TransmittingCountry>
    <crs:ReceivingCountry>${escapeXML(report.reporting_jurisdiction)}</crs:ReceivingCountry>
    <crs:MessageType>CRS</crs:MessageType>
    <crs:MessageRefId>${escapeXML(messageRefId)}</crs:MessageRefId>
    <crs:MessageTypeIndic>CRS703</crs:MessageTypeIndic>
    <crs:ReportingPeriod>${report.reporting_year}-12-31</crs:ReportingPeriod>
    <crs:Timestamp>${timestamp}</crs:Timestamp>
  </crs:MessageSpec>
  
  <crs:CrsBody>
    <crs:ReportingFI>
      <crs:ResCountryCode>CW</crs:ResCountryCode>
      <crs:TIN IssuedBy="${entity?.is_ffi ? 'US' : 'CW'}">${escapeXML(entity?.is_ffi ? entity?.giin : entity?.tax_id)}</crs:TIN>
      <crs:Name NameType="OECD207">${escapeXML(entity?.entity_name || 'Unknown Entity')}</crs:Name>
      <crs:Address AddressType="OECD303">
        <crs:CountryCode>CW</crs:CountryCode>
        <crs:AddressFix>
          ${entity?.address?.street ? `<crs:Street>${escapeXML(entity.address.street)}</crs:Street>` : ''}
          <crs:City>${escapeXML(entity?.address?.city || '')}</crs:City>
        </crs:AddressFix>
      </crs:Address>${filerCategoryXml}
      <crs:DocSpec>
        <crs:DocTypeIndic>${fiDocTypeIndic}</crs:DocTypeIndic>
        <crs:DocRefId>${escapeXML(fiDocRefId)}</crs:DocRefId>
      </crs:DocSpec>
    </crs:ReportingFI>
  </crs:CrsBody>
</crs:CRS_OECD>`;

      setXmlContent(xml);

      // Upload XML to storage
      const blob = new Blob([xml], { type: 'application/xml' });
      const fileName = generateFileName(config.fileNamingPattern, {
        year: report.reporting_year,
        tin: entity?.tax_id,
        giin: entity?.giin,
        sequence: '001'
      }).replace('.xml', '_NIL.xml');
      
      const file = new File([blob], fileName);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Update report
      await base44.entities.CRSReport.update(report.id, {
        xml_file_url: file_url,
        status: 'validated',
        report_type: 'nil_report',
        summary_stats: {
          total_reportable_accounts: 0,
          total_controlling_persons: 0,
          jurisdictions_reported: [],
          total_account_balance: 0
        },
        validation_results: {
          is_valid: true,
          errors: [],
          warnings: [],
          validated_date: new Date().toISOString()
        }
      });

      setGenerated(true);
      onSuccess?.();
    } catch (error) {
      console.error("NIL report generation error:", error);
      alert("Failed to generate NIL report: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadXML = () => {
    if (!xmlContent) return;

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CRS_NIL_${report.reporting_year}_${entity?.entity_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'report'}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <FileX className="w-5 h-5 text-slate-600" />
          NIL Report Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            <strong>NIL Report:</strong> This report declares that the Reporting Financial Institution 
            has no Reportable Accounts for the reporting period. It satisfies the filing obligation 
            when there are no accounts to report.
          </AlertDescription>
        </Alert>

        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-slate-900">Report Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Reporting Entity</p>
              <p className="font-medium">{entity?.entity_name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-slate-500">Reporting Year</p>
              <p className="font-medium">{report.reporting_year}</p>
            </div>
            <div>
              <p className="text-slate-500">Jurisdiction</p>
              <p className="font-medium">{report.reporting_jurisdiction}</p>
            </div>
            <div>
              <p className="text-slate-500">Report Type</p>
              <Badge variant="outline">NIL Report (No Reportable Accounts)</Badge>
            </div>
          </div>
        </div>

        {!generated ? (
          <Button
            onClick={generateNILReport}
            disabled={generating}
            className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating NIL Report...
              </>
            ) : (
              <>
                <FileCode className="w-5 h-5 mr-2" />
                Generate NIL Report XML
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">NIL Report Generated Successfully</p>
                <p className="text-sm text-green-700">The report is ready for download and submission.</p>
              </div>
            </div>

            <Button
              onClick={downloadXML}
              variant="outline"
              className="w-full h-12 border-2 border-green-200 hover:bg-green-50"
            >
              <Download className="w-5 h-5 mr-2 text-green-600" />
              Download NIL Report XML
            </Button>

            {xmlContent && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">XML Preview:</p>
                <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto max-h-64">
                  {xmlContent}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}