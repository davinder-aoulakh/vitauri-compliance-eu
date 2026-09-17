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
import { toDisplayDate, toDisplayDateTime } from "@/lib/dateUtils";

const actionIcons = {
  controlling_person_created: Plus,
  controlling_person_updated: Edit,
  controlling_person_deleted: Trash2,
  controlling_person_classified: CheckCircle2
};

const actionColors = {
  controlling_person_created: "bg-green-100 text-green-800 border-green-200",
  controlling_person_updated: "bg-blue-100 text-blue-800 border-blue-200",
  controlling_person_deleted: "bg-red-100 text-red-800 border-red-200",
  controlling_person_classified: "bg-purple-100 text-purple-800 border-purple-200"
};

const fieldNameLabels = {
  first_name: "First Name",
  last_name: "Last Name",
  full_name: "Full Name",
  date_of_birth: "Date of Birth",
  address: "Address",
  tax_residencies: "Tax Residencies",
  control_type: "Control Type",
  ownership_percentage: "Ownership Percentage",
  is_reportable: "Reportable Status",
  us_person_indic: "US Person Indicator",
  classification_answers: "Classification Answers",
  street: "Street",
  city: "City",
  state: "State/Province",
  postal_code: "Postal Code",
  country: "Country",
  tin: "Tax ID Number (TIN)",
  tin_unavailable_reason: "TIN Unavailable Reason"
};

const getFieldLabel = (fieldName) => {
  return fieldNameLabels[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Empty';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.map(item => {
      if (typeof item === 'object') {
        return Object.entries(item)
          .filter(([k, v]) => v && !k.startsWith('_'))
          .map(([k, v]) => `${getFieldLabel(k)}: ${formatValue(v)}`)
          .join(', ');
      }
      return String(item);
    }).join(' | ');
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([k, v]) => v && !k.startsWith('_'));
    if (entries.length === 0) return 'Empty';
    return entries.map(([k, v]) => `${getFieldLabel(k)}: ${formatValue(v)}`).join(', ');
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return toDisplayDate(value);
  }
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export default function ControllingPersonAuditLog({ controllingPerson }) {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['audit-log', 'controlling-person', controllingPerson?.id],
    queryFn: () => base44.entities.AuditLog.filter({
      target_entity_id: controllingPerson?.id,
      target_entity_type: "ControllingPerson"
    }),
    enabled: !!controllingPerson?.id
  });

  const sortedLogs = [...auditLogs].sort((a, b) => 
    new Date(b.timestamp || b.created_date) - new Date(a.timestamp || a.created_date)
  );

  const formatChanges = (changes) => {
    if (!changes) return null;
    
    if (changes.field) {
      return (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm">
          <span className="font-medium text-slate-700">{getFieldLabel(changes.field)}</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-start gap-2">
              <span className="text-xs text-slate-500 w-16 flex-shrink-0">Before:</span>
              <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs">
                {formatValue(changes.previous_value)}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-slate-500 w-16 flex-shrink-0">After:</span>
              <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">
                {formatValue(changes.new_value)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    const changeEntries = Object.entries(changes).filter(([k]) => !k.startsWith('_'));
    if (changeEntries.length === 0) return null;

    return (
      <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm space-y-2">
        {changeEntries.map(([field, value]) => (
          <div key={field} className="flex items-start gap-2">
            <span className="font-medium text-slate-700 min-w-[120px]">{getFieldLabel(field)}:</span>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-900">
            Audit Log ({sortedLogs.length} entries)
          </h3>
        </div>
      </div>

      {sortedLogs.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-12 text-center">
            <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600">No audit log entries found for this controlling person</p>
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
                              <span>
                                {toDisplayDateTime(log.timestamp || log.created_date)}
                              </span>
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