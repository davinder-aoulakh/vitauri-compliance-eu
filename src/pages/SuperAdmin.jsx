import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Shield,
  Building2,
  Users,
  GitBranch,
  Activity,
  ArrowRight,
  TrendingUp,
  Database,
  FileSpreadsheet
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BackupManager from "@/components/superadmin/BackupManager";
import FITypeTemplateManager from "@/components/superadmin/FITypeTemplateManager";

export default function SuperAdminDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.app_role !== "super_admin") {
        window.location.href = createPageUrl("Dashboard");
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const { data: tenants = [] } = useQuery({
    queryKey: ['all-tenants'],
    queryFn: () => base44.entities.Tenant.list(),
    enabled: !!user
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['all-workflows'],
    queryFn: () => base44.entities.Workflow.list(),
    enabled: !!user
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['recent-audit-logs'],
    queryFn: async () => {
      const logs = await base44.entities.AuditLog.list();
      return logs.slice(0, 10);
    },
    enabled: !!user
  });

  const activeTenants = tenants.filter(t => t.subscription_status === "active");
  const publishedWorkflows = workflows.filter(w => w.status === "published");

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  Super Admin Console
                </h1>
                <p className="text-indigo-200">
                  System-wide management and configuration
                </p>
              </div>
            </div>
          </div>
          <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-sm px-4 py-2">
            <Shield className="w-4 h-4 mr-2" />
            Administrator Access
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Active Tenants"
            value={activeTenants.length}
            total={tenants.length}
            icon={Building2}
            color="#10b981"
            link={createPageUrl("TenantManagement")}
          />
          <StatCard
            title="Total Users"
            value={allUsers.length}
            subtitle={`${allUsers.filter(u => u.app_role === "tenant_admin").length} admins`}
            icon={Users}
            color="#3b82f6"
          />
          <StatCard
            title="Workflows"
            value={publishedWorkflows.length}
            subtitle={`${workflows.filter(w => w.status === "draft").length} drafts`}
            icon={GitBranch}
            color="#8b5cf6"
            link={createPageUrl("WorkflowBuilder")}
          />
          <StatCard
            title="System Status"
            value="Healthy"
            subtitle="All services operational"
            icon={Activity}
            color="#22c55e"
          />
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ActionCard
            icon={Building2}
            title="Tenant Management"
            description="Onboard new financial institutions, manage subscriptions, and oversee tenant data"
            actions={[
              { label: "Add New Tenant", link: createPageUrl("TenantManagement"), primary: true },
              { label: "View All Tenants", link: createPageUrl("TenantManagement") }
            ]}
            stats={[
              { label: "Active", value: activeTenants.length },
              { label: "Trial", value: tenants.filter(t => t.subscription_status === "trial").length },
              { label: "Suspended", value: tenants.filter(t => t.subscription_status === "suspended").length }
            ]}
          />

          <ActionCard
            icon={GitBranch}
            title="Workflow Configuration"
            description="Create and publish compliance questionnaires for entity and account classification"
            actions={[
              { label: "Create Workflow", link: createPageUrl("WorkflowBuilder"), primary: true },
              { label: "Manage Workflows", link: createPageUrl("WorkflowBuilder") }
            ]}
            stats={[
              { label: "Published", value: publishedWorkflows.length },
              { label: "Draft", value: workflows.filter(w => w.status === "draft").length },
              { label: "Archived", value: workflows.filter(w => w.status === "archived").length }
            ]}
          />
        </div>

        {/* Tabs: Overview + Backup */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/10 backdrop-blur-sm">
            <TabsTrigger value="overview" className="text-white data-[state=active]:bg-white/20">
              <Activity className="w-4 h-4 mr-2" /> Overview
            </TabsTrigger>
            <TabsTrigger value="backup" className="text-white data-[state=active]:bg-white/20">
              <Database className="w-4 h-4 mr-2" /> Backup & Restore
            </TabsTrigger>
            <TabsTrigger value="fi-templates" className="text-white data-[state=active]:bg-white/20">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> FI Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="backup">
            <BackupManager />
          </TabsContent>

          <TabsContent value="fi-templates">
            <FITypeTemplateManager />
          </TabsContent>

          <TabsContent value="overview" className="space-y-6">

        {/* Recent Activity */}
        <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-sm border border-white/20">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="flex items-center gap-2 text-white">
              <Database className="w-5 h-5" />
              Recent System Activity
            </CardTitle>
            <CardDescription className="text-indigo-200">
              Latest actions across all tenants
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {auditLogs.length > 0 ? (
              <div className="space-y-3">
                {auditLogs.map((log, idx) => (
                  <div 
                    key={log.id || idx} 
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-indigo-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {log.action_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-indigo-200">
                          by {log.actor_email} • {log.actor_role?.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-indigo-300">
                      {log.created_date ? new Date(log.created_date).toLocaleString() : "Just now"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-indigo-200">
                No recent activity to display
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <CardContent className="p-6 text-center">
              <Building2 className="w-8 h-8 mx-auto mb-3 text-indigo-300" />
              <h3 className="text-2xl font-bold text-white mb-1">{tenants.length}</h3>
              <p className="text-sm text-indigo-200">Total Tenants</p>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 mx-auto mb-3 text-indigo-300" />
              <h3 className="text-2xl font-bold text-white mb-1">{allUsers.length}</h3>
              <p className="text-sm text-indigo-200">Platform Users</p>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <CardContent className="p-6 text-center">
              <GitBranch className="w-8 h-8 mx-auto mb-3 text-indigo-300" />
              <h3 className="text-2xl font-bold text-white mb-1">{workflows.length}</h3>
              <p className="text-sm text-indigo-200">Workflows Configured</p>
            </CardContent>
          </Card>
        </div>

          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ title, value, total, subtitle, icon: Icon, color, link }) {
  const content = (
    <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-all">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" 
               style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
          {total && (
            <Badge variant="outline" className="bg-white/10 text-white border-white/20">
              {value}/{total}
            </Badge>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-indigo-200 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
          {subtitle && <p className="text-xs text-indigo-300">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );

  return link ? <Link to={link}>{content}</Link> : content;
}

function ActionCard({ icon: Icon, title, description, actions, stats }) {
  return (
    <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
      <CardHeader className="border-b border-white/10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-white mb-2">{title}</CardTitle>
            <CardDescription className="text-indigo-200">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-indigo-200 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex flex-col gap-3">
          {actions.map((action, idx) => (
            <Link key={idx} to={action.link}>
              <Button 
                className={`w-full ${action.primary 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white' 
                  : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'}`}
              >
                {action.label}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}