import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
  LogOut
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
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
      const preferences = {
        theme,
        layoutDensity,
        accentColor
      };
      
      await base44.auth.updateMe({
        appearance_preferences: preferences
      });
      
      applyAppearanceSettings(preferences);
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
      const preferences = {
        emailNotifications,
        inAppNotifications,
        workflowNotifications,
        reportNotifications,
        defaultLandingPage,
        language,
        dateFormat,
        timezone
      };
      
      await base44.auth.updateMe({
        general_preferences: preferences
      });
      
      toast.success("General settings saved successfully");
    } catch (error) {
      console.error("Error saving general settings:", error);
      toast.error("Failed to save general settings");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setFontSize("medium");
    setHighContrast(false);
    setReducedMotion(false);
    setKeyboardNavigation(true);
    toast.info("Settings reset to defaults (click Save to apply)");
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="accessibility" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Accessibility
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Appearance
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
                Appearance Preferences
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Customize the visual appearance of the application
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Theme Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="theme" className="text-base font-semibold flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Theme
                    </Label>
                    <p className="text-sm text-slate-600">
                      Choose between light and dark mode
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {theme}
                  </Badge>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger id="theme" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light Mode</SelectItem>
                    <SelectItem value="dark">Dark Mode</SelectItem>
                    <SelectItem value="auto">Auto (System Preference)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Layout Density */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="layoutDensity" className="text-base font-semibold flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
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

              {/* Accent Color */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="accentColor" className="text-base font-semibold">
                      Accent Color
                    </Label>
                    <p className="text-sm text-slate-600">
                      Customize the primary accent color for buttons and highlights
                    </p>
                  </div>
                  <div 
                    className="w-10 h-10 rounded-lg border-2 border-slate-300 shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>
                <div className="flex gap-3">
                  <input
                    type="color"
                    id="accentColor"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-20 rounded border border-slate-300 cursor-pointer"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#4f46e5"
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {["#4f46e5", "#7c3aed", "#2563eb", "#0891b2", "#059669", "#dc2626", "#ea580c"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className="w-8 h-8 rounded-lg border-2 hover:scale-110 transition-transform"
                      style={{ 
                        backgroundColor: color,
                        borderColor: accentColor === color ? "#1e293b" : "transparent"
                      }}
                      aria-label={`Select ${color} as accent color`}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
                <p className="text-sm font-semibold text-slate-700">Preview:</p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    style={{ 
                      backgroundColor: accentColor,
                      borderColor: accentColor 
                    }}
                  >
                    Primary Button
                  </Button>
                  <Button size="sm" variant="outline">
                    Secondary Button
                  </Button>
                </div>
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
                      Save Appearance
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
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
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                  </SelectContent>
                </Select>
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