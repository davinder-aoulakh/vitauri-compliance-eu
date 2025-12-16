import React, { useState } from "react";
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
import { XCircle, Save } from "lucide-react";

export default function CustomValidationRuleForm({ rule, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    rule_name: rule?.rule_name || "",
    description: rule?.description || "",
    target_entity_type: rule?.target_entity_type || "Account",
    severity: rule?.severity || "medium",
    rule_type: rule?.rule_type || "field_validation",
    field_name: rule?.field_name || "",
    condition: rule?.condition || {
      operator: "equals",
      value: "",
      secondary_value: "",
      field_reference: ""
    },
    error_message: rule?.error_message || "",
    suggested_action: rule?.suggested_action || "",
    is_active: rule?.is_active !== undefined ? rule.is_active : true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConditionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      condition: { ...prev.condition, [field]: value }
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="rule_name">Rule Name *</Label>
        <Input
          id="rule_name"
          value={formData.rule_name}
          onChange={(e) => handleChange("rule_name", e.target.value)}
          placeholder="e.g., High Balance Threshold Check"
          required
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Describe what this rule validates..."
          className="mt-1.5"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="target_entity_type">Target Entity Type *</Label>
          <Select
            value={formData.target_entity_type}
            onValueChange={(value) => handleChange("target_entity_type", value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Account">Account</SelectItem>
              <SelectItem value="Entity">Entity</SelectItem>
              <SelectItem value="ControllingPerson">Controlling Person</SelectItem>
              <SelectItem value="Beneficiary">Beneficiary</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="severity">Severity *</Label>
          <Select
            value={formData.severity}
            onValueChange={(value) => handleChange("severity", value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="rule_type">Rule Type *</Label>
          <Select
            value={formData.rule_type}
            onValueChange={(value) => handleChange("rule_type", value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="field_validation">Field Validation</SelectItem>
              <SelectItem value="cross_field_validation">Cross-Field Validation</SelectItem>
              <SelectItem value="threshold">Threshold</SelectItem>
              <SelectItem value="pattern_match">Pattern Match</SelectItem>
              <SelectItem value="custom_logic">Custom Logic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="field_name">Field Name</Label>
          <Input
            id="field_name"
            value={formData.field_name}
            onChange={(e) => handleChange("field_name", e.target.value)}
            placeholder="e.g., year_end_cash_value"
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="p-4 border-2 border-slate-200 rounded-lg space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Condition</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="operator">Operator</Label>
            <Select
              value={formData.condition.operator}
              onValueChange={(value) => handleConditionChange("operator", value)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="not_equals">Not Equals</SelectItem>
                <SelectItem value="greater_than">Greater Than</SelectItem>
                <SelectItem value="less_than">Less Than</SelectItem>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="not_contains">Not Contains</SelectItem>
                <SelectItem value="is_empty">Is Empty</SelectItem>
                <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
                <SelectItem value="matches_pattern">Matches Pattern</SelectItem>
                <SelectItem value="between">Between</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              value={formData.condition.value}
              onChange={(e) => handleConditionChange("value", e.target.value)}
              placeholder="Comparison value"
              className="mt-1.5"
            />
          </div>
        </div>

        {formData.condition.operator === "between" && (
          <div>
            <Label htmlFor="secondary_value">Upper Bound</Label>
            <Input
              id="secondary_value"
              value={formData.condition.secondary_value}
              onChange={(e) => handleConditionChange("secondary_value", e.target.value)}
              placeholder="Upper bound value"
              className="mt-1.5"
            />
          </div>
        )}

        {formData.rule_type === "cross_field_validation" && (
          <div>
            <Label htmlFor="field_reference">Field Reference</Label>
            <Input
              id="field_reference"
              value={formData.condition.field_reference}
              onChange={(e) => handleConditionChange("field_reference", e.target.value)}
              placeholder="e.g., entity.country_of_incorporation"
              className="mt-1.5"
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="error_message">Error Message</Label>
        <Textarea
          id="error_message"
          value={formData.error_message}
          onChange={(e) => handleChange("error_message", e.target.value)}
          placeholder="Message to display when rule is violated..."
          className="mt-1.5"
          rows={2}
        />
      </div>

      <div>
        <Label htmlFor="suggested_action">Suggested Action</Label>
        <Textarea
          id="suggested_action"
          value={formData.suggested_action}
          onChange={(e) => handleChange("suggested_action", e.target.value)}
          placeholder="Recommended steps to resolve the violation..."
          className="mt-1.5"
          rows={2}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => handleChange("is_active", e.target.checked)}
          className="w-4 h-4"
        />
        <Label htmlFor="is_active" className="cursor-pointer">
          Active (rule will be applied during validation)
        </Label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          {rule ? "Update Rule" : "Create Rule"}
        </Button>
      </div>
    </form>
  );
}