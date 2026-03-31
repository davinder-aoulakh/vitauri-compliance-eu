import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  Globe,
  AlertCircle,
  FileText,
  History
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import BeneficiaryAuditLog from "./BeneficiaryAuditLog";

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

export default function BeneficiaryDetails({ beneficiary, account }) {
  const [showAuditLog, setShowAuditLog] = React.useState(false);

  if (!beneficiary) return null;

  const getStatusBadge = (status) => {
    const config = {
      reportable: {
        label: "Reportable",
        color: "bg-amber-100 text-amber-800",
        icon: AlertCircle
      },
      non_reportable: {
        label: "Non-Reportable",
        color: "bg-green-100 text-green-800",
        icon: CheckCircle2
      },
      pending_review: {
        label: "Pending Review",
        color: "bg-yellow-100 text-yellow-800",
        icon: Calendar
      },
      excluded: {
        label: "Excluded",
        color: "bg-red-100 text-red-800",
        icon: XCircle
      }
    };
    const { label, color, icon: Icon } = config[status] || config.pending_review;
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const fullName = beneficiary.first_name && beneficiary.last_name
    ? `${beneficiary.first_name} ${beneficiary.last_name}`
    : beneficiary.full_name || "N/A";

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-100 bg-gradient-to-br from-white to-purple-50/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center">
              <User className="w-7 h-7 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                {fullName}
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {getStatusBadge(beneficiary.reportability_status)}
              </div>
            </div>
          </div>

          {/* Beneficiary Actions */}
          <div className="mt-4 pt-4 border-t border-purple-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAuditLog(!showAuditLog)}
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <History className="w-4 h-4 mr-2" />
              {showAuditLog ? "Hide Audit Log" : "View Audit Log"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Section */}
      {showAuditLog && (
        <Card className="border-2 border-purple-100">
          <CardContent className="p-6">
            <BeneficiaryAuditLog beneficiary={beneficiary} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Personal Information */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-0">
            <InfoRow
              icon={User}
              label="Full Name"
              value={fullName}
            />
            {beneficiary.date_of_birth && (
              <InfoRow
                icon={Calendar}
                label="Date of Birth"
                value={format(new Date(beneficiary.date_of_birth.replace(/-/g, '/')), 'MMMM d, yyyy')}
              />
            )}
            {beneficiary.place_of_birth && (
              <InfoRow
                icon={Globe}
                label="Place of Birth"
                value={beneficiary.place_of_birth}
              />
            )}
            {account && (
              <InfoRow
                icon={FileText}
                label="Associated Account"
                value={account.account_holder_name}
              />
            )}
          </CardContent>
        </Card>

        {/* Right Column - Address */}
        <div className="space-y-6">
          {beneficiary.address && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  Address
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {(beneficiary.address.street || beneficiary.address.country) ? (
                  <div className="space-y-1 text-sm">
                    {beneficiary.address.street && (
                      <p className="text-slate-900">{beneficiary.address.street}</p>
                    )}
                    <p className="text-slate-900">
                      {[
                        beneficiary.address.city,
                        beneficiary.address.state,
                        beneficiary.address.postal_code
                      ].filter(Boolean).join(", ")}
                    </p>
                    {beneficiary.address.country && (
                      <p className="font-medium text-slate-900">{beneficiary.address.country}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tax Residencies */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                Tax Residencies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {beneficiary.tax_residencies && beneficiary.tax_residencies.length > 0 ? (
                <div className="space-y-3">
                  {beneficiary.tax_residencies.map((residency, idx) => (
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
                        <XCircle className="w-5 h-5 text-amber-600" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reportability Information */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            Reportability Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-0">
          <InfoRow
            icon={FileText}
            label="Status"
            badge={getStatusBadge(beneficiary.reportability_status)}
          />
          {beneficiary.reportability_reason && (
            <InfoRow
              icon={AlertCircle}
              label="Reason"
              value={beneficiary.reportability_reason}
            />
          )}
          {beneficiary.classified_by && (
            <InfoRow
              icon={User}
              label="Classified By"
              value={beneficiary.classified_by}
            />
          )}
          {beneficiary.classification_date && (
            <InfoRow
              icon={Calendar}
              label="Classification Date"
              value={format(new Date(beneficiary.classification_date), 'MMM d, yyyy h:mm a')}
            />
          )}
        </CardContent>
      </Card>

      {/* Self-Certification Status */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-purple-600" />
            Self-Certification Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-0">
          {beneficiary.self_certification_request_date && (
            <InfoRow
              icon={Calendar}
              label="Certification Requested"
              value={format(new Date(beneficiary.self_certification_request_date.replace(/-/g, '/')), 'MMM d, yyyy')}
            />
          )}
          {beneficiary.self_certification_request_date && (
            <InfoRow
              icon={AlertCircle}
              label="Overdue Status"
              badge={
                <Badge className={beneficiary.self_certification_overdue ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                  {beneficiary.self_certification_overdue ? "Overdue (90+ days)" : "Current"}
                </Badge>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Record Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-0">
          {beneficiary.created_date && (
            <InfoRow
              icon={Calendar}
              label="Created"
              value={format(new Date(beneficiary.created_date), 'MMM d, yyyy h:mm a')}
            />
          )}
          {beneficiary.updated_date && (
            <InfoRow
              icon={Calendar}
              label="Last Updated"
              value={format(new Date(beneficiary.updated_date), 'MMM d, yyyy h:mm a')}
            />
          )}
          {beneficiary.created_by && (
            <InfoRow
              icon={User}
              label="Created By"
              value={beneficiary.created_by}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}