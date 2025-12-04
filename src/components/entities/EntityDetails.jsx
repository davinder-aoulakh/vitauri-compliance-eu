import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  MapPin, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Info,
  Shield,
  Globe
} from "lucide-react";
import { format } from "date-fns";

export default function EntityDetails({ entity }) {
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
            </div>
          </div>
        </CardContent>
      </Card>

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
              value={<span className="capitalize">{entity.entity_type?.replace(/_/g, " ")}</span>}
              icon={Building2}
            />
            <InfoRow 
              label="Country of Incorporation" 
              value={entity.country_of_incorporation}
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
            {entity.non_reporting_reason && (
              <InfoRow 
                label="Non-Reporting Reason" 
                value={entity.non_reporting_reason}
                icon={Info}
              />
            )}
            {entity.classification_completed_date && (
              <InfoRow 
                label="Classification Completed" 
                value={format(new Date(entity.classification_completed_date), 'MMMM d, yyyy')}
                icon={Calendar}
              />
            )}
          </div>
        </CardContent>
      </Card>

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
                  <InfoRow label="Country" value={entity.address.country} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card className="border-0 shadow-lg bg-slate-50">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-500 mb-1">Created</p>
              <p className="text-slate-900 font-medium">
                {entity.created_date ? format(new Date(entity.created_date), 'MMM d, yyyy h:mm a') : '—'}
              </p>
              {entity.created_by && (
                <p className="text-slate-600 text-xs mt-0.5">by {entity.created_by}</p>
              )}
            </div>
            <div>
              <p className="text-slate-500 mb-1">Last Updated</p>
              <p className="text-slate-900 font-medium">
                {entity.updated_date ? format(new Date(entity.updated_date), 'MMM d, yyyy h:mm a') : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}