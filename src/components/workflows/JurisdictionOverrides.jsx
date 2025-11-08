import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Plus,
  Trash2,
  Save,
  MapPin,
  Settings
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function JurisdictionOverrides({ workflow, onSave }) {
  const [jurisdictions, setJurisdictions] = useState(workflow?.jurisdiction_overrides || []);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingJurisdiction, setEditingJurisdiction] = useState(null);

  const handleAddJurisdiction = (jurisdiction) => {
    setJurisdictions([...jurisdictions, jurisdiction]);
    setShowAddDialog(false);
  };

  const handleUpdateJurisdiction = (updated) => {
    setJurisdictions(jurisdictions.map(j => 
      j.jurisdiction_code === updated.jurisdiction_code ? updated : j
    ));
    setEditingJurisdiction(null);
  };

  const handleDeleteJurisdiction = (code) => {
    if (confirm(`Remove overrides for ${code}?`)) {
      setJurisdictions(jurisdictions.filter(j => j.jurisdiction_code !== code));
    }
  };

  const handleSave = () => {
    const updatedWorkflow = {
      ...workflow,
      jurisdiction_overrides: jurisdictions
    };
    onSave(updatedWorkflow);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-600" />
            Jurisdiction-Specific Overrides
          </h3>
          <p className="text-sm text-slate-600">Customize workflow for different countries/regions</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Jurisdiction
        </Button>
      </div>

      {/* Base Workflow Info */}
      <Card className="border-2 border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Base Workflow</p>
              <p className="text-sm text-blue-800">
                The default workflow applies globally unless overridden. Add jurisdiction-specific 
                variations below to customize thresholds, questions, or steps.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jurisdictions List */}
      {jurisdictions.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Globe className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Jurisdiction Overrides</h3>
            <p className="text-slate-600 mb-6">
              The base workflow will be used for all jurisdictions
            </p>
            <Button onClick={() => setShowAddDialog(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add First Override
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jurisdictions.map((jurisdiction) => (
            <Card key={jurisdiction.jurisdiction_code} className="border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">
                      {jurisdiction.jurisdiction_name}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {jurisdiction.jurisdiction_code}
                    </Badge>
                  </div>
                </div>

                {jurisdiction.description && (
                  <p className="text-sm text-slate-600 mb-3">
                    {jurisdiction.description}
                  </p>
                )}

                <div className="space-y-2 mb-4">
                  {jurisdiction.overrides && Object.keys(jurisdiction.overrides).length > 0 && (
                    <div className="bg-slate-50 rounded p-3">
                      <p className="text-xs font-medium text-slate-700 mb-2">Overrides:</p>
                      <div className="space-y-1">
                        {Object.entries(jurisdiction.overrides).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{key}:</span>
                            <Badge variant="outline" className="text-xs font-mono">
                              {JSON.stringify(value)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditingJurisdiction(jurisdiction)}
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteJurisdiction(jurisdiction.jurisdiction_code)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Save Button */}
      {jurisdictions.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Save className="w-4 h-4 mr-2" />
            Save All Overrides
          </Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || !!editingJurisdiction} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingJurisdiction(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingJurisdiction ? "Edit Jurisdiction Override" : "Add Jurisdiction Override"}
            </DialogTitle>
          </DialogHeader>
          <JurisdictionForm
            jurisdiction={editingJurisdiction}
            onSubmit={editingJurisdiction ? handleUpdateJurisdiction : handleAddJurisdiction}
            onCancel={() => {
              setShowAddDialog(false);
              setEditingJurisdiction(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Jurisdiction Form Component
function JurisdictionForm({ jurisdiction, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(jurisdiction || {
    jurisdiction_code: "",
    jurisdiction_name: "",
    description: "",
    overrides: {}
  });

  const [overrideKey, setOverrideKey] = useState("");
  const [overrideValue, setOverrideValue] = useState("");

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleAddOverride = () => {
    if (overrideKey && overrideValue) {
      setFormData({
        ...formData,
        overrides: {
          ...formData.overrides,
          [overrideKey]: overrideValue
        }
      });
      setOverrideKey("");
      setOverrideValue("");
    }
  };

  const handleRemoveOverride = (key) => {
    const newOverrides = { ...formData.overrides };
    delete newOverrides[key];
    setFormData({ ...formData, overrides: newOverrides });
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const commonJurisdictions = [
    { code: "US", name: "United States" },
    { code: "GB", name: "United Kingdom" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "AW", name: "Aruba" },
    { code: "CW", name: "Curaçao" },
    { code: "SX", name: "Sint Maarten" },
    { code: "CH", name: "Switzerland" },
    { code: "LU", name: "Luxembourg" },
    { code: "SG", name: "Singapore" }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="jurisdiction_code">Jurisdiction Code *</Label>
          <Select
            value={formData.jurisdiction_code}
            onValueChange={(value) => {
              handleChange("jurisdiction_code", value);
              const selected = commonJurisdictions.find(j => j.code === value);
              if (selected) {
                handleChange("jurisdiction_name", selected.name);
              }
            }}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select or enter code..." />
            </SelectTrigger>
            <SelectContent>
              {commonJurisdictions.map((j) => (
                <SelectItem key={j.code} value={j.code}>
                  {j.code} - {j.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="jurisdiction_name">Jurisdiction Name *</Label>
          <Input
            id="jurisdiction_name"
            value={formData.jurisdiction_name}
            onChange={(e) => handleChange("jurisdiction_name", e.target.value)}
            placeholder="e.g., United States"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Describe what makes this jurisdiction different..."
          rows={2}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label className="mb-2 block">Parameter Overrides</Label>
        <div className="space-y-3">
          {Object.entries(formData.overrides).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <span className="text-sm font-medium text-slate-700 flex-1">{key}</span>
              <Badge variant="outline" className="font-mono">{value}</Badge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleRemoveOverride(key)}
                className="text-red-600 h-8 w-8"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2 p-3 border-2 border-dashed border-slate-200 rounded-lg">
            <Input
              placeholder="Parameter name (e.g., high_value_threshold)"
              value={overrideKey}
              onChange={(e) => setOverrideKey(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Value (e.g., 750000)"
              value={overrideValue}
              onChange={(e) => setOverrideValue(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAddOverride} variant="outline">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Common overrides: high_value_threshold, currency, reporting_deadline, language
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.jurisdiction_code || !formData.jurisdiction_name}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {jurisdiction ? "Update" : "Add"} Jurisdiction
        </Button>
      </div>
    </div>
  );
}