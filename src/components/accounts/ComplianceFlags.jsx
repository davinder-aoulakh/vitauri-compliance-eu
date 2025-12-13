import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Users,
  Eye,
  Calendar,
  Check,
  X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function ComplianceFlags({ tenantId, onSelectAccount }) {
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolvingIssue, setResolvingIssue] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const queryClient = useQueryClient();

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

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Account.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['accounts']);
      setShowResolveDialog(false);
      setResolvingIssue(null);
      setResolutionNotes("");
    }
  });

  // Calculate compliance issues
  const issues = {
    pendingReview: accounts.filter(a => 
      a.reportability_status === 'pending_review' &&
      !a.compliance_issues_resolved?.includes('pending_review')
    ),
    missingSelfCert: accounts.filter(a => 
      a.account_holder_type === 'individual' && 
      !a.self_certification_obtained &&
      a.reportability_status !== 'non_reportable' &&
      !a.compliance_issues_resolved?.includes('missing_self_cert')
    ),
    missingTIN: accounts.filter(a => 
      a.tax_residencies && 
      a.tax_residencies.some(r => !r.tin && !r.tin_unavailable_reason) &&
      !a.compliance_issues_resolved?.includes('missing_tin')
    ),
    passiveNFENoControlling: accounts.filter(a => {
      if (a.entity_classification !== 'passive_nfe') return false;
      if (a.compliance_issues_resolved?.includes('passive_nfe_no_cp')) return false;
      const accountControllingPersons = controllingPersons.filter(cp => cp.account_id === a.id);
      return accountControllingPersons.length === 0;
    }),
    controllingPersonNotClassified: accounts.filter(a => {
      if (a.entity_classification !== 'passive_nfe') return false;
      if (a.compliance_issues_resolved?.includes('cp_not_classified')) return false;
      const accountControllingPersons = controllingPersons.filter(cp => cp.account_id === a.id);
      // Has CPs but at least one is not classified (no reportability_status or is pending_review)
      return accountControllingPersons.length > 0 && 
             accountControllingPersons.some(cp => !cp.reportability_status || cp.reportability_status === 'pending_review');
    }),
    highValueIndicia: accounts.filter(a => 
      a.account_balance > 1000000 && 
      a.indicia_found && 
      a.indicia_found.length > 0 &&
      !a.self_certification_obtained &&
      !a.compliance_issues_resolved?.includes('high_value_indicia')
    ),
    oldClassification: accounts.filter(a => {
      if (!a.updated_date) return false;
      if (a.compliance_issues_resolved?.includes('old_classification')) return false;
      const daysSinceUpdate = (Date.now() - new Date(a.updated_date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 365 && a.reportability_status !== 'pending_review';
    }),
    needsReclassification: accounts.filter(a =>
      a.needs_reclassification === true &&
      !a.compliance_issues_resolved?.includes('needs_reclassification')
    )
  };

  const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);

  const handleResolveIssue = (account, issueType) => {
    setResolvingIssue({ account, issueType });
    setShowResolveDialog(true);
  };

  const saveResolution = async () => {
    if (!resolvingIssue || !resolutionNotes) return;

    const { account, issueType } = resolvingIssue;
    const resolvedIssues = account.compliance_issues_resolved || [];
    
    const resolutionRecord = {
      type: issueType,
      resolved_date: new Date().toISOString(),
      notes: resolutionNotes
    };

    const complianceResolutions = account.compliance_resolutions || [];
    complianceResolutions.push(resolutionRecord);

    updateAccountMutation.mutate({
      id: account.id,
      data: {
        compliance_issues_resolved: [...resolvedIssues, issueType],
        compliance_resolutions: complianceResolutions
      }
    });
  };

  const IssueCard = ({ title, description, accounts, icon: Icon, color, actionText, issueType }) => {
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
                <div className="flex gap-2 ml-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSelectAccount(account)}
                    title="Review account"
                  >
                    {actionText}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResolveIssue(account, issueType)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    title="Mark as resolved"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
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
            issueType="pending_review"
          />

          {/* Needs Reclassification */}
          <IssueCard
            title="Requires Reclassification"
            description="Accounts with significant changes requiring review"
            accounts={issues.needsReclassification}
            icon={AlertTriangle}
            color={{
              border: "border-orange-200",
              bg: "bg-orange-50/30",
              iconBg: "bg-orange-100",
              icon: "text-orange-600",
              badge: "bg-orange-100 text-orange-800 border-orange-300"
            }}
            actionText="Re-classify"
            issueType="needs_reclassification"
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
            issueType="missing_self_cert"
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
            issueType="missing_tin"
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
            issueType="passive_nfe_no_cp"
          />

          {/* Controlling Persons Not Classified */}
          <IssueCard
            title="Controlling Persons - Pending Classification"
            description="Passive NFE controlling persons that haven't been classified"
            accounts={issues.controllingPersonNotClassified}
            icon={Eye}
            color={{
              border: "border-indigo-200",
              bg: "bg-indigo-50/30",
              iconBg: "bg-indigo-100",
              icon: "text-indigo-600",
              badge: "bg-indigo-100 text-indigo-800 border-indigo-300"
            }}
            actionText="Classify"
            issueType="cp_not_classified"
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
            issueType="high_value_indicia"
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
            issueType="old_classification"
          />
        </div>
      )}

      {/* Resolution Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Issue as Resolved</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Account</Label>
              <p className="text-sm font-medium text-slate-900 mt-1">
                {resolvingIssue?.account?.account_holder_name}
              </p>
              <p className="text-xs text-slate-500">{resolvingIssue?.account?.account_number}</p>
            </div>

            <div>
              <Label>Issue Type</Label>
              <Badge variant="outline" className="mt-1">
                {resolvingIssue?.issueType?.replace(/_/g, " ")}
              </Badge>
            </div>

            <div>
              <Label htmlFor="resolution_notes">Resolution Notes *</Label>
              <Textarea
                id="resolution_notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Explain how this issue was resolved..."
                rows={4}
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1">
                Provide details on what action was taken to resolve this compliance issue
              </p>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResolveDialog(false);
                  setResolvingIssue(null);
                  setResolutionNotes("");
                }}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={saveResolution}
                disabled={!resolutionNotes}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="w-4 h-4 mr-2" />
                Mark Resolved
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}