import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Wallet,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  Activity
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import moment from "moment";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function WidgetPreview({ widget, tenantId }) {
  // Fetch data based on widget type
  const { data: accounts = [] } = useQuery({
    queryKey: ['widget-accounts', tenantId],
    queryFn: () => base44.entities.Account.filter({ tenant_id: tenantId }),
    enabled: !!tenantId && ['stats_card', 'account_list', 'reportability_breakdown', 'chart_pie', 'chart_bar'].includes(widget.widget_type),
    staleTime: 30000
  });

  const { data: entities = [] } = useQuery({
    queryKey: ['widget-entities', tenantId],
    queryFn: () => base44.entities.Entity.filter({ tenant_id: tenantId }),
    enabled: !!tenantId && ['stats_card', 'entity_list', 'compliance_summary'].includes(widget.widget_type),
    staleTime: 30000
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['widget-audit-logs', tenantId],
    queryFn: () => base44.entities.AuditLog.filter({ tenant_id: tenantId }, '-timestamp', 10),
    enabled: !!tenantId && widget.widget_type === 'recent_activity',
    staleTime: 30000
  });

  const config = widget.config || {};

  // Stats Card Widget
  if (widget.widget_type === 'stats_card') {
    const metric = config.metric || 'total_accounts';
    let value = 0;
    let trend = null;
    let icon = <Wallet className="w-6 h-6" />;

    switch (metric) {
      case 'total_accounts':
        value = accounts.length;
        icon = <Wallet className="w-6 h-6 text-indigo-600" />;
        break;
      case 'total_entities':
        value = entities.length;
        icon = <Building2 className="w-6 h-6 text-purple-600" />;
        break;
      case 'reportable_accounts':
        value = accounts.filter(a => a.reportability_status === 'reportable').length;
        icon = <FileText className="w-6 h-6 text-amber-600" />;
        break;
      case 'pending_review':
        value = accounts.filter(a => a.reportability_status === 'pending_review').length;
        icon = <Clock className="w-6 h-6 text-blue-600" />;
        break;
      case 'classified_entities':
        value = entities.filter(e => e.rfi_status !== 'pending_classification').length;
        icon = <CheckCircle className="w-6 h-6 text-green-600" />;
        break;
    }

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">{widget.title}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
              {trend && (
                <div className="flex items-center gap-1 mt-2 text-sm">
                  {trend > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className={trend > 0 ? "text-green-600" : "text-red-600"}>
                    {Math.abs(trend)}%
                  </span>
                </div>
              )}
            </div>
            <div className="p-3 rounded-xl bg-slate-100">
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pie Chart Widget
  if (widget.widget_type === 'chart_pie') {
    const dataSource = config.data_source || 'reportability';
    let chartData = [];

    if (dataSource === 'reportability') {
      const reportable = accounts.filter(a => a.reportability_status === 'reportable').length;
      const nonReportable = accounts.filter(a => a.reportability_status === 'non_reportable').length;
      const pending = accounts.filter(a => a.reportability_status === 'pending_review').length;
      chartData = [
        { name: 'Reportable', value: reportable },
        { name: 'Non-Reportable', value: nonReportable },
        { name: 'Pending', value: pending }
      ].filter(d => d.value > 0);
    } else if (dataSource === 'entity_classification') {
      const reporting = entities.filter(e => e.rfi_status === 'reporting_fi').length;
      const nonReporting = entities.filter(e => e.rfi_status === 'non_reporting_fi').length;
      const pending = entities.filter(e => e.rfi_status === 'pending_classification').length;
      chartData = [
        { name: 'Reporting FI', value: reporting },
        { name: 'Non-Reporting FI', value: nonReporting },
        { name: 'Pending', value: pending }
      ].filter(d => d.value > 0);
    }

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Bar Chart Widget
  if (widget.widget_type === 'chart_bar') {
    const dataSource = config.data_source || 'account_types';
    let chartData = [];

    if (dataSource === 'account_types') {
      const typeCount = {};
      accounts.forEach(a => {
        const type = a.account_type || 'Unknown';
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
      chartData = Object.entries(typeCount).map(([name, value]) => ({ name, value }));
    }

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Recent Activity Widget
  if (widget.widget_type === 'recent_activity') {
    const limit = config.limit || 5;
    const displayLogs = auditLogs.slice(0, limit);

    const getActionIcon = (actionType) => {
      if (actionType?.includes('created')) return <CheckCircle className="w-4 h-4 text-green-600" />;
      if (actionType?.includes('updated')) return <Activity className="w-4 h-4 text-blue-600" />;
      if (actionType?.includes('deleted')) return <AlertTriangle className="w-4 h-4 text-red-600" />;
      return <Activity className="w-4 h-4 text-slate-400" />;
    };

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                {getActionIcon(log.action_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {log.action_type?.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-slate-500">{log.actor_email}</p>
                </div>
                <span className="text-xs text-slate-400">
                  {moment(log.timestamp).fromNow()}
                </span>
              </div>
            ))}
            {displayLogs.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Entity List Widget
  if (widget.widget_type === 'entity_list') {
    const limit = config.limit || 5;
    const displayEntities = entities.slice(0, limit);

    return (
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{widget.title}</CardTitle>
          <Link to={createPageUrl("Entities")} className="text-xs text-indigo-600 hover:underline">
            View All
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {displayEntities.map((entity) => (
              <div key={entity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{entity.entity_name}</p>
                  <p className="text-xs text-slate-500 capitalize">{entity.entity_type}</p>
                </div>
                <Badge className={
                  entity.rfi_status === 'reporting_fi' ? 'bg-amber-100 text-amber-800' :
                  entity.rfi_status === 'non_reporting_fi' ? 'bg-green-100 text-green-800' :
                  'bg-slate-100 text-slate-800'
                }>
                  {entity.rfi_status?.replace(/_/g, ' ') || 'Pending'}
                </Badge>
              </div>
            ))}
            {displayEntities.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No entities</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Account List Widget
  if (widget.widget_type === 'account_list') {
    const limit = config.limit || 5;
    const filterStatus = config.filter_status;
    let displayAccounts = accounts;
    if (filterStatus && filterStatus !== 'all') {
      displayAccounts = accounts.filter(a => a.reportability_status === filterStatus);
    }
    displayAccounts = displayAccounts.slice(0, limit);

    return (
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{widget.title}</CardTitle>
          <Link to={createPageUrl("Accounts")} className="text-xs text-indigo-600 hover:underline">
            View All
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {displayAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{account.account_holder_name}</p>
                  <p className="text-xs text-slate-500">{account.account_number}</p>
                </div>
                <Badge className={
                  account.reportability_status === 'reportable' ? 'bg-amber-100 text-amber-800' :
                  account.reportability_status === 'non_reportable' ? 'bg-green-100 text-green-800' :
                  'bg-blue-100 text-blue-800'
                }>
                  {account.reportability_status?.replace(/_/g, ' ') || 'Pending'}
                </Badge>
              </div>
            ))}
            {displayAccounts.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No accounts</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compliance Summary Widget
  if (widget.widget_type === 'compliance_summary') {
    const totalEntities = entities.length;
    const classifiedEntities = entities.filter(e => e.rfi_status !== 'pending_classification').length;
    const totalAccounts = accounts.length;
    const classifiedAccounts = accounts.filter(a => a.reportability_status !== 'pending_review').length;

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-600">Entities Classified</span>
              <span className="font-medium">{classifiedEntities}/{totalEntities}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full"
                style={{ width: `${totalEntities > 0 ? (classifiedEntities / totalEntities) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-600">Accounts Reviewed</span>
              <span className="font-medium">{classifiedAccounts}/{totalAccounts}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${totalAccounts > 0 ? (classifiedAccounts / totalAccounts) * 100 : 0}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Reportability Breakdown Widget
  if (widget.widget_type === 'reportability_breakdown') {
    const reportable = accounts.filter(a => a.reportability_status === 'reportable').length;
    const nonReportable = accounts.filter(a => a.reportability_status === 'non_reportable').length;
    const pending = accounts.filter(a => a.reportability_status === 'pending_review').length;
    const excluded = accounts.filter(a => a.reportability_status === 'excluded').length;

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-700">{reportable}</p>
              <p className="text-xs text-amber-600">Reportable</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{nonReportable}</p>
              <p className="text-xs text-green-600">Non-Reportable</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">{pending}</p>
              <p className="text-xs text-blue-600">Pending Review</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-700">{excluded}</p>
              <p className="text-xs text-slate-600">Excluded</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Quick Actions Widget
  if (widget.widget_type === 'quick_actions') {
    const actions = config.actions || [
      { label: 'Add Account', url: 'Accounts', icon: 'Wallet' },
      { label: 'Add Entity', url: 'Entities', icon: 'Building2' },
      { label: 'View Reports', url: 'Reports', icon: 'FileText' }
    ];

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {actions.map((action, idx) => (
              <Link
                key={idx}
                to={createPageUrl(action.url)}
                className="flex items-center gap-2 p-3 rounded-lg border hover:border-indigo-300 hover:bg-indigo-50 transition-all"
              >
                <Zap className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pending Tasks Widget
  if (widget.widget_type === 'pending_tasks') {
    const pendingAccounts = accounts.filter(a => a.reportability_status === 'pending_review');
    const pendingEntities = entities.filter(e => e.rfi_status === 'pending_classification');

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingAccounts.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-900">Accounts pending review</span>
                </div>
                <Badge className="bg-amber-600 text-white">{pendingAccounts.length}</Badge>
              </div>
            )}
            {pendingEntities.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Entities pending classification</span>
                </div>
                <Badge className="bg-purple-600 text-white">{pendingEntities.length}</Badge>
              </div>
            )}
            {pendingAccounts.length === 0 && pendingEntities.length === 0 && (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-sm text-slate-600">All caught up!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default fallback
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500">Widget type: {widget.widget_type}</p>
      </CardContent>
    </Card>
  );
}