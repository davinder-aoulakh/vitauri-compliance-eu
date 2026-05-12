import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GitBranch, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ConditionalLogicBuilder({ 
  conditionalLogic, 
  onChange, 
  availableSteps = [] 
}) {
  const handleAddCondition = () => {
    const newLogic = {
      ...conditionalLogic,
      conditions: [
        ...(conditionalLogic?.conditions || []),
        {
          field: "",
          operator: "=",
          value: "",
          value_type: "static",
          logic_operator: "AND"
        }
      ]
    };
    onChange(newLogic);
  };

  const handleRemoveCondition = (index) => {
    const newLogic = {
      ...conditionalLogic,
      conditions: conditionalLogic.conditions.filter((_, i) => i !== index)
    };
    onChange(newLogic);
  };

  const handleUpdateCondition = (index, field, value) => {
    const newConditions = [...(conditionalLogic?.conditions || [])];
    newConditions[index] = { ...newConditions[index], [field]: value };
    onChange({ ...conditionalLogic, conditions: newConditions });
  };

  const handleUpdatePath = (field, value) => {
    onChange({ ...conditionalLogic, [field]: value });
  };

  const conditions = conditionalLogic?.conditions || [];

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-xs text-blue-900">
          <strong>Conditional Logic:</strong> Define complex branching rules based on multiple conditions. 
          Use AND/OR operators to combine conditions. If all conditions match, go to "Then" step, otherwise go to "Else" step.
        </AlertDescription>
      </Alert>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-600" />
            Conditions ({conditions.length})
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddCondition}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Condition
          </Button>
        </div>

        {conditions.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded border border-slate-200">
            No conditions defined. Add a condition to start building logic.
          </p>
        ) : (
          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <Card key={index} className="bg-purple-50 border-purple-200">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-purple-100 text-purple-800">
                      Condition {index + 1}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCondition(index)}
                      className="h-6 w-6 text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Field (Step ID) */}
                    <div>
                      <Label className="text-xs">Step ID / Field</Label>
                      <Select
                        value={condition.field}
                        onValueChange={(value) => handleUpdateCondition(index, "field", value)}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Select step..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSteps.map((step) => {
                            // If step has multi_fields, create sub-options for each field
                            if (step.multi_fields && step.multi_fields.length > 0) {
                              return [
                                <SelectItem key={step.step_id} value={step.step_id}>
                                  {step.step_title || step.step_id} (All)
                                </SelectItem>,
                                ...step.multi_fields.map((field) => (
                                  <SelectItem 
                                    key={`${step.step_id}.${field.field_id}`} 
                                    value={`${step.step_id}.${field.field_id}`}
                                    className="pl-6"
                                  >
                                    ↳ {field.display_label}
                                  </SelectItem>
                                ))
                              ];
                            }
                            // Regular step
                            return (
                              <SelectItem key={step.step_id} value={step.step_id}>
                                {step.step_title || step.step_id}
                              </SelectItem>
                            );
                          })}
                          <SelectItem value="custom">Custom Field</SelectItem>
                        </SelectContent>
                      </Select>
                      {condition.field === "custom" && (
                        <Input
                          value={condition.field}
                          onChange={(e) => handleUpdateCondition(index, "field", e.target.value)}
                          placeholder="field_name"
                          className="h-7 text-xs mt-1"
                        />
                      )}
                    </div>

                    {/* Operator */}
                    <div>
                      <Label className="text-xs">Operator</Label>
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => handleUpdateCondition(index, "operator", value)}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="=">Equals (=)</SelectItem>
                          <SelectItem value="!=">Not Equals (≠)</SelectItem>
                          <SelectItem value=">">Greater Than (&gt;)</SelectItem>
                          <SelectItem value="<">Less Than (&lt;)</SelectItem>
                          <SelectItem value=">=">Greater or Equal (&gt;=)</SelectItem>
                          <SelectItem value="<=">Less or Equal (&lt;=)</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="in">In (comma-separated)</SelectItem>
                          <SelectItem value="not_in">Not In (comma-separated)</SelectItem>
                          <SelectItem value="is_crs">Is CRS Country 🌍</SelectItem>
                          <SelectItem value="is_not_crs">Is Not CRS Country</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Value Type */}
                    <div>
                      <Label className="text-xs">Value Type</Label>
                      <Select
                        value={condition.value_type || "static"}
                        onValueChange={(value) => {
                          // Update the condition with new value_type - single update to preserve value_type
                          const newConditions = [...(conditionalLogic?.conditions || [])];
                          newConditions[index] = { 
                            ...newConditions[index], 
                            value_type: value,
                            value: "" // Clear value when switching types
                          };
                          onChange({ ...conditionalLogic, conditions: newConditions });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="static">Static Value</SelectItem>
                          <SelectItem value="field_reference">Field Reference</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Value */}
                  <div>
                    <Label className="text-xs">Value</Label>
                    {condition.value_type === "field_reference" ? (
                      <Select
                        value={condition.value}
                        onValueChange={(value) => handleUpdateCondition(index, "value", value)}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Select field to compare..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSteps.map((step) => {
                            // If step has multi_fields, create sub-options for each field
                            if (step.multi_fields && step.multi_fields.length > 0) {
                              return [
                                <SelectItem key={step.step_id} value={step.step_id}>
                                  {step.step_title || step.step_id} (All)
                                </SelectItem>,
                                ...step.multi_fields.map((field) => (
                                  <SelectItem 
                                    key={`${step.step_id}.${field.field_id}`} 
                                    value={`${step.step_id}.${field.field_id}`}
                                    className="pl-6"
                                  >
                                    ↳ {field.display_label}
                                  </SelectItem>
                                ))
                              ];
                            }
                            // Regular step
                            return (
                              <SelectItem key={step.step_id} value={step.step_id}>
                                {step.step_title || step.step_id}
                              </SelectItem>
                            );
                          })}
                          <SelectItem value="current_address.country">Current Address Country</SelectItem>
                          <SelectItem value="account_holder_address.country">Account Holder Address Country</SelectItem>
                          <SelectItem value="country_of_residence">Country of Residence</SelectItem>
                          <SelectItem value="place_of_birth">Place of Birth</SelectItem>
                          <SelectItem value="country_of_incorporation">Country of Incorporation (Entity)</SelectItem>
                          <SelectItem value="tax_residencies.country">Tax Residency - Country of Tax Residence 🌍</SelectItem>
                          <SelectItem value="tax_residencies.tin">Tax Residency - TIN</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={condition.value}
                        onChange={(e) => handleUpdateCondition(index, "value", e.target.value)}
                        placeholder={condition.operator === "is_crs" || condition.operator === "is_not_crs" ? "N/A (CRS lookup)" : "value or values"}
                        disabled={condition.operator === "is_crs" || condition.operator === "is_not_crs"}
                        className="h-8 text-xs mt-1"
                      />
                    )}
                  </div>

                  {/* Logic Operator (AND/OR) - only show if not last condition */}
                  {index < conditions.length - 1 && (
                    <div>
                      <Label className="text-xs">Combine with next condition using:</Label>
                      <Select
                        value={condition.logic_operator || "AND"}
                        onValueChange={(value) => handleUpdateCondition(index, "logic_operator", value)}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND (both must match)</SelectItem>
                          <SelectItem value="OR">OR (either can match)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Paths */}
      {conditions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div>
            <Label className="text-xs font-semibold text-green-700">
              Then (conditions match)
            </Label>
            <Select
              value={conditionalLogic?.next_step || ""}
              onValueChange={(value) => handleUpdatePath("next_step", value)}
            >
              <SelectTrigger className="h-8 text-xs mt-1 border-green-300">
                <SelectValue placeholder="Select next step..." />
              </SelectTrigger>
              <SelectContent>
                {availableSteps.map((step) => (
                  <SelectItem key={step.step_id} value={step.step_id}>
                    {step.step_title || step.step_id}
                  </SelectItem>
                ))}
                <SelectItem value="complete">Complete Workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-red-700">
              Else (conditions don't match)
            </Label>
            <Select
              value={conditionalLogic?.else_step || ""}
              onValueChange={(value) => handleUpdatePath("else_step", value)}
            >
              <SelectTrigger className="h-8 text-xs mt-1 border-red-300">
                <SelectValue placeholder="Select next step..." />
              </SelectTrigger>
              <SelectContent>
                {availableSteps.map((step) => (
                  <SelectItem key={step.step_id} value={step.step_id}>
                    {step.step_title || step.step_id}
                  </SelectItem>
                ))}
                <SelectItem value="complete">Complete Workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}