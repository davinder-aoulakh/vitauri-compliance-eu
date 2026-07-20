import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  MapPin, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Info,
  Shield,
  Globe,
  History
} from "lucide-react";
// Format date in AST (UTC-4) for accurate auditing
const formatAST = (value, includeTime = false) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const opts = includeTime
    ? { timeZone: 'America/Puerto_Rico', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }
    : { timeZone: 'America/Puerto_Rico', year: 'numeric', month: 'long', day: 'numeric' };
  return new Intl.DateTimeFormat('en-US', opts).format(d) + (includeTime ? ' AST' : '');
};
import EntityAuditLog from "./EntityAuditLog";

export default function EntityDetails({ entity }) {
  const [showAuditLog, setShowAuditLog] = useState(false);
  // Fetch country info for name lookup
  const { data: countryMap = {} } = useQuery({
    queryKey: ['country-name-map'],
    queryFn: async () => {
      const countries = await base44.entities.CrsCountryInfo.list();
      const map = {};
      countries.forEach(c => {
        if (c.country_code) {
          map[c.country_code.toLowerCase()] = c.country_name;
        }
        if (c.country_name) {
          map[c.country_name.toLowerCase()] = c.country_name;
        }
      });
      return map;
    },
    staleTime: Infinity
  });

  // Fetch referenced data for entity type labels
  const { data: entityTypeOptions = [] } = useQuery({
    queryKey: ['entity-type-options'],
    queryFn: async () => {
      const data = await base44.entities.ReferencedData.filter({
        entity_name: 'Entity',
        field_name: 'entity_type',
        is_published: true
      });
      return data;
    },
    staleTime: Infinity
  });

  // Helper to get country name from code
  const getCountryName = (codeOrName) => {
    if (!codeOrName) return null;
    return countryMap[codeOrName.toLowerCase()] || codeOrName;
  };

  // Helper to get entity type label from value
  const getEntityTypeLabel = (typeValue) => {
    if (!typeValue) return null;
    const option = entityTypeOptions.find(opt => opt.value === typeValue);
    if (option) return option.label;
    // Fallback: capitalize and replace underscores
    return typeValue.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  if (!entity) return null;

  const getStatusBadge = (status) => {
    const config = {
      reporting_fi: { label: "Reporting FI", color: "bg-green-100 text-green-800 border-green-200" },
      non_reporting_fi: { label: "Non-Reporting FI", color: "bg-slate-100 text-slate-800 border-slate-200" },
      nfe_active: { label: "Active NFE", color: "bg-blue-100 text-blue-800 border-blue-200" },
      nfe_passive: { label: "Passive NFE", color: "bg-purple-100 text-purple-800 border-purple-200" },
      pending_classification: { label: "Pending", color: "bg-amber-100 text-amber-800 border-amber-200" }
    };
    const { label, color } = config[status] || config.pending_classification;
    return <Badge variant="outline" className={`${color} border`}>{label}</Badge>;
  };

  const getFITypeBadge = (fiType) => {
    if (!fiType || fiType === "not_applicable") return <span className="text-slate-400">—</span>;
    
    const labels = {
      custodial_institution: "Custodial Institution",
      depository_institution: "Depository Institution",
      investment_entity: "Investment Entity",
      specified_insurance_company: "Insurance Company"
    };
    
    return (
      <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200">
        {labels[fiType] || fiType}
      </Badge>
    );
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
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{entity.entity_name}</h2>
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(entity.rfi_status)}
                {entity.status && (
                  <Badge variant="outline" className={`capitalize ${
                    entity.status === 'active' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {entity.status}
                  </Badge>
                )}
              </div>
              <div className="mt-3">
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Section */}
      {showAuditLog && (
        <Card className="border-2 border-indigo-100">
          <CardContent className="p-6">
            <EntityAuditLog entity={entity} />
          </CardContent>
        </Card>
      )}

      {/* Basic Information */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="w-5 h-5 text-slate-600" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-0">
            <InfoRow 
              label="Entity Type" 
              value={<span className="capitalize">{getEntityTypeLabel(entity.entity_type)}</span>}
              icon={Building2}
            />
            <InfoRow 
              label="Country of Incorporation" 
              value={getCountryName(entity.country_of_incorporation)}
              icon={Globe}
            />
            <InfoRow 
              label="Tax ID" 
              value={entity.tax_id}
              icon={FileText}
            />
            {entity.giin && (
              <InfoRow 
                label="GIIN (Global Intermediary Identification Number)" 
                value={entity.giin}
                icon={Shield}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* CRS Classification */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="w-5 h-5 text-slate-600" />
            CRS Classification
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-0">
            <InfoRow 
              label="RFI Status" 
              value={getStatusBadge(entity.rfi_status)}
              icon={CheckCircle2}
            />
            <InfoRow 
              label="Financial Institution Type" 
              value={getFITypeBadge(entity.fi_type)}
              icon={Building2}
            />

            {entity.classification_completed_date && (
              <InfoRow 
                label="Classification Completed" 
                value={formatAST(entity.classification_completed_date)}
                icon={Calendar}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* FATCA Filing Details — only shown for FFI entities */}
      {entity.is_ffi === true && (
        <Card className="border-0 shadow-lg border-l-4 border-l-amber-400">
          <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-amber-600" />
              FATCA Filing Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-0">
              <InfoRow
                label="Sponsored by Another Entity?"
                value={
                  entity.is_sponsored_ffi
                    ? <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Yes — Sponsored FFI (FilerCategory on Sponsor)</Badge>
                    : <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">No — Files Independently</Badge>
                }
                icon={Shield}
              />
              {!entity.is_sponsored_ffi && (
                <InfoRow
                  label="Institution Registration Type"
                  value={
                    entity.fi_registration_type
                      ? <span>{entity.fi_registration_type}</span>
                      : <span className="text-red-500 font-medium">⚠ Not set — required before XML generation</span>
                  }
                  icon={FileText}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Address Information */}
      {entity.address && (Object.values(entity.address).some(v => v)) && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="w-5 h-5 text-slate-600" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-0">
              {entity.address.street && (
                <InfoRow label="Street" value={entity.address.street} />
              )}
              <div className="grid grid-cols-2 gap-4">
                {entity.address.city && (
                  <InfoRow label="City" value={entity.address.city} />
                )}
                {entity.address.state && (
                  <InfoRow label="State/Province" value={entity.address.state} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {entity.address.postal_code && (
                  <InfoRow label="Postal Code" value={entity.address.postal_code} />
                )}
                {entity.address.country && (
                  <InfoRow label="Country" value={getCountryName(entity.address.country)} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}


    </div>
  );
}