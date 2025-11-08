import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  User, 
  Building2, 
  MapPin, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Info,
  DollarSign,
  Globe
} from "lucide-react";
import { format } from "date-fns";

export default function AccountDetails({ account, entity }) {
  if (!account) return null;

  const getStatusBadge = (status) => {
    const config = {
      reportable: { label: "Reportable", color: "bg-green-100 text-green-800 border-green-200" },
      non_reportable: { label: "Non-Reportable", color: "bg-slate-100 text-slate-800 border-slate-200" },
      pending_review: { label: "Pending Review", color: "bg-amber-100 text-amber-800 border-amber-200" },
      excluded: { label: "Excluded", color: "bg-red-100 text-red-800 border-red-200" }
    };
    const { label, color } = config[status] || config.pending_review;
    return <Badge variant="outline" className={`${color} border`}>{label}</Badge>;
  };

  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount || 0);
  };

  const InfoRow = ({ label, value, icon: Icon }) => (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        {Icon && <Icon className="w-4 h-4 text-indigo-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
        <div className="text-sm text-slate-900">{value || <span className="text-slate-400">Not specified</span>}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{account.account_holder_name}</h2>
              <p className="text-sm text-slate-600 mb-3">Account: {account.account_number}</p>
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(account.reportability_status)}
                <Badge variant="outline" className="capitalize bg-blue-50 text-blue-700 border-blue-200">
                  {account.account_holder_type?.replace("_", " ")}
                </Badge>
                {account.status && (
                  <Badge variant="outline" className={`capitalize ${
                    account.status === 'active' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {account.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="w-5 h-5 text-slate-600" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-0">
            <InfoRow 
              label="Account Number" 
              value={<span className="font-mono">{account.account_number}</span>}
              icon={FileText}
            />
            <InfoRow 
              label="Account Type" 
              value={<span className="capitalize">{account.account_type?.replace(/_/g, " ")}</span>}
              icon={Wallet}
            />
            <InfoRow 
              label="Account Balance" 
              value={<span className="font-semibold text-lg">{formatCurrency(account.account_balance, account.currency)}</span>}
              icon={DollarSign}
            />
            <InfoRow 
              label="Currency" 
              value={account.currency}
              icon={DollarSign}
            />
            <InfoRow 
              label="Reporting Year" 
              value={account.reporting_year}
              icon={Calendar}
            />
            {entity && (
              <InfoRow 
                label="Associated Entity" 
                value={entity.entity_name}
                icon={Building2}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Holder Information */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-slate-600" />
            Account Holder
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-0">
            <InfoRow 
              label="Account Holder Name" 
              value={account.account_holder_name}
              icon={User}
            />
            <InfoRow 
              label="Holder Type" 
              value={<span className="capitalize">{account.account_holder_type?.replace("_", " ")}</span>}
              icon={User}
            />
            {account.account_holder_type === "individual" && account.date_of_birth && (
              <InfoRow 
                label="Date of Birth" 
                value={format(new Date(account.date_of_birth), 'MMMM d, yyyy')}
                icon={Calendar}
              />
            )}
            {account.entity_classification && (
              <InfoRow 
                label="Entity Classification" 
                value={<span className="capitalize">{account.entity_classification.replace(/_/g, " ")}</span>}
                icon={Building2}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      {account.account_holder_address && (Object.values(account.account_holder_address).some(v => v)) && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="w-5 h-5 text-slate-600" />
              Account Holder Address
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-0">
              {account.account_holder_address.street && (
                <InfoRow label="Street" value={account.account_holder_address.street} />
              )}
              <div className="grid grid-cols-2 gap-4">
                {account.account_holder_address.city && (
                  <InfoRow label="City" value={account.account_holder_address.city} />
                )}
                {account.account_holder_address.state && (
                  <InfoRow label="State/Province" value={account.account_holder_address.state} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {account.account_holder_address.postal_code && (
                  <InfoRow label="Postal Code" value={account.account_holder_address.postal_code} />
                )}
                {account.account_holder_address.country && (
                  <InfoRow label="Country" value={account.account_holder_address.country} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Residencies */}
      {account.tax_residencies && account.tax_residencies.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-slate-600" />
              Tax Residencies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {account.tax_residencies.map((residency, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Country</span>
                      <Badge variant="outline" className="bg-white">{residency.country}</Badge>
                    </div>
                    {residency.tin && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">TIN</span>
                        <span className="text-sm text-slate-900 font-mono">{residency.tin}</span>
                      </div>
                    )}
                    {residency.tin_unavailable_reason && (
                      <div>
                        <span className="text-xs font-medium text-slate-500">TIN Unavailable Reason:</span>
                        <p className="text-sm text-slate-700 mt-1">{residency.tin_unavailable_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reportability Details */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="w-5 h-5 text-slate-600" />
            Reportability
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-0">
            <InfoRow 
              label="Reportability Status" 
              value={getStatusBadge(account.reportability_status)}
              icon={CheckCircle2}
            />
            {account.reportability_reason && (
              <InfoRow 
                label="Reason" 
                value={account.reportability_reason}
                icon={Info}
              />
            )}
            {account.indicia_found && account.indicia_found.length > 0 && (
              <InfoRow 
                label="Foreign Indicia Found" 
                value={
                  <div className="flex flex-wrap gap-1">
                    {account.indicia_found.map((indicia, idx) => (
                      <Badge key={idx} variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                        {indicia}
                      </Badge>
                    ))}
                  </div>
                }
                icon={Info}
              />
            )}
            <InfoRow 
              label="Self-Certification" 
              value={
                account.self_certification_obtained ? (
                  <div>
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Obtained
                    </Badge>
                    {account.self_certification_date && (
                      <p className="text-xs text-slate-500 mt-1">
                        Date: {format(new Date(account.self_certification_date), 'MMMM d, yyyy')}
                      </p>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                    Not Obtained
                  </Badge>
                )
              }
              icon={FileText}
            />
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card className="border-0 shadow-lg bg-slate-50">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-500 mb-1">Created</p>
              <p className="text-slate-900 font-medium">
                {account.created_date ? format(new Date(account.created_date), 'MMM d, yyyy h:mm a') : '—'}
              </p>
              {account.created_by && (
                <p className="text-slate-600 text-xs mt-0.5">by {account.created_by}</p>
              )}
            </div>
            <div>
              <p className="text-slate-500 mb-1">Last Updated</p>
              <p className="text-slate-900 font-medium">
                {account.updated_date ? format(new Date(account.updated_date), 'MMM d, yyyy h:mm a') : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}