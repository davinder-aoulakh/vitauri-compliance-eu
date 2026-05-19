import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const ACCOUNT_FIELDS = [
  // Account basics
  { value: "account_holder_type", label: "Account Holder Type" },
  { value: "account_type", label: "Account Type" },
  { value: "account_holder_is_alive", label: "Account Holder Alive" },
  { value: "account_holder_deceased_during_period", label: "Deceased During Period" },
  { value: "is_pre_existing", label: "Pre-existing Account" },
  { value: "account_closed_during_period", label: "Account Closed" },
  { value: "account_dormant_at_reporting_date", label: "Account Dormant at Reporting Date" },
  { value: "account_frozen_at_reporting_date", label: "Account Frozen at Reporting Date" },
  { value: "status", label: "Account Status" },
  // Financial values
  { value: "year_end_cash_value", label: "Year-end Cash Value" },
  { value: "gross_payments", label: "Gross Payments" },
  // Entity-related
  { value: "entity_classification", label: "Entity Classification" },
  { value: "entity_managed_by_fiduciary_trust", label: "Managed by Fiduciary Trust" },
  { value: "entity_managed_by_asset_manager", label: "Managed by Asset Manager" },
  { value: "gross_income_from_financial_assets", label: "Gross Income from Financial Assets" },
  { value: "gross_income_50_passive", label: "Gross Income ≥50% Passive" },
  // CRS S3 gate
  { value: "non_reportable_exception_type", label: "Non-Reportable Exception Type (S3-1)" },
  // CRS S4-1 routing
  { value: "potential_exception_type", label: "Potential Exception Type (S4-1)" },
  // Treasury Center fields
  { value: "treasury_activities_operational", label: "Treasury: Activities Functional & Operational" },
  { value: "treasury_part_of_nonfinancial_group", label: "Treasury: Part of Non-Financial Group" },
  { value: "treasury_main_fn_finance_hedge_group", label: "Treasury: Main Function Financing/Hedging" },
  { value: "treasury_50pct_passive_income_fails", label: "Treasury: <50% Passive Income (Passes 50% Test)" },
  { value: "treasury_still_operational_despite_failing_50pct", label: "Treasury: Operational Despite Failing 50% Test" },
  // Reportability
  { value: "reportability_status", label: "Reportability Status" },
  { value: "us_person_indic", label: "US Person Indicator" },
  // Self certification
  { value: "self_certification_obtained", label: "Self Certification Obtained" },
  { value: "self_certification_overdue", label: "Self Certification Overdue (90+ days)" },
  { value: "self_certification_request_date", label: "Self Certification Request Date" },
  // Address
  { value: "current_address.country", label: "Current Address: Country" },
  { value: "account_holder_address.country", label: "Account Holder Address: Country" },
  { value: "country_of_residence", label: "Country of Residence" },
  { value: "place_of_birth", label: "Place of Birth" },
  // Deceased / estate
  { value: "death_certificate_requested", label: "Death Certificate Requested" },
  { value: "death_certificate_received", label: "Death Certificate Received" },
  { value: "will_or_inheritance_requested", label: "Will/Inheritance Requested" },
  { value: "will_or_inheritance_received", label: "Will/Inheritance Received" },
  { value: "legacy_of_deceased_settled", label: "Legacy Settled" },
  // Dates
  { value: "account_creation_date", label: "Account Creation Date" },
  { value: "created_date", label: "Record Created Date" },
  { value: "updated_date", label: "Record Updated Date" },
  // Entity (related)
  { value: "entity.entity_name", label: "Entity: Name" },
  { value: "entity.entity_type", label: "Entity: Type" },
  { value: "entity.country_of_incorporation", label: "Entity: Country of Incorporation" },
  { value: "entity.rfi_status", label: "Entity: RFI Status" },
  { value: "entity.fi_type", label: "Entity: FI Type" },
];

export default function WorkflowFieldMappingEditor({ linkedWorkflowId, workflowFieldMappings, onWorkflowChange, onMappingsChange }) {
  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows-published'],
    queryFn: () => base44.entities.Workflow.filter({ status: 'published' }),
  });

  const selectedWorkflow = workflows.find(w => w.id === linkedWorkflowId);

  // Flatten all steps from the selected workflow
  const workflowSteps = selectedWorkflow?.steps?.filter(s =>
    s.question_type !== 'result' && s.question_type !== 'info'
  ) || [];

  const handleMappingChange = (stepId, stepTitle, accountField) => {
    const existing = workflowFieldMappings || [];
    const updated = existing.filter(m => m.step_id !== stepId);
    if (accountField) {
      updated.push({ step_id: stepId, step_title: stepTitle, account_field: accountField });
    }
    onMappingsChange(updated);
  };

  const getMappingForStep = (stepId) => {
    return (workflowFieldMappings || []).find(m => m.step_id === stepId)?.account_field || "";
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-semibold text-slate-800">Workflow Linkage for Classification History</span>
      </div>
      <p className="text-xs text-slate-500">
        Link a published workflow and map its steps to account fields. When this rule runs ad-hoc, answers will be auto-resolved from account data and recorded in the classification history.
      </p>

      <div>
        <Label className="text-xs">Linked Workflow</Label>
        <Select value={linkedWorkflowId || ""} onValueChange={(v) => { onWorkflowChange(v || null); onMappingsChange([]); }}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a published workflow..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>None</SelectItem>
            {workflows.map(w => (
              <SelectItem key={w.id} value={w.id}>{w.workflow_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {linkedWorkflowId && workflowSteps.length > 0 && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold">Step → Account Field Mappings</Label>
          <div className="space-y-2">
            {workflowSteps.map(step => (
              <div key={step.step_id} className="grid grid-cols-2 gap-2 items-center bg-white p-2 rounded border">
                <div>
                  <p className="text-xs font-medium text-slate-700 truncate">{step.step_title || step.step_id}</p>
                  <Badge variant="outline" className="text-xs mt-0.5">{step.question_type}</Badge>
                </div>
                <Select
                  value={getMappingForStep(step.step_id)}
                  onValueChange={(v) => handleMappingChange(step.step_id, step.step_title || step.step_id, v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Map to account field..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    <SelectItem value={null}>— Not mapped —</SelectItem>
                    {ACCOUNT_FIELDS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            {(workflowFieldMappings || []).length} of {workflowSteps.length} steps mapped
          </p>
        </div>
      )}

      {linkedWorkflowId && workflowSteps.length === 0 && (
        <p className="text-xs text-amber-600">This workflow has no mappable steps.</p>
      )}
    </div>
  );
}