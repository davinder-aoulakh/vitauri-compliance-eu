import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import useInactivityLogout from "@/components/utils/useInactivityLogout";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Wrench,
  Database,
  Eye,
  Palette,
  Globe
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
import AIHelpAssistant from "@/components/help/AIHelpAssistant";

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);

  // Handle inactivity warning
  const handleInactivityWarning = useCallback((warningTime) => {
    setShowInactivityWarning(true);
    setSecondsRemaining(Math.floor(warningTime / 1000));
  }, []);

  // Inactivity logout hook - 30 minutes timeout, 2 minute warning
  const { resetTimer } = useInactivityLogout({
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 2 * 60 * 1000, // 2 minutes warning
    onWarning: handleInactivityWarning,
    enabled: !!user
  });

  // Countdown timer for warning dialog
  useEffect(() => {
    if (!showInactivityWarning) return;

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showInactivityWarning]);

  // Handle staying active
  const handleStayActive = () => {
    setShowInactivityWarning(false);
    setSecondsRemaining(120);
    resetTimer();
  };

  useEffect(() => {
    loadUserData();
    applyAccessibilitySettings();
  }, []);

  const applyAccessibilitySettings = () => {
    // Apply saved accessibility preferences on load
    const prefs = user?.accessibility_preferences || {};
    const root = document.documentElement;
    
    if (prefs.fontSize) {
      const fontSizeMap = {
        small: "14px",
        medium: "16px",
        large: "18px",
        xlarge: "20px"
      };
      root.style.setProperty("--base-font-size", fontSizeMap[prefs.fontSize]);
    }
    
    if (prefs.highContrast) {
      root.classList.add("high-contrast");
    }
    
    if (prefs.reducedMotion) {
      root.classList.add("reduced-motion");
    }
    
    if (prefs.keyboardNavigation !== false) {
      root.classList.add("enhanced-focus");
    }
  };

  const loadUserData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.tenant_id) {
        const tenantData = await base44.entities.Tenant.list();
        const userTenant = tenantData.find(t => t.id === currentUser.tenant_id);
        setTenant(userTenant);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error loading user data:", error);
      // Keep loading spinner and redirect to Base44 login
      window.location.href = `https://app.base44.com/login?next=${encodeURIComponent(window.location.href)}`;
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
      title: "RFI Entities",
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
    },
    {
      title: "AI Assistant",
      url: createPageUrl("ComplianceAssistant"),
      icon: Shield,
      roles: ["tenant_admin", "tenant_user"]
    },
    {
      title: "Activity Log",
      url: createPageUrl("Activity"),
      icon: Eye,
      roles: ["tenant_admin"]
    }
  ];

  const administrationNav = [
    {
      title: "Dashboard Builder",
      url: createPageUrl("DashboardBuilder"),
      icon: LayoutDashboard,
      roles: ["tenant_admin"]
    },
    {
      title: "User Management",
      url: createPageUrl("UserManagement"),
      icon: Users,
      roles: ["tenant_admin"]
    },
    {
      title: "Validation Rules",
      url: createPageUrl("CustomValidationRules"),
      icon: Shield,
      roles: ["tenant_admin"]
    },
    {
      title: "Settings",
      url: createPageUrl("Settings"),
      icon: Settings,
      roles: ["tenant_admin", "tenant_user"]
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
    },
    {
      title: "Form Builder",
      url: createPageUrl("FormBuilder"),
      icon: Settings,
      roles: ["super_admin"]
    },
    {
      title: "Referenced Data",
      url: createPageUrl("ReferencedDataManagement"),
      icon: Database,
      roles: ["super_admin"]
    },
    {
      title: "Jurisdiction CRS Config",
      url: createPageUrl("JurisdictionSettings"),
      icon: Globe,
      roles: ["super_admin"]
    }
  ];

  const navigation = isSuperAdmin 
    ? superAdminNav 
    : tenantNav;

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
    <ThemeProvider>
    <SidebarProvider>
      {/* Inactivity Warning Dialog */}
      <AlertDialog open={showInactivityWarning} onOpenChange={setShowInactivityWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Session Timeout Warning</AlertDialogTitle>
            <AlertDialogDescription>
              You will be logged out due to inactivity in {secondsRemaining} seconds.
              Click "Stay Logged In" to continue your session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleStayActive}>
              Stay Logged In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Skip to main content link for keyboard navigation */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      <style>{`
        :root {
          --tenant-primary: ${primaryColor};
          --tenant-font: ${fontFamily};
          --focus-ring-color: ${primaryColor};
        }
        body {
          font-family: var(--tenant-font);
        }
      `}</style>

      <div className="min-h-screen flex w-full bg-slate-50" role="application" aria-label="CRS Platform">
        <Sidebar className="border-r border-slate-200 bg-white" role="navigation" aria-label="Main navigation">
          <SidebarHeader className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              {tenant?.branding?.logo_url ? (
                <img 
                  src={tenant.branding.logo_url} 
                  alt={`${tenant.name} logo`}
                  className="h-8 w-auto object-contain"
                  role="img"
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

            {/* Vitauri Branding */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <a 
                href="https://www.vitauri.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-white hover:bg-slate-50 transition-colors"
              >
                <span className="text-xs text-slate-500">Powered by</span>
                <img 
                  src="https://www.vitauri.com/wp-content/uploads/2023/05/vitauri-logo.png"
                  alt="Vitauri"
                  className="h-8 w-auto"
                />
              </a>
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

            {/* Administration Section - Tenant Admin Only */}
            {isTenantAdmin && !isSuperAdmin && (
              <SidebarGroup className="mt-6">
                <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">
                  Administration
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {administrationNav.map((item) => (
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
            )}

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

            {/* Setup Link for Super Admin Only */}
            {isSuperAdmin && (
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
            )}
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
                {isSuperAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("Setup")}>
                      <Wrench className="w-4 h-4 mr-2" />
                      Switch Role (Testing)
                    </Link>
                  </DropdownMenuItem>
                )}
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
            <div className="mt-4 text-left text-xs text-slate-500">
              &copy; {new Date().getFullYear()} <a href="https://www.vitauri.com" target="_blank" rel="noopener noreferrer" className="hover:underline">Vitauri</a>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col overflow-hidden" id="main-content" role="main">
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between lg:hidden" role="banner">
            <SidebarTrigger 
              className="hover:bg-slate-100 p-2 rounded-lg transition-colors"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </SidebarTrigger>
            <h1 className="text-lg font-semibold text-slate-900">
              {tenant?.short_name || "CRS Platform"}
            </h1>
            <div className="w-10" aria-hidden="true"></div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>

        {/* AI Help Assistant - Floating Widget */}
        {(tenant?.enabled_features?.ai_help_assistant !== false) && (
          <AIHelpAssistant currentPage={navigation.find(n => n.url === location.pathname)?.title} />
        )}
      </div>
    </SidebarProvider>
  </ThemeProvider>
  );
}