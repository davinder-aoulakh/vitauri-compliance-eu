import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  User,
  Calendar,
  FileText,
  Edit,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2
} from "lucide-react";

const actionIcons = {
  entity_created: Plus,
  entity_updated: Edit,
  entity_deleted: Trash2,
  entity_classified: CheckCircle2
};

const actionColors = {
  entity_created: "bg-green-100 text-green-800 border-green-200",
  entity_updated: "bg-blue-100 text-blue-800 border-blue-200",
  entity_deleted: "bg-red-100 text-red-800 border-red-200",
  entity_classified: "bg-purple-100 text-purple-800 border-purple-200"
};

const fieldNameLabels = {
  entity_name: "Entity Name",
  entity_type: "Entity Type",
  country_of_incorporation: "Country of Incorporation",
  tax_id: "Tax ID",
  rfi_status: "RFI Status",
  fi_type: "FI Type",
  non_reporting_reason: "Non-Reporting Reason",
  classification_completed_date: "Classification Completed Date",
  status: "Status",
  address: "Address",
  giin: "GIIN",
  is_ffi: "Is FFI",
  is_sponsored_ffi: "Is Sponsored FFI",
  fi_registration_type: "FI Registration Type",
  policy_pre_existing_account_status: "Policy: Pre-existing Account Status",
  policy_reporting_method: "Policy: Reporting Method",
  policy_report_under_threshold: "Policy: Report Under Threshold",
  policy_dormant_no_contact_period: "Policy: Dormant No-Contact Period",
  policy_dormant_no_contact_unit: "Policy: Dormant No-Contact Unit",
  policy_dormant_status: "Policy: Dormant Status"
};

// Fields to exclude from the audit log display (classification answers, internal IDs, metadata)
const EXCLUDED_FIELDS = new Set([
  'classification_answers', 'tenant_id', 'id', 'created_date', 'updated_date',
  'created_by', 'created_by_id', 'updated_by', 'updated_by_id'
]);

const getFieldLabel = (fieldName) =>
  fieldNameLabels[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Empty';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length === 0 ? 'None' : value.join(', ');
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([k, v]) => v && !k.startsWith('_'));
    return entries.length === 0 ? 'Empty' : entries.map(([k, v]) => `${getFieldLabel(k)}: ${v}`).join(', ');
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toLocaleDateString();
  }
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export default function EntityAuditLog({ entity }) {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['audit-log', 'entity', entity?.id],
    queryFn: () => base44.entities.AuditLog.filter({
      target_entity_id: entity?.id,
      target_entity_type: "Entity"
    }),
    enabled: !!entity?.id
  });

  const sortedLogs = [...auditLogs].sort((a, b) =>
    new Date(b.timestamp || b.created_date) - new Date(a.timestamp || a.created_date)
  );

  const formatChanges = (changes) => {
    if (!changes) return null;

    // Handle { before, after } format — show only the "after" (new) values
    const source = changes.after ?? changes.before ?? changes;

    // Handle { field, previous_value, new_value } format
    let changeEntries;
    if (source.field && ('new_value' in source || 'previous_value' in source)) {
      changeEntries = [[source.field, source.new_value ?? source.previous_value]];
    } else {
      changeEntries = Object.entries(source).filter(([k]) =>
        !['field', 'previous_value', 'new_value', 'before', 'after'].includes(k) &&
        !k.startsWith('_') &&
        !EXCLUDED_FIELDS.has(k)
      );
    }

    if (changeEntries.length === 0) return null;
    return (
      <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm space-y-2">
        {changeEntries.map(([field, value]) => (
          <div key={field} className="flex items-start gap-2">
            <span className="font-medium text-slate-700 min-w-[160px]">{getFieldLabel(field)}:</span>
            <span className="text-slate-600">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-slate-900">
          Audit Log ({sortedLogs.length} entries)
        </h3>
      </div>

      {sortedLogs.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-12 text-center">
            <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600">No audit log entries found for this entity</p>
            <p className="text-xs text-slate-500 mt-1">
              Actions like create, update, and classify will be recorded here
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px] pr-4">
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
            <div className="space-y-4">
              {sortedLogs.map((log, index) => {
                const Icon = actionIcons[log.action_type] || FileText;
                const colorClass = actionColors[log.action_type] || "bg-slate-100 text-slate-800 border-slate-200";
                return (
                  <div key={log.id} className="relative pl-12">
                    <div className={`absolute left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center ${colorClass}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <Card className="border border-slate-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={colorClass}>
                                {log.action_type?.replace(/_/g, ' ')}
                              </Badge>
                              {index === 0 && (
                                <Badge variant="outline" className="text-xs">Latest</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-600 mt-2">
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>{log.actor_email || 'System'}</span>
                              </div>
                              {log.actor_role && (
                                <Badge variant="outline" className="text-xs capitalize">
                                  {log.actor_role.replace(/_/g, ' ')}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(log.timestamp || log.created_date).toLocaleString()}</span>
                            </div>
                            {log.changes && formatChanges(log.changes)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}