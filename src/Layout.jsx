import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  Building2,
  Wallet,
  FileText,
  Settings,
  Users,
  GitBranch,
  Bell,
  LogOut,
  ChevronDown,
  Shield,
  Menu,
  Wrench
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.tenant_id) {
        const tenantData = await base44.entities.Tenant.list();
        const userTenant = tenantData.find(t => t.id === currentUser.tenant_id);
        setTenant(userTenant);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
    } catch (error) {
      console.error("Logout error:", error);
      window.location.reload();
    }
  };

  const isSuperAdmin = user?.user_role === "super_admin";
  const isTenantAdmin = user?.user_role === "tenant_admin";

  const tenantNav = [
    {
      title: "Dashboard",
      url: createPageUrl("Dashboard"),
      icon: LayoutDashboard,
      roles: ["tenant_admin", "tenant_user"]
    },
    {
      title: "Entities",
      url: createPageUrl("Entities"),
      icon: Building2,
      roles: ["tenant_admin", "tenant_user"]
    },
    {
      title: "Accounts",
      url: createPageUrl("Accounts"),
      icon: Wallet,
      roles: ["tenant_admin", "tenant_user"]
    },
    {
      title: "CRS Reports",
      url: createPageUrl("Reports"),
      icon: FileText,
      roles: ["tenant_admin", "tenant_user"]
    }
  ];

  const adminNav = [
    {
      title: "User Management",
      url: createPageUrl("UserManagement"),
      icon: Users,
      roles: ["tenant_admin"]
    },
    {
      title: "Settings",
      url: createPageUrl("Settings"),
      icon: Settings,
      roles: ["tenant_admin"]
    }
  ];

  const superAdminNav = [
    {
      title: "Super Admin",
      url: createPageUrl("SuperAdmin"),
      icon: Shield,
      roles: ["super_admin"]
    },
    {
      title: "Tenant Management",
      url: createPageUrl("TenantManagement"),
      icon: Building2,
      roles: ["super_admin"]
    },
    {
      title: "Workflows",
      url: createPageUrl("WorkflowBuilder"),
      icon: GitBranch,
      roles: ["super_admin"]
    }
  ];

  const navigation = isSuperAdmin 
    ? superAdminNav 
    : [...tenantNav, ...(isTenantAdmin ? adminNav : [])];

  const primaryColor = tenant?.branding?.primary_color || "#464feb";
  const fontFamily = tenant?.branding?.font_family || "Inter, system-ui, sans-serif";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --tenant-primary: ${primaryColor};
          --tenant-font: ${fontFamily};
        }
        body {
          font-family: var(--tenant-font);
        }
      `}</style>

      <div className="min-h-screen flex w-full bg-slate-50">
        <Sidebar className="border-r border-slate-200 bg-white">
          <SidebarHeader className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              {tenant?.branding?.logo_url ? (
                <img 
                  src={tenant.branding.logo_url} 
                  alt={tenant.name}
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}
                >
                  {isSuperAdmin ? "SA" : (tenant?.short_name?.[0] || "C")}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-slate-900 text-sm truncate">
                  {isSuperAdmin ? "CRS Platform Admin" : (tenant?.short_name || "CRS Platform")}
                </h2>
                <p className="text-xs text-slate-500 truncate">
                  {isSuperAdmin ? "System Management" : "Compliance Management"}
                </p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">
                {isSuperAdmin ? "Administration" : "Main Menu"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navigation.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`rounded-lg transition-all duration-200 ${
                          location.pathname === item.url 
                            ? 'text-white shadow-md' 
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                        style={location.pathname === item.url ? {
                          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`
                        } : {}}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {!isSuperAdmin && tenant && (
              <SidebarGroup className="mt-6">
                <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">
                  Quick Info
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="px-3 py-2 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Jurisdiction</span>
                      <Badge variant="outline" className="text-xs">
                        {tenant.jurisdiction}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Plan</span>
                      <Badge 
                        className="text-xs capitalize"
                        style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                      >
                        {tenant.subscription_tier}
                      </Badge>
                    </div>
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Setup Link for Testing */}
            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      className={`rounded-lg transition-all duration-200 ${
                        location.pathname === createPageUrl("Setup")
                          ? 'text-white shadow-md' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                      style={location.pathname === createPageUrl("Setup") ? {
                        background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`
                      } : {}}
                    >
                      <Link to={createPageUrl("Setup")} className="flex items-center gap-3 px-3 py-2.5">
                        <Wrench className="w-4 h-4" />
                        <span className="font-medium text-sm">Setup / Switch Role</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-100 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full hover:bg-slate-50 rounded-lg p-2 transition-colors">
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}
                  >
                    {user?.full_name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {user?.full_name || "User"}
                    </p>
                    <p className="text-xs text-slate-500 truncate capitalize">
                      {user?.user_role?.replace("_", " ") || "User"}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl("Setup")}>
                    <Wrench className="w-4 h-4 mr-2" />
                    Switch Role (Testing)
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between lg:hidden">
            <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors">
              <Menu className="w-5 h-5" />
            </SidebarTrigger>
            <h1 className="text-lg font-semibold text-slate-900">
              {tenant?.short_name || "CRS Platform"}
            </h1>
            <div className="w-10"></div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}