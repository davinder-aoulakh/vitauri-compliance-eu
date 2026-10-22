import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FileCheck,
  Users,
  History
} from "lucide-react";
import AccountAuditLog from "./AccountAuditLog";
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from "@/lib/dateUtils";
import { getAccountBalanceLabel, getAccountGrossPaymentLabel } from "@/lib/accountReportingLabels";

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
  // Fetch beneficiaries for deceased individual accounts
  const { data: beneficiaries = [] } = useQuery({
    queryKey: ['beneficiaries', account?.id],
    queryFn: () => base44.entities.Beneficiary.filter({ account_id: account?.id }),
    enabled: !!account?.id && account?.account_holder_type === 'individual' && !account?.account_holder_is_alive
  });

  // Fetch controlling persons for entity accounts
  const { data: controllingPersons = [] } = useQuery({
    queryKey: ['controlling-persons', account?.id],
    queryFn: () => base44.entities.ControllingPerson.filter({ account_id: account?.id }),
    enabled: !!account?.id && account?.account_holder_type === 'entity'
  });

  // Fetch referenced data for labels
  const { data: referencedData = [] } = useQuery({
    queryKey: ['referenced-data-labels'],
    queryFn: () => base44.entities.ReferencedData.list()
  });

  const [showAuditLog, setShowAuditLog] = React.useState(false);

  if (!account) return null;

  // Helper function to get label from value
  const getLabel = (entityName, fieldName, value) => {
    const item = referencedData.find(
      rd => rd.entity_name === entityName && rd.field_name === fieldName && rd.value === value
    );
    return item?.label || value?.replace(/_/g, " ");
  };

  const showBeneficiaries = account.account_holder_type === 'individual' && !account.account_holder_is_alive;
  const showControllingPersons = account.account_holder_type === 'entity';

  const formatCurrency = (amount, currency) => {
    const safeCurrency = currency && currency.trim().length === 3 ? currency.trim() : "USD";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const config = {
      reportable: { label: "Reportable", color: "bg-green-100 text-green-800" },
      non_reportable: { label: "Non-Reportable", color: "bg-slate-100 text-slate-800" },
      pending_review: { label: "Pending Review", color: "bg-amber-100 text-amber-800" },
      excluded: { label: "Excluded", color: "bg-red-100 text-red-800" },
      work_in_progress: { label: "Work in progress", color: "bg-blue-100 text-blue-800" }
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
                    {account.entity_classification === "not_applicable" ? "Still to be determined" : account.entity_classification.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Account Actions */}
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
            <AccountAuditLog account={account} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Account Information */}
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
              icon={Calendar}
              label="Account Opening Date"
              value={formatDateDDMMYYYY(account.account_creation_date)}
            />
            <InfoRow
              icon={CreditCard}
              label="Account Type"
              value={getLabel('Account', 'account_type', account.account_type)}
            />
            <InfoRow
              icon={CreditCard}
              label={getAccountBalanceLabel(account.account_type)}
              value={formatCurrency(account.year_end_cash_value, account.year_end_cash_value_currency)}
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
                value={formatDateDDMMYYYY(account.date_of_birth)}
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

        {/* Right Column - Address Stack */}
        <div className="space-y-6">
          {/* Current Address */}
          {account.current_address && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                  Current Address
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-1 text-sm">
                  {account.current_address.street && (
                    <p className="text-slate-900">{account.current_address.street}</p>
                  )}
                  <p className="text-slate-900">
                    {[
                      account.current_address.city,
                      account.current_address.state,
                      account.current_address.postal_code
                    ].filter(Boolean).join(", ")}
                  </p>
                  {account.current_address.country && (
                    <p className="font-medium text-slate-900">{account.current_address.country}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Holder Original Address */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                Original Address
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {account.account_holder_address && (account.account_holder_address.street || account.account_holder_address.country) ? (
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
              ) : (
                <p className="text-sm text-slate-400">—</p>
              )}
            </CardContent>
          </Card>

          {/* Tax Residencies */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-600" />
                Tax Residencies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {account.tax_residencies && account.tax_residencies.length > 0 ? (
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
              ) : (
                <p className="text-sm text-slate-400">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
                        Uploaded: {formatDateTimeDDMMYYYY(uploadDate)}
                      </p>
                    )}
                    {uploadedBy && (
                      <p className="text-xs text-green-700">
                        By: {uploadedBy}
                      </p>
                    )}
                    {account.self_certification_date && (
                      <p className="text-xs text-green-700">
                        Certified: {formatDateTimeDDMMYYYY(account.self_certification_date)}
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
          {account.reportability_status === "reportable" && (
            <div className="pt-4 mt-4 border-t border-slate-200">
              <h4 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Reportable Data
              </h4>
              
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mt-3 mb-2">RFI General Information</p>
              <InfoRow
                icon={FileText}
                label="The Tax number of the RFI"
                value={entity?.tax_id || "—"}
              />
              <InfoRow
                icon={Building2}
                label="The name of the RFI"
                value={entity?.entity_name || "—"}
              />

              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mt-4 mb-2">Account Holder General Information</p>
              <InfoRow
                icon={CreditCard}
                label="Account number with the RFI of the Account Holder"
                value={account.account_number}
              />
              <InfoRow
                icon={User}
                label="Name of the account holder"
                value={account.account_holder_name}
              />
              <InfoRow
                icon={MapPin}
                label="Current Address of the account holder"
                value={
                  account.current_address
                    ? [
                        account.current_address.street,
                        account.current_address.city,
                        account.current_address.state,
                        account.current_address.postal_code,
                        account.current_address.country
                      ].filter(Boolean).join(', ')
                    : "—"
                }
              />
              <InfoRow
                icon={Calendar}
                label="Date of birth of the account holder"
                value={formatDateDDMMYYYY(account.date_of_birth)}
              />
              <InfoRow
                icon={Globe}
                label="Place of birth of the account holder"
                value={account.place_of_birth || "—"}
              />
              <InfoRow
                icon={Globe}
                label="Jurisdiction of residence of the account holder"
                value={account.country_of_residence || "—"}
              />
              <InfoRow
                icon={FileText}
                label="TIN of the account holder"
                value={account.tax_residencies?.[0]?.tin || "—"}
              />

              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mt-4 mb-2">Account Holder Financial Information</p>
              <InfoRow
                icon={CreditCard}
                label={getAccountBalanceLabel(account.account_type)}
                value={formatCurrency(account.year_end_cash_value, account.year_end_cash_value_currency || "USD")}
              />
              <InfoRow
                icon={CreditCard}
                label={`Income: ${getAccountGrossPaymentLabel(account.account_type)}`}
                value={formatCurrency(account.gross_payments, account.gross_payments_currency || "USD")}
              />
              {account.account_closed_during_period && (
                <InfoRow
                  icon={Calendar}
                  label="Date of Account Closing"
                  value={formatDateTimeDDMMYYYY(account.updated_date)}
                />
              )}
            </div>
          )}
          {account.self_certification_date && (
            <InfoRow
              icon={Calendar}
              label="Certification Date"
              value={formatDateDDMMYYYY(account.self_certification_date)}
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

      {/* Beneficiaries Section - For deceased individual accounts */}
      {showBeneficiaries && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-purple-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Beneficiaries ({beneficiaries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {beneficiaries.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No beneficiaries added</p>
            ) : (
              <div className="space-y-3">
                {beneficiaries.map((beneficiary) => (
                  <div key={beneficiary.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{beneficiary.full_name}</p>
                      {beneficiary.date_of_birth && (
                        <p className="text-xs text-slate-600">
                          DOB: {formatDateDDMMYYYY(beneficiary.date_of_birth)}
                        </p>
                      )}
                      {beneficiary.address?.country && (
                        <div className="flex items-center gap-1 text-xs text-slate-600 mt-1">
                          <MapPin className="w-3 h-3" />
                          {[beneficiary.address.city, beneficiary.address.country].filter(Boolean).join(", ")}
                        </div>
                      )}
                      <div className="mt-2">
                        <Badge className={
                          beneficiary.reportability_status === 'reportable' 
                            ? "bg-green-100 text-green-800" 
                            : beneficiary.reportability_status === 'non_reportable'
                              ? "bg-slate-100 text-slate-800"
                              : "bg-amber-100 text-amber-800"
                        }>
                          {beneficiary.reportability_status?.replace(/_/g, ' ') || 'Pending Review'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Controlling Persons Section - For entity accounts */}
      {showControllingPersons && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-indigo-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Controlling Persons ({controllingPersons.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {controllingPersons.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No controlling persons added</p>
            ) : (
              <div className="space-y-3">
                {controllingPersons.map((person) => (
                  <div key={person.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{person.full_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {person.control_type && (
                          <Badge variant="outline" className="capitalize text-xs">
                            {person.control_type?.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        {person.ownership_percentage > 0 && (
                          <span className="text-xs text-slate-600">{person.ownership_percentage}% ownership</span>
                        )}
                      </div>
                      {person.address?.country && (
                        <div className="flex items-center gap-1 text-xs text-slate-600 mt-1">
                          <MapPin className="w-3 h-3" />
                          {[person.address.city, person.address.country].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {person.tax_residencies && person.tax_residencies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {person.tax_residencies.map((res, idx) => (
                            <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                              <Globe className="w-3 h-3 mr-1" />
                              {res.country}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-2">
                        <Badge className={person.is_reportable ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"}>
                          {person.is_reportable ? 'Reportable' : 'Non-Reportable'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              value={formatDateTimeDDMMYYYY(account.created_date)}
            />
          )}
          {account.updated_date && (
            <InfoRow
              icon={Calendar}
              label="Last Updated"
              value={formatDateTimeDDMMYYYY(account.updated_date)}
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