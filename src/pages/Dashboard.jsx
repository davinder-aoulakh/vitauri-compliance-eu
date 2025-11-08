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
  Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);

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

  const { data: entities = [] } = useQuery({
    queryKey: ['entities', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.Entity.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.Account.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['reports', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.CRSReport.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const rfiEntities = entities.filter(e => e.rfi_status === "reporting_fi");
  const reportableAccounts = accounts.filter(a => a.reportability_status === "reportable");
  const pendingAccounts = accounts.filter(a => a.reportability_status === "pending_review");
  const currentYear = new Date().getFullYear();
  const currentYearReports = reports.filter(r => r.reporting_year === currentYear.toString());

  const completionPercentage = entities.length > 0 
    ? Math.round((rfiEntities.length / entities.length) * 100)
    : 0;

  const primaryColor = tenant?.branding?.primary_color || "#464feb";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Welcome back, {user?.full_name?.split(' ')[0] || "User"}
            </h1>
            <p className="text-slate-600">
              Here's your CRS compliance overview for {tenant?.name || "your organization"}
            </p>
          </div>
          <div className="flex gap-3">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Entities"
            value={entities.length}
            subtitle={`${rfiEntities.length} Reporting FIs`}
            icon={Building2}
            color="#3b82f6"
            trend="+2 this month"
          />
          <MetricCard
            title="Reportable Accounts"
            value={reportableAccounts.length}
            subtitle={`${accounts.length} total accounts`}
            icon={Wallet}
            color="#10b981"
            trend={`${pendingAccounts.length} pending review`}
          />
          <MetricCard
            title="CRS Reports"
            value={currentYearReports.length}
            subtitle={`Year ${currentYear}`}
            icon={FileCheck}
            color="#8b5cf6"
          />
          <MetricCard
            title="Compliance Status"
            value={`${completionPercentage}%`}
            subtitle="Entity classification"
            icon={CheckCircle2}
            color="#f59e0b"
            showProgress
            progress={completionPercentage}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2 border-0 shadow-xl">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" style={{ color: primaryColor }} />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates and pending actions</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {pendingAccounts.length > 0 ? (
                <div className="space-y-4">
                  <ActivityItem
                    icon={AlertTriangle}
                    iconColor="#f59e0b"
                    title="Accounts Pending Classification"
                    description={`${pendingAccounts.length} accounts need reportability review`}
                    action="Review Now"
                    link={createPageUrl("Accounts")}
                  />
                  {entities.filter(e => e.rfi_status === "pending_classification").length > 0 && (
                    <ActivityItem
                      icon={Building2}
                      iconColor="#3b82f6"
                      title="Entity Classification Pending"
                      description={`${entities.filter(e => e.rfi_status === "pending_classification").length} entities await RFI determination`}
                      action="Classify"
                      link={createPageUrl("Entities")}
                    />
                  )}
                  {currentYearReports.length === 0 && rfiEntities.length > 0 && (
                    <ActivityItem
                      icon={Calendar}
                      iconColor="#8b5cf6"
                      title={`${currentYear} CRS Report Due`}
                      description="Annual reporting deadline approaching"
                      action="Start Report"
                      link={createPageUrl("Reports")}
                    />
                  )}
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

          {/* Quick Stats */}
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
                  <span className="text-sm font-medium text-slate-700">Home Jurisdiction</span>
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

        {/* Entities Overview */}
        {entities.length > 0 && (
          <Card className="border-0 shadow-xl">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle>Entity Classification Status</CardTitle>
              <CardDescription>Overview of your legal entities and their CRS status</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatusCard
                  label="Reporting FIs"
                  count={rfiEntities.length}
                  color="#10b981"
                  description="Active reporting entities"
                />
                <StatusCard
                  label="Non-Reporting FIs"
                  count={entities.filter(e => e.rfi_status === "non_reporting_fi").length}
                  color="#6b7280"
                  description="Exempt from reporting"
                />
                <StatusCard
                  label="Pending Classification"
                  count={entities.filter(e => e.rfi_status === "pending_classification").length}
                  color="#f59e0b"
                  description="Awaiting determination"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, color, trend, showProgress, progress }) {
  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
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
    <div className="p-4 rounded-lg border border-slate-200 bg-white hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
      </div>
      <p className="text-3xl font-bold text-slate-900 mb-1">{count}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}