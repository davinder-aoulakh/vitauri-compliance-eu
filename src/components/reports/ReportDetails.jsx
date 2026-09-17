import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Calendar,
  Building2,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Users,
  DollarSign
} from "lucide-react";
import { toDisplayDate, toDisplayDateTime } from "@/lib/dateUtils";

const InfoRow = ({ icon: Icon, label, value, badge }) => (
  <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
    <Icon className="w-4 h-4 mt-1 text-slate-400" />
    <div className="flex-1">
      <p className="text-xs text-slate-600">{label}</p>
      {badge ? badge : (
        <p className="text-sm font-medium text-slate-900 mt-0.5">{value || "—"}</p>
      )}
    </div>
  </div>
);

export default function ReportDetails({ report, entity }) {
  if (!report) return null;

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileText className="w-7 h-7 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                CRS Report - {report.reporting_year}
              </h3>
              <p className="text-sm text-slate-600 mb-2">
                {entity?.entity_name || "Unknown Entity"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className={
                  report.status === 'submitted' || report.status === 'accepted' 
                    ? "bg-green-100 text-green-800" 
                    : report.status === 'validated'
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-100 text-slate-800"
                }>
                  {report.status}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {report.report_type?.replace('_', ' ')}
                </Badge>
                <Badge variant="outline">
                  Schema {report.schema_version || report.xml_schema_version}
                </Badge>
                {report.message_type_indic && (
                  <Badge variant="outline" className={
                    report.message_type_indic === 'CRS702' ? 'bg-blue-50 text-blue-700' :
                    report.message_type_indic === 'CRS703' ? 'bg-red-50 text-red-700' :
                    'bg-slate-50 text-slate-700'
                  }>
                    {report.message_type_indic}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Report Information */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Report Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-0">
            <InfoRow
              icon={Calendar}
              label="Reporting Year"
              value={report.reporting_year}
            />
            <InfoRow
              icon={Globe}
              label="Reporting Jurisdiction"
              value={report.reporting_jurisdiction}
            />
            <InfoRow
              icon={Building2}
              label="Reporting Entity"
              value={entity?.entity_name}
            />
            <InfoRow
              icon={Calendar}
              label="Report Created"
              value={toDisplayDateTime(report.created_date)}
            />
            {report.submission_date && (
              <InfoRow
                icon={Calendar}
                label="Submitted"
                value={toDisplayDate(report.submission_date)}
              />
            )}
            {report.submission_reference && (
              <InfoRow
                icon={FileText}
                label="Submission Reference"
                value={report.submission_reference}
              />
            )}
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Summary Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-0">
            <InfoRow
              icon={FileText}
              label="Total Reportable Accounts"
              value={report.summary_stats?.total_reportable_accounts || 0}
            />
            <InfoRow
              icon={Users}
              label="Controlling Persons"
              value={report.summary_stats?.total_controlling_persons || 0}
            />
            <InfoRow
              icon={DollarSign}
              label="Total Account Balance"
              value={`$${(report.summary_stats?.total_account_balance || 0).toLocaleString()}`}
            />
            <InfoRow
              icon={Globe}
              label="Jurisdictions Reported"
              badge={
                <div className="flex flex-wrap gap-1 mt-1">
                  {report.summary_stats?.jurisdictions_reported?.map((country, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {country}
                    </Badge>
                  ))}
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Validation Results */}
      {report.validation_results && (
        <Card className={`border-2 ${
          report.validation_results.is_valid 
            ? 'border-green-200 bg-green-50/30' 
            : 'border-amber-200 bg-amber-50/30'
        }`}>
          <CardHeader className={`border-b ${
            report.validation_results.is_valid ? 'border-green-200' : 'border-amber-200'
          }`}>
            <CardTitle className="text-base flex items-center gap-2">
              {report.validation_results.is_valid ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-green-900">Validation Passed</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="text-amber-900">Validation Results</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {report.validation_results.errors && report.validation_results.errors.length > 0 && (
              <div className="space-y-1 mb-3">
                <p className="text-sm font-semibold text-red-900">Errors:</p>
                {report.validation_results.errors.map((error, idx) => (
                  <p key={idx} className="text-sm text-red-800">• {error}</p>
                ))}
              </div>
            )}
            {report.validation_results.warnings && report.validation_results.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900">Warnings:</p>
                {report.validation_results.warnings.map((warning, idx) => (
                  <p key={idx} className="text-sm text-amber-800">• {warning}</p>
                ))}
              </div>
            )}
            {report.validation_results.validated_date && (
              <p className="text-xs text-slate-600 mt-3">
                Validated: {toDisplayDateTime(report.validation_results.validated_date)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Correction/Deletion Information */}
      {(report.correction_message_ref_id || report.message_type_indic === 'CRS702' || report.message_type_indic === 'CRS703') && (
        <Card className="border-2 border-amber-100 bg-amber-50/30">
          <CardHeader className="border-b border-amber-200">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              {report.message_type_indic === 'CRS703' ? 'Deletion Report' : 'Correction Report'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {report.correction_message_ref_id && (
              <div>
                <p className="text-xs text-amber-700">Original Message Ref ID:</p>
                <p className="text-sm font-mono text-amber-900">{report.correction_message_ref_id}</p>
              </div>
            )}
            {report.notification_details?.correction_reason && (
              <div>
                <p className="text-xs text-amber-700">Reason:</p>
                <p className="text-sm text-amber-900">{report.notification_details.correction_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* XML File Information */}
      {report.xml_file_url && (
        <Card className="border-2 border-blue-100 bg-blue-50/30">
          <CardHeader className="border-b border-blue-200">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              XML File
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  CRS XML File Generated
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Schema Version: {report.schema_version || report.xml_schema_version}
                </p>
                {report.giin && (
                  <p className="text-xs text-blue-700 mt-1">
                    GIIN: {report.giin}
                  </p>
                )}
              </div>
              <a
                href={report.xml_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Download →
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Authority Notifications */}
      {report.notification_details?.last_notification_date && (
        <Card className={`border-2 ${
          report.status === 'accepted' ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'
        }`}>
          <CardHeader className={`border-b ${
            report.status === 'accepted' ? 'border-green-200' : 'border-red-200'
          }`}>
            <CardTitle className="text-base flex items-center gap-2">
              {report.status === 'accepted' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              Tax Authority Response
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            <div>
              <p className="text-xs text-slate-700">Status:</p>
              <p className="text-sm font-semibold">{report.notification_details.notification_status}</p>
            </div>
            {report.notification_details.error_code && (
              <div>
                <p className="text-xs text-red-700">Error Code:</p>
                <p className="text-sm font-mono text-red-900">{report.notification_details.error_code}</p>
              </div>
            )}
            {report.notification_details.error_description && (
              <div>
                <p className="text-xs text-red-700">Error Description:</p>
                <p className="text-sm text-red-900">{report.notification_details.error_description}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-700">Received:</p>
              <p className="text-sm text-slate-900">
                {toDisplayDateTime(report.notification_details.last_notification_date)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}