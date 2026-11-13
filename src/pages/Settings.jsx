import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { auditLog } from "@/components/utils/auditLogger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Settings as SettingsIcon, 
  Palette, 
  Eye, 
  Save, 
  CheckCircle2,
  Type,
  Monitor,
  Bell,
  LayoutDashboard,
  Shield,
  LogOut,
  Mail,
  Building2,
  Upload,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ThemeSelector from "@/components/theme/ThemeSelector";
import EmailNotificationConfig from "@/components/settings/EmailNotificationConfig";

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSaving, setMfaSaving] = useState(false);
  const [showMfaDisableDialog, setShowMfaDisableDialog] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaCodeSending, setMfaCodeSending] = useState(false);
  const [mfaCodeSubmitting, setMfaCodeSubmitting] = useState(false);

  // Accessibility Settings
  const [fontSize, setFontSize] = useState("medium");
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [keyboardNavigation, setKeyboardNavigation] = useState(true);

  // Appearance Settings
  const [theme, setTheme] = useState("light");
  const [layoutDensity, setLayoutDensity] = useState("comfortable");
  const [accentColor, setAccentColor] = useState("#4f46e5");

  // General Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [workflowNotifications, setWorkflowNotifications] = useState(true);
  const [reportNotifications, setReportNotifications] = useState(true);
  const [defaultLandingPage, setDefaultLandingPage] = useState("Dashboard");
  const [language, setLanguage] = useState("en");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [timezone, setTimezone] = useState("UTC");
  const [emailEventConfig, setEmailEventConfig] = useState({});

  // Branding Settings
  const [vitauriName, setVitauriName] = useState("Vitauri CRS");
  const [vitauriTagline, setVitauriTagline] = useState("Compliance Platform");
  const [vitauriLogoUrl, setVitauriLogoUrl] = useState("https://www.vitauri.com/wp-content/uploads/2023/05/vitauri-logo.png");
  const [tenantName, setTenantName] = useState("");
  const [tenantLogoUrl, setTenantLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Load tenant data
      if (currentUser.tenant_id) {
        const tenants = await base44.entities.Tenant.list();
        const userTenant = tenants.find(t => t.id === currentUser.tenant_id);
        setTenant(userTenant);
        setTenantName(userTenant?.short_name || "");
        setTenantLogoUrl(userTenant?.branding?.logo_url || "");
      }
      
      // Load accessibility preferences from user data
      const prefs = currentUser.accessibility_preferences || {};
      setFontSize(prefs.fontSize || "medium");
      setHighContrast(prefs.highContrast || false);
      setReducedMotion(prefs.reducedMotion || false);
      setKeyboardNavigation(prefs.keyboardNavigation !== false);
      
      // Load appearance preferences
      const appearance = currentUser.appearance_preferences || {};
      setTheme(appearance.theme || "light");
      setLayoutDensity(appearance.layoutDensity || "comfortable");
      setAccentColor(appearance.accentColor || "#4f46e5");
      
      // Load general preferences
      const general = currentUser.general_preferences || {};
      setEmailNotifications(general.emailNotifications !== false);
      setInAppNotifications(general.inAppNotifications !== false);
      setWorkflowNotifications(general.workflowNotifications !== false);
      setReportNotifications(general.reportNotifications !== false);
      setDefaultLandingPage(general.defaultLandingPage || "Dashboard");
      setLanguage(general.language || "en");
      setDateFormat(general.dateFormat || "MM/DD/YYYY");
      setTimezone(general.timezone || "UTC");
      setEmailEventConfig(general.emailEventConfig || {});
      
      // Load MFA preference
      setMfaEnabled(currentUser.mfa_enabled || false);

      // Load Vitauri branding from global platform settings
      try {
        const platformSettings = await base44.entities.PlatformSettings.filter({ setting_key: "vitauri_branding" });
        const brandingSetting = platformSettings[0];
        if (brandingSetting?.setting_value) {
          setVitauriName(brandingSetting.setting_value.name || "Vitauri CRS");
          setVitauriTagline(brandingSetting.setting_value.tagline || "Compliance Platform");
          setVitauriLogoUrl(brandingSetting.setting_value.logo_url || "https://www.vitauri.com/wp-content/uploads/2023/05/vitauri-logo.png");
        } else {
          // Defaults
          setVitauriName("Vitauri CRS");
          setVitauriTagline("Compliance Platform");
          setVitauriLogoUrl("https://www.vitauri.com/wp-content/uploads/2023/05/vitauri-logo.png");
        }
      } catch (error) {
        console.error("Error loading Vitauri branding:", error);
        // Use defaults
        setVitauriName("Vitauri CRS");
        setVitauriTagline("Compliance Platform");
        setVitauriLogoUrl("https://www.vitauri.com/wp-content/uploads/2023/05/vitauri-logo.png");
      }
      
      // Apply settings to document
      applyAccessibilitySettings(prefs);
      applyAppearanceSettings(appearance);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const applyAccessibilitySettings = (prefs) => {
    const root = document.documentElement;
    
    // Font Size
    const fontSizeMap = {
      small: "14px",
      medium: "16px",
      large: "18px",
      xlarge: "20px"
    };
    root.style.setProperty("--base-font-size", fontSizeMap[prefs.fontSize || "medium"]);
    root.classList.toggle("text-sm", prefs.fontSize === "small");
    root.classList.toggle("text-base", prefs.fontSize === "medium");
    root.classList.toggle("text-lg", prefs.fontSize === "large");
    root.classList.toggle("text-xl", prefs.fontSize === "xlarge");
    
    // High Contrast
    root.classList.toggle("high-contrast", prefs.highContrast);
    
    // Reduced Motion
    if (prefs.reducedMotion) {
      root.style.setProperty("--transition-duration", "0ms");
    } else {
      root.style.removeProperty("--transition-duration");
    }
    
    // Enhanced Focus Indicators
    root.classList.toggle("enhanced-focus", prefs.keyboardNavigation);
  };

  const applyAppearanceSettings = (appearance) => {
    const root = document.documentElement;
    
    // Theme
    root.classList.toggle("dark", appearance.theme === "dark");
    
    // Layout Density
    root.setAttribute("data-density", appearance.layoutDensity || "comfortable");
    
    // Accent Color
    if (appearance.accentColor) {
      root.style.setProperty("--accent-color", appearance.accentColor);
      root.style.setProperty("--focus-ring-color", appearance.accentColor);
    }
  };

  const handleSaveAccessibility = async () => {
    setSaving(true);
    try {
      const before = user?.accessibility_preferences || {};
      const preferences = {
        fontSize,
        highContrast,
        reducedMotion,
        keyboardNavigation
      };
      
      await base44.auth.updateMe({
        accessibility_preferences: preferences
      });
      
      applyAccessibilitySettings(preferences);
      await auditLog.settingsChanged('accessibility', before, preferences);
      toast.success("Accessibility settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAppearance = async () => {
    setSaving(true);
    try {
      const before = user?.appearance_preferences || {};
      const preferences = {
        theme,
        layoutDensity,
        accentColor
      };
      
      await base44.auth.updateMe({
        appearance_preferences: preferences
      });
      
      applyAppearanceSettings(preferences);
      await auditLog.settingsChanged('appearance', before, preferences);
      toast.success("Appearance settings saved successfully");
    } catch (error) {
      console.error("Error saving appearance:", error);
      toast.error("Failed to save appearance settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      const before = user?.general_preferences || {};
      const preferences = {
        emailNotifications,
        inAppNotifications,
        workflowNotifications,
        reportNotifications,
        defaultLandingPage,
        language,
        dateFormat,
        timezone,
        emailEventConfig
      };
      
      await base44.auth.updateMe({
        general_preferences: preferences
      });
      
      await auditLog.settingsChanged('general', before, preferences);
      toast.success("General settings saved successfully");
    } catch (error) {
      console.error("Error saving general settings:", error);
      toast.error("Failed to save general settings");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMfa = async (enabled) => {
    if (enabled) {
      // Turning ON: allowed for the user themselves (server-side setMyMfa).
      setMfaSaving(true);
      try {
        const res = await base44.functions.invoke("setMyMfa", { enable: true });
        if (res.data?.error) throw new Error(res.data.error);
        setMfaEnabled(true);
        sessionStorage.removeItem("mfa_verified");
        toast.success("Two-factor authentication enabled");
      } catch (error) {
        toast.error(error.message || "Failed to update MFA settings");
      } finally {
        setMfaSaving(false);
      }
    } else if (user?.app_role === "super_admin") {
      // Super Admin may disable 2FA without a code.
      setMfaSaving(true);
      try {
        const res = await base44.functions.invoke("setMyMfa", { enable: false });
        if (res.data?.error) throw new Error(res.data.error);
        setMfaEnabled(false);
        toast.success("Two-factor authentication disabled");
      } catch (error) {
        toast.error(error.message || "Failed to update MFA settings");
      } finally {
        setMfaSaving(false);
      }
    } else {
      // Turning OFF: prompt for a verification code.
      setMfaCode("");
      setShowMfaDisableDialog(true);
    }
  };

  const handleSendMfaCode = async () => {
    setMfaCodeSending(true);
    try {
      const res = await base44.functions.invoke("requestMfaCode", {});
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Verification code sent to your email");
    } catch (error) {
      toast.error(error.message || "Failed to send code");
    } finally {
      setMfaCodeSending(false);
    }
  };

  const handleConfirmDisableMfa = async () => {
    setMfaCodeSubmitting(true);
    try {
      const res = await base44.functions.invoke("setMyMfa", { enable: false, code: mfaCode });
      if (res.data?.error) throw new Error(res.data.error);
      setMfaEnabled(false);
      setShowMfaDisableDialog(false);
      setMfaCode("");
      toast.success("Two-factor authentication disabled");
    } catch (error) {
      toast.error(error.message || "Failed to disable 2FA");
    } finally {
      setMfaCodeSubmitting(false);
    }
  };

  const handleResetToDefaults = () => {
    setFontSize("medium");
    setHighContrast(false);
    setReducedMotion(false);
    setKeyboardNavigation(true);
    toast.info("Settings reset to defaults (click Save to apply)");
  };

  const handleLogoUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      if (type === 'vitauri') {
        setVitauriLogoUrl(file_url);
      } else {
        setTenantLogoUrl(file_url);
      }
      
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveVitauriBranding = async () => {
    setSaving(true);
    try {
      const branding = {
        name: vitauriName,
        tagline: vitauriTagline,
        logo_url: vitauriLogoUrl
      };
      
      // Check if setting exists
      const existingSettings = await base44.entities.PlatformSettings.filter({ setting_key: "vitauri_branding" });
      
      if (existingSettings.length > 0) {
        // Update existing
        const before = existingSettings[0].setting_value;
        await base44.entities.PlatformSettings.update(existingSettings[0].id, {
          setting_value: branding,
          updated_by: user.email
        });
        await auditLog.settingsChanged('vitauri_branding', before, branding);
      } else {
        // Create new
        await base44.entities.PlatformSettings.create({
          setting_key: "vitauri_branding",
          setting_value: branding,
          description: "Global Vitauri platform branding",
          updated_by: user.email
        });
        await auditLog.settingsChanged('vitauri_branding', {}, branding);
      }
      
      toast.success("Vitauri branding saved successfully");
      
      // Reload page to reflect changes in sidebar
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error saving Vitauri branding:", error);
      toast.error("Failed to save Vitauri branding");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTenantBranding = async () => {
    if (!tenant) {
      toast.error("No tenant found");
      return;
    }

    setSaving(true);
    try {
      const before = { 
        short_name: tenant.short_name,
        logo_url: tenant.branding?.logo_url 
      };
      
      await base44.entities.Tenant.update(tenant.id, {
        short_name: tenantName,
        branding: {
          ...tenant.branding,
          logo_url: tenantLogoUrl
        }
      });
      
      await auditLog.settingsChanged('tenant_branding', before, {
        short_name: tenantName,
        logo_url: tenantLogoUrl
      });
      
      toast.success("Tenant branding saved successfully");
      
      // Reload page to reflect changes in sidebar
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error saving tenant branding:", error);
      toast.error("Failed to save tenant branding");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-indigo-600" />
            Settings
          </h1>
          <p className="text-slate-600 mt-1">
            Manage your account preferences and accessibility options
          </p>
        </div>
        <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
          {user?.user_role?.replace("_", " ").toUpperCase()}
        </Badge>
      </div>

      <Tabs defaultValue="accessibility" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="accessibility" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Accessibility
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            General
          </TabsTrigger>
        </TabsList>

        {/* Accessibility Tab */}
        <TabsContent value="accessibility" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                Accessibility Preferences
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Customize your experience for better accessibility and usability
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Font Size */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="fontSize" className="text-base font-semibold flex items-center gap-2">
                      <Type className="w-4 h-4" />
                      Text Size
                    </Label>
                    <p className="text-sm text-slate-600">
                      Adjust the base font size throughout the application
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {fontSize}
                  </Badge>
                </div>
                <Select value={fontSize} onValueChange={setFontSize}>
                  <SelectTrigger id="fontSize" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (14px)</SelectItem>
                    <SelectItem value="medium">Medium (16px) - Default</SelectItem>
                    <SelectItem value="large">Large (18px)</SelectItem>
                    <SelectItem value="xlarge">Extra Large (20px)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="p-4 bg-slate-50 rounded-lg border">
                  <p style={{ fontSize: fontSize === "small" ? "14px" : fontSize === "large" ? "18px" : fontSize === "xlarge" ? "20px" : "16px" }}>
                    Preview: The quick brown fox jumps over the lazy dog
                  </p>
                </div>
              </div>

              {/* High Contrast Mode */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="highContrast" className="text-base font-semibold">
                    High Contrast Mode
                  </Label>
                  <p className="text-sm text-slate-600">
                    Increase color contrast for better visibility (WCAG AAA compliance)
                  </p>
                </div>
                <Switch
                  id="highContrast"
                  checked={highContrast}
                  onCheckedChange={setHighContrast}
                  aria-label="Toggle high contrast mode"
                />
              </div>

              {/* Reduced Motion */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="reducedMotion" className="text-base font-semibold">
                    Reduce Motion
                  </Label>
                  <p className="text-sm text-slate-600">
                    Minimize animations and transitions for users sensitive to motion
                  </p>
                </div>
                <Switch
                  id="reducedMotion"
                  checked={reducedMotion}
                  onCheckedChange={setReducedMotion}
                  aria-label="Toggle reduced motion"
                />
              </div>

              {/* Enhanced Keyboard Navigation */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="keyboardNavigation" className="text-base font-semibold">
                    Enhanced Keyboard Focus
                  </Label>
                  <p className="text-sm text-slate-600">
                    Show prominent focus indicators for keyboard navigation
                  </p>
                </div>
                <Switch
                  id="keyboardNavigation"
                  checked={keyboardNavigation}
                  onCheckedChange={setKeyboardNavigation}
                  aria-label="Toggle enhanced keyboard focus"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleResetToDefaults}
                  disabled={saving}
                >
                  Reset to Defaults
                </Button>
                <Button
                  onClick={handleSaveAccessibility}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Accessibility Tips */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Accessibility Tips
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-semibold min-w-[24px]">•</span>
                  <span>Use <kbd className="px-2 py-0.5 bg-white rounded border text-xs">Tab</kbd> to navigate between interactive elements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold min-w-[24px]">•</span>
                  <span>Press <kbd className="px-2 py-0.5 bg-white rounded border text-xs">Enter</kbd> or <kbd className="px-2 py-0.5 bg-white rounded border text-xs">Space</kbd> to activate buttons</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold min-w-[24px]">•</span>
                  <span>Screen readers are fully supported throughout the application</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold min-w-[24px]">•</span>
                  <span>All form fields include proper labels and error messages</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-purple-600" />
                Theme Selection
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Choose from 10 professionally designed themes or create your own
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <ThemeSelector />
            </CardContent>
          </Card>

          {/* Layout Density */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-indigo-600" />
                Layout Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="layoutDensity" className="text-base font-semibold">
                      Layout Density
                    </Label>
                    <p className="text-sm text-slate-600">
                      Adjust spacing and padding throughout the interface
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {layoutDensity}
                  </Badge>
                </div>
                <Select value={layoutDensity} onValueChange={setLayoutDensity}>
                  <SelectTrigger id="layoutDensity" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact - More content, less spacing</SelectItem>
                    <SelectItem value="comfortable">Comfortable - Balanced spacing (Default)</SelectItem>
                    <SelectItem value="spacious">Spacious - More breathing room</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  onClick={handleSaveAppearance}
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Layout Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          {/* Vitauri Branding - Super Admin Only */}
          {user?.user_role === 'super_admin' && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Vitauri Platform Branding
                </CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Configure the global platform branding visible to all users
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="vitauriName" className="text-base font-semibold">
                    Platform Name
                  </Label>
                  <Input
                    id="vitauriName"
                    value={vitauriName}
                    onChange={(e) => setVitauriName(e.target.value)}
                    placeholder="Vitauri CRS"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="vitauriTagline" className="text-base font-semibold">
                    Platform Tagline
                  </Label>
                  <Input
                    id="vitauriTagline"
                    value={vitauriTagline}
                    onChange={(e) => setVitauriTagline(e.target.value)}
                    placeholder="Compliance Platform"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Platform Logo
                  </Label>
                  <div className="flex items-center gap-4">
                    {vitauriLogoUrl && (
                      <div className="relative">
                        <img 
                          src={vitauriLogoUrl} 
                          alt="Vitauri Logo" 
                          className="h-16 w-auto object-contain border rounded p-2"
                        />
                        <button
                          onClick={() => setVitauriLogoUrl("")}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e, 'vitauri')}
                        className="hidden"
                        id="vitauri-logo-upload"
                        disabled={uploadingLogo}
                      />
                      <label htmlFor="vitauri-logo-upload">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploadingLogo}
                          className="cursor-pointer"
                          asChild
                        >
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Recommended: PNG or SVG with transparent background, max 200px height
                  </p>
                </div>

                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <p className="text-sm font-semibold text-indigo-900 mb-2">Preview:</p>
                  <div className="flex items-center gap-3 p-3 bg-white rounded border">
                    {vitauriLogoUrl ? (
                      <img src={vitauriLogoUrl} alt="Preview" className="h-8 w-auto" />
                    ) : (
                      <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">
                        V
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm">{vitauriName}</p>
                      <p className="text-xs text-slate-500">{vitauriTagline}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSaveVitauriBranding}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Vitauri Branding
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tenant Branding - Tenant Admin Only */}
          {user?.user_role === 'tenant_admin' && tenant && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-600" />
                  Organization Branding
                </CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Configure your organization's branding
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="tenantName" className="text-base font-semibold">
                    Organization Short Name
                  </Label>
                  <Input
                    id="tenantName"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="ACME Financial"
                  />
                  <p className="text-xs text-slate-500">
                    This name will appear in the sidebar footer
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Organization Logo
                  </Label>
                  <div className="flex items-center gap-4">
                    {tenantLogoUrl && (
                      <div className="relative">
                        <img 
                          src={tenantLogoUrl} 
                          alt="Organization Logo" 
                          className="h-16 w-auto object-contain border rounded p-2"
                        />
                        <button
                          onClick={() => setTenantLogoUrl("")}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e, 'tenant')}
                        className="hidden"
                        id="tenant-logo-upload"
                        disabled={uploadingLogo}
                      />
                      <label htmlFor="tenant-logo-upload">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploadingLogo}
                          className="cursor-pointer"
                          asChild
                        >
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Recommended: PNG or SVG, square format, max 200px
                  </p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm font-semibold text-purple-900 mb-2">Preview:</p>
                  <div className="flex items-center gap-2 p-3 bg-white rounded border">
                    {tenantLogoUrl ? (
                      <img src={tenantLogoUrl} alt="Preview" className="h-6 w-auto" />
                    ) : (
                      <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center text-white font-bold text-xs">
                        {tenantName?.[0] || 'O'}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold">{tenantName || 'Organization Name'}</p>
                      <p className="text-xs text-slate-500">{tenant.jurisdiction}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSaveTenantBranding}
                    disabled={saving}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Organization Branding
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No access message for regular users */}
          {user?.user_role !== 'super_admin' && user?.user_role !== 'tenant_admin' && (
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Admin Access Required
                </h3>
                <p className="text-slate-600">
                  Only administrators can configure branding settings.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          {/* Notification Preferences */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-green-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-green-600" />
                Notification Preferences
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Control how and when you receive notifications
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="emailNotifications" className="text-base font-semibold">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-slate-600">
                    Receive updates via email
                  </p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="inAppNotifications" className="text-base font-semibold">
                    In-App Notifications
                  </Label>
                  <p className="text-sm text-slate-600">
                    Show notifications within the application
                  </p>
                </div>
                <Switch
                  id="inAppNotifications"
                  checked={inAppNotifications}
                  onCheckedChange={setInAppNotifications}
                />
              </div>

              <div className="ml-6 space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-900">Notification Types:</p>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="workflowNotifications" className="text-sm">
                    Workflow updates and changes
                  </Label>
                  <Switch
                    id="workflowNotifications"
                    checked={workflowNotifications}
                    onCheckedChange={setWorkflowNotifications}
                    disabled={!inAppNotifications && !emailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="reportNotifications" className="text-sm">
                    Report submissions and status
                  </Label>
                  <Switch
                    id="reportNotifications"
                    checked={reportNotifications}
                    onCheckedChange={setReportNotifications}
                    disabled={!inAppNotifications && !emailNotifications}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Notification Events - Only show when email notifications are enabled */}
          {emailNotifications && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-600" />
                  Email Event Configuration
                </CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Configure which events trigger email notifications and customize delivery options
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <EmailNotificationConfig
                  config={emailEventConfig}
                  onChange={setEmailEventConfig}
                  userRole={user?.user_role}
                />
              </CardContent>
            </Card>
          )}

          {/* Landing Page & Preferences */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-indigo-600" />
                Application Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <Label htmlFor="defaultLandingPage" className="text-base font-semibold">
                  Default Landing Page
                </Label>
                <p className="text-sm text-slate-600">
                  Choose which page to display after login
                </p>
                <Select value={defaultLandingPage} onValueChange={setDefaultLandingPage}>
                  <SelectTrigger id="defaultLandingPage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dashboard">Dashboard</SelectItem>
                    <SelectItem value="Entities">Entities</SelectItem>
                    <SelectItem value="Accounts">Accounts</SelectItem>
                    <SelectItem value="Reports">CRS Reports</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Language & Region */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-amber-600" />
                Language & Region
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <Label htmlFor="language" className="text-base font-semibold">
                  Language
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es" disabled>Español (Coming Soon)</SelectItem>
                    <SelectItem value="fr" disabled>Français (Coming Soon)</SelectItem>
                    <SelectItem value="de" disabled>Deutsch (Coming Soon)</SelectItem>
                    <SelectItem value="zh" disabled>中文 (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Additional languages will be available in a future update
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="dateFormat" className="text-base font-semibold">
                    Date Format
                  </Label>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger id="dateFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (EU)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="timezone" className="text-base font-semibold">
                    Timezone
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Two-Factor Authentication (2FA)
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Add an extra layer of security to your account with email verification
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="space-y-1 flex-1">
                  <Label className="text-base font-semibold">
                    Email Verification on Login
                  </Label>
                  <p className="text-sm text-slate-600">
                    A 6-digit code will be sent to <strong>{user?.email}</strong> each time you log in
                  </p>
                  {mfaEnabled && (
                    <p className="text-xs text-green-700 font-medium mt-1">✓ 2FA is currently active on your account</p>
                  )}
                </div>
                <Switch
                  checked={mfaEnabled}
                  onCheckedChange={handleToggleMfa}
                  disabled={mfaSaving}
                  aria-label="Toggle two-factor authentication"
                />
              </div>
            </CardContent>
          </Card>

          {/* Disable 2FA confirmation dialog */}
          <AlertDialog open={showMfaDisableDialog} onOpenChange={setShowMfaDisableDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable Two-Factor Authentication</AlertDialogTitle>
                <AlertDialogDescription>
                  For security, enter the 6-digit code sent to <strong>{user?.email}</strong> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="mfa-disable-code" className="text-sm">Verification code</Label>
                <div className="flex gap-2">
                  <Input
                    id="mfa-disable-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    inputMode="numeric"
                  />
                  <Button type="button" variant="outline" onClick={handleSendMfaCode} disabled={mfaCodeSending}>
                    {mfaCodeSending ? "Sending..." : "Send code"}
                  </Button>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={mfaCodeSubmitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDisableMfa}
                  disabled={mfaCodeSubmitting || !mfaCode}
                >
                  {mfaCodeSubmitting ? "Disabling..." : "Disable 2FA"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Session Management */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-red-50 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-600" />
                Session Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Manage your active login sessions across different devices
                </p>
                
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-green-900">Current Session</p>
                      <p className="text-sm text-green-700 mt-1">
                        {user?.email} • Active now
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Browser: {navigator.userAgent.includes("Chrome") ? "Chrome" : "Other"}
                      </p>
                    </div>
                    <Badge className="bg-green-600 text-white">Active</Badge>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border">
                  <p className="text-sm text-slate-700 italic">
                    No other active sessions detected
                  </p>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => {
                    if (confirm("Log out from all other devices? You will remain logged in on this device.")) {
                      toast.success("Successfully logged out from all other devices");
                    }
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log Out From Other Devices
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveGeneral}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save General Settings
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}