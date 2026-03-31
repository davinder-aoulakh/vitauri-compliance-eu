import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical,
  Download,
  FileCode,
  Loader2,
  Info,
  CheckCircle2,
  Users
} from "lucide-react";
import { generateFileName, JURISDICTION_CONFIGS } from "./JurisdictionConfig";
import { generateMessageRefId, generateDocRefId } from "./idGenerator";

export default function TestModeGenerator({ entity, tenant, jurisdiction }) {
  const [generating, setGenerating] = useState(false);
  const [config, setConfig] = useState({
    numAccounts: 3,
    includeControllingPersons: true,
    useDummyData: true,
    reportingYear: new Date().getFullYear() - 1
  });
  const [xmlContent, setXmlContent] = useState(null);

  const generateTestXML = async () => {
    setGenerating(true);
    try {
      const jConfig = JURISDICTION_CONFIGS[jurisdiction] || JURISDICTION_CONFIGS["DEFAULT"];
      
      // Generate dummy data
      const dummyAccounts = Array.from({ length: config.numAccounts }, (_, i) => ({
        account_number: `TEST${String(i + 1).padStart(6, '0')}`,
        account_holder_name: `Test Account Holder ${i + 1}`,
        account_holder_type: i % 2 === 0 ? 'individual' : 'entity',
        account_type: 'custodial',
        account_balance: Math.floor(Math.random() * 500000) + 50000,
        year_end_cash_value: Math.floor(Math.random() * 500000) + 50000,
        year_end_cash_value_currency: 'USD',
        account_holder_address: {
          street: `${100 + i} Test Street`,
          city: 'Test City',
          country: jurisdiction || 'AU',
          postal_code: '12345'
        },
        tax_residencies: [{
          country: jurisdiction || 'AU',
          tin: `TEST${String(i + 1).padStart(9, '0')}`
        }],
        date_of_birth: i % 2 === 0 ? '1980-01-15' : undefined,
        reportability_status: 'reportable'
      }));

      const dummyControllingPersons = config.includeControllingPersons ? [{
        full_name: 'Test Controlling Person',
        date_of_birth: '1975-05-20',
        tax_residencies: [{
          country: jurisdiction || 'AU',
          tin: 'TESTCP123456789'
        }],
        address: {
          street: '200 Control Street',
          city: 'Test City',
          country: jurisdiction || 'AU'
        },
        account_id: 'dummy_account_1'
      }] : [];

      // Build XML
      const escapeXML = (str) => {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      const timestamp = new Date().toISOString().substring(0, 19);
      const cribNumber = entity?.tax_id || 'TESTTIN123';

      const messageRefId = generateMessageRefId({
        fiscalYear: config.reportingYear,
        cribNumber,
        serialNumber: '001'
      });

      // GAP 12: ReportingFI DocSpec — FI-typed DocRefId (test supply → OECD11)
      const fiDocRefId = generateDocRefId({
        fiscalYear: config.reportingYear,
        cribNumber,
        serialNumber: '001',
        type: 'FI'
      });

      // GAP 11: FilerCategory — required for FFI entities that file independently (not through a Sponsor)
      const FATCA_FILER_CATEGORY_MAP = {
        "Participating FFI (standard FATCA-registered institution)": "FATCA601",
        "Registered Deemed-Compliant FFI": "FATCA602",
        "Limited FFI or Limited Branch": "FATCA603",
        "Qualified Intermediary / Withholding Foreign Partnership or Trust": "FATCA605",
        "Direct Reporting NFFE": "FATCA606",
        "Reporting Model 1 FFI / Withholding Agent": "FATCA610"
      };
      let testFilerCategoryXml = '';
      if (entity?.is_ffi === true && !entity?.is_sponsored_ffi && entity?.fi_registration_type) {
        const fatcaCode = FATCA_FILER_CATEGORY_MAP[entity.fi_registration_type];
        if (fatcaCode) {
          testFilerCategoryXml = `\n      <crs:FilerCategory>${fatcaCode}</crs:FilerCategory>`;
        }
      }

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<crs:CRS_OECD xmlns:crs="urn:oecd:ties:crs:v2" xmlns:stf="urn:oecd:ties:crsstf:v5" version="${jConfig.schemaVersion}">
  <!-- THIS IS A TEST FILE - NOT FOR ACTUAL SUBMISSION -->
  <crs:MessageSpec>
    <crs:SendingCompanyIN>${escapeXML(entity?.tax_id || 'TESTTIN123')}</crs:SendingCompanyIN>
    <crs:TransmittingCountry>${escapeXML(jurisdiction || 'AU')}</crs:TransmittingCountry>
    <crs:ReceivingCountry>${escapeXML(jurisdiction || 'AU')}</crs:ReceivingCountry>
    <crs:MessageType>CRS</crs:MessageType>
    <crs:MessageRefId>${escapeXML(messageRefId)}</crs:MessageRefId>
    <crs:MessageTypeIndic>CRS704</crs:MessageTypeIndic>
    <crs:ReportingPeriod>${config.reportingYear}-12-31</crs:ReportingPeriod>
    <crs:Timestamp>${timestamp}</crs:Timestamp>
  </crs:MessageSpec>
  
  <crs:CrsBody>
    <crs:ReportingFI>
      <crs:ResCountryCode>CW</crs:ResCountryCode>
      <crs:TIN IssuedBy="${entity?.is_ffi ? 'US' : 'CW'}">${escapeXML(entity?.is_ffi ? (entity?.giin || 'TESTGIIN123456') : (entity?.tax_id || 'TESTCRIB123'))}</crs:TIN>
      <crs:Name NameType="OECD207">${escapeXML(entity?.entity_name || 'Test Financial Institution')}</crs:Name>
      <crs:Address AddressType="OECD303">
        <crs:CountryCode>CW</crs:CountryCode>
        <crs:AddressFix>
          ${entity?.address?.street ? `<crs:Street>${escapeXML(entity.address.street)}</crs:Street>` : '<crs:Street>123 Test Bank Street</crs:Street>'}
          <crs:City>${escapeXML(entity?.address?.city || 'Willemstad')}</crs:City>
        </crs:AddressFix>
      </crs:Address>${testFilerCategoryXml}
      <crs:DocSpec>
        <crs:DocTypeIndic>OECD11</crs:DocTypeIndic>
        <crs:DocRefId>${escapeXML(fiDocRefId)}</crs:DocRefId>
      </crs:DocSpec>
    </crs:ReportingFI>
`;

      dummyAccounts.forEach((account, index) => {
        const accDocRefId = generateDocRefId({
          fiscalYear: config.reportingYear,
          cribNumber,
          serialNumber: String(index + 1),
          type: 'ACC'
        });

        xml += `
    <crs:AccountReport>
      <crs:DocSpec>
        <crs:DocTypeIndic>OECD11</crs:DocTypeIndic>
        <crs:DocRefId>${escapeXML(accDocRefId)}</crs:DocRefId>
      </crs:DocSpec>
      
      <crs:AccountNumber>${escapeXML(account.account_number)}</crs:AccountNumber>
      
      <crs:AccountHolder>
        ${account.account_holder_type === 'individual' ? `
        <crs:Individual>
          <crs:ResCountryCode>${escapeXML(account.account_holder_address.country)}</crs:ResCountryCode>
          <crs:TIN>${escapeXML(account.tax_residencies[0].tin)}</crs:TIN>
          <crs:Name>
            <crs:FirstName>${escapeXML(account.account_holder_name.split(' ')[0])}</crs:FirstName>
            <crs:LastName>${escapeXML(account.account_holder_name.split(' ').slice(1).join(' '))}</crs:LastName>
          </crs:Name>
          <crs:Address>
            <crs:CountryCode>${escapeXML(account.account_holder_address.country)}</crs:CountryCode>
            <crs:AddressFree>${escapeXML(account.account_holder_address.street)}</crs:AddressFree>
            <crs:City>${escapeXML(account.account_holder_address.city)}</crs:City>
            <crs:PostCode>${escapeXML(account.account_holder_address.postal_code)}</crs:PostCode>
          </crs:Address>
          <crs:BirthDate>${account.date_of_birth}</crs:BirthDate>
        </crs:Individual>
        ` : `
        <crs:Organisation>
          <crs:ResCountryCode>${escapeXML(account.account_holder_address.country)}</crs:ResCountryCode>
          <crs:TIN>${escapeXML(account.tax_residencies[0].tin)}</crs:TIN>
          <crs:Name>${escapeXML(account.account_holder_name)}</crs:Name>
          <crs:Address>
            <crs:CountryCode>${escapeXML(account.account_holder_address.country)}</crs:CountryCode>
            <crs:AddressFree>${escapeXML(account.account_holder_address.street)}</crs:AddressFree>
            <crs:City>${escapeXML(account.account_holder_address.city)}</crs:City>
            <crs:PostCode>${escapeXML(account.account_holder_address.postal_code)}</crs:PostCode>
          </crs:Address>
        </crs:Organisation>
        `}
      </crs:AccountHolder>
      
      <crs:AccountBalance currCode="${account.year_end_cash_value_currency}">${account.year_end_cash_value}</crs:AccountBalance>
      
      <crs:Payment>
        <crs:Type>CRS501</crs:Type>
        <crs:PaymentAmnt currCode="${account.year_end_cash_value_currency}">0</crs:PaymentAmnt>
      </crs:Payment>
`;

        // Add controlling person to first account if enabled
        if (config.includeControllingPersons && index === 0) {
          const cp = dummyControllingPersons[0];
          xml += `
      <crs:ControllingPerson>
        <crs:Individual>
          <crs:ResCountryCode>${escapeXML(cp.address.country)}</crs:ResCountryCode>
          <crs:TIN>${escapeXML(cp.tax_residencies[0].tin)}</crs:TIN>
          <crs:Name>
            <crs:FirstName>${escapeXML(cp.full_name.split(' ')[0])}</crs:FirstName>
            <crs:LastName>${escapeXML(cp.full_name.split(' ').slice(1).join(' '))}</crs:LastName>
          </crs:Name>
          <crs:Address>
            <crs:CountryCode>${escapeXML(cp.address.country)}</crs:CountryCode>
            <crs:AddressFree>${escapeXML(cp.address.street)}</crs:AddressFree>
            <crs:City>${escapeXML(cp.address.city)}</crs:City>
          </crs:Address>
          <crs:BirthDate>${cp.date_of_birth}</crs:BirthDate>
        </crs:Individual>
        <crs:CtrlgPersonType>CRS801</crs:CtrlgPersonType>
      </crs:ControllingPerson>
`;
        }

        xml += `    </crs:AccountReport>
`;
      });

      xml += `  </crs:CrsBody>
</crs:CRS_OECD>`;

      setXmlContent(xml);
    } catch (error) {
      console.error("Test XML generation error:", error);
      alert("Failed to generate test XML: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadTestXML = () => {
    if (!xmlContent) return;

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CRS_TEST_${config.reportingYear}_${Date.now()}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-purple-600" />
          Test Mode - Generate Sample XML
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <Alert className="bg-amber-50 border-amber-200">
          <Info className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-900">
            <strong>Test Mode:</strong> Generate a sample CRS XML file with dummy data to test your 
            configuration and submission process before using real data.
          </AlertDescription>
        </Alert>

        {/* Configuration Options */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Number of Test Accounts</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={config.numAccounts}
              onChange={(e) => setConfig({ ...config, numAccounts: parseInt(e.target.value) || 1 })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Reporting Year</Label>
            <Input
              type="number"
              min="2014"
              max={new Date().getFullYear()}
              value={config.reportingYear}
              onChange={(e) => setConfig({ ...config, reportingYear: parseInt(e.target.value) })}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Include Controlling Persons</p>
            <p className="text-xs text-slate-500">Add sample controlling person data to first account</p>
          </div>
          <Switch
            checked={config.includeControllingPersons}
            onCheckedChange={(checked) => setConfig({ ...config, includeControllingPersons: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Use Dummy Data</p>
            <p className="text-xs text-slate-500">Generate realistic but fake account information</p>
          </div>
          <Switch
            checked={config.useDummyData}
            onCheckedChange={(checked) => setConfig({ ...config, useDummyData: checked })}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={generateTestXML}
            disabled={generating}
            className="flex-1 h-16 bg-purple-600 hover:bg-purple-700"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating Test XML...
              </>
            ) : (
              <>
                <FileCode className="w-5 h-5 mr-2" />
                Generate Test XML
              </>
            )}
          </Button>

          {xmlContent && (
            <Button
              onClick={downloadTestXML}
              variant="outline"
              className="flex-1 h-16 border-2 border-green-200 hover:bg-green-50"
            >
              <Download className="w-5 h-5 mr-2 text-green-600" />
              Download Test File
            </Button>
          )}
        </div>

        {/* Preview */}
        {xmlContent && (
          <Card className="border-2 border-green-200 bg-green-50/30">
            <CardHeader className="border-b border-green-200">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Test XML Generated
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-4 p-3 bg-white rounded-lg border">
                <div>
                  <p className="text-xs text-slate-600">File Size</p>
                  <p className="text-sm font-semibold">{(new Blob([xmlContent]).size / 1024).toFixed(2)} KB</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Test Accounts</p>
                  <p className="text-sm font-semibold">{config.numAccounts}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Controlling Persons</p>
                  <p className="text-sm font-semibold">{config.includeControllingPersons ? 1 : 0}</p>
                </div>
              </div>

              <div className="max-h-64 overflow-auto">
                <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg">
                  {xmlContent}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}