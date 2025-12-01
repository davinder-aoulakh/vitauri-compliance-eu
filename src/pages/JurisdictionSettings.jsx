import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
import { toast } from "sonner";
import { Globe, Save, Plus, Trash2, Settings as SettingsIcon } from "lucide-react";
import JurisdictionConfig, { JURISDICTION_CONFIGS } from "@/components/reports/JurisdictionConfig";

export default function JurisdictionSettingsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState("AU");
  const [jurisdictionOverrides, setJurisdictionOverrides] = useState({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load jurisdiction overrides from user preferences
      const savedOverrides = currentUser.jurisdiction_overrides || {};
      setJurisdictionOverrides(savedOverrides);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load jurisdiction settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJurisdiction = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        jurisdiction_overrides: jurisdictionOverrides
      });
      toast.success("Jurisdiction settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (config) => {
    setJurisdictionOverrides({
      ...jurisdictionOverrides,
      [selectedJurisdiction]: config
    });
  };

  const handleResetToDefault = () => {
    const newOverrides = { ...jurisdictionOverrides };
    delete newOverrides[selectedJurisdiction];
    setJurisdictionOverrides(newOverrides);
    toast.info("Reset to default configuration");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (user?.user_role !== "super_admin") {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Card>
          <CardContent className="p-12">
            <p className="text-slate-600">You don't have permission to access this page.</p>
            <p className="text-sm text-slate-500 mt-2">Only Super Admins can configure jurisdiction settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableJurisdictions = Object.keys(JURISDICTION_CONFIGS).filter(k => k !== "DEFAULT");

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Globe className="w-8 h-8 text-indigo-600" />
            Jurisdiction CRS Configuration
          </h1>
          <p className="text-slate-600 mt-1">
            Configure CRS XML generation rules for different tax authorities
          </p>
        </div>
        <Badge variant="outline" className="bg-purple-50 text-purple-700">
          SUPER ADMIN
        </Badge>
      </div>

      {/* Jurisdiction Selector */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-transparent">
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-indigo-600" />
            Select Jurisdiction
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Jurisdiction / Tax Authority</Label>
              <Select value={selectedJurisdiction} onValueChange={setSelectedJurisdiction}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableJurisdictions.map(code => {
                    const config = JURISDICTION_CONFIGS[code];
                    return (
                      <SelectItem key={code} value={code}>
                        {config.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={handleResetToDefault}
                disabled={!jurisdictionOverrides[selectedJurisdiction]}
              >
                Reset to Default
              </Button>
              <Button
                onClick={handleSaveJurisdiction}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jurisdiction Configuration */}
      <JurisdictionConfig
        jurisdiction={selectedJurisdiction}
        config={jurisdictionOverrides[selectedJurisdiction] || {}}
        onChange={handleConfigChange}
        readOnly={false}
      />

      {/* Available Jurisdictions Overview */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-green-50 to-transparent">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-green-600" />
            Configured Jurisdictions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableJurisdictions.map(code => {
              const config = JURISDICTION_CONFIGS[code];
              const hasOverride = !!jurisdictionOverrides[code];
              
              return (
                <Card key={code} className={`border-2 ${hasOverride ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">{code}</h3>
                      {hasOverride && (
                        <Badge className="bg-indigo-600 text-white text-xs">Custom</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{config.name}</p>
                    <div className="space-y-1 text-xs text-slate-600">
                      <p>• Schema: v{config.schemaVersion}</p>
                      <p>• Deadline: {config.reportingDeadline}</p>
                      <p>• GIIN: {config.requiresGIIN ? 'Required' : 'Optional'}</p>
                      <p>• Encryption: {config.requiresEncryption ? 'Required' : 'Optional'}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}