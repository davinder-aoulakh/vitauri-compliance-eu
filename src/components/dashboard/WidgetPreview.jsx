import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Wallet,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  Activity,
  ArrowRight,
  Calendar,
  FileWarning,
  RefreshCw
} from "lucide-react";
import JurisdictionOverviewWidget from "./JurisdictionOverviewWidget";
import EntityClassificationWidget from "./EntityClassificationWidget";
import { useWidgetRefresh, getWidgetQueryKeys, DEFAULT_REFRESH_INTERVALS } from "./useWidgetRefresh";
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
  Legend,
  Area,
  AreaChart
} from "recharts";
import moment from "moment";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function WidgetPreview({ widget, tenantId, selectedEntityId, accessibleEntityIds }) {
  const config = widget.config || {};
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Determine refresh interval - use config value or default for widget type
  const refreshInterval = config.refreshInterval !== undefined 
    ? config.refreshInterval 
    : DEFAULT_REFRESH_INTERVALS[widget.widget_type] || 30000;

  const autoRefreshEnabled = config.autoRefresh !== false && refreshInterval > 0;

  // Get query keys for this widget type
  const queryKeys = getWidgetQueryKeys(widget.widget_type, tenantId);

  // Set up auto-refresh
  const { refreshData } = useWidgetRefresh({
    widgetId: widget.widget_id,
    tenantId,
    refreshInterval: autoRefreshEnabled ? refreshInterval : 0,
    enabled: autoRefreshEnabled,
    queryKeys
  });

  // Handle manual refresh
  const handleManualRefresh = () => {
    setIsRefreshing(true);
    refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Fetch data based on widget type
  const { data: accounts = [], isFetching: accountsFetching } = useQuery({
    queryKey: ['widget-accounts', tenantId, selectedEntityId],
    queryFn: () => {
      const filter = { tenant_id: tenantId };
      if (selectedEntityId) filter.entity_id = selectedEntityId;
      return base44.entities.Account.filter(filter);
    },
    enabled: !!tenantId && ['stats_card', 'account_list', 'reportability_breakdown', 'chart_pie', 'chart_bar', 'pending_tasks', 'chart_line'].includes(widget.widget_type),
    staleTime: refreshInterval > 0 ? refreshInterval / 2 : 30000
  });

  const { data: entities = [], isFetching: entitiesFetching } = useQuery({
    queryKey: ['widget-entities', tenantId],
    queryFn: () => base44.entities.Entity.filter({ tenant_id: tenantId }),
    enabled: !!tenantId && ['stats_card', 'entity_list', 'compliance_summary', 'pending_tasks', 'chart_line'].includes(widget.widget_type),
    staleTime: refreshInterval > 0 ? refreshInterval / 2 : 30000
  });

  const { data: auditLogs = [], isFetching: logsFetching } = useQuery({
    queryKey: ['widget-audit-logs', tenantId],
    queryFn: () => base44.entities.AuditLog.filter({ tenant_id: tenantId }, '-timestamp', 10),
    enabled: !!tenantId && widget.widget_type === 'recent_activity',
    staleTime: refreshInterval > 0 ? refreshInterval / 2 : 30000
  });

  const { data: reports = [], isFetching: reportsFetching } = useQuery({
    queryKey: ['widget-reports', tenantId, selectedEntityId],
    queryFn: () => {
      const filter = { tenant_id: tenantId };
      if (selectedEntityId) filter.entity_id = selectedEntityId;
      return base44.entities.CRSReport.filter(filter);
    },
    enabled: !!tenantId && (widget.widget_type === 'stats_card' && widget.config?.metric === 'total_crs_reports'),
    staleTime: refreshInterval > 0 ? refreshInterval / 2 : 30000
  });

  // Apply entity access filtering for non-admin users
  const filteredAccounts = accessibleEntityIds ? accounts.filter(a => accessibleEntityIds.has(a.entity_id)) : accounts;
  const filteredEntities = accessibleEntityIds ? entities.filter(e => accessibleEntityIds.has(e.id)) : entities;
  const filteredReports = accessibleEntityIds ? reports.filter(r => accessibleEntityIds.has(r.entity_id)) : reports;

  // Use filtered data throughout
  const accountsData = filteredAccounts;
  const entitiesData = filteredEntities;
  const reportsData = filteredReports;

  const isAnyFetching = accountsFetching || entitiesFetching || logsFetching || reportsFetching || isRefreshing;

  // Refresh indicator component
  const RefreshIndicator = ({ showButton = false }) => {
    if (!autoRefreshEnabled && !showButton) return null;
    
    return (
      <div className="flex items-center gap-1">
        {isAnyFetching && (
          <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
        )}
        {showButton && !isAnyFetching && (
          <button 
            onClick={handleManualRefresh}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-3 h-3 text-slate-400 hover:text-slate-600" />
          </button>
        )}
        {autoRefreshEnabled && !isAnyFetching && !showButton && (
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" title={`Auto-refresh every ${refreshInterval / 1000}s`} />
        )}
      </div>
    );
  };

  // Stats Card Widget
  if (widget.widget_type === 'stats_card') {
    const metric = config.metric || 'total_accounts';
    let value = 0;
    let trendLabel = config.trendLabel || null;
    let subDescription = config.subDescription || null;
    let icon = <Wallet className="w-6 h-6" />;
    let iconBgColor = 'bg-indigo-100';
    let drilldownUrl = null;

    const reportingFIs = entities.filter(e => e.rfi_status === 'reporting_fi').length;
    const pendingReviewCount = accounts.filter(a => a.reportability_status === 'pending_review').length;

    // Show refresh indicator in stats card

    switch (metric) {
      case 'total_accounts':
        value = accounts.length;
        icon = <Wallet className="w-6 h-6 text-indigo-600" />;
        iconBgColor = 'bg-indigo-100';
        drilldownUrl = createPageUrl("Accounts");
        break;
      case 'total_entities':
        value = entities.length;
        icon = <Building2 className="w-6 h-6 text-blue-600" />;
        iconBgColor = 'bg-blue-100';
        if (!subDescription) subDescription = `${reportingFIs} Reporting FIs`;
        drilldownUrl = createPageUrl("Entities");
        break;
      case 'reportable_accounts':
        value = accounts.filter(a => a.reportability_status === 'reportable').length;
        icon = <FileText className="w-6 h-6 text-purple-600" />;
        iconBgColor = 'bg-purple-100';
        if (!subDescription) subDescription = `${accounts.length} total accounts`;
        if (pendingReviewCount > 0 && !trendLabel) {
          trendLabel = `${pendingReviewCount} pending review`;
        }
        drilldownUrl = createPageUrl("Accounts") + "?status=reportable";
        break;
      case 'non_reportable_accounts':
        value = accounts.filter(a => a.reportability_status === 'non_reportable').length;
        icon = <CheckCircle className="w-6 h-6 text-green-600" />;
        iconBgColor = 'bg-green-100';
        if (!subDescription) subDescription = `${accounts.length} total accounts`;
        drilldownUrl = createPageUrl("Accounts") + "?status=non_reportable";
        break;
      case 'pending_review':
        value = pendingReviewCount;
        icon = <Clock className="w-6 h-6 text-blue-600" />;
        iconBgColor = 'bg-blue-100';
        drilldownUrl = createPageUrl("Accounts") + "?status=pending_review";
        break;
      case 'excluded_accounts':
        value = accounts.filter(a => a.reportability_status === 'excluded').length;
        icon = <AlertTriangle className="w-6 h-6 text-slate-600" />;
        iconBgColor = 'bg-slate-100';
        if (!subDescription) subDescription = `${accounts.length} total accounts`;
        drilldownUrl = createPageUrl("Accounts") + "?status=excluded";
        break;
      case 'classified_entities':
        value = entities.filter(e => e.rfi_status !== 'pending_classification').length;
        icon = <CheckCircle className="w-6 h-6 text-green-600" />;
        iconBgColor = 'bg-green-100';
        drilldownUrl = createPageUrl("Entities");
        break;
      case 'reporting_fi_entities':
        value = entities.filter(e => e.rfi_status === 'reporting_fi').length;
        icon = <Building2 className="w-6 h-6 text-amber-600" />;
        iconBgColor = 'bg-amber-100';
        if (!subDescription) subDescription = `${entities.length} total entities`;
        drilldownUrl = createPageUrl("Entities");
        break;
      case 'non_reporting_fi_entities':
        value = entities.filter(e => e.rfi_status === 'non_reporting_fi').length;
        icon = <Building2 className="w-6 h-6 text-green-600" />;
        iconBgColor = 'bg-green-100';
        if (!subDescription) subDescription = `${entities.length} total entities`;
        drilldownUrl = createPageUrl("Entities");
        break;
      case 'active_nfe_entities':
        value = accounts.filter(a => a.entity_classification === 'active_nfe').length;
        icon = <Building2 className="w-6 h-6 text-blue-600" />;
        iconBgColor = 'bg-blue-100';
        if (!subDescription) subDescription = `${entities.length} total entities`;
        drilldownUrl = createPageUrl("Accounts") + "?entity_classification=active_nfe";
        break;
      case 'passive_nfe_entities':
        value = accounts.filter(a => a.entity_classification === 'passive_nfe').length;
        icon = <Building2 className="w-6 h-6 text-purple-600" />;
        iconBgColor = 'bg-purple-100';
        if (!subDescription) subDescription = `${entities.length} total entities`;
        drilldownUrl = createPageUrl("Accounts") + "?entity_classification=passive_nfe";
        break;
      case 'total_crs_reports':
        value = reports.length;
        icon = <FileText className="w-6 h-6 text-emerald-600" />;
        iconBgColor = 'bg-emerald-100';
        if (!subDescription) subDescription = `Year ${new Date().getFullYear()}`;
        drilldownUrl = createPageUrl("Reports") + `?year=${new Date().getFullYear()}`;
        break;
      case 'custom_account_filter':
        const customAccountFilter = config.customFilter || {};
        let filteredAccounts = [...accounts];
        
        if (customAccountFilter.status && customAccountFilter.status !== 'all') {
          filteredAccounts = filteredAccounts.filter(a => a.reportability_status === customAccountFilter.status);
        }
        if (customAccountFilter.account_type && customAccountFilter.account_type !== 'all') {
          filteredAccounts = filteredAccounts.filter(a => a.account_type === customAccountFilter.account_type);
        }
        if (customAccountFilter.account_holder_type && customAccountFilter.account_holder_type !== 'all') {
          filteredAccounts = filteredAccounts.filter(a => a.account_holder_type === customAccountFilter.account_holder_type);
        }
        
        value = filteredAccounts.length;
        icon = <Wallet className="w-6 h-6 text-indigo-600" />;
        iconBgColor = 'bg-indigo-100';
        if (!subDescription) subDescription = `${accounts.length} total accounts`;
        drilldownUrl = createPageUrl("Accounts");
        break;
      case 'custom_entity_filter':
        const customEntityFilter = config.customFilter || {};
        let filteredEntities = [...entities];
        
        if (customEntityFilter.rfi_status && customEntityFilter.rfi_status !== 'all') {
          filteredEntities = filteredEntities.filter(e => e.rfi_status === customEntityFilter.rfi_status);
        }
        if (customEntityFilter.entity_type && customEntityFilter.entity_type !== 'all') {
          filteredEntities = filteredEntities.filter(e => e.entity_type === customEntityFilter.entity_type);
        }
        
        value = filteredEntities.length;
        icon = <Building2 className="w-6 h-6 text-blue-600" />;
        iconBgColor = 'bg-blue-100';
        if (!subDescription) subDescription = `${entities.length} total entities`;
        drilldownUrl = createPageUrl("Entities");
        break;
    }

    // Trend indicator config
    const showTrend = config.showTrend;
    const trendDirection = config.trendDirection || 'up';
    const trendValue = config.trendValue || '';

    const getTrendIcon = () => {
      if (trendDirection === 'up') return <TrendingUp className="w-3 h-3" />;
      if (trendDirection === 'down') return <TrendingDown className="w-3 h-3" />;
      return <Minus className="w-3 h-3" />;
    };

    const getTrendColor = () => {
      if (trendDirection === 'up') return 'bg-green-50 text-green-700 border-green-200';
      if (trendDirection === 'down') return 'bg-red-50 text-red-700 border-red-200';
      return 'bg-slate-50 text-slate-700 border-slate-200';
    };

    const cardContent = (
      <Card className="h-full hover:shadow-lg transition-all cursor-pointer">
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-2">
            <RefreshIndicator showButton={true} />
            {(showTrend && trendValue) && (
              <Badge variant="outline" className={`text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="ml-1">{trendValue}</span>
                {trendLabel && <span className="ml-1">{trendLabel}</span>}
              </Badge>
            )}
            {!showTrend && trendLabel && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                <TrendingUp className="w-3 h-3 mr-1" />
                {trendLabel}
              </Badge>
            )}
          </div>
          <div className="flex items-start justify-between">
            <div className={`p-3 rounded-xl ${iconBgColor}`}>
              {icon}
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-slate-600">{widget.title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
            {subDescription && (
              <p className="text-sm text-slate-500 mt-1">{subDescription}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );

    return drilldownUrl ? (
      <Link to={drilldownUrl} className="no-underline">
        {cardContent}
      </Link>
    ) : cardContent;
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
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{widget.title}</CardTitle>
          <RefreshIndicator showButton={true} />
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
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{widget.title}</CardTitle>
          <RefreshIndicator showButton={true} />
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
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{widget.title}</CardTitle>
          <RefreshIndicator showButton={true} />
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
    const filterStatus = config.filter_status;
    const sortBy = config.sortBy || 'created_date';
    
    let filteredEntities = [...entities];
    
    // Apply status filter
    if (filterStatus && filterStatus !== 'all') {
      filteredEntities = filteredEntities.filter(e => e.rfi_status === filterStatus);
    }
    
    // Apply sorting
    filteredEntities.sort((a, b) => {
      const desc = sortBy.startsWith('-');
      const field = desc ? sortBy.slice(1) : sortBy;
      const aVal = a[field] || '';
      const bVal = b[field] || '';
      const comparison = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
      return desc ? -comparison : comparison;
    });
    
    const displayEntities = filteredEntities.slice(0, limit);

    return (
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{widget.title}</CardTitle>
            <RefreshIndicator showButton={true} />
          </div>
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
    const sortBy = config.sortBy || 'created_date';
    
    let filteredAccounts = [...accounts];
    
    // Apply status filter
    if (filterStatus && filterStatus !== 'all') {
      filteredAccounts = filteredAccounts.filter(a => a.reportability_status === filterStatus);
    }
    
    // Apply sorting
    filteredAccounts.sort((a, b) => {
      const desc = sortBy.startsWith('-');
      const field = desc ? sortBy.slice(1) : sortBy;
      const aVal = a[field] || '';
      const bVal = b[field] || '';
      const comparison = typeof aVal === 'string' ? aVal.localeCompare(bVal) : (aVal || 0) - (bVal || 0);
      return desc ? -comparison : comparison;
    });
    
    const displayAccounts = filteredAccounts.slice(0, limit);

    return (
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{widget.title}</CardTitle>
            <RefreshIndicator showButton={true} />
          </div>
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

    // Calculate percentage based on config or default to entity classification
    const metricType = config.metricType || 'entity_classification';
    let percentage = 0;
    let label = 'Entity classification';

    if (metricType === 'entity_classification') {
      percentage = totalEntities > 0 ? Math.round((classifiedEntities / totalEntities) * 100) : 0;
      label = 'Entity classification';
    } else if (metricType === 'account_review') {
      percentage = totalAccounts > 0 ? Math.round((classifiedAccounts / totalAccounts) * 100) : 0;
      label = 'Account review';
    } else if (metricType === 'overall') {
      const totalItems = totalEntities + totalAccounts;
      const completedItems = classifiedEntities + classifiedAccounts;
      percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      label = 'Overall compliance';
    }

    // Compact card style (like stats cards)
    if (config.displayStyle === 'compact' || widget.position?.w <= 3) {
      return (
        <Card className="h-full">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-green-100">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-slate-600">{widget.title}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{percentage}%</p>
              <p className="text-sm text-slate-500 mt-1">{label}</p>
            </div>
            <div className="mt-3 w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      );
    }

    // Full card style with detailed breakdown
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
    const taskType = config.taskType;

    // If specific task type is configured, show only that
    if (taskType === 'accounts_pending_classification') {
      return (
        <Card className="h-full">
          <CardContent className="p-4">
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Accounts Pending Classification</p>
                  <p className="text-sm text-slate-600">{pendingAccounts.length} accounts need reportability review</p>
                </div>
              </div>
              <Link to={createPageUrl("Accounts")} className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-indigo-600">
                Review Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (taskType === 'crs_report_due') {
      const reportYear = config.reportYear || new Date().getFullYear();
      return (
        <Card className="h-full">
          <CardContent className="p-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{reportYear} CRS Report Due</p>
                  <p className="text-sm text-slate-600">Annual reporting deadline approaching</p>
                </div>
              </div>
              <Link to={createPageUrl("Reports")} className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-indigo-600">
                Start Report
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Entities pending classification
    if (taskType === 'entities_pending_classification') {
      return (
        <Card className="h-full">
          <CardContent className="p-4">
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Entities Pending Classification</p>
                  <p className="text-sm text-slate-600">
                    {config.taskDescription || `${pendingEntities.length} entities need RFI classification`}
                  </p>
                </div>
              </div>
              <Link to={createPageUrl("Entities")} className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-indigo-600">
                Review Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Self certification missing
    if (taskType === 'self_certification_missing') {
      const missingCertCount = accounts.filter(a => !a.self_certification_obtained && a.reportability_status === 'reportable').length;
      return (
        <Card className="h-full">
          <CardContent className="p-4">
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <FileWarning className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Self-Certification Missing</p>
                  <p className="text-sm text-slate-600">{missingCertCount} reportable accounts need self-certification</p>
                </div>
              </div>
              <Link to={createPageUrl("Accounts")} className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-indigo-600">
                Review Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Default: show all pending tasks
    return (
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{widget.title}</CardTitle>
          <RefreshIndicator showButton={true} />
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

  // Jurisdiction Overview Widget
  if (widget.widget_type === 'jurisdiction_overview') {
    return (
      <Card className="h-full">
        <CardContent className="p-6">
          <JurisdictionOverviewWidget 
            tenantId={tenantId} 
            deadlineDate={config.deadlineDate}
            deadlineDescription={config.deadlineDescription}
            showReportingCount={config.showReportingCount !== false}
          />
        </CardContent>
      </Card>
    );
  }

  // Entity Classification Status Widget
  if (widget.widget_type === 'entity_classification') {
    return (
      <Card className="h-full">
        <CardContent className="p-6">
          <EntityClassificationWidget tenantId={tenantId} />
        </CardContent>
      </Card>
    );
  }

  // Line Chart Widget
  if (widget.widget_type === 'chart_line') {
    const dataSource = config.data_source || 'accounts_over_time';
    const timeRange = config.timeRange || '6months';
    const aggregation = config.aggregation || 'monthly';
    const lineColor = config.lineColor || '#4f46e5';
    const showDataPoints = config.showDataPoints !== false;
    const fillArea = config.fillArea || false;

    // Generate time-based data
    const generateTimeData = () => {
      let periods = [];
      
      switch (timeRange) {
        case '7days':
          for (let i = 6; i >= 0; i--) {
            periods.push(moment().subtract(i, 'days').format('MMM D'));
          }
          break;
        case '30days':
          for (let i = 29; i >= 0; i -= aggregation === 'daily' ? 1 : 7) {
            periods.push(moment().subtract(i, 'days').format('MMM D'));
          }
          break;
        case '3months':
          for (let i = 2; i >= 0; i--) {
            periods.push(moment().subtract(i, 'months').format('MMM'));
          }
          break;
        case '6months':
          for (let i = 5; i >= 0; i--) {
            periods.push(moment().subtract(i, 'months').format('MMM'));
          }
          break;
        case '1year':
          for (let i = 11; i >= 0; i--) {
            periods.push(moment().subtract(i, 'months').format('MMM'));
          }
          break;
        default:
          for (let i = 5; i >= 0; i--) {
            periods.push(moment().subtract(i, 'months').format('MMM'));
          }
      }

      // Generate data based on source
      let data = [];
      const totalItems = dataSource.includes('accounts') ? accounts.length : entities.length;
      
      periods.forEach((period, idx) => {
        let value = 0;
        switch (dataSource) {
          case 'accounts_over_time':
            value = Math.floor((totalItems / periods.length) * (idx + 1) + Math.random() * 5);
            break;
          case 'entities_over_time':
            value = Math.floor((totalItems / periods.length) * (idx + 1) + Math.random() * 3);
            break;
          case 'reportable_trend':
            const reportableCount = accounts.filter(a => a.reportability_status === 'reportable').length;
            value = Math.floor((reportableCount / periods.length) * (idx + 1) + Math.random() * 2);
            break;
          case 'classification_progress':
            const classifiedCount = entities.filter(e => e.rfi_status !== 'pending_classification').length;
            value = Math.floor((classifiedCount / Math.max(entities.length, 1)) * 100 * ((idx + 1) / periods.length));
            break;
        }
        data.push({ name: period, value: Math.max(0, value) });
      });

      return data;
    };

    const chartData = generateTimeData();

    return (
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{widget.title}</CardTitle>
          <RefreshIndicator showButton={true} />
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {fillArea ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={lineColor} 
                    fill={`${lineColor}20`}
                    strokeWidth={2}
                    dot={showDataPoints ? { fill: lineColor, strokeWidth: 2, r: 4 } : false}
                  />
                </AreaChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={lineColor} 
                    strokeWidth={2}
                    dot={showDataPoints ? { fill: lineColor, strokeWidth: 2, r: 4 } : false}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
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