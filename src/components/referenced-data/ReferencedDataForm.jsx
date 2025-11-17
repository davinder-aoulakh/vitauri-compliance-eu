import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, XCircle } from "lucide-react";

export default function ReferencedDataForm({ item, onSave, onCancel }) {
  const [formData, setFormData] = useState(item || {
    entity_name: "Account",
    field_name: "",
    value: "",
    label: "",
    description: "",
    is_published: true,
    order: 0
  });
  const [saving, setSaving] = useState(false);

  const accountFields = [
    { value: "account_type", label: "Account Type" },
    { value: "account_holder_type", label: "Account Holder Type" },
    { value: "currency", label: "Currency" },
    { value: "reportability_status", label: "Reportability Status" },
    { value: "status", label: "Status" },
    { value: "entity_classification", label: "Entity Classification" }
  ];

  const entityFields = [
    { value: "entity_type", label: "Entity Type" },
    { value: "rfi_status", label: "RFI Status" },
    { value: "fi_type", label: "FI Type" },
    { value: "status", label: "Status" }
  ];

  const globalFields = [
    { value: "country", label: "Country" },
    { value: "currency", label: "Currency" },
    { value: "language", label: "Language" },
    { value: "timezone", label: "Timezone" }
  ];

  const availableFields = formData.entity_name === "Account" 
    ? accountFields 
    : formData.entity_name === "Entity"
    ? entityFields
    : globalFields;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (item?.id) {
        await base44.entities.ReferencedData.update(item.id, formData);
      } else {
        await base44.entities.ReferencedData.create(formData);
      }
      onSave();
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="entity_name">Entity Type *</Label>
          <Select
            value={formData.entity_name}
            onValueChange={(value) => setFormData({ ...formData, entity_name: value })}
            disabled={!!item?.id}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Account">Account</SelectItem>
              <SelectItem value="Entity">Entity</SelectItem>
              <SelectItem value="Global">Global (Cross-Entity)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="field_name">Field Name *</Label>
          <Select
            value={formData.field_name}
            onValueChange={(value) => setFormData({ ...formData, field_name: value })}
            disabled={!!item?.id}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select field..." />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map((field) => (
                <SelectItem key={field.value} value={field.value}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="value">Value *</Label>
          <Input
            id="value"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            placeholder="e.g., depository"
            className="mt-1.5"
          />
          <p className="text-xs text-slate-500 mt-1">
            Technical value stored in database (lowercase, no spaces)
          </p>
        </div>

        <div>
          <Label htmlFor="label">Display Label *</Label>
          <Input
            id="label"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            placeholder="e.g., Depository Account"
            className="mt-1.5"
          />
          <p className="text-xs text-slate-500 mt-1">
            User-facing label shown in dropdown
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional help text explaining this option"
          className="mt-1.5"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="order">Display Order</Label>
          <Input
            id="order"
            type="number"
            value={formData.order}
            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
            className="mt-1.5"
          />
          <p className="text-xs text-slate-500 mt-1">
            Order in which this option appears in dropdown
          </p>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <Checkbox
            id="is_published"
            checked={formData.is_published}
            onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
          />
          <Label htmlFor="is_published" className="cursor-pointer">
            Published (visible to all tenants)
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={saving || !formData.value || !formData.label || !formData.field_name}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Option"}
        </Button>
      </div>
    </div>
  );
}