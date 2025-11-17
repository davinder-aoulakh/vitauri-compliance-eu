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
  const [validationErrors, setValidationErrors] = useState({});

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

  // Fetch all published referenced data (entity-specific + global)
  const { data: referencedData = [], isLoading: dataLoading } = useQuery({
    queryKey: ['referenced-data', entityType],
    queryFn: async () => {
      const [entitySpecific, globalData] = await Promise.all([
        base44.entities.ReferencedData.filter({
          entity_name: entityType,
          is_published: true
        }),
        base44.entities.ReferencedData.filter({
          entity_name: "Global",
          is_published: true
        })
      ]);
      return [...entitySpecific, ...globalData];
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

  const evaluateCondition = (condition, allFormData) => {
    if (!condition || !condition.field) return true;
    
    const fieldValue = allFormData[condition.field];
    const compareValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return String(fieldValue) === String(compareValue);
      case 'not_equals':
        return String(fieldValue) !== String(compareValue);
      case 'contains':
        return String(fieldValue).includes(compareValue);
      case 'in':
        return compareValue.split(',').map(v => v.trim()).includes(String(fieldValue));
      case 'not_in':
        return !compareValue.split(',').map(v => v.trim()).includes(String(fieldValue));
      case 'greater_than':
        return parseFloat(fieldValue) > parseFloat(compareValue);
      case 'less_than':
        return parseFloat(fieldValue) < parseFloat(compareValue);
      default:
        return true;
    }
  };

  const validateField = (field, value) => {
    const errors = [];

    // Check required
    const isRequired = field.is_required || evaluateCondition(field.conditional_required, formData);
    if (isRequired && !value) {
      errors.push(`${field.display_label} is required`);
    }

    if (value && field.validation) {
      // Min/Max length for text
      if (field.validation.minLength && String(value).length < field.validation.minLength) {
        errors.push(`Must be at least ${field.validation.minLength} characters`);
      }
      if (field.validation.maxLength && String(value).length > field.validation.maxLength) {
        errors.push(`Must be at most ${field.validation.maxLength} characters`);
      }

      // Min/Max value for numbers
      if (field.validation.min !== undefined && parseFloat(value) < field.validation.min) {
        errors.push(`Must be at least ${field.validation.min}`);
      }
      if (field.validation.max !== undefined && parseFloat(value) > field.validation.max) {
        errors.push(`Must be at most ${field.validation.max}`);
      }

      // Regex pattern
      if (field.validation.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          errors.push(field.validation.patternMessage || 'Invalid format');
        }
      }
    }

    return errors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate all visible and required fields
    const errors = {};
    config.fields_config.forEach(field => {
      const isVisible = field.is_visible && evaluateCondition(field.conditional_visibility, formData);
      if (isVisible) {
        const fieldErrors = validateField(field, formData[field.field_name]);
        if (fieldErrors.length > 0) {
          errors[field.field_name] = fieldErrors;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    onSubmit(formData);
  };

  const handleChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // Clear validation error for this field
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const getOptionsForField = (fieldConfig) => {
    const fieldName = fieldConfig.referenced_data_key || fieldConfig.field_name;
    
    // If referenced_data_key is explicitly set, use it directly (any entity)
    if (fieldConfig.referenced_data_key) {
      const options = referencedData
        .filter(rd => rd.field_name === fieldName)
        .sort((a, b) => a.order - b.order);
      
      return options.map(opt => ({
        value: opt.value,
        label: opt.label,
        description: opt.description
      }));
    }
    
    // Otherwise, use legacy logic (entity-specific first, then global)
    let options = referencedData
      .filter(rd => rd.field_name === fieldName && rd.entity_name === entityType)
      .sort((a, b) => a.order - b.order);
    
    // If no entity-specific options, check for global options
    if (options.length === 0) {
      options = referencedData
        .filter(rd => rd.field_name === fieldName && rd.entity_name === "Global")
        .sort((a, b) => a.order - b.order);
    }
    
    return options.map(opt => ({
      value: opt.value,
      label: opt.label,
      description: opt.description
    }));
  };

  const renderField = (field) => {
    // Check conditional visibility
    const isVisible = field.is_visible && evaluateCondition(field.conditional_visibility, formData);
    if (!isVisible) return null;

    const value = formData[field.field_name] || "";
    const options = field.field_type === "select" ? getOptionsForField(field) : [];
    const isRequired = field.is_required || evaluateCondition(field.conditional_required, formData);
    const fieldErrors = validationErrors[field.field_name];

    switch (field.field_type) {
      case "text":
      case "email":
        return (
          <div key={field.field_name}>
            <Label htmlFor={field.field_name}>
              {field.display_label} {isRequired && "*"}
            </Label>
            <Input
              id={field.field_name}
              type={field.field_type}
              value={value}
              onChange={(e) => handleChange(field.field_name, e.target.value)}
              placeholder={field.placeholder}
              required={isRequired}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
              pattern={field.validation?.pattern}
              className={`mt-1.5 ${fieldErrors ? 'border-red-500' : ''}`}
            />
            {fieldErrors && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.join(', ')}</p>
            )}
            {!fieldErrors && field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      case "number":
        return (
          <div key={field.field_name}>
            <Label htmlFor={field.field_name}>
              {field.display_label} {isRequired && "*"}
            </Label>
            <Input
              id={field.field_name}
              type="number"
              value={value}
              onChange={(e) => handleChange(field.field_name, parseFloat(e.target.value) || 0)}
              placeholder={field.placeholder}
              required={isRequired}
              min={field.validation?.min}
              max={field.validation?.max}
              className={`mt-1.5 ${fieldErrors ? 'border-red-500' : ''}`}
            />
            {fieldErrors && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.join(', ')}</p>
            )}
            {!fieldErrors && field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      case "date":
        return (
          <div key={field.field_name}>
            <Label htmlFor={field.field_name}>
              {field.display_label} {isRequired && "*"}
            </Label>
            <Input
              id={field.field_name}
              type="date"
              value={value}
              onChange={(e) => handleChange(field.field_name, e.target.value)}
              required={isRequired}
              className={`mt-1.5 ${fieldErrors ? 'border-red-500' : ''}`}
            />
            {fieldErrors && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.join(', ')}</p>
            )}
            {!fieldErrors && field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      case "select":
        return (
          <div key={field.field_name}>
            <Label htmlFor={field.field_name}>
              {field.display_label} {isRequired && "*"}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleChange(field.field_name, val)}
            >
              <SelectTrigger className={`mt-1.5 ${fieldErrors ? 'border-red-500' : ''}`}>
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
            {fieldErrors && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.join(', ')}</p>
            )}
            {!fieldErrors && field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      case "boolean":
        return (
          <div key={field.field_name}>
            <div className="flex items-center gap-2">
              <Checkbox
                id={field.field_name}
                checked={value === true}
                onCheckedChange={(checked) => handleChange(field.field_name, checked)}
              />
              <Label htmlFor={field.field_name} className="cursor-pointer">
                {field.display_label} {isRequired && "*"}
              </Label>
            </div>
            {fieldErrors && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.join(', ')}</p>
            )}
            {!fieldErrors && field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      case "textarea":
        return (
          <div key={field.field_name}>
            <Label htmlFor={field.field_name}>
              {field.display_label} {isRequired && "*"}
            </Label>
            <Textarea
              id={field.field_name}
              value={value}
              onChange={(e) => handleChange(field.field_name, e.target.value)}
              placeholder={field.placeholder}
              required={isRequired}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
              className={`mt-1.5 ${fieldErrors ? 'border-red-500' : ''}`}
              rows={4}
            />
            {fieldErrors && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.join(', ')}</p>
            )}
            {!fieldErrors && field.help_text && (
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