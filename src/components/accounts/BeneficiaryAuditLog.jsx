import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";

export default function BeneficiaryAuditLog({ beneficiary }) {
  const [expandedLogs, setExpandedLogs] = React.useState(new Set());

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['beneficiary-audit-log', beneficiary?.id],
    queryFn: () => base44.entities.AuditLog.filter({ 
      target_entity_type: "Beneficiary",
      target_entity_id: beneficiary?.id
    }),
    enabled: !!beneficiary?.id,
    staleTime: 30000
  });

  const toggleExpanded = (logId) => {
    const newSet = new Set(expandedLogs);
    if (newSet.has(logId)) {
      newSet.delete(logId);
    } else {
      newSet.add(logId);
    }
    setExpandedLogs(newSet);
  };

  const getActionBadgeColor = (actionType) => {
    if (actionType.includes('created')) return 'bg-green-100 text-green-800';
    if (actionType.includes('updated')) return 'bg-blue-100 text-blue-800';
    if (actionType.includes('deleted')) return 'bg-red-100 text-red-800';
    if (actionType.includes('classified')) return 'bg-purple-100 text-purple-800';
    return 'bg-slate-100 text-slate-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-purple-600 mr-2" />
        <p className="text-slate-600">Loading audit history...</p>
      </div>
    );
  }

  if (auditLogs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500">No audit history available for this beneficiary</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700 mb-4">
        {auditLogs.length} audit record(s) found
      </p>
      {auditLogs.map((log) => (
        <Card key={log.id} className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getActionBadgeColor(log.action_type)}>
                    {log.action_type?.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {format(new Date(log.timestamp), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  <strong>By:</strong> {log.actor_email}
                </p>
              </div>
              <button
                onClick={() => toggleExpanded(log.id)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Toggle details"
              >
                {expandedLogs.has(log.id) ? (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>

            {expandedLogs.has(log.id) && log.changes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-700 mb-2">Changes:</p>
                <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto max-h-40">
                  {JSON.stringify(log.changes, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}