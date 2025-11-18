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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Info, Upload, FileText, Globe } from "lucide-react";

export default function FormPreview({ config }) {
  if (!config || !config.fields_config) {
    return <div className="p-8 text-center text-slate-500">No configuration to preview</div>;
  }

  const visibleFields = config.fields_config.filter(f => f.is_visible);
  const columns = config.layout_config?.columns || 2;
  const sections = config.layout_config?.sections || [];
  const hasSections = sections.length > 0;

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
            {field.help_text && (
              <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
            )}
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

      case 'tax_residency':
        return (
          <div key={field.field_name} className="col-span-full">
            <Card className="border-slate-200">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  {labelText}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-900">
                    {field.help_text || "Tax residency information will be managed here"}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        );

      case 'file_upload':
        return (
          <div key={field.field_name} className="col-span-full">
            <Label>{labelText}</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center mt-2 border-slate-300 bg-slate-50">
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6 text-indigo-600" />
              </div>
              <p className="text-sm font-medium text-slate-700 mb-1">
                {field.help_text || "File upload area"}
              </p>
              <p className="text-xs text-slate-500">
                PDF, JPG, PNG up to 10MB
              </p>
            </div>
          </div>
        );

      case 'info_section':
        return (
          <div key={field.field_name} className="col-span-full">
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="w-5 h-5 text-blue-600" />
              <AlertDescription>
                <h3 className="font-semibold text-blue-900 mb-1">{field.display_label}</h3>
                {field.help_text && (
                  <p className="text-sm text-blue-800">{field.help_text}</p>
                )}
              </AlertDescription>
            </Alert>
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

  const fieldsBySection = hasSections 
    ? sections.reduce((acc, section) => {
        acc[section.section_name] = visibleFields.filter(
          f => f.section === section.section_name
        );
        return acc;
      }, {})
    : { main: visibleFields };

  const renderFieldGrid = (fields) => (
    <div 
      className="grid gap-4"
      style={{ 
        gridTemplateColumns: `repeat(${columns}, 1fr)` 
      }}
    >
      {fields
        .sort((a, b) => a.order - b.order)
        .map(renderField)}
    </div>
  );

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
          {hasSections ? (
            <Tabs defaultValue={sections[0]?.section_name} className="space-y-4">
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}>
                {sections
                  .sort((a, b) => a.order - b.order)
                  .map(section => (
                    <TabsTrigger key={section.section_name} value={section.section_name}>
                      {section.section_label}
                    </TabsTrigger>
                  ))}
              </TabsList>
              {sections
                .sort((a, b) => a.order - b.order)
                .map(section => (
                  <TabsContent key={section.section_name} value={section.section_name} className="space-y-4">
                    {renderFieldGrid(fieldsBySection[section.section_name] || [])}
                  </TabsContent>
                ))}
            </Tabs>
          ) : (
            renderFieldGrid(visibleFields)
          )}
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