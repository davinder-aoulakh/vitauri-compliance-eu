import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  FileText,
  FileCode,
  Send,
  CheckCircle2,
  XCircle,
  Edit,
  User,
  Clock,
  ChevronRight,
  ChevronDown,
  GitCompare
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ReportVersionHistory({ report }) {
  const [expandedLog, setExpandedLog] = useState(null);

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['report-audit-logs', report?.id],
    queryFn: async () => {
      if (!report?.id) return [];
      
      const logs = await base44.entities.AuditLog.filter({
        target_entity_type: "CRSReport",
        target_entity_id: report.id
      });
      
      return logs.sort((a, b) => 
        new Date(b.timestamp || b.created_date) - new Date(a.timestamp || a.created_date)
      );
    },
    enabled: !!report?.id
  });

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'report_generated':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'report_submitted':
        return <Send className="w-4 h-4 text-green-600" />;
      case 'report_deleted':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Edit className="w-4 h-4 text-slate-600" />;
    }
  };

  const getActionColor = (actionType) => {
    switch (actionType) {
      case 'report_generated':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'report_submitted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'report_deleted':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getActionLabel = (actionType) => {
    const labels = {
      'report_generated': 'Report Generated',
      'report_submitted': 'Report Submitted',
      'report_deleted': 'Report Deleted'
    };
    return labels[actionType] || actionType.replace(/_/g, ' ');
  };

  const renderDiffView = (changes) => {
    if (!changes || typeof changes !== 'object') return null;

    return (
      <div className="mt-3 space-y-2">
        {Object.entries(changes).map(([key, value]) => (
          <div key={key} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <GitCompare className="w-3 h-3 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700 capitalize">
                {key.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="text-sm text-slate-900 font-mono bg-white rounded px-2 py-1 border border-slate-200">
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!report) {
    return (
      <Alert>
        <AlertDescription>No report selected</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (auditLogs.length === 0) {
    return (
      <Alert>
        <History className="w-4 h-4" />
        <AlertDescription>
          No version history available for this report yet.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <History className="w-4 h-4" />
        <span>{auditLogs.length} version{auditLogs.length !== 1 ? 's' : ''} recorded</span>
      </div>

      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-3">
          {auditLogs.map((log, index) => {
            const isExpanded = expandedLog === log.id;
            const timestamp = new Date(log.timestamp || log.created_date);
            
            return (
              <Card 
                key={log.id}
                className="border-l-4 transition-all hover:shadow-md"
                style={{
                  borderLeftColor: log.action_type === 'report_submitted' ? '#10b981' :
                    log.action_type === 'report_generated' ? '#3b82f6' :
                    log.action_type === 'report_deleted' ? '#ef4444' : '#64748b'
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mt-1">
                        {getActionIcon(log.action_type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={getActionColor(log.action_type)}>
                            {getActionLabel(log.action_type)}
                          </Badge>
                          {index === 0 && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              Latest
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <User className="w-3 h-3" />
                          <span>{log.actor_email}</span>
                          <span>•</span>
                          <Clock className="w-3 h-3" />
                          <span>{timestamp.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    {log.changes && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        className="ml-2"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>

                {isExpanded && log.changes && (
                  <CardContent className="pt-0">
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-slate-700 mb-2">
                        Changes Made:
                      </p>
                      {renderDiffView(log.changes)}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-900">
            <p className="font-semibold mb-1">Immutable Audit Trail</p>
            <p>All changes are permanently logged and cannot be modified or deleted, ensuring compliance and traceability.</p>
          </div>
        </div>
      </div>
    </div>
  );
}