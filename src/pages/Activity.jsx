import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity as ActivityIcon,
  Filter,
  RefreshCw,
  FileText,
  User,
  Building2,
  Wallet,
  Settings,
  GitBranch,
  UserPlus,
  Trash2,
  Edit,
  CheckCircle,
  Send,
  Calendar,
  Download,
  LayoutDashboard,
  Grid3X3,
  Upload,
  Shield,
  UserMinus,
  Archive,
  XCircle,
  Shield as ShieldIcon
} from "lucide-react";
import { auditLog } from "@/components/utils/auditLogger";
import moment from "moment";

export default function ActivityPage() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [actionCategory, setActionCategory] = useState("all"); // "all", "create", "update", "delete"

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const { data: auditLogs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit-logs', user?.tenant_id],
    queryFn: async () => {
      if (!user) return [];
      // Super admins can see all logs; tenant users only see their own tenant's logs
      if (user.app_role === 'super_admin') {
        return await base44.entities.AuditLog.list('-timestamp', 500);
      }
      return await base44.entities.AuditLog.filter({ tenant_id: user.tenant_id }, '-timestamp', 500);
    },
    enabled: !!user
  });

  const isAdmin = user?.app_role === 'tenant_admin' || user?.app_role === 'super_admin';
  const isSuperAdmin = user?.app_role === 'super_admin';

  const { data: userEntityAccess = [] } = useQuery({
    queryKey: ['user-entity-access', user?.id],
    queryFn: () => base44.entities.UserEntityAccess.filter({ user_id: user.id, tenant_id: user.tenant_id }),
    enabled: !!user?.id && !isAdmin
  });

  const { data: accessibleAccounts = [] } = useQuery({
    queryKey: ['accounts-for-activity', user?.tenant_id],
    queryFn: () => base44.entities.Account.filter({ tenant_id: user.tenant_id }),
    enabled: !!user?.tenant_id && !isAdmin
  });

  const hasEntityAccess = userEntityAccess.length > 0;

  const handleRefresh = () => {
    refetch();
  };

  // Get unique users for filter
  const uniqueUsers = [...new Set(auditLogs.map(log => log.actor_email))].filter(Boolean);

  // For non-admins: scope logs to accessible entities/accounts
  const accessibleEntityIds = new Set(userEntityAccess.map(a => a.rfi_entity_id));
  const accessibleAccountIds = new Set(
    accessibleAccounts.filter(a => accessibleEntityIds.has(a.entity_id)).map(a => a.id)
  );

  const scopedLogs = isAdmin ? auditLogs : auditLogs.filter(log => {
    if (!log.target_entity_type) return false;
    if (log.target_entity_type === 'Entity') return accessibleEntityIds.has(log.target_entity_id);
    if (log.target_entity_type === 'Account') return accessibleAccountIds.has(log.target_entity_id);
    return false;
  });

  // Filter logs
  const filteredLogs = scopedLogs.filter(log => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      log.action_type?.toLowerCase().includes(searchLower) ||
      log.actor_email?.toLowerCase().includes(searchLower) ||
      log.target_entity_type?.toLowerCase().includes(searchLower);

    // Action type filter
    const matchesActionType = actionTypeFilter === "all" || log.action_type === actionTypeFilter;

    // User filter
    const matchesUser = userFilter === "all" || log.actor_email === userFilter;

    // Date filter (preset)
    let matchesDate = true;
    if (dateFilter !== "all" && dateFilter !== "custom" && log.timestamp) {
      const logDate = moment(log.timestamp);
      const now = moment();
      
      switch (dateFilter) {
        case "today":
          matchesDate = logDate.isSame(now, 'day');
          break;
        case "week":
          matchesDate = logDate.isAfter(moment().subtract(7, 'days'));
          break;
        case "month":
          matchesDate = logDate.isAfter(moment().subtract(30, 'days'));
          break;
        default:
          matchesDate = true;
      }
    }

    // Custom date range filter
    if (dateFilter === "custom" && log.timestamp) {
      const logDate = moment(log.timestamp);
      if (startDate) {
        matchesDate = matchesDate && logDate.isSameOrAfter(moment(startDate), 'day');
      }
      if (endDate) {
        matchesDate = matchesDate && logDate.isSameOrBefore(moment(endDate), 'day');
      }
    }

    // Action category filter (create/update/delete)
    let matchesCategory = true;
    if (actionCategory !== "all") {
      const actionLower = log.action_type?.toLowerCase() || "";
      switch (actionCategory) {
        case "create":
          matchesCategory = actionLower.includes("created") || actionLower.includes("invited");
          break;
        case "update":
          matchesCategory = actionLower.includes("updated") || actionLower.includes("classified") || actionLower.includes("changed");
          break;
        case "delete":
          matchesCategory = actionLower.includes("deleted");
          break;
        default:
          matchesCategory = true;
      }
    }

    return matchesSearch && matchesActionType && matchesUser && matchesDate && matchesCategory;
  });

  const getActionIcon = (actionType) => {
    const iconMap = {
      entity_created: <Building2 className="w-4 h-4" />,
      entity_updated: <Edit className="w-4 h-4" />,
      entity_deleted: <Trash2 className="w-4 h-4" />,
      entity_classified: <CheckCircle className="w-4 h-4" />,
      account_created: <Wallet className="w-4 h-4" />,
      account_updated: <Edit className="w-4 h-4" />,
      account_deleted: <Trash2 className="w-4 h-4" />,
      account_classified: <CheckCircle className="w-4 h-4" />,
      report_generated: <FileText className="w-4 h-4" />,
      report_submitted: <Send className="w-4 h-4" />,
      user_invited: <UserPlus className="w-4 h-4" />,
      user_role_changed: <User className="w-4 h-4" />,
      user_removed: <UserMinus className="w-4 h-4" />,
      workflow_published: <GitBranch className="w-4 h-4" />,
      workflow_archived: <Archive className="w-4 h-4" />,
      settings_changed: <Settings className="w-4 h-4" />,
      dashboard_created: <LayoutDashboard className="w-4 h-4" />,
      dashboard_updated: <Edit className="w-4 h-4" />,
      dashboard_deleted: <Trash2 className="w-4 h-4" />,
      dashboard_published: <CheckCircle className="w-4 h-4" />,
      widget_added: <Grid3X3 className="w-4 h-4" />,
      widget_updated: <Edit className="w-4 h-4" />,
      widget_removed: <Trash2 className="w-4 h-4" />,
      data_exported: <Download className="w-4 h-4" />,
      data_imported: <Upload className="w-4 h-4" />,
      permission_changed: <Shield className="w-4 h-4" />,
      bulk_import_initiated: <Upload className="w-4 h-4" />,
      bulk_import_completed: <CheckCircle className="w-4 h-4" />,
      bulk_import_failed: <XCircle className="w-4 h-4" />
    };
    return iconMap[actionType] || <ActivityIcon className="w-4 h-4" />;
  };

  const getActionBadge = (actionType) => {
    const colorMap = {
      entity_created: "bg-green-100 text-green-800",
      entity_updated: "bg-blue-100 text-blue-800",
      entity_deleted: "bg-red-100 text-red-800",
      entity_classified: "bg-purple-100 text-purple-800",
      account_created: "bg-green-100 text-green-800",
      account_updated: "bg-blue-100 text-blue-800",
      account_deleted: "bg-red-100 text-red-800",
      account_classified: "bg-purple-100 text-purple-800",
      report_generated: "bg-indigo-100 text-indigo-800",
      report_submitted: "bg-teal-100 text-teal-800",
      user_invited: "bg-green-100 text-green-800",
      user_role_changed: "bg-amber-100 text-amber-800",
      user_removed: "bg-red-100 text-red-800",
      workflow_published: "bg-purple-100 text-purple-800",
      workflow_archived: "bg-slate-100 text-slate-800",
      settings_changed: "bg-slate-100 text-slate-800",
      dashboard_created: "bg-emerald-100 text-emerald-800",
      dashboard_updated: "bg-cyan-100 text-cyan-800",
      dashboard_deleted: "bg-red-100 text-red-800",
      dashboard_published: "bg-green-100 text-green-800",
      widget_added: "bg-sky-100 text-sky-800",
      widget_updated: "bg-blue-100 text-blue-800",
      widget_removed: "bg-orange-100 text-orange-800",
      data_exported: "bg-violet-100 text-violet-800",
      data_imported: "bg-fuchsia-100 text-fuchsia-800",
      permission_changed: "bg-rose-100 text-rose-800",
      bulk_import_initiated: "bg-fuchsia-100 text-fuchsia-800",
      bulk_import_completed: "bg-green-100 text-green-800",
      bulk_import_failed: "bg-red-100 text-red-800"
    };

    const formattedAction = actionType?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    return (
      <Badge className={colorMap[actionType] || "bg-slate-100 text-slate-800"}>
        {formattedAction}
      </Badge>
    );
  };

  // Format changes for readable display
  const renderChanges = (changes) => {
    if (!changes) return null;

    // Handle field change format: { field, previous_value, new_value }
    if (changes.field) {
      return (
        <div className="space-y-1">
          <div className="font-medium text-slate-700">
            {changes.field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </div>
          {changes.previous_value !== undefined && (
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-medium text-xs">Before:</span>
              <span className="text-slate-600 text-xs">
                {typeof changes.previous_value === 'object' 
                  ? formatObjectValue(changes.previous_value) 
                  : String(changes.previous_value || '(empty)')}
              </span>
            </div>
          )}
          {changes.new_value !== undefined && (
            <div className="flex items-start gap-2">
              <span className="text-green-600 font-medium text-xs">After:</span>
              <span className="text-slate-600 text-xs">
                {typeof changes.new_value === 'object' 
                  ? formatObjectValue(changes.new_value) 
                  : String(changes.new_value || '(empty)')}
              </span>
            </div>
          )}
        </div>
      );
    }

    // Handle bulk import changes format
    if (changes.imported_records || changes.updated_records || changes.failed_records) {
      return (
        <div className="space-y-3">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-2">
            {changes.total_records && (
              <div className="bg-slate-50 p-2 rounded">
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-sm font-bold text-slate-900">{changes.total_records}</p>
              </div>
            )}
            {changes.created !== undefined && (
              <div className="bg-green-50 p-2 rounded">
                <p className="text-xs text-green-600">Created</p>
                <p className="text-sm font-bold text-green-700">{changes.created}</p>
              </div>
            )}
            {changes.updated !== undefined && (
              <div className="bg-amber-50 p-2 rounded">
                <p className="text-xs text-amber-600">Updated</p>
                <p className="text-sm font-bold text-amber-700">{changes.updated}</p>
              </div>
            )}
            {changes.failed !== undefined && (
              <div className="bg-red-50 p-2 rounded">
                <p className="text-xs text-red-600">Failed</p>
                <p className="text-sm font-bold text-red-700">{changes.failed}</p>
              </div>
            )}
          </div>

          {/* Detailed Records - Collapsible */}
          {changes.imported_records && changes.imported_records.length > 0 && (
            <details className="bg-green-50 border border-green-200 rounded p-2">
              <summary className="text-xs font-medium text-green-800 cursor-pointer">
                View {changes.imported_records.length} Created Records
              </summary>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {changes.imported_records.map((record, idx) => (
                  <div key={idx} className="text-xs text-green-700 flex items-center gap-2">
                    <span className="font-mono text-green-600">Row {record.row}:</span>
                    <span className="truncate">{record.name}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {changes.updated_records && changes.updated_records.length > 0 && (
            <details className="bg-amber-50 border border-amber-200 rounded p-2">
              <summary className="text-xs font-medium text-amber-800 cursor-pointer">
                View {changes.updated_records.length} Updated Records
              </summary>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {changes.updated_records.map((record, idx) => (
                  <div key={idx} className="text-xs text-amber-700 flex items-center gap-2">
                    <span className="font-mono text-amber-600">Row {record.row}:</span>
                    <span className="truncate">{record.name}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {changes.failed_records && changes.failed_records.length > 0 && (
            <details className="bg-red-50 border border-red-200 rounded p-2">
              <summary className="text-xs font-medium text-red-800 cursor-pointer">
                View {changes.failed_records.length} Failed Records
              </summary>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {changes.failed_records.map((record, idx) => (
                  <div key={idx} className="text-xs bg-red-100 p-2 rounded border border-red-300">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-red-600">Row {record.row}:</span>
                      <span className="font-medium truncate text-red-900">{record.name}</span>
                      {record.type && (
                        <Badge className="text-xs bg-red-200 text-red-900">
                          {record.type.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    {record.error && (
                      <p className="text-red-700 ml-2">{record.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      );
    }

    // Handle generic object changes
    return Object.entries(changes).map(([key, value]) => (
      <div key={key} className="border-b border-slate-200 pb-2 last:border-0 last:pb-0">
        <div className="font-medium text-slate-700 text-xs mb-1">
          {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </div>
        <div className="text-slate-600 text-xs">
          {typeof value === 'object' && value !== null
            ? formatObjectValue(value)
            : String(value ?? '(empty)')}
        </div>
      </div>
    ));
  };

  const formatObjectValue = (obj) => {
    if (!obj || typeof obj !== 'object') return String(obj ?? '(empty)');
    
    // Handle address objects
    if (obj.street || obj.city || obj.country) {
      const parts = [obj.street, obj.city, obj.state, obj.postal_code, obj.country].filter(Boolean);
      return parts.join(', ') || '(empty)';
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '(empty)';
      return obj.map((item, idx) => (
        <div key={idx} className="ml-2">• {typeof item === 'object' ? formatObjectValue(item) : String(item)}</div>
      ));
    }

    // Generic object - show key-value pairs
    const entries = Object.entries(obj).filter(([_, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length === 0) return '(empty)';
    
    return entries.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
  };

  const exportToCSV = async () => {
    const csvContent = [
      ['Timestamp', 'Action', 'User', 'Role', 'Entity Type', 'Entity Name', 'Entity ID'],
      ...filteredLogs.map(log => [
        moment(log.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        log.action_type,
        log.actor_email,
        log.actor_role,
        log.target_entity_type || '',
        log.target_entity_name || '',
        log.target_entity_id || ''
      ])
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${moment().format('YYYY-MM-DD')}.csv`;
    a.click();
    
    // Log the export action
    await auditLog.dataExported('AuditLog', { 
      records_count: filteredLogs.length,
      filters_applied: { actionTypeFilter, dateFilter, userFilter, actionCategory },
      export_format: 'CSV'
    });
    
    toast.success(`Exported ${filteredLogs.length} activity records`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (user && !isAdmin && !hasEntityAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ShieldIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Access Restricted</h2>
          <p className="text-slate-500">The Activity Log is only available to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <ActivityIcon className="w-8 h-8 text-indigo-600" />
            Activity Log
          </h1>
          <p className="text-slate-600 mt-1">
            Track all user actions and system events
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Events</p>
                <p className="text-2xl font-bold text-slate-900">{scopedLogs.length}</p>
              </div>
              <ActivityIcon className="w-8 h-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Filtered Results</p>
                <p className="text-2xl font-bold text-slate-900">{filteredLogs.length}</p>
              </div>
              <Filter className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Users</p>
                <p className="text-2xl font-bold text-slate-900">{uniqueUsers.length}</p>
              </div>
              <User className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Today</p>
                <p className="text-2xl font-bold text-slate-900">
                  {scopedLogs.filter(log => moment(log.timestamp).isSame(moment(), 'day')).length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search actions, users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="entity_created">Entity Created</SelectItem>
                  <SelectItem value="entity_updated">Entity Updated</SelectItem>
                  <SelectItem value="entity_deleted">Entity Deleted</SelectItem>
                  <SelectItem value="entity_classified">Entity Classified</SelectItem>
                  <SelectItem value="account_created">Account Created</SelectItem>
                  <SelectItem value="account_updated">Account Updated</SelectItem>
                  <SelectItem value="account_deleted">Account Deleted</SelectItem>
                  <SelectItem value="account_classified">Account Classified</SelectItem>
                  <SelectItem value="report_generated">Report Generated</SelectItem>
                  <SelectItem value="report_submitted">Report Submitted</SelectItem>
                  <SelectItem value="user_invited">User Invited</SelectItem>
                  <SelectItem value="user_role_changed">User Role Changed</SelectItem>
                  <SelectItem value="user_removed">User Removed</SelectItem>
                  <SelectItem value="permission_changed">Permission Changed</SelectItem>
                  <SelectItem value="workflow_published">Workflow Published</SelectItem>
                  <SelectItem value="workflow_archived">Workflow Archived</SelectItem>
                  <SelectItem value="dashboard_created">Dashboard Created</SelectItem>
                  <SelectItem value="dashboard_updated">Dashboard Updated</SelectItem>
                  <SelectItem value="dashboard_deleted">Dashboard Deleted</SelectItem>
                  <SelectItem value="dashboard_published">Dashboard Published</SelectItem>
                  <SelectItem value="widget_added">Widget Added</SelectItem>
                  <SelectItem value="widget_updated">Widget Updated</SelectItem>
                  <SelectItem value="widget_removed">Widget Removed</SelectItem>
                  <SelectItem value="data_exported">Data Exported</SelectItem>
                  <SelectItem value="data_imported">Data Imported</SelectItem>
                  <SelectItem value="bulk_import_initiated">Bulk Import Initiated</SelectItem>
                  <SelectItem value="bulk_import_completed">Bulk Import Completed</SelectItem>
                  <SelectItem value="bulk_import_failed">Bulk Import Failed</SelectItem>
                  <SelectItem value="settings_changed">Settings Changed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Action Category</Label>
              <Select value={actionCategory} onValueChange={setActionCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>User</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {uniqueUsers.map(email => (
                    <SelectItem key={email} value={email}>{email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Range */}
          {dateFilter === "custom" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Clear Filters */}
          {(searchTerm || actionTypeFilter !== "all" || dateFilter !== "all" || userFilter !== "all" || actionCategory !== "all") && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setActionTypeFilter("all");
                  setDateFilter("all");
                  setUserFilter("all");
                  setActionCategory("all");
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg">Activity Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Record Created</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action_type)}
                          <div>
                            <p className="font-medium text-sm">
                              {moment(log.timestamp || log.created_date).format('MMM D, YYYY')}
                            </p>
                            <p className="text-xs text-slate-500">
                              {moment(log.timestamp || log.created_date).format('HH:mm:ss')}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getActionBadge(log.action_type)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{log.actor_email}</p>
                          <p className="text-xs text-slate-500 capitalize">
                            {log.actor_role?.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.target_entity_type && (
                          <div>
                            <Badge variant="outline">
                              {log.target_entity_type}
                            </Badge>
                            {log.target_entity_name && (
                              <p className="text-xs text-slate-700 mt-1 truncate max-w-[150px]" title={log.target_entity_name}>
                                {log.target_entity_name}
                              </p>
                            )}
                            {!log.target_entity_name && log.target_entity_id && (
                              <p className="text-xs text-slate-400 mt-1 font-mono truncate max-w-[100px]" title={log.target_entity_id}>
                                {log.target_entity_id.slice(-8)}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div>
                          <p className="text-sm text-slate-700">
                            {moment(log.created_date).format('MMM D, YYYY')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {moment(log.created_date).format('HH:mm:ss')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-sm">
                        {log.changes && (
                          <details className="cursor-pointer">
                            <summary className="text-sm text-indigo-600 hover:text-indigo-800">
                              View Changes
                            </summary>
                            <div className="mt-2 bg-slate-50 p-3 rounded border text-sm space-y-2 max-h-64 overflow-auto">
                              {renderChanges(log.changes)}
                            </div>
                          </details>
                        )}
                        {log.file_url && (
                          <div className="mt-2">
                            <a
                              href={log.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              View Original File
                            </a>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}