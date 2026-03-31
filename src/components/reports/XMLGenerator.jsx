import React, { useState, useEffect } from "react";
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
import XMLValidator from "./XMLValidator";
import ReportPreviewExport from "./ReportPreviewExport";
import TestModeGenerator from "./TestModeGenerator";
// All XML generation is in xmlBuilder.js (plain JS — no JSX compiler to mangle tag names)
import { buildCRSXML, scanForProhibitedChars } from "./xmlBuilder";

export default function XMLGenerator({ report, onSuccess }) {
  const [generating, setGenerating] = useState(false);
  const [xmlContent, setXmlContent] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  const [isNilReport, setIsNilReport] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [entity, setEntity] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [controllingPersons, setControllingPersons] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const jurisdictionConfig = JURISDICTION_CONFIGS[report?.reporting_jurisdiction] || JURISDICTION_CONFIGS["DEFAULT"];

  const loadReportData = async () => {
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
    const allCPs = await base44.entities.ControllingPerson.filter({ tenant_id: report.tenant_id });
    const filteredCPs = allCPs.filter(cp => accountIds.includes(cp.account_id) && cp.is_reportable);
    setControllingPersons(filteredCPs);
    setDataLoaded(true);

    return { accounts: filteredAccounts, entity: reportingEntity, tenant: reportingTenant, controllingPersons: filteredCPs };
  };

  const generateXML = async () => {
    setGenerating(true);
    try {
      const data = dataLoaded
        ? { accounts, entity, tenant, controllingPersons }
        : await loadReportData();

      const nilScenario = data.accounts.length === 0 || report.report_type === 'nil_report';
      setIsNilReport(nilScenario);

      const effectiveMessageType = report.is_test_supply ? 'CRS704' : (report.message_type_indic || 'CRS701');
      if (effectiveMessageType === 'CRS701' && report.correction_doc_ref_id) {
        throw new Error(
          'This is a New Data report (CRS701). CorrDocRefId must NOT appear in any DocSpec for new supply reports. ' +
          'Please clear the correction_doc_ref_id field on the report, or change the MessageTypeIndic to CRS702 if this is a correction.'
        );
      }

      const prohibitedIssues = scanForProhibitedChars(data.accounts, data.controllingPersons, data.entity);
      if (prohibitedIssues.length > 0) {
        const confirmed = window.confirm(
          `Warning: The following data fields contain prohibited character combinations (--  /*  &#) that will be automatically sanitised before XML generation:\n\n` +
          prohibitedIssues.map(i => `• ${i}`).join('\n') +
          `\n\nClick OK to continue and sanitise automatically, or Cancel to review your data first.`
        );
        if (!confirmed) {
          setGenerating(false);
          return;
        }
      }

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

  useEffect(() => {
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