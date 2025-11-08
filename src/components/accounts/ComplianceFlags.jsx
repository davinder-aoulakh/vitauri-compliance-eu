import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Users,
  Eye,
  Calendar
} from "lucide-react";

export default function ComplianceFlags({ tenantId, onSelectAccount }) {
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', tenantId],
    queryFn: () => tenantId 
      ? base44.entities.Account.filter({ tenant_id: tenantId })
      : [],
    enabled: !!tenantId
  });

  const { data: controllingPersons = [] } = useQuery({
    queryKey: ['all-controlling-persons', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const persons = await base44.entities.ControllingPerson.filter({ tenant_id: tenantId });
      return persons;
    },
    enabled: !!tenantId
  });

  // Calculate compliance issues
  const issues = {
    pendingReview: accounts.filter(a => a.reportability_status === 'pending_review'),
    missingSelfCert: accounts.filter(a => 
      a.account_holder_type === 'individual' && 
      !a.self_certification_obtained &&
      a.reportability_status !== 'non_reportable'
    ),
    missingTIN: accounts.filter(a => 
      a.tax_residencies && 
      a.tax_residencies.some(r => !r.tin && !r.tin_unavailable_reason)
    ),
    passiveNFENoControlling: accounts.filter(a => {
      if (a.entity_classification !== 'passive_nfe') return false;
      const accountControllingPersons = controllingPersons.filter(cp => cp.account_id === a.id);
      return accountControllingPersons.length === 0;
    }),
    highValueIndicia: accounts.filter(a => 
      a.account_balance > 1000000 && 
      a.indicia_found && 
      a.indicia_found.length > 0 &&
      !a.self_certification_obtained
    ),
    oldClassification: accounts.filter(a => {
      if (!a.updated_date) return false;
      const daysSinceUpdate = (Date.now() - new Date(a.updated_date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 365 && a.reportability_status !== 'pending_review';
    })
  };

  const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);

  const IssueCard = ({ title, description, accounts, icon: Icon, color, actionText }) => {
    if (accounts.length === 0) return null;

    return (
      <Card className={`border-2 ${color.border} ${color.bg}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg ${color.iconBg} flex items-center justify-center mt-1`}>
                <Icon className={`w-5 h-5 ${color.icon}`} />
              </div>
              <div>
                <CardTitle className="text-base mb-1">{title}</CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
              </div>
            </div>
            <Badge className={color.badge}>
              {accounts.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {accounts.slice(0, 5).map((account) => (
              <div 
                key={account.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {account.account_holder_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {account.account_number}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelectAccount(account)}
                  className="ml-2 flex-shrink-0"
                >
                  {actionText}
                </Button>
              </div>
            ))}
            {accounts.length > 5 && (
              <p className="text-xs text-slate-500 text-center py-2">
                +{accounts.length - 5} more accounts
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-amber-100 bg-gradient-to-br from-white to-amber-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
                Compliance Flags
              </CardTitle>
              <CardDescription className="mt-1">
                Accounts requiring attention for CRS compliance
              </CardDescription>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">{totalIssues}</div>
              <div className="text-xs text-amber-700">Total Issues</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {totalIssues === 0 ? (
        <Card className="border-2 border-green-100 bg-green-50/30">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              All Clear! 🎉
            </h3>
            <p className="text-green-700">
              No compliance issues detected. All accounts are up to date.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Review */}
          <IssueCard
            title="Pending Classification"
            description="Accounts that haven't been classified yet"
            accounts={issues.pendingReview}
            icon={Clock}
            color={{
              border: "border-amber-200",
              bg: "bg-amber-50/30",
              iconBg: "bg-amber-100",
              icon: "text-amber-600",
              badge: "bg-amber-100 text-amber-800 border-amber-300"
            }}
            actionText="Classify"
          />

          {/* Missing Self-Certification */}
          <IssueCard
            title="Self-Certification Required"
            description="Individual accounts missing self-certification"
            accounts={issues.missingSelfCert}
            icon={FileText}
            color={{
              border: "border-red-200",
              bg: "bg-red-50/30",
              iconBg: "bg-red-100",
              icon: "text-red-600",
              badge: "bg-red-100 text-red-800 border-red-300"
            }}
            actionText="Review"
          />

          {/* Missing TIN */}
          <IssueCard
            title="Missing Tax ID (TIN)"
            description="Tax residencies without TIN or unavailable reason"
            accounts={issues.missingTIN}
            icon={FileText}
            color={{
              border: "border-orange-200",
              bg: "bg-orange-50/30",
              iconBg: "bg-orange-100",
              icon: "text-orange-600",
              badge: "bg-orange-100 text-orange-800 border-orange-300"
            }}
            actionText="Update"
          />

          {/* Passive NFE No Controlling Persons */}
          <IssueCard
            title="Passive NFE - Missing Controlling Persons"
            description="Passive NFEs without any controlling persons identified"
            accounts={issues.passiveNFENoControlling}
            icon={Users}
            color={{
              border: "border-purple-200",
              bg: "bg-purple-50/30",
              iconBg: "bg-purple-100",
              icon: "text-purple-600",
              badge: "bg-purple-100 text-purple-800 border-purple-300"
            }}
            actionText="Add Persons"
          />

          {/* High Value with Uncured Indicia */}
          <IssueCard
            title="High Value - Uncured Indicia"
            description="Accounts over $1M with foreign indicia but no self-cert"
            accounts={issues.highValueIndicia}
            icon={AlertTriangle}
            color={{
              border: "border-red-200",
              bg: "bg-red-50/30",
              iconBg: "bg-red-100",
              icon: "text-red-600",
              badge: "bg-red-100 text-red-800 border-red-300"
            }}
            actionText="Cure"
          />

          {/* Old Classifications */}
          <IssueCard
            title="Outdated Classification"
            description="Classifications older than 1 year - may need review"
            accounts={issues.oldClassification}
            icon={Calendar}
            color={{
              border: "border-blue-200",
              bg: "bg-blue-50/30",
              iconBg: "bg-blue-100",
              icon: "text-blue-600",
              badge: "bg-blue-100 text-blue-800 border-blue-300"
            }}
            actionText="Review"
          />
        </div>
      )}
    </div>
  );
}