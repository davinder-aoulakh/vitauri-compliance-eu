import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Building2,
  Wallet,
  FileCheck,
  AlertTriangle,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Globe,
  Wrench,
  LayoutDashboard,
  Settings,
  PlayCircle,
  X,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WidgetPreview from "@/components/dashboard/WidgetPreview";
import GuidedTour from "@/components/tours/GuidedTour";
import { getTourByPage } from "@/components/tours/tourDefinitions";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [showTour, setShowTour] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState(null);

  const tourConfig = showTour === "app-overview" 
    ? getTourByPage("AppOverview") 
    : getTourByPage("Dashboard");

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.tenant_id) {
        const tenants = await base44.entities.Tenant.list();
        const userTenant = tenants.find(t => t.id === currentUser.tenant_id);
        setTenant(userTenant);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const isAdmin = user?.app_role === 'tenant_admin' || user?.app_role === 'super_admin';

  const { data: userEntityAccess = [] } = useQuery({
    queryKey: ['user-entity-access', user?.id],
    queryFn: () => base44.entities.UserEntityAccess.filter({ user_id: user.id, tenant_id: user.tenant_id }),
    enabled: !!user?.id && !isAdmin
  });

  const accessibleEntityIds = isAdmin ? null : new Set(userEntityAccess.map(r => r.rfi_entity_id));

  const { data: allEntities = [] } = useQuery({
    queryKey: ['entities', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.Entity.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const entities = isAdmin ? allEntities : allEntities.filter(e => accessibleEntityIds?.has(e.id));

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['accounts', user?.tenant_id, selectedEntityId],
    queryFn: () => {
      if (!user?.tenant_id) return [];
      const filter = { tenant_id: user.tenant_id };
      if (selectedEntityId) filter.entity_id = selectedEntityId;
      return base44.entities.Account.filter(filter);
    },
    enabled: !!user?.tenant_id
  });

  const accounts = isAdmin ? allAccounts : allAccounts.filter(a => accessibleEntityIds?.has(a.entity_id));

  const { data: reports = [] } = useQuery({
    queryKey: ['reports', user?.tenant_id, selectedEntityId],
    queryFn: () => {
      if (!user?.tenant_id) return [];
      const filter = { tenant_id: user.tenant_id };
      if (selectedEntityId) filter.entity_id = selectedEntityId;
      return base44.entities.CRSReport.filter(filter);
    },
    enabled: !!user?.tenant_id
  });

  // Fetch custom dashboard configuration
  const { data: dashboardConfigs = [] } = useQuery({
    queryKey: ['dashboard-config', user?.tenant_id],
    queryFn: () => base44.entities.DashboardConfiguration.filter({ 
      tenant_id: user.tenant_id,
      is_published: true,
      is_default: true
    }),
    enabled: !!user?.tenant_id
  });

  const customDashboard = dashboardConfigs[0];

  const rfiEntities = entities.filter(e => e.rfi_status === "reporting_fi");
  const reportableAccounts = accounts.filter(a => a.reportability_status === "reportable");
  const pendingAccounts = accounts.filter(a => a.reportability_status === "pending_review");
  const currentYear = new Date().getFullYear();
  const currentYearReports = reports.filter(r => r.reporting_year === currentYear.toString());

  const completionPercentage = entities.length > 0 
    ? Math.round((rfiEntities.length / entities.length) * 100)
    : 0;

  const primaryColor = tenant?.branding?.primary_color || "#464feb";

  const handleStartTour = () => {
    // Reset tour completion for this page
    const completedTours = JSON.parse(localStorage.getItem("completedTours") || "[]");
    const filtered = completedTours.filter(t => t !== tourConfig.key);
    localStorage.setItem("completedTours", JSON.stringify(filtered));
    setShowTour(true);
  };

  // Show setup prompt if no tenant assigned
  if (!user?.tenant_id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-2xl border-2 border-indigo-200 shadow-2xl">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Wrench className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Welcome to CRS Platform!</CardTitle>
            <CardDescription className="text-base mt-2">
              You need to set up your role before accessing the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-900">
                <strong>Getting Started:</strong> Click the button below to choose your role. 
                You can be a Super Admin (manage all tenants) or an ACME tenant user.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2">🛡️ Super Admin</h4>
                <p className="text-sm text-slate-600">
                  Manage all tenants, configure workflows, and access system-wide settings
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2">👔 ACME Tenant Admin</h4>
                <p className="text-sm text-slate-600">
                  Full access to ACME Financial data, entities, accounts, and reports
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2">👤 ACME Tenant User</h4>
                <p className="text-sm text-slate-600">
                  Limited access to ACME - can classify accounts but not manage settings
                </p>
              </div>
            </div>

            <Link to={createPageUrl("Setup")} className="block">
              <Button 
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-lg py-6"
              >
                <Wrench className="w-5 h-5 mr-2" />
                Go to Setup Page
              </Button>
            </Link>

            <div className="text-center text-sm text-slate-500 pt-4 border-t">
              You can also find the "Setup / Switch Role" link in the sidebar menu
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If custom dashboard is published, render it
  if (customDashboard && customDashboard.layout?.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                Welcome back, {(user?.display_name || user?.full_name)?.split(' ')[0] || "User"}
              </h1>
              <p className="text-slate-600">
                {customDashboard.description || `Here's your CRS compliance overview for ${tenant?.name || "your organization"}`}
              </p>
            </div>
            
            {/* Entity Filter */}
            <div className="flex items-center gap-3">
              <div className="w-64">
                <Select value={selectedEntityId || "all"} onValueChange={(value) => setSelectedEntityId(value === "all" ? null : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All RFI Entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        All RFI Entities
                      </div>
                    </SelectItem>
                    {entities.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.entity_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedEntityId && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSelectedEntityId(null)}
                  className="h-9 w-9"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleStartTour} className="gap-2">
                <PlayCircle className="w-4 h-4" />
                Page Tour
              </Button>
              <Button variant="outline" onClick={() => {
                const completedTours = JSON.parse(localStorage.getItem("completedTours") || "[]");
                const filtered = completedTours.filter(t => t !== "app-overview-tour");
                localStorage.setItem("completedTours", JSON.stringify(filtered));
                setShowTour("app-overview");
              }} className="gap-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50">
                <Sparkles className="w-4 h-4" />
                App Overview
              </Button>
              {(user?.user_role === 'tenant_admin' || user?.user_role === 'super_admin') && (
                <Link to={createPageUrl("DashboardBuilder")}>
                  <Button variant="outline" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Customize
                  </Button>
                </Link>
              )}
              <Link to={createPageUrl("Reports")}>
                <Button 
                  className="gap-2 text-white shadow-lg hover:shadow-xl transition-all"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}
                >
                  <FileCheck className="w-4 h-4" />
                  Generate Report
                </Button>
              </Link>
            </div>
          </div>

          {/* Custom Dashboard Widgets */}
          <div className="grid grid-cols-12 gap-4">
            {customDashboard.layout.map((widget) => (
              <div
                key={widget.widget_id}
                className="h-full"
                style={{ 
                  gridColumn: `span ${widget.position?.w || 6}`
                }}
              >
                <WidgetPreview widget={widget} tenantId={user.tenant_id} selectedEntityId={selectedEntityId} />
              </div>
            ))}
          </div>

          {showTour && tourConfig && (
            <GuidedTour
              steps={tourConfig.steps}
              tourKey={tourConfig.key}
              onComplete={() => setShowTour(false)}
              onSkip={() => setShowTour(false)}
            />
          )}
        </div>
      </div>
    );
  }

  // Default dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Welcome back, {(user?.display_name || user?.full_name)?.split(' ')[0] || "User"}
            </h1>
            <p className="text-slate-600">
              Here's your CRS compliance overview for {tenant?.name || "your organization"}
            </p>
          </div>

          {/* Entity Filter */}
          <div className="flex items-center gap-3">
            <div className="w-64">
              <Select value={selectedEntityId || "all"} onValueChange={(value) => setSelectedEntityId(value === "all" ? null : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All RFI Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      All RFI Entities
                    </div>
                  </SelectItem>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.entity_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedEntityId && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSelectedEntityId(null)}
                className="h-9 w-9"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleStartTour} className="gap-2">
              <PlayCircle className="w-4 h-4" />
              Page Tour
            </Button>
            <Button variant="outline" onClick={() => {
              const completedTours = JSON.parse(localStorage.getItem("completedTours") || "[]");
              const filtered = completedTours.filter(t => t !== "app-overview-tour");
              localStorage.setItem("completedTours", JSON.stringify(filtered));
              setShowTour("app-overview");
            }} className="gap-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50">
              <Sparkles className="w-4 h-4" />
              App Overview
            </Button>
            {(user?.user_role === 'tenant_admin' || user?.user_role === 'super_admin') && (
              <Link to={createPageUrl("DashboardBuilder")}>
                <Button variant="outline" className="gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Customize Dashboard
                </Button>
              </Link>
            )}
            <Link to={createPageUrl("Entities")}>
              <Button variant="outline" className="gap-2">
                <Building2 className="w-4 h-4" />
                Add Entity
              </Button>
            </Link>
            <Link to={createPageUrl("Reports")}>
              <Button 
                className="gap-2 text-white shadow-lg hover:shadow-xl transition-all"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}
              >
                <FileCheck className="w-4 h-4" />
                Generate Report
              </Button>
            </Link>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link to={createPageUrl("Entities")} className="no-underline">
            <MetricCard
              title="Total Entities"
              value={entities.length}
              subtitle={`${rfiEntities.length} Reporting FIs`}
              icon={Building2}
              color="#3b82f6"
              trend="+2 this month"
            />
          </Link>
          <Link to={createPageUrl("Accounts") + "?status=reportable"} className="no-underline">
            <MetricCard
              title="Reportable Accounts"
              value={reportableAccounts.length}
              subtitle={`${accounts.length} total accounts`}
              icon={Wallet}
              color="#10b981"
              trend={`${pendingAccounts.length} pending review`}
            />
          </Link>
          <Link to={createPageUrl("Reports") + `?year=${currentYear}`} className="no-underline">
            <MetricCard
              title="CRS Reports"
              value={currentYearReports.length}
              subtitle={`Year ${currentYear}`}
              icon={FileCheck}
              color="#8b5cf6"
            />
          </Link>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="flex flex-col gap-4">
            {currentYearReports.length === 0 && rfiEntities.length > 0 && (
              <Card className="border-0 shadow-xl">
                <CardContent className="p-0">
                  <ActivityItem
                    icon={Calendar}
                    iconColor="#8b5cf6"
                    title={`${currentYear} CRS Report Due`}
                    description="Annual reporting deadline approaching"
                    action="Start Report"
                    link={createPageUrl("Reports")}
                  />
                </CardContent>
              </Card>
            )}

            {/* Jurisdiction Overview Card */}
            <Card className="border-0 shadow-xl">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" style={{ color: primaryColor }} />
                  Jurisdiction Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">RFI Jurisdiction</span>
                    <Badge variant="outline">{tenant?.jurisdiction || "N/A"}</Badge>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Reporting Entities</span>
                    <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                      {rfiEntities.length}
                    </span>
                  </div>
                  <Progress value={(rfiEntities.length / (entities.length || 1)) * 100} className="h-2" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Next Deadline</span>
                    <span className="text-sm font-semibold text-slate-900">
                      May 31, {currentYear + 1}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">CRS Annual Report</p>
                </div>

                <Link to={createPageUrl("Entities")} className="block">
                  <Button variant="outline" className="w-full mt-4">
                    View All Entities
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Recent Activity */}
          <Card className="border-0 shadow-xl h-fit">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" style={{ color: primaryColor }} />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates and pending actions</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {entities.filter(e => e.rfi_status === "pending_classification").length > 0 ? (
                <div className="space-y-4">
                  <ActivityItem
                    icon={Building2}
                    iconColor="#3b82f6"
                    title="Entity Classification Pending"
                    description={`${entities.filter(e => e.rfi_status === "pending_classification").length} entities await RFI determination`}
                    action="Classify"
                    link={createPageUrl("Entities")}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">All Caught Up!</h3>
                  <p className="text-slate-600">No pending compliance tasks at the moment</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Entities Overview */}
        {entities.length > 0 && (
          <Card className="border-0 shadow-xl">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle>Entity Classification Status</CardTitle>
              <CardDescription>Overview of your legal entities and their CRS status</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link to={createPageUrl("Entities") + "?status=reporting_fi"} className="no-underline">
                  <StatusCard
                    label="Reporting FIs"
                    count={rfiEntities.length}
                    color="#10b981"
                    description="Active reporting entities"
                  />
                </Link>
                <Link to={createPageUrl("Entities") + "?status=non_reporting_fi"} className="no-underline">
                  <StatusCard
                    label="Non-Reporting FIs"
                    count={entities.filter(e => e.rfi_status === "non_reporting_fi").length}
                    color="#6b7280"
                    description="Exempt from reporting"
                  />
                </Link>
                <Link to={createPageUrl("Entities") + "?status=pending_classification"} className="no-underline">
                  <StatusCard
                    label="Pending Classification"
                    count={entities.filter(e => e.rfi_status === "pending_classification").length}
                    color="#f59e0b"
                    description="Awaiting determination"
                  />
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {showTour && tourConfig && (
          <GuidedTour
            steps={tourConfig.steps}
            tourKey={tourConfig.key}
            onComplete={() => setShowTour(false)}
            onSkip={() => setShowTour(false)}
          />
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, color, trend, showProgress, progress }) {
  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" 
               style={{ backgroundColor: `${color}15` }}>
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
          {trend && (
            <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
              <TrendingUp className="w-3 h-3 mr-1" />
              {trend}
            </Badge>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 mb-1">{value}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
          {showProgress && (
            <Progress value={progress} className="h-2 mt-3" style={{ backgroundColor: `${color}20` }} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ icon: Icon, iconColor, title, description, action, link }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" 
           style={{ backgroundColor: `${iconColor}15` }}>
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-slate-900 text-sm mb-1">{title}</h4>
        <p className="text-xs text-slate-600">{description}</p>
      </div>
      <Link to={link}>
        <Button size="sm" variant="ghost" className="flex-shrink-0">
          {action}
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </Link>
    </div>
  );
}

function StatusCard({ label, count, color, description }) {
  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-white hover:shadow-md transition-all cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
      </div>
      <p className="text-3xl font-bold text-slate-900 mb-1">{count}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}