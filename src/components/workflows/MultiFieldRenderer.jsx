import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";

export default function MultiFieldRenderer({ fields = [], values = {}, onChange, errors = {} }) {
  const [referencedDataCache, setReferencedDataCache] = useState({});

  // Collect all unique referenced_data_keys
  const referencedKeys = fields
    .filter(f => f.field_type === "select" && f.referenced_data_key)
    .map(f => f.referenced_data_key);

  // Fetch referenced data for all keys
  const { data: allReferencedData } = useQuery({
    queryKey: ['multi-field-referenced-data', referencedKeys],
    queryFn: async () => {
      const cache = {};
      
      for (const key of referencedKeys) {
        const [source, ...rest] = key.split('.');
        
        if (source === 'CrsCountryInfo') {
          const countries = await base44.entities.CrsCountryInfo.list();
          cache[key] = countries.map(c => ({
            value: c.country_code,
            label: c.country_name
          }));
        } else if (source === 'ReferencedData') {
          const entityName = rest[0];
          const fieldName = rest[1];
          const data = await base44.entities.ReferencedData.filter({
            entity_name: entityName,
            field_name: fieldName,
            is_published: true
          });
          cache[key] = data.map(d => ({
            value: d.value,
            label: d.label
          }));
        }
      }
      
      return cache;
    },
    enabled: referencedKeys.length > 0
  });

  useEffect(() => {
    if (allReferencedData) {
      setReferencedDataCache(allReferencedData);
    }
  }, [allReferencedData]);

  const handleFieldChange = (fieldId, value) => {
    onChange({
      ...values,
      [fieldId]: value
    });
  };

  const getSelectOptions = (field) => {
    if (field.referenced_data_key && referencedDataCache[field.referenced_data_key]) {
      return referencedDataCache[field.referenced_data_key];
    }
    return field.options || [];
  };

  const renderField = (field) => {
    const value = values[field.field_id];
    const error = errors[field.field_id];
    const options = getSelectOptions(field);

    switch (field.field_type) {
      case "text":
      case "email":
        return (
          <Input
            type={field.field_type === "email" ? "email" : "text"}
            value={value || ""}
            onChange={(e) => handleFieldChange(field.field_id, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.display_label.toLowerCase()}`}
            className={error ? "border-red-500" : ""}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) => handleFieldChange(field.field_id, e.target.value)}
            placeholder={field.placeholder || "Enter number"}
            className={error ? "border-red-500" : ""}
          />
        );

      case "textarea":
        return (
          <Textarea
            value={value || ""}
            onChange={(e) => handleFieldChange(field.field_id, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.display_label.toLowerCase()}`}
            rows={3}
            className={error ? "border-red-500" : ""}
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={value || ""}
            onChange={(e) => handleFieldChange(field.field_id, e.target.value)}
            className={error ? "border-red-500" : ""}
          />
        );

      case "boolean":
        return (
          <RadioGroup
            value={value === true || value === "YES" || value === "true" ? "YES" : value === false || value === "NO" || value === "false" ? "NO" : ""}
            onValueChange={(val) => handleFieldChange(field.field_id, val === "YES")}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="YES" id={`${field.field_id}-yes`} />
              <Label htmlFor={`${field.field_id}-yes`} className="font-normal cursor-pointer">
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="NO" id={`${field.field_id}-no`} />
              <Label htmlFor={`${field.field_id}-no`} className="font-normal cursor-pointer">
                No
              </Label>
            </div>
          </RadioGroup>
        );

      case "select":
        return (
          <Select
            value={value || ""}
            onValueChange={(val) => handleFieldChange(field.field_id, val)}
          >
            <SelectTrigger className={error ? "border-red-500" : ""}>
              <SelectValue placeholder={field.placeholder || `Select ${field.display_label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <SelectItem value={null} disabled>
                  No options available
                </SelectItem>
              ) : (
                options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        );

      default:
        return (
          <Input
            value={value || ""}
            onChange={(e) => handleFieldChange(field.field_id, e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  };

  // Check if a field should be visible based on conditional visibility rules
  const isFieldVisible = (field) => {
    if (!field.conditional_visibility) return true;
    
    const dependsOnField = field.conditional_visibility.depends_on_field;
    const requiredValue = field.conditional_visibility.required_value;
    const dependsOnValue = values[dependsOnField];
    
    // For boolean fields, compare "yes"/"no" strings (case insensitive)
    if (requiredValue === "yes" || requiredValue === "no") {
      const normalizedValue = typeof dependsOnValue === 'boolean' 
        ? (dependsOnValue ? "yes" : "no")
        : (dependsOnValue === "YES" || dependsOnValue === true ? "yes" : "no");
      return normalizedValue === requiredValue.toLowerCase();
    }
    
    // For other fields, direct comparison
    return dependsOnValue === requiredValue;
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const isVisible = isFieldVisible(field);
        if (!isVisible) return null;
        const error = errors[field.field_id];
        
        return (
          <div key={field.field_id} className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-slate-700">
                {field.display_label}
              </Label>
              {field.is_required && (
                <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                  Required
                </Badge>
              )}
            </div>
            
            {renderField(field)}
            
            {error && (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}