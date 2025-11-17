import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XCircle, Save, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DynamicFormRenderer({ 
  entityType, 
  initialData, 
  onSubmit, 
  onCancel,
  additionalFields
}) {
  const [formData, setFormData] = useState(initialData || {});
  const [loading, setLoading] = useState(true);

  // Fetch published form configuration
  const { data: formConfigs = [], isLoading: configLoading } = useQuery({
    queryKey: ['form-configuration', entityType],
    queryFn: async () => {
      const configs = await base44.entities.FormConfiguration.filter({
        entity_type: entityType,
        is_published: true
      });
      return configs.sort((a, b) => 
        parseFloat(b.version || "1.0") - parseFloat(a.version || "1.0")
      );
    }
  });

  // Fetch all published referenced data
  const { data: referencedData = [], isLoading: dataLoading } = useQuery({
    queryKey: ['referenced-data', entityType],
    queryFn: async () => {
      return await base44.entities.ReferencedData.filter({
        entity_name: entityType,
        is_published: true
      });
    }
  });

  useEffect(() => {
    setLoading(configLoading || dataLoading);
  }, [configLoading, dataLoading]);

  const config = formConfigs[0]; // Use latest published config

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!config) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <AlertDescription className="text-amber-900">
          No published form configuration found for {entityType}. Using default form.
        </AlertDescription>
      </Alert>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const getOptionsForField = (fieldName) => {
    const options = referencedData
      .filter(rd => rd.field_name === fieldName)
      .sort((a, b) => a.order - b.order);
    
    return options.map(opt => ({
      value: opt.value,
      label: opt.label,
      description: opt.description
    }));
  };

  const renderField = (field) => {
    if (!field.is_visible) return null;

    const value = formData[field.field_name] || "";
    const options = field.field_type === "select" ? getOptionsForField(field.field_name) : [];

    switch (field.field_type) {
      case "text":
      case "email":
        return (
          <div key={field.field_name}>
            <Label htmlFor={field.field_name}>
              {field.display_label} {field.is_required && "*"}
            </Label>
            <Input
              id={field.field_name}
              type={field.field_type}
              value={value}
              onChange={(e) => handleChange(field.field_name, e.target.value)}
              placeholder={field.placeholder}
              required={field.is_required}
              className="mt-1.5"
            />
            {field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      case "number":
        return (
          <div key={field.field_name}>
            <Label htmlFor={field.field_name}>
              {field.display_label} {field.is_required && "*"}
            </Label>
            <Input
              id={field.field_name}
              type="number"
              value={value}
              onChange={(e) => handleChange(field.field_name, parseFloat(e.target.value) || 0)}
              placeholder={field.placeholder}
              required={field.is_required}
              min={field.validation?.min}
              max={field.validation?.max}
              className="mt-1.5"
            />
            {field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      case "date":
        return (
          <div key={field.field_name}>
            <Label htmlFor={field.field_name}>
              {field.display_label} {field.is_required && "*"}
            </Label>
            <Input
              id={field.field_name}
              type="date"
              value={value}
              onChange={(e) => handleChange(field.field_name, e.target.value)}
              required={field.is_required}
              className="mt-1.5"
            />
            {field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      case "select":
        return (
          <div key={field.field_name}>
            <Label htmlFor={field.field_name}>
              {field.display_label} {field.is_required && "*"}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleChange(field.field_name, val)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={field.placeholder || `Select ${field.display_label}...`} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      case "boolean":
        return (
          <div key={field.field_name} className="flex items-center gap-2">
            <Checkbox
              id={field.field_name}
              checked={value === true}
              onCheckedChange={(checked) => handleChange(field.field_name, checked)}
            />
            <Label htmlFor={field.field_name} className="cursor-pointer">
              {field.display_label} {field.is_required && "*"}
            </Label>
            {field.help_text && (
              <p className="text-xs text-slate-500 ml-2">({field.help_text})</p>
            )}
          </div>
        );

      case "textarea":
        return (
          <div key={field.field_name}>
            <Label htmlFor={field.field_name}>
              {field.display_label} {field.is_required && "*"}
            </Label>
            <Textarea
              id={field.field_name}
              value={value}
              onChange={(e) => handleChange(field.field_name, e.target.value)}
              placeholder={field.placeholder}
              required={field.is_required}
              className="mt-1.5"
              rows={4}
            />
            {field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const visibleFields = config.fields_config
    .filter(f => f.is_visible)
    .sort((a, b) => a.order - b.order);

  const columns = config.layout_config?.columns || 2;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <AlertDescription className="text-sm text-blue-900">
          Form: <strong>{config.form_name}</strong> (v{config.version})
        </AlertDescription>
      </Alert>

      <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-4`}>
        {visibleFields.map(field => renderField(field))}
      </div>

      {additionalFields && (
        <div className="border-t pt-6">
          {additionalFields}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          {initialData?.id ? "Update" : "Create"} {entityType}
        </Button>
      </div>
    </form>
  );
}