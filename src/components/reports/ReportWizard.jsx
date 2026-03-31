import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2
} from "lucide-react";
import SchemaVersionSelector, { getRecommendedSchemaVersion } from "./SchemaVersionSelector";

export default function ReportWizard({ tenant, onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    entity_id: "",
    reporting_year: new Date().getFullYear() - 1,
    reporting_jurisdiction: tenant?.jurisdiction || "",
    report_type: "crs_xml",
    schema_version: "v2.0",
    message_type_indic: "CRS701",
    giin: ""
  });
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const { data: entities = [] } = useQuery({
    queryKey: ['entities', tenant?.id],
    queryFn: () => tenant?.id 
      ? base44.entities.Entity.filter({ tenant_id: tenant.id, status: 'active' })
      : [],
    enabled: !!tenant?.id
  });

  const { data: jurisdictionConfigs = [] } = useQuery({
    queryKey: ['jurisdiction-configs'],
    queryFn: () => base44.entities.JurisdictionConfig.list(),
    enabled: true
  });

  const currentJurisdictionConfig = jurisdictionConfigs.find(
    jc => jc.jurisdiction_code === formData.reporting_jurisdiction
  );

  const { data: accounts = [] } = useQuery({
    queryKey: ['reportable-accounts', formData.entity_id, formData.reporting_year],
    queryFn: async () => {
      if (!formData.entity_id) return [];
      const allAccounts = await base44.entities.Account.filter({ 
        entity_id: formData.entity_id,
        reporting_year: formData.reporting_year.toString()
      });
      return allAccounts.filter(acc => acc.reportability_status === 'reportable');
    },
    enabled: !!formData.entity_id && step >= 2
  });

  const { data: controllingPersons = [] } = useQuery({
    queryKey: ['controlling-persons', formData.entity_id],
    queryFn: async () => {
      if (!formData.entity_id || accounts.length === 0) return [];
      const accountIds = accounts.map(a => a.id);
      const allCPs = await base44.entities.ControllingPerson.filter({ 
        tenant_id: tenant.id 
      });
      return allCPs.filter(cp => 
        accountIds.includes(cp.account_id) && cp.is_reportable
      );
    },
    enabled: !!formData.entity_id && accounts.length > 0 && step >= 2
  });

  const handleNext = async () => {
    if (step === 1) {
      if (!formData.entity_id || !formData.reporting_year || !formData.reporting_jurisdiction) {
        alert("Please fill in all required fields");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Generate preview
      setLoading(true);
      try {
        await generatePreview();
        setStep(3);
      } catch (error) {
        console.error("Preview error:", error);
        alert("Failed to generate preview: " + error.message);
      } finally {
        setLoading(false);
      }
    } else if (step === 3) {
      // Create report
      await handleCreateReport();
    }
  };

  const generatePreview = async () => {
    const selectedEntity = entities.find(e => e.id === formData.entity_id);
    
    const summary = {
      entity: selectedEntity,
      total_reportable_accounts: accounts.length,
      total_controlling_persons: controllingPersons.length,
      jurisdictions_reported: [...new Set(
        accounts.flatMap(acc => 
          acc.tax_residencies?.map(r => r.country) || []
        )
      )],
      total_account_balance: accounts.reduce((sum, acc) => 
        sum + (acc.year_end_cash_value || 0) + (acc.gross_payments || 0), 0
      ),
      accounts_by_type: accounts.reduce((acc, account) => {
        acc[account.account_holder_type] = (acc[account.account_holder_type] || 0) + 1;
        return acc;
      }, {}),
      validation_warnings: []
    };

    // Validation checks
    accounts.forEach((account, idx) => {
      if (!account.account_holder_name) {
        summary.validation_warnings.push(`Account ${account.account_number}: Missing account holder name`);
      }
      if (!account.tax_residencies || account.tax_residencies.length === 0) {
        summary.validation_warnings.push(`Account ${account.account_number}: No tax residencies defined`);
      } else {
        account.tax_residencies.forEach(res => {
          if (!res.tin && !res.tin_unavailable_reason) {
            summary.validation_warnings.push(`Account ${account.account_number}: Missing TIN for ${res.country}`);
          }
        });
      }
      if (!account.account_holder_address?.country) {
        summary.validation_warnings.push(`Account ${account.account_number}: Missing address country`);
      }
    });

    controllingPersons.forEach(cp => {
      if (!cp.tax_residencies || cp.tax_residencies.length === 0) {
        summary.validation_warnings.push(`Controlling Person ${cp.full_name}: No tax residencies defined`);
      }
    });

    setPreviewData(summary);
  };

  const handleCreateReport = async () => {
    setLoading(true);
    try {
      const reportData = {
        tenant_id: tenant.id,
        entity_id: formData.entity_id,
        reporting_year: formData.reporting_year.toString(),
        reporting_jurisdiction: formData.reporting_jurisdiction,
        report_type: formData.report_type,
        schema_version: formData.schema_version,
        message_type_indic: formData.message_type_indic,
        giin: formData.giin || null,
        status: 'draft',
        summary_stats: {
          total_reportable_accounts: previewData.total_reportable_accounts,
          total_controlling_persons: previewData.total_controlling_persons,
          jurisdictions_reported: previewData.jurisdictions_reported,
          total_account_balance: previewData.total_account_balance
        },
        validation_results: {
          is_valid: previewData.validation_warnings.length === 0,
          errors: [],
          warnings: previewData.validation_warnings.map(w => typeof w === 'string' ? w : w.message || JSON.stringify(w)),
          validated_date: new Date().toISOString()
        }
      };

      const report = await base44.entities.CRSReport.create(reportData);
      onComplete(report);
    } catch (error) {
      console.error("Report creation error:", error);
      alert("Failed to create report: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onCancel();
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Report Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="entity_id">Reporting Financial Institution *</Label>
            <Select
              value={formData.entity_id}
              onValueChange={(value) => setFormData({ ...formData, entity_id: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select RFI entity..." />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.entity_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              The entity filing this CRS report
            </p>
          </div>

          <div>
            <Label htmlFor="reporting_year">Reporting Year *</Label>
            <Input
              id="reporting_year"
              type="number"
              min="2014"
              max={new Date().getFullYear()}
              value={formData.reporting_year}
              onChange={(e) => setFormData({ ...formData, reporting_year: parseInt(e.target.value) })}
              className="mt-1.5"
            />
            <p className="text-xs text-slate-500 mt-1">
              Calendar year for which you're reporting
            </p>
          </div>

          <div>
            <Label htmlFor="reporting_jurisdiction">Reporting Jurisdiction *</Label>
            <Input
              id="reporting_jurisdiction"
              value={formData.reporting_jurisdiction}
              onChange={(e) => setFormData({ ...formData, reporting_jurisdiction: e.target.value })}
              placeholder="e.g., United Kingdom, Australia"
              className="mt-1.5"
            />
            <p className="text-xs text-slate-500 mt-1">
              Tax authority jurisdiction receiving this report
            </p>
          </div>

          <div>
            <Label htmlFor="report_type">Report Type</Label>
            <Select
              value={formData.report_type}
              onValueChange={(value) => setFormData({ ...formData, report_type: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crs_xml">CRS XML Report</SelectItem>
                <SelectItem value="nil_report">NIL Report (No Reportable Accounts)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SchemaVersionSelector
            value={formData.schema_version}
            onChange={(value) => setFormData({ ...formData, schema_version: value })}
            jurisdictionConfig={currentJurisdictionConfig}
            reportingYear={formData.reporting_year}
          />

          {currentJurisdictionConfig?.requires_giin && (
            <div>
              <Label htmlFor="giin">GIIN (Global Intermediary Identification Number)</Label>
              <Input
                id="giin"
                value={formData.giin}
                onChange={(e) => setFormData({ ...formData, giin: e.target.value })}
                placeholder="e.g., ABCDEF.12345.LE.123"
                maxLength={19}
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1">
                Required by this jurisdiction for FATCA/CRS reporting
              </p>
            </div>
          )}
        </div>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>About CRS Reporting:</strong> This wizard will generate an XML file compliant with OECD CRS standards. 
          The file will contain all reportable accounts for the selected entity and reporting year.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Data Review</h3>
        <p className="text-sm text-slate-600 mb-4">
          Review the accounts and data that will be included in this report
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-indigo-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600">Reportable Accounts</p>
                <p className="text-2xl font-bold text-slate-900">{accounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600">Controlling Persons</p>
                <p className="text-2xl font-bold text-slate-900">{controllingPersons.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600">Total Balance</p>
                <p className="text-lg font-bold text-slate-900">
                  ${accounts.reduce((sum, acc) => sum + (acc.year_end_cash_value || 0) + (acc.gross_payments || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {accounts.length === 0 ? (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong>No reportable accounts found</strong> for the selected entity and reporting year. 
            Consider generating a NIL report instead, or verify that accounts have been properly classified as reportable.
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base">Accounts to be Reported</CardTitle>
            <CardDescription>
              The following accounts will be included in the XML report
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-700 p-3">Account Holder</th>
                    <th className="text-left text-xs font-semibold text-slate-700 p-3">Account #</th>
                    <th className="text-left text-xs font-semibold text-slate-700 p-3">Type</th>
                    <th className="text-left text-xs font-semibold text-slate-700 p-3">Balance</th>
                    <th className="text-left text-xs font-semibold text-slate-700 p-3">Jurisdictions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3">
                        <p className="text-sm font-medium text-slate-900">{account.account_holder_name}</p>
                        <p className="text-xs text-slate-500 capitalize">{account.account_holder_type}</p>
                      </td>
                      <td className="p-3">
                        <code className="text-xs text-slate-700">{account.account_number}</code>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-slate-600 capitalize">
                          {account.account_type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm font-semibold text-slate-900">
                          ${((account.year_end_cash_value || 0) + (account.gross_payments || 0)).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {account.tax_residencies?.map((res, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {res.country}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
          previewData?.validation_warnings.length === 0 ? 'bg-green-100' : 'bg-amber-100'
        }`}>
          {previewData?.validation_warnings.length === 0 ? (
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          ) : (
            <AlertTriangle className="w-10 h-10 text-amber-600" />
          )}
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Report Preview & Validation</h3>
        <p className="text-slate-600">
          Review the report summary and validation results before creating the report
        </p>
      </div>

      {/* Summary */}
      <Card className="border-2 border-indigo-100 bg-indigo-50/30">
        <CardHeader className="border-b border-indigo-200">
          <CardTitle className="text-lg">Report Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-600 mb-1">Reporting Entity</p>
              <p className="text-sm font-semibold text-slate-900">{previewData?.entity?.entity_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">Reporting Year</p>
              <p className="text-sm font-semibold text-slate-900">{formData.reporting_year}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">Total Accounts</p>
              <p className="text-sm font-semibold text-slate-900">{previewData?.total_reportable_accounts}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">Controlling Persons</p>
              <p className="text-sm font-semibold text-slate-900">{previewData?.total_controlling_persons}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">Total Balance</p>
              <p className="text-sm font-semibold text-slate-900">
                ${(previewData?.total_account_balance || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">Jurisdictions</p>
              <div className="flex flex-wrap gap-1">
                {previewData?.jurisdictions_reported.map((country, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {country}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Results */}
      <Card className={`border-2 ${
        previewData?.validation_warnings.length === 0 
          ? 'border-green-200 bg-green-50/30' 
          : 'border-amber-200 bg-amber-50/30'
      }`}>
        <CardHeader className={`border-b ${
          previewData?.validation_warnings.length === 0 ? 'border-green-200' : 'border-amber-200'
        }`}>
          <CardTitle className="text-lg flex items-center gap-2">
            {previewData?.validation_warnings.length === 0 ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-green-900">Validation Passed</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span className="text-amber-900">Validation Warnings ({previewData?.validation_warnings.length})</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {previewData?.validation_warnings.length === 0 ? (
            <p className="text-sm text-green-900">
              All required data is present and valid. The report is ready to be generated.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-amber-900 mb-3">
                The following issues were found. You can proceed with report generation, but these should be resolved before submission:
              </p>
              {previewData?.validation_warnings.map((warning, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>Next Steps:</strong> Once created, this report will be saved as a draft. You can then generate the XML file, 
          validate it against the schema, and download it for submission to the tax authority.
        </AlertDescription>
      </Alert>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3].map((stepNum) => (
          <React.Fragment key={stepNum}>
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step === stepNum 
                  ? 'bg-indigo-600 text-white' 
                  : step > stepNum 
                    ? 'bg-green-600 text-white' 
                    : 'bg-slate-200 text-slate-600'
              }`}>
                {step > stepNum ? <CheckCircle2 className="w-5 h-5" /> : stepNum}
              </div>
              <span className={`text-sm font-medium ${
                step === stepNum ? 'text-indigo-600' : 'text-slate-600'
              }`}>
                {stepNum === 1 ? 'Configure' : stepNum === 2 ? 'Review Data' : 'Preview'}
              </span>
            </div>
            {stepNum < 3 && (
              <div className={`w-12 h-0.5 ${step > stepNum ? 'bg-green-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleBack}
          size="lg"
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {step === 1 ? "Cancel" : "Back"}
        </Button>
        <Button 
          onClick={handleNext}
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
          disabled={loading || (step === 2 && accounts.length === 0 && formData.report_type !== 'nil_report')}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {step === 3 ? 'Create Report' : 'Next'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}