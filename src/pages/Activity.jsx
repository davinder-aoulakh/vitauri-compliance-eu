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
  Download
} from "lucide-react";
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
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const logs = await base44.entities.AuditLog.list('-timestamp', 500);
      return logs;
    }
  });

  const handleRefresh = () => {
    refetch();
  };

  // Get unique users for filter
  const uniqueUsers = [...new Set(auditLogs.map(log => log.actor_email))].filter(Boolean);

  // Filter logs
  const filteredLogs = auditLogs.filter(log => {
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
      workflow_published: <GitBranch className="w-4 h-4" />,
      settings_changed: <Settings className="w-4 h-4" />
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
      workflow_published: "bg-purple-100 text-purple-800",
      settings_changed: "bg-slate-100 text-slate-800"
    };

    const formattedAction = actionType?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    return (
      <Badge className={colorMap[actionType] || "bg-slate-100 text-slate-800"}>
        {formattedAction}
      </Badge>
    );
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Timestamp', 'Action', 'User', 'Role', 'Entity Type', 'Entity ID'],
      ...filteredLogs.map(log => [
        moment(log.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        log.action_type,
        log.actor_email,
        log.actor_role,
        log.target_entity_type || '',
        log.target_entity_id || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${moment().format('YYYY-MM-DD')}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
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
                <p className="text-2xl font-bold text-slate-900">{auditLogs.length}</p>
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
                  {auditLogs.filter(log => moment(log.timestamp).isSame(moment(), 'day')).length}
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
                  <SelectItem value="workflow_published">Workflow Published</SelectItem>
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
                            {log.target_entity_id && (
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
                      <TableCell className="max-w-xs">
                        {log.changes && (
                          <details className="cursor-pointer">
                            <summary className="text-sm text-indigo-600 hover:text-indigo-800">
                              View Changes
                            </summary>
                            <pre className="text-xs bg-slate-50 p-2 rounded mt-2 overflow-auto max-h-32">
                              {JSON.stringify(log.changes, null, 2)}
                            </pre>
                          </details>
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