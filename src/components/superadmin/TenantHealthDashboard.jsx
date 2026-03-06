import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Activity,
  ChevronRight,
  Building2,
  Users,
  FileText,
  Zap,
  Clock,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

const RISK_CONFIG = {
  healthy:  { label: 'Healthy',  color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', bar: 'bg-emerald-500', icon: CheckCircle2 },
  warning:  { label: 'Warning',  color: 'text-amber-400',   bg: 'bg-amber-500/20',   border: 'border-amber-500/30',   bar: 'bg-amber-500',   icon: AlertTriangle },
  at_risk:  { label: 'At Risk',  color: 'text-orange-400',  bg: 'bg-orange-500/20',  border: 'border-orange-500/30',  bar: 'bg-orange-500',  icon: ShieldAlert },
  critical: { label: 'Critical', color: 'text-red-400',     bg: 'bg-red-500/20',     border: 'border-red-500/30',     bar: 'bg-red-500',     icon: XCircle },
};

const SEVERITY_CONFIG = {
  high:   { color: 'text-red-400',    bg: 'bg-red-900/30',    border: 'border-red-500/30',    label: 'High' },
  medium: { color: 'text-amber-400',  bg: 'bg-amber-900/30',  border: 'border-amber-500/30',  label: 'Medium' },
  low:    { color: 'text-blue-400',   bg: 'bg-blue-900/30',   border: 'border-blue-500/30',   label: 'Low' },
};

function RiskScoreBadge({ score, level, size = 'md' }) {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.healthy;
  const Icon = cfg.icon;
  const textSize = size === 'lg' ? 'text-4xl' : 'text-2xl';
  return (
    <div className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl ${cfg.bg} border ${cfg.border}`}>
      <Icon className={`w-5 h-5 ${cfg.color}`} />
      <span className={`font-bold ${cfg.color} ${textSize}`}>{score}</span>
      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
    </div>
  );
}

function IssueItem({ issue }) {
  const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.low;
  return (
    <div className={`rounded-lg p-3 border ${sev.bg} ${sev.border} space-y-1`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${sev.color}`}>{issue.title}</span>
        <Badge variant="outline" className={`text-xs py-0 ${sev.color} border-current`}>{sev.label}</Badge>
      </div>
      <p className="text-xs text-white/70">{issue.description}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <Zap className="w-3 h-3 text-indigo-300" />
        <p className="text-xs text-indigo-300 italic">{issue.action}</p>
      </div>
    </div>
  );
}

function TenantHealthDetail({ health, onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-indigo-600" />
            {health.tenant_name} — Health Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Score + stats */}
          <div className="flex items-start gap-4">
            <RiskScoreBadge score={health.risk_score} level={health.risk_level} size="lg" />
            <div className="flex-1 grid grid-cols-2 gap-3">
              {[
                { label: 'Total Accounts', value: health.stats.total_accounts, icon: Users },
                { label: 'Total Entities', value: health.stats.total_entities, icon: Building2 },
                { label: 'Pending Accounts', value: health.stats.pending_accounts, icon: Clock },
                { label: 'Unclassified Entities', value: health.stats.unclassified_entities, icon: AlertCircle },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 rounded-lg p-3 flex items-center gap-2">
                  <s.icon className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-lg font-bold text-slate-800">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Issues */}
          <div>
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Issues Found ({health.issues.length})
            </h3>
            {health.issues.length === 0 ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">No issues found. This tenant is in good health!</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2 bg-slate-900 rounded-xl p-4">
                {health.issues.map((issue, i) => (
                  <IssueItem key={i} issue={issue} />
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 text-right">
            Checked at: {format(new Date(health.checked_at), "MMM d, yyyy h:mm a")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TenantHealthDashboard() {
  const [selectedHealth, setSelectedHealth] = useState(null);

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['tenant-health'],
    queryFn: async () => {
      const response = await base44.functions.invoke('tenantHealthCheck', {});
      return response.data.results || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const results = data || [];
  const critical = results.filter(r => r.risk_level === 'critical').length;
  const atRisk = results.filter(r => r.risk_level === 'at_risk').length;
  const warning = results.filter(r => r.risk_level === 'warning').length;
  const healthy = results.filter(r => r.risk_level === 'healthy').length;

  // Sort by risk score ascending (worst first)
  const sorted = [...results].sort((a, b) => a.risk_score - b.risk_score);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Tenant Health Monitor</h2>
            <p className="text-sm text-indigo-200">
              Integrity checks, risk scores &amp; actionable alerts
              {dataUpdatedAt > 0 && (
                <span className="ml-2 text-indigo-400">
                  · Last checked {format(new Date(dataUpdatedAt), "h:mm a")}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10 gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Checking...' : 'Re-run Checks'}
        </Button>
      </div>

      {/* Summary pills */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Critical', value: critical, cfg: RISK_CONFIG.critical },
            { label: 'At Risk',  value: atRisk,   cfg: RISK_CONFIG.at_risk },
            { label: 'Warning',  value: warning,  cfg: RISK_CONFIG.warning },
            { label: 'Healthy',  value: healthy,  cfg: RISK_CONFIG.healthy },
          ].map(s => {
            const Icon = s.cfg.icon;
            return (
              <div key={s.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${s.cfg.bg} border ${s.cfg.border}`}>
                <Icon className={`w-5 h-5 ${s.cfg.color}`} />
                <div>
                  <p className={`text-2xl font-bold ${s.cfg.color}`}>{s.value}</p>
                  <p className={`text-xs ${s.cfg.color} opacity-80`}>{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tenant cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <RefreshCw className="w-6 h-6 text-white animate-spin" />
          <span className="text-white text-sm">Running integrity checks across all tenants…</span>
        </div>
      ) : sorted.length === 0 ? (
        <Card className="border-0 bg-white/10 backdrop-blur-sm border border-white/20">
          <CardContent className="p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-indigo-300" />
            <p className="text-white font-semibold mb-1">No tenants found</p>
            <p className="text-indigo-200 text-sm">Add tenants first to see health reports.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map(health => {
            const cfg = RISK_CONFIG[health.risk_level] || RISK_CONFIG.healthy;
            const Icon = cfg.icon;
            const highIssues = health.issues.filter(i => i.severity === 'high');
            return (
              <Card
                key={health.tenant_id}
                className={`border-0 bg-white/10 backdrop-blur-sm border shadow-xl cursor-pointer hover:bg-white/15 transition-all ${cfg.border}`}
                onClick={() => setSelectedHealth(health)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {health.short_name?.[0] || health.tenant_name?.[0] || 'T'}
                      </span>
                    </div>

                    {/* Name + alerts */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white truncate">{health.tenant_name}</p>
                        <Badge variant="outline" className="border-white/20 text-indigo-300 text-xs py-0">
                          {health.jurisdiction}
                        </Badge>
                      </div>
                      {highIssues.length > 0 ? (
                        <p className="text-xs text-red-300 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {highIssues.map(i => i.title).join(' · ')}
                        </p>
                      ) : health.issues.length > 0 ? (
                        <p className="text-xs text-amber-300 mt-0.5">{health.issues.length} minor issue{health.issues.length > 1 ? 's' : ''}</p>
                      ) : (
                        <p className="text-xs text-emerald-400 mt-0.5">No issues detected</p>
                      )}
                    </div>

                    {/* Score bar */}
                    <div className="hidden md:flex flex-col items-end gap-1.5 w-32">
                      <div className="flex items-center gap-2 w-full">
                        <Progress value={health.risk_score} className="h-2 flex-1" />
                        <span className={`text-sm font-bold ${cfg.color} w-8 text-right`}>{health.risk_score}</span>
                      </div>
                      <div className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </div>
                    </div>

                    {/* Mobile score */}
                    <div className={`md:hidden flex items-center gap-1 text-sm font-bold ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                      {health.risk_score}
                    </div>

                    <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      {selectedHealth && (
        <TenantHealthDetail
          health={selectedHealth}
          onClose={() => setSelectedHealth(null)}
        />
      )}
    </div>
  );
}