import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";

export default function FormPreview({ config }) {
  if (!config || !config.fields_config) {
    return <div className="p-8 text-center text-slate-500">No configuration to preview</div>;
  }

  const visibleFields = config.fields_config.filter(f => f.is_visible);
  const columns = config.layout_config?.columns || 2;

  const renderField = (field) => {
    const labelText = field.display_label + (field.is_required ? ' *' : '');

    switch (field.field_type) {
      case 'textarea':
        return (
          <div key={field.field_name}>
            <Label>{labelText}</Label>
            <Textarea 
              placeholder={field.placeholder}
              disabled
              className="mt-1.5"
            />
            {field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={field.field_name} className="flex items-center gap-2">
            <Checkbox disabled />
            <Label>{labelText}</Label>
          </div>
        );

      case 'select':
        return (
          <div key={field.field_name}>
            <Label>{labelText}</Label>
            <Select disabled>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={field.placeholder || "Select..."} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt, idx) => (
                  <SelectItem key={idx} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={field.field_name}>
            <Label>{labelText}</Label>
            <Input
              type={field.field_type}
              placeholder={field.placeholder}
              disabled
              className="mt-1.5"
            />
            {field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            Form Preview: {config.form_name}
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">{config.entity_type}</Badge>
            <Badge variant="outline">v{config.version}</Badge>
            <Badge variant="outline">{visibleFields.length} visible fields</Badge>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div 
            className="grid gap-4"
            style={{ 
              gridTemplateColumns: `repeat(${columns}, 1fr)` 
            }}
          >
            {visibleFields
              .sort((a, b) => a.order - b.order)
              .map(renderField)}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-amber-100 bg-amber-50/30">
        <CardContent className="p-4">
          <p className="text-sm text-amber-900">
            <strong>Note:</strong> This is a preview only. All fields are disabled. 
            The actual form will be functional when used by tenants.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}