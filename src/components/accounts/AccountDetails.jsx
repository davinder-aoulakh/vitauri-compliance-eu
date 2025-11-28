import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  User,
  MapPin,
  CreditCard,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  Download,
  Eye,
  FileCheck
} from "lucide-react";

const InfoRow = ({ icon: Icon, label, value, badge, color }) => (
  <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
    <Icon className={`w-4 h-4 mt-1 ${color || 'text-slate-400'}`} />
    <div className="flex-1">
      <p className="text-xs text-slate-600">{label}</p>
      {badge ? (
        badge
      ) : (
        <p className="text-sm font-medium text-slate-900 mt-0.5">{value || "—"}</p>
      )}
    </div>
  </div>
);

export default function AccountDetails({ account, entity }) {
  if (!account) return null;

  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const config = {
      reportable: { label: "Reportable", color: "bg-green-100 text-green-800" },
      non_reportable: { label: "Non-Reportable", color: "bg-slate-100 text-slate-800" },
      pending_review: { label: "Pending Review", color: "bg-amber-100 text-amber-800" },
      excluded: { label: "Excluded", color: "bg-red-100 text-red-800" }
    };
    const { label, color } = config[status] || config.pending_review;
    return <Badge className={color}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center">
              {account.account_holder_type === 'individual' ? (
                <User className="w-7 h-7 text-indigo-600" />
              ) : (
                <Building2 className="w-7 h-7 text-indigo-600" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                {account.account_holder_name}
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {getStatusBadge(account.reportability_status)}
                <Badge variant="outline" className="capitalize">
                  {account.account_holder_type?.replace("_", " ")}
                </Badge>
                {account.entity_classification && (
                  <Badge variant="outline" className="capitalize bg-purple-50 text-purple-700 border-purple-200">
                    {account.entity_classification.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Information */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-0">
            <InfoRow
              icon={FileText}
              label="Account Number"
              value={account.account_number}
            />
            <InfoRow
              icon={CreditCard}
              label="Account Type"
              value={account.account_type?.replace(/_/g, " ")}
            />
            <InfoRow
              icon={CreditCard}
              label="Balance"
              value={formatCurrency(account.account_balance, account.currency)}
            />
            <InfoRow
              icon={Calendar}
              label="Reporting Year"
              value={account.reporting_year}
            />
            {account.date_of_birth && (
              <InfoRow
                icon={Calendar}
                label="Date of Birth"
                value={account.date_of_birth ? new Date(account.date_of_birth).toLocaleDateString() : "—"}
              />
            )}
            {entity && (
              <InfoRow
                icon={Building2}
                label="Related Entity"
                value={entity.entity_name}
              />
            )}
          </CardContent>
        </Card>

        {/* Holder Address */}
        {account.account_holder_address && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                Account Holder Address
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-1 text-sm">
                {account.account_holder_address.street && (
                  <p className="text-slate-900">{account.account_holder_address.street}</p>
                )}
                <p className="text-slate-900">
                  {[
                    account.account_holder_address.city,
                    account.account_holder_address.state,
                    account.account_holder_address.postal_code
                  ].filter(Boolean).join(", ")}
                </p>
                {account.account_holder_address.country && (
                  <p className="font-medium text-slate-900">{account.account_holder_address.country}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tax Residencies */}
      {account.tax_residencies && account.tax_residencies.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              Tax Residencies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {account.tax_residencies.map((residency, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{residency.country}</p>
                      {residency.tin ? (
                        <p className="text-xs text-slate-600">TIN: <code className="bg-white px-1 py-0.5 rounded">{residency.tin}</code></p>
                      ) : residency.tin_unavailable_reason ? (
                        <p className="text-xs text-amber-600">TIN: {residency.tin_unavailable_reason}</p>
                      ) : (
                        <p className="text-xs text-red-600">TIN: Not provided</p>
                      )}
                    </div>
                  </div>
                  {residency.tin ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Self-Certification Document - Show latest from documents array or legacy field */}
      {(() => {
        // Get the latest self-certification document from documents array
        const selfCertDocs = (account.documents || [])
          .filter(d => d.document_type === 'self_certification')
          .sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
        
        const latestDoc = selfCertDocs[0];
        
        // Fall back to legacy field if no documents in array
        const docUrl = latestDoc?.document_url || account.self_certification_document_url;
        const docName = latestDoc?.document_name || account.self_certification_document_name || 'Self-Certification Form';
        const uploadDate = latestDoc?.upload_date || account.self_certification_upload_date;
        const uploadedBy = latestDoc?.uploaded_by_email || account.self_certification_uploaded_by_email;
        
        if (!docUrl) return null;
        
        return (
          <Card className="border-2 border-green-200 bg-green-50/30">
            <CardHeader className="border-b border-green-200">
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-green-600" />
                Self-Certification Document
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      {docName}
                    </p>
                    {uploadDate && (
                      <p className="text-xs text-green-700">
                        Uploaded: {new Date(uploadDate).toLocaleString()}
                      </p>
                    )}
                    {uploadedBy && (
                      <p className="text-xs text-green-700">
                        By: {uploadedBy}
                      </p>
                    )}
                    {account.self_certification_date && (
                      <p className="text-xs text-green-700">
                        Certified: {new Date(account.self_certification_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(docUrl, '_blank')}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = docUrl;
                      link.download = docName;
                      link.click();
                    }}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Reportability Information */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Reportability Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-0">
          <InfoRow
            icon={FileText}
            label="Status"
            badge={getStatusBadge(account.reportability_status)}
          />
          {account.reportability_reason && (
            <InfoRow
              icon={FileText}
              label="Reason"
              value={account.reportability_reason}
            />
          )}
          <InfoRow
            icon={account.self_certification_obtained ? CheckCircle2 : XCircle}
            label="Self-Certification"
            badge={
              <Badge className={account.self_certification_obtained ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {account.self_certification_obtained ? "Obtained" : "Not Obtained"}
              </Badge>
            }
            color={account.self_certification_obtained ? "text-green-600" : "text-red-600"}
          />
          {account.self_certification_date && (
            <InfoRow
              icon={Calendar}
              label="Certification Date"
              value={account.self_certification_date ? new Date(account.self_certification_date).toLocaleDateString() : "—"}
            />
          )}
          {account.indicia_found && account.indicia_found.length > 0 && (
            <InfoRow
              icon={AlertTriangle}
              label="Indicia Found"
              badge={
                <div className="flex flex-wrap gap-1 mt-1">
                  {account.indicia_found.map((indicia, idx) => (
                    <Badge key={idx} variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs">
                      {indicia.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              }
              color="text-amber-600"
            />
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Record Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-0">
          {account.created_date && (
            <InfoRow
              icon={Calendar}
              label="Created"
              value={account.created_date ? new Date(account.created_date).toLocaleString() : "—"}
            />
          )}
          {account.updated_date && (
            <InfoRow
              icon={Calendar}
              label="Last Updated"
              value={account.updated_date ? new Date(account.updated_date).toLocaleString() : "—"}
            />
          )}
          {account.created_by && (
            <InfoRow
              icon={User}
              label="Created By"
              value={account.created_by}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}