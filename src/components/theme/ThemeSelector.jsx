import React, { useState } from "react";
import { useTheme, THEMES } from "./ThemeProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sun,
  Moon,
  Monitor,
  Contrast,
  Minus,
  Palette,
  Briefcase,
  Sparkles,
  Accessibility,
  Settings,
  Check,
  Eye
} from "lucide-react";

const ICON_MAP = {
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  contrast: Contrast,
  minus: Minus,
  palette: Palette,
  briefcase: Briefcase,
  sparkles: Sparkles,
  accessibility: Accessibility,
  settings: Settings
};

export default function ThemeSelector() {
  const { theme, setTheme, customColors, setCustomColors, systemPreference } = useTheme();
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [tempCustomColors, setTempCustomColors] = useState(customColors);
  const [previewTheme, setPreviewTheme] = useState(null);

  const handleSelectTheme = (themeKey) => {
    if (themeKey === "custom") {
      setShowCustomizer(true);
    } else {
      setTheme(themeKey);
    }
  };

  const handleSaveCustomTheme = () => {
    setCustomColors(tempCustomColors);
    setTheme("custom");
    setShowCustomizer(false);
  };

  const getThemePreviewStyle = (themeKey) => {
    const themeData = THEMES[themeKey];
    let colors = themeData.colors;
    
    if (themeKey === "system") {
      colors = THEMES[systemPreference].colors;
    } else if (themeKey === "custom") {
      colors = {
        background: customColors.background,
        foreground: customColors.foreground,
        primary: customColors.primary,
        accent: customColors.accent
      };
    }

    if (!colors) return {};

    return {
      backgroundColor: colors.background,
      color: colors.foreground,
      borderColor: colors.primary
    };
  };

  const renderThemeCard = (themeKey) => {
    const themeData = THEMES[themeKey];
    const IconComponent = ICON_MAP[themeData.icon] || Settings;
    const isSelected = theme === themeKey;
    const previewStyle = getThemePreviewStyle(themeKey);

    return (
      <Card
        key={themeKey}
        className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
          isSelected ? "ring-2 ring-offset-2" : "hover:border-slate-300"
        }`}
        style={isSelected ? { ringColor: previewStyle.borderColor } : {}}
        onClick={() => handleSelectTheme(themeKey)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Theme Preview */}
            <div 
              className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0 border-2 transition-all"
              style={previewStyle}
            >
              <IconComponent className="w-6 h-6" style={{ color: previewStyle.borderColor }} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {themeData.name}
                </h3>
                {isSelected && (
                  <Badge className="bg-green-100 text-green-800">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {themeData.description}
              </p>
              
              {/* Color swatches */}
              {themeKey !== "system" && themeKey !== "custom" && themeData.colors && (
                <div className="flex gap-1 mt-2">
                  {['background', 'primary', 'accent', 'foreground'].map(colorKey => (
                    <div
                      key={colorKey}
                      className="w-4 h-4 rounded-full border border-slate-300"
                      style={{ backgroundColor: themeData.colors[colorKey] }}
                      title={colorKey}
                    />
                  ))}
                </div>
              )}
              
              {themeKey === "system" && (
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                  <Monitor className="w-3 h-3" />
                  Currently: {systemPreference === "dark" ? "Dark" : "Light"}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Theme Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.keys(THEMES).map(themeKey => renderThemeCard(themeKey))}
      </div>

      {/* Custom Theme Builder Dialog */}
      <Dialog open={showCustomizer} onOpenChange={setShowCustomizer}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Custom Theme Builder
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Live Preview */}
            <div 
              className="p-4 rounded-lg border-2 transition-all"
              style={{
                backgroundColor: tempCustomColors.background,
                color: tempCustomColors.foreground,
                borderColor: tempCustomColors.primary
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4" />
                <span className="font-semibold">Live Preview</span>
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  className="px-3 py-1.5 rounded text-sm font-medium text-white"
                  style={{ backgroundColor: tempCustomColors.primary }}
                >
                  Primary Button
                </button>
                <button
                  className="px-3 py-1.5 rounded text-sm font-medium border"
                  style={{ 
                    backgroundColor: tempCustomColors.accent,
                    color: tempCustomColors.foreground,
                    borderColor: tempCustomColors.primary 
                  }}
                >
                  Secondary
                </button>
              </div>
              <p className="text-sm opacity-80">
                This is how your custom theme will look.
              </p>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={tempCustomColors.primary}
                    onChange={(e) => setTempCustomColors({ ...tempCustomColors, primary: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={tempCustomColors.primary}
                    onChange={(e) => setTempCustomColors({ ...tempCustomColors, primary: e.target.value })}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={tempCustomColors.background}
                    onChange={(e) => setTempCustomColors({ ...tempCustomColors, background: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={tempCustomColors.background}
                    onChange={(e) => setTempCustomColors({ ...tempCustomColors, background: e.target.value })}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Text Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={tempCustomColors.foreground}
                    onChange={(e) => setTempCustomColors({ ...tempCustomColors, foreground: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={tempCustomColors.foreground}
                    onChange={(e) => setTempCustomColors({ ...tempCustomColors, foreground: e.target.value })}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={tempCustomColors.accent}
                    onChange={(e) => setTempCustomColors({ ...tempCustomColors, accent: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={tempCustomColors.accent}
                    onChange={(e) => setTempCustomColors({ ...tempCustomColors, accent: e.target.value })}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Preset Color Palettes */}
            <div className="space-y-2">
              <Label>Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "Ocean", primary: "#0ea5e9", bg: "#f0f9ff", fg: "#0c4a6e", accent: "#bae6fd" },
                  { name: "Forest", primary: "#16a34a", bg: "#f0fdf4", fg: "#14532d", accent: "#bbf7d0" },
                  { name: "Sunset", primary: "#ea580c", bg: "#fff7ed", fg: "#7c2d12", accent: "#fed7aa" },
                  { name: "Berry", primary: "#c026d3", bg: "#fdf4ff", fg: "#4a044e", accent: "#f5d0fe" },
                  { name: "Slate", primary: "#475569", bg: "#f8fafc", fg: "#0f172a", accent: "#e2e8f0" }
                ].map(preset => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => setTempCustomColors({
                      primary: preset.primary,
                      background: preset.bg,
                      foreground: preset.fg,
                      accent: preset.accent
                    })}
                    className="gap-2"
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: preset.primary }}
                    />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomizer(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCustomTheme}>
              Apply Custom Theme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}