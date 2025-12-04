import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertCircle,
  ArrowRight,
  Loader2
} from "lucide-react";

const actionIcons = {
  account_created: Plus,
  account_updated: Edit,
  account_deleted: Trash2,
  account_classified: CheckCircle2
};

const actionColors = {
  account_created: "bg-green-100 text-green-800 border-green-200",
  account_updated: "bg-blue-100 text-blue-800 border-blue-200",
  account_deleted: "bg-red-100 text-red-800 border-red-200",
  account_classified: "bg-purple-100 text-purple-800 border-purple-200"
};

export default function AccountAuditLog({ account }) {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['audit-log', 'account', account?.id],
    queryFn: () => base44.entities.AuditLog.filter({
      target_entity_id: account?.id,
      target_entity_type: "Account"
    }),
    enabled: !!account?.id
  });

  // Sort by timestamp descending (most recent first)
  const sortedLogs = [...auditLogs].sort((a, b) => 
    new Date(b.timestamp || b.created_date) - new Date(a.timestamp || a.created_date)
  );

  const formatChanges = (changes) => {
    if (!changes) return null;
    
    // Handle single field change
    if (changes.field) {
      return (
        <div className="mt-2 p-2 bg-slate-50 rounded text-xs">
          <span className="font-medium text-slate-700">{changes.field}:</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-red-600 line-through">
              {typeof changes.previous_value === 'object' 
                ? JSON.stringify(changes.previous_value) 
                : String(changes.previous_value || 'empty')}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className="text-green-600">
              {typeof changes.new_value === 'object' 
                ? JSON.stringify(changes.new_value) 
                : String(changes.new_value || 'empty')}
            </span>
          </div>
        </div>
      );
    }

    // Handle multiple field changes
    const changeEntries = Object.entries(changes);
    if (changeEntries.length === 0) return null;

    return (
      <div className="mt-2 p-2 bg-slate-50 rounded text-xs space-y-2">
        {changeEntries.map(([field, value]) => (
          <div key={field}>
            <span className="font-medium text-slate-700">{field}:</span>
            <span className="ml-2 text-slate-600">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
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
            <p className="text-slate-600">No audit log entries found for this account</p>
            <p className="text-xs text-slate-500 mt-1">
              Actions like create, update, and classify will be recorded here
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px] pr-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />

            <div className="space-y-4">
              {sortedLogs.map((log, index) => {
                const Icon = actionIcons[log.action_type] || FileText;
                const colorClass = actionColors[log.action_type] || "bg-slate-100 text-slate-800 border-slate-200";

                return (
                  <div key={log.id} className="relative pl-12">
                    {/* Timeline dot */}
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
                                {new Date(log.timestamp || log.created_date).toLocaleString()}
                              </span>
                            </div>

                            {/* Show changes if available */}
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