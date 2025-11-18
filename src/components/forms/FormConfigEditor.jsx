import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
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
  Settings,
  CheckCircle2
} from "lucide-react";

export default function FormConfigEditor({ config, onSave, onCancel }) {
  const [formData, setFormData] = useState(
    config ? JSON.parse(JSON.stringify(config)) : {
      form_name: "",
      entity_type: "Account",
      version: "1.0",
      fields_config: [],
      layout_config: { columns: 2, sections: [] }
    }
  );
  const [saving, setSaving] = useState(false);
  const [expandedField, setExpandedField] = useState(null);

  // Update formData when config changes
  useEffect(() => {
    if (config) {
      setFormData(JSON.parse(JSON.stringify(config)));
    }
  }, [config]);

  // Fetch all available referenced data lists
  const { data: referencedData = [] } = useQuery({
    queryKey: ['referenced-data-all'],
    queryFn: () => base44.entities.ReferencedData.list()
  });

  // Get unique field names grouped by entity
  const availableReferencedLists = React.useMemo(() => {
    const grouped = referencedData.reduce((acc, item) => {
      if (!acc[item.entity_name]) {
        acc[item.entity_name] = new Set();
      }
      acc[item.entity_name].add(item.field_name);
      return acc;
    }, {});

    return Object.entries(grouped).map(([entityName, fieldNames]) => ({
      entityName,
      fields: Array.from(fieldNames).sort()
    }));
  }, [referencedData]);

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
    
    // Ensure the update is immediately reflected
    const newFormData = { ...formData, fields_config: updatedFields };
    setFormData(newFormData);
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

  const validateConfiguration = () => {
    const errors = [];
    
    if (!formData.form_name?.trim()) {
      errors.push("Form name is required");
    }
    
    if (!formData.entity_type) {
      errors.push("Entity type is required");
    }
    
    if (formData.fields_config.length === 0) {
      errors.push("At least one field is required");
    }
    
    // Check for duplicate field names
    const fieldNames = formData.fields_config.map(f => f.field_name);
    const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate field names: ${duplicates.join(', ')}`);
    }
    
    return errors;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Make a deep copy to ensure we have the latest state
      const saveData = JSON.parse(JSON.stringify(formData));
      
      console.log("Saving form config:", saveData);
      console.log("Fields config:", saveData.fields_config);
      
      if (config?.id) {
        await base44.entities.FormConfiguration.update(config.id, saveData);
      } else {
        await base44.entities.FormConfiguration.create(saveData);
      }
      onSave();
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save configuration: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const errors = validateConfiguration();
    
    if (errors.length > 0) {
      alert("Cannot publish configuration:\n\n" + errors.join('\n'));
      return;
    }
    
    if (!confirm("Publish this configuration? This will:\n\n1. Archive any currently published configuration for this entity type\n2. Make this configuration active for all tenants\n3. Set version and publish metadata")) {
      return;
    }
    
    setSaving(true);
    try {
      // Make a deep copy to ensure we have the absolute latest state
      const currentFormData = JSON.parse(JSON.stringify(formData));
      
      console.log("Publishing form config:", currentFormData);
      console.log("ALL FIELDS:", currentFormData.fields_config.map(f => ({
        field_name: f.field_name,
        field_type: f.field_type,
        referenced_data_key: f.referenced_data_key || 'NOT SET'
      })));
      console.log("Fields with referenced_data_key:", 
        currentFormData.fields_config.filter(f => f.referenced_data_key).map(f => ({
          field_name: f.field_name,
          referenced_data_key: f.referenced_data_key
        }))
      );
      
      // First, fetch all published configs for this entity type
      const publishedConfigs = await base44.entities.FormConfiguration.filter({
        entity_type: currentFormData.entity_type,
        is_published: true
      });
      
      // Archive them (unpublish)
      for (const pubConfig of publishedConfigs) {
        if (pubConfig.id !== config?.id) {
          await base44.entities.FormConfiguration.update(pubConfig.id, {
            is_published: false
          });
        }
      }
      
      // Save or update current config with published flag
      const publishData = {
        ...currentFormData,
        is_published: true,
        published_date: new Date().toISOString(),
        published_by: (await base44.auth.me()).email
      };
      
      console.log("Final publishData being saved:", publishData);
      
      if (config?.id) {
        await base44.entities.FormConfiguration.update(config.id, publishData);
        console.log("Updated existing config:", config.id);
      } else {
        const created = await base44.entities.FormConfiguration.create(publishData);
        console.log("Created new config:", created);
      }
      
      onSave();
    } catch (error) {
      console.error("Publish error:", error);
      alert("Failed to publish configuration: " + error.message);
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

                    {/* Referenced Data Key Selection - show when field type is select */}
                    {field.field_type === 'select' && (
                      <div className="mt-4 pl-6 border-l-2 border-green-200">
                        <Label className="text-xs font-semibold text-green-800">Data Source (Referenced List)</Label>
                        <Select
                          value={field.referenced_data_key || ""}
                          onValueChange={(value) => handleUpdateField(index, 'referenced_data_key', value)}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select a referenced data list..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableReferencedLists.map((group) => (
                              <React.Fragment key={group.entityName}>
                                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50">
                                  {group.entityName}
                                </div>
                                {group.fields.map((fieldName) => (
                                  <SelectItem key={`${group.entityName}.${fieldName}`} value={`${group.entityName}.${fieldName}`}>
                                    {fieldName}
                                  </SelectItem>
                                ))}
                              </React.Fragment>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.referenced_data_key && (
                          <Badge variant="outline" className="mt-2 text-xs bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Using: {field.referenced_data_key.split('.')[1] || field.referenced_data_key}
                          </Badge>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          Choose which referenced data list provides options for this dropdown
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-3">
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            variant="outline"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save as Draft"}
          </Button>
          <Button 
            onClick={handlePublish} 
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {saving ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}