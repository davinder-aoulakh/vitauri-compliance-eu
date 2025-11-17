import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  ArrowUp,
  ArrowDown,
  Info,
  Settings
} from "lucide-react";

export default function FormConfigEditor({ config, onSave, onCancel }) {
  const [formData, setFormData] = useState(config || {
    form_name: "",
    entity_type: "Account",
    version: "1.0",
    fields_config: [],
    layout_config: { columns: 2, sections: [] }
  });
  const [saving, setSaving] = useState(false);
  const [expandedField, setExpandedField] = useState(null);

  const baseAccountFields = [
    { name: "account_number", label: "Account Number", type: "text" },
    { name: "account_holder_name", label: "Account Holder Name", type: "text" },
    { name: "account_holder_type", label: "Account Holder Type", type: "select" },
    { name: "account_type", label: "Account Type", type: "select" },
    { name: "account_balance", label: "Account Balance", type: "number" },
    { name: "currency", label: "Currency", type: "text" },
    { name: "date_of_birth", label: "Date of Birth", type: "date" },
    { name: "reporting_year", label: "Reporting Year", type: "text" },
    { name: "reportability_status", label: "Reportability Status", type: "select" },
    { name: "status", label: "Status", type: "select" },
    { name: "entity_classification", label: "Entity Classification", type: "select" }
  ];

  const baseEntityFields = [
    { name: "entity_name", label: "Entity Name", type: "text" },
    { name: "entity_type", label: "Entity Type", type: "select" },
    { name: "country_of_incorporation", label: "Country of Incorporation", type: "text" },
    { name: "tax_id", label: "Tax ID", type: "text" },
    { name: "giin", label: "GIIN", type: "text" },
    { name: "rfi_status", label: "RFI Status", type: "select" },
    { name: "fi_type", label: "FI Type", type: "select" },
    { name: "status", label: "Status", type: "select" }
  ];

  const availableBaseFields = formData.entity_type === "Account" 
    ? baseAccountFields 
    : baseEntityFields;

  const handleAddField = () => {
    const newField = {
      field_name: "custom_field_" + Date.now(),
      display_label: "New Field",
      field_type: "text",
      is_visible: true,
      is_required: false,
      is_custom: true,
      order: formData.fields_config.length,
      section: "basic"
    };

    setFormData({
      ...formData,
      fields_config: [...formData.fields_config, newField]
    });
  };

  const handleAddBaseField = (baseField) => {
    const newField = {
      field_name: baseField.name,
      display_label: baseField.label,
      field_type: baseField.type,
      is_visible: true,
      is_required: false,
      is_custom: false,
      order: formData.fields_config.length,
      section: "basic"
    };

    setFormData({
      ...formData,
      fields_config: [...formData.fields_config, newField]
    });
  };

  const handleUpdateField = (index, field, value) => {
    const updatedFields = [...formData.fields_config];
    updatedFields[index] = { ...updatedFields[index], [field]: value };
    setFormData({ ...formData, fields_config: updatedFields });
  };

  const handleRemoveField = (index) => {
    const updatedFields = formData.fields_config.filter((_, i) => i !== index);
    setFormData({ ...formData, fields_config: updatedFields });
  };

  const handleMoveField = (index, direction) => {
    const updatedFields = [...formData.fields_config];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < updatedFields.length) {
      [updatedFields[index], updatedFields[newIndex]] = [updatedFields[newIndex], updatedFields[index]];
      updatedFields.forEach((field, i) => field.order = i);
      setFormData({ ...formData, fields_config: updatedFields });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config?.id) {
        await base44.entities.FormConfiguration.update(config.id, formData);
      } else {
        await base44.entities.FormConfiguration.create(formData);
      }
      onSave();
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save configuration: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const unusedBaseFields = availableBaseFields.filter(
    bf => !formData.fields_config.some(f => f.field_name === bf.name)
  );

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          Configure form fields by adding base entity fields or creating custom fields. 
          For <strong>select</strong> fields, options are dynamically loaded from Referenced Data.
          Manage dropdown values in the Referenced Data menu.
        </AlertDescription>
      </Alert>

      {/* Basic Config */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base">Form Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Form Name</Label>
              <Input
                value={formData.form_name}
                onChange={(e) => setFormData({ ...formData, form_name: e.target.value })}
                placeholder="e.g., Account Form"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Entity Type</Label>
              <Select
                value={formData.entity_type}
                onValueChange={(value) => setFormData({ ...formData, entity_type: value })}
                disabled={!!config?.id}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Account">Account</SelectItem>
                  <SelectItem value="Entity">Entity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Version</Label>
              <Input
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Fields */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base">Add Fields</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleAddField}
              variant="outline"
              size="sm"
              className="border-2 border-dashed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Field
            </Button>
            
            {unusedBaseFields.map((baseField) => (
              <Button
                key={baseField.name}
                type="button"
                onClick={() => handleAddBaseField(baseField)}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                {baseField.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fields Configuration */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base">
            Form Fields ({formData.fields_config.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {formData.fields_config.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No fields configured. Add fields using the buttons above.
            </div>
          ) : (
            <div className="space-y-3">
              {formData.fields_config.map((field, index) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-12 gap-4 items-start">
                      {/* Order Controls */}
                      <div className="col-span-1 flex flex-col gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleMoveField(index, 'up')}
                          disabled={index === 0}
                          className="h-6 w-6"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleMoveField(index, 'down')}
                          disabled={index === formData.fields_config.length - 1}
                          className="h-6 w-6"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                        <GripVertical className="w-4 h-4 text-slate-400 mx-auto mt-1" />
                      </div>

                      {/* Field Config */}
                      <div className="col-span-10 grid grid-cols-6 gap-3">
                        <div className="col-span-2">
                          <Label className="text-xs">Field Name</Label>
                          <Input
                            value={field.field_name}
                            onChange={(e) => handleUpdateField(index, 'field_name', e.target.value)}
                            disabled={!field.is_custom}
                            className="mt-1"
                            size="sm"
                          />
                          {field.is_custom && (
                            <Badge variant="outline" className="mt-1 text-xs">Custom</Badge>
                          )}
                        </div>

                        <div className="col-span-2">
                          <Label className="text-xs">Display Label</Label>
                          <Input
                            value={field.display_label}
                            onChange={(e) => handleUpdateField(index, 'display_label', e.target.value)}
                            className="mt-1"
                            size="sm"
                          />
                        </div>

                        <div className="col-span-1">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={field.field_type}
                            onValueChange={(value) => handleUpdateField(index, 'field_type', value)}
                          >
                            <SelectTrigger className="mt-1 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="select">Select (Dynamic)</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                              <SelectItem value="textarea">Textarea</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={field.is_visible}
                              onCheckedChange={(checked) => handleUpdateField(index, 'is_visible', checked)}
                            />
                            <Label className="text-xs">Visible</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={field.is_required}
                              onCheckedChange={(checked) => handleUpdateField(index, 'is_required', checked)}
                            />
                            <Label className="text-xs">Required</Label>
                          </div>
                          {field.field_type === 'select' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              Dynamic Options
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <div className="col-span-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveField(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}