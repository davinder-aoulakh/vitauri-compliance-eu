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
  Shield,
  Building2,
  FileText,
  History
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import ControllingPersonAuditLog from "./ControllingPersonAuditLog";

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

export default function ControllingPersonDetails({ controllingPerson, account }) {
  const [showAuditLog, setShowAuditLog] = React.useState(false);

  if (!controllingPerson) return null;

  const getStatusBadge = (isReportable) => {
    if (isReportable === true) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Reportable
        </Badge>
      );
    } else if (isReportable === false) {
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-600">
          <XCircle className="w-3 h-3 mr-1" />
          Non-Reportable
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          Pending Review
        </Badge>
      );
    }
  };

  const fullName = controllingPerson.first_name && controllingPerson.last_name
    ? `${controllingPerson.first_name} ${controllingPerson.last_name}`
    : controllingPerson.full_name || "N/A";

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center">
              <User className="w-7 h-7 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                {fullName}
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {getStatusBadge(controllingPerson.is_reportable)}
                {controllingPerson.control_type && (
                  <Badge variant="outline" className="capitalize">
                    {controllingPerson.control_type.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Controlling Person Actions */}
          <div className="mt-4 pt-4 border-t border-indigo-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAuditLog(!showAuditLog)}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <History className="w-4 h-4 mr-2" />
              {showAuditLog ? "Hide Audit Log" : "View Audit Log"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Section */}
      {showAuditLog && (
        <Card className="border-2 border-indigo-100">
          <CardContent className="p-6">
            <ControllingPersonAuditLog controllingPerson={controllingPerson} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Personal Information */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-0">
            <InfoRow
              icon={User}
              label="Full Name"
              value={fullName}
            />
            {controllingPerson.date_of_birth && (
              <InfoRow
                icon={Calendar}
                label="Date of Birth"
                value={format(new Date(controllingPerson.date_of_birth.replace(/-/g, '/')), 'MMMM d, yyyy')}
              />
            )}
            <InfoRow
              icon={Shield}
              label="Control Type"
              value={controllingPerson.control_type?.replace(/_/g, ' ')}
            />
            {controllingPerson.ownership_percentage > 0 && (
              <InfoRow
                icon={FileText}
                label="Ownership Percentage"
                value={`${controllingPerson.ownership_percentage}%`}
              />
            )}
            {account && (
              <InfoRow
                icon={Building2}
                label="Associated Account"
                value={account.account_holder_name}
              />
            )}
          </CardContent>
        </Card>

        {/* Right Column - Address */}
        <div className="space-y-6">
          {controllingPerson.address && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                  Address
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {(controllingPerson.address.street || controllingPerson.address.country) ? (
                  <div className="space-y-1 text-sm">
                    {controllingPerson.address.street && (
                      <p className="text-slate-900">{controllingPerson.address.street}</p>
                    )}
                    <p className="text-slate-900">
                      {[
                        controllingPerson.address.city,
                        controllingPerson.address.state,
                        controllingPerson.address.postal_code
                      ].filter(Boolean).join(", ")}
                    </p>
                    {controllingPerson.address.country && (
                      <p className="font-medium text-slate-900">{controllingPerson.address.country}</p>
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
                <Globe className="w-5 h-5 text-indigo-600" />
                Tax Residencies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {controllingPerson.tax_residencies && controllingPerson.tax_residencies.length > 0 ? (
                <div className="space-y-3">
                  {controllingPerson.tax_residencies.map((residency, idx) => (
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
            <FileText className="w-5 h-5 text-indigo-600" />
            Reportability Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-0">
          <InfoRow
            icon={FileText}
            label="Status"
            badge={getStatusBadge(controllingPerson.is_reportable)}
          />
          {controllingPerson.us_person_indic !== undefined && (
            <InfoRow
              icon={Shield}
              label="US Person Indicator"
              badge={
                <Badge className={controllingPerson.us_person_indic ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-800"}>
                  {controllingPerson.us_person_indic ? "Yes" : "No"}
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
            <Calendar className="w-5 h-5 text-indigo-600" />
            Record Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-0">
          {controllingPerson.created_date && (
            <InfoRow
              icon={Calendar}
              label="Created"
              value={format(new Date(controllingPerson.created_date), 'MMM d, yyyy h:mm a')}
            />
          )}
          {controllingPerson.updated_date && (
            <InfoRow
              icon={Calendar}
              label="Last Updated"
              value={format(new Date(controllingPerson.updated_date), 'MMM d, yyyy h:mm a')}
            />
          )}
          {controllingPerson.created_by && (
            <InfoRow
              icon={User}
              label="Created By"
              value={controllingPerson.created_by}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}