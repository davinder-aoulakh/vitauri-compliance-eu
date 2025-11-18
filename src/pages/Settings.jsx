import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Monitor
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
      
      // Apply settings to document
      applyAccessibilitySettings(prefs);
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
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-purple-600" />
                Appearance Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-slate-600">
                Theme customization options will be available here in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-slate-600" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-slate-600">
                General application settings will be available here in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}