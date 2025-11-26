import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  GripVertical,
  Database,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  Mail,
  AlignLeft
} from "lucide-react";

const FIELD_TYPES = [
  { value: "text", label: "Text", icon: Type },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: Calendar },
  { value: "boolean", label: "Yes/No", icon: ToggleLeft },
  { value: "select", label: "Dropdown", icon: List },
  { value: "email", label: "Email", icon: Mail },
  { value: "textarea", label: "Text Area", icon: AlignLeft },
];

export default function MultiFieldEditor({ fields = [], onChange }) {
  // Fetch available referenced data keys
  const { data: referencedData = [] } = useQuery({
    queryKey: ['referenced-data-keys'],
    queryFn: async () => {
      const data = await base44.entities.ReferencedData.filter({ is_published: true });
      // Get unique entity_name.field_name combinations
      const uniqueKeys = [...new Set(data.map(d => `ReferencedData.${d.entity_name}.${d.field_name}`))];
      return uniqueKeys.sort();
    }
  });

  // Fetch CRS countries as a data source option
  const { data: crsCountries = [] } = useQuery({
    queryKey: ['crs-countries-keys'],
    queryFn: async () => {
      const data = await base44.entities.CrsCountryInfo.list();
      return data.length > 0 ? ['CrsCountryInfo.country_name'] : [];
    }
  });

  const allDataSources = [...crsCountries, ...referencedData];

  const handleAddField = () => {
    const newField = {
      field_id: `field_${Date.now()}`,
      display_label: "",
      field_type: "text",
      placeholder: "",
      is_required: false,
      referenced_data_key: "",
      options: []
    };
    onChange([...fields, newField]);
  };

  const handleUpdateField = (index, key, value) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    
    // Clear referenced_data_key if field_type is not select
    if (key === "field_type" && value !== "select") {
      updated[index].referenced_data_key = "";
      updated[index].options = [];
    }
    
    onChange(updated);
  };

  const handleRemoveField = (index) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const handleAddStaticOption = (fieldIndex) => {
    const updated = [...fields];
    const currentOptions = updated[fieldIndex].options || [];
    updated[fieldIndex].options = [...currentOptions, { value: "", label: "" }];
    onChange(updated);
  };

  const handleUpdateStaticOption = (fieldIndex, optionIndex, key, value) => {
    const updated = [...fields];
    updated[fieldIndex].options[optionIndex][key] = value;
    onChange(updated);
  };

  const handleRemoveStaticOption = (fieldIndex, optionIndex) => {
    const updated = [...fields];
    updated[fieldIndex].options = updated[fieldIndex].options.filter((_, i) => i !== optionIndex);
    onChange(updated);
  };

  const getFieldTypeIcon = (type) => {
    const fieldType = FIELD_TYPES.find(ft => ft.value === type);
    return fieldType?.icon || Type;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          Multi-Field Configuration
        </Label>
        <Button size="sm" onClick={handleAddField} variant="outline">
          <Plus className="w-3 h-3 mr-1" />
          Add Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg bg-slate-50">
          <Database className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-600 mb-2">No fields defined yet</p>
          <Button size="sm" onClick={handleAddField} variant="outline">
            <Plus className="w-3 h-3 mr-1" />
            Add First Field
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const FieldIcon = getFieldTypeIcon(field.field_type);
            
            return (
              <div
                key={field.field_id}
                className="p-4 border-2 rounded-lg bg-white hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 pt-1">
                    <GripVertical className="w-4 h-4 text-slate-400 cursor-move" />
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <FieldIcon className="w-4 h-4 text-indigo-600" />
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    {/* Row 1: Field ID, Label, Type */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-slate-500">Field ID</Label>
                        <Input
                          value={field.field_id}
                          onChange={(e) => handleUpdateField(index, "field_id", e.target.value)}
                          placeholder="field_id"
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Display Label *</Label>
                        <Input
                          value={field.display_label}
                          onChange={(e) => handleUpdateField(index, "display_label", e.target.value)}
                          placeholder="Enter label"
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Field Type *</Label>
                        <Select
                          value={field.field_type}
                          onValueChange={(value) => handleUpdateField(index, "field_type", value)}
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <type.icon className="w-3 h-3" />
                                  {type.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 2: Placeholder and Required */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs text-slate-500">Placeholder</Label>
                        <Input
                          value={field.placeholder || ""}
                          onChange={(e) => handleUpdateField(index, "placeholder", e.target.value)}
                          placeholder="Enter placeholder text"
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={field.is_required || false}
                            onCheckedChange={(checked) => handleUpdateField(index, "is_required", checked)}
                            id={`required-${field.field_id}`}
                          />
                          <Label 
                            htmlFor={`required-${field.field_id}`} 
                            className="text-xs cursor-pointer"
                          >
                            Required Field
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Conditional: Referenced Data Key for Select fields */}
                    {field.field_type === "select" && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                        <Label className="text-xs font-semibold text-blue-700 flex items-center gap-2">
                          <Database className="w-3 h-3" />
                          Dropdown Options Source
                        </Label>
                        
                        <div>
                          <Label className="text-xs text-slate-600">Link to Referenced Data</Label>
                          <Select
                            value={field.referenced_data_key || ""}
                            onValueChange={(value) => handleUpdateField(index, "referenced_data_key", value)}
                          >
                            <SelectTrigger className="h-8 text-xs mt-1">
                              <SelectValue placeholder="Select data source (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={null}>None (Use Static Options)</SelectItem>
                              {allDataSources.map((key) => (
                                <SelectItem key={key} value={key}>
                                  {key}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-slate-500 mt-1">
                            Link to existing data or define static options below
                          </p>
                        </div>

                        {/* Static Options (if no referenced_data_key) */}
                        {!field.referenced_data_key && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-slate-600">Static Options</Label>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAddStaticOption(index)}
                                className="h-6 text-xs"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add Option
                              </Button>
                            </div>
                            {(field.options || []).map((option, optIdx) => (
                              <div key={optIdx} className="flex gap-2">
                                <Input
                                  value={option.value}
                                  onChange={(e) => handleUpdateStaticOption(index, optIdx, "value", e.target.value)}
                                  placeholder="Value"
                                  className="h-7 text-xs flex-1"
                                />
                                <Input
                                  value={option.label}
                                  onChange={(e) => handleUpdateStaticOption(index, optIdx, "label", e.target.value)}
                                  placeholder="Label"
                                  className="h-7 text-xs flex-1"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleRemoveStaticOption(index, optIdx)}
                                  className="h-7 w-7 text-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

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
            );
          })}
        </div>
      )}

      {fields.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
          <Badge variant="outline" className="text-xs">
            {fields.length} field{fields.length !== 1 ? 's' : ''}
          </Badge>
          <span>
            {fields.filter(f => f.is_required).length} required
          </span>
          <span>•</span>
          <span>
            {fields.filter(f => f.field_type === 'select').length} dropdown{fields.filter(f => f.field_type === 'select').length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}