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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GitBranch, Settings2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MultiChoiceRoutingBuilder({
  routingGroups = [],
  defaultStep = "",
  availableOptions = [],
  allSteps = [],
  currentStepId = "",
  availableConditionFields = [],
  onGroupsChange,
  onDefaultStepChange
}) {
  const handleAddGroup = () => {
    const newGroup = {
      group_id: `group_${Date.now()}`,
      group_name: "",
      group_operator: "AND",
      conditions: [
        {
          condition_id: `cond_${Date.now()}`,
          condition_type: "selected_options",
          option_values: [],
          count_operator: "=",
          count_value: 1,
          field: "",
          operator: "=",
          value: "",
          value_type: "static"
        }
      ],
      next_step: ""
    };
    onGroupsChange([...routingGroups, newGroup]);
  };

  const handleRemoveGroup = (groupIndex) => {
    onGroupsChange(routingGroups.filter((_, i) => i !== groupIndex));
  };

  const handleGroupChange = (groupIndex, field, value) => {
    const newGroups = [...routingGroups];
    newGroups[groupIndex] = { ...newGroups[groupIndex], [field]: value };
    onGroupsChange(newGroups);
  };

  const handleAddCondition = (groupIndex) => {
    const newGroups = [...routingGroups];
    newGroups[groupIndex].conditions.push({
      condition_id: `cond_${Date.now()}`,
      condition_type: "selected_options",
      option_values: [],
      count_operator: "=",
      count_value: 1,
      field: "",
      operator: "=",
      value: "",
      value_type: "static"
    });
    onGroupsChange(newGroups);
  };

  const handleRemoveCondition = (groupIndex, condIndex) => {
    const newGroups = [...routingGroups];
    newGroups[groupIndex].conditions = newGroups[groupIndex].conditions.filter((_, i) => i !== condIndex);
    onGroupsChange(newGroups);
  };

  const handleConditionChange = (groupIndex, condIndex, field, value) => {
    const newGroups = [...routingGroups];
    newGroups[groupIndex].conditions[condIndex] = {
      ...newGroups[groupIndex].conditions[condIndex],
      [field]: value
    };
    onGroupsChange(newGroups);
  };

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 border-blue-200">
        <GitBranch className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-xs text-blue-900">
          <strong>Multi-Choice Routing Groups:</strong> Create multiple routing rules based on selected options, selection count, or other field conditions. Groups are evaluated in order - the first matching group determines the next step.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          Routing Groups ({routingGroups.length})
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddGroup}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Routing Group
        </Button>
      </div>

      {routingGroups.length === 0 ? (
        <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded border border-slate-200">
          No routing groups defined. Add a group to create advanced multi-choice routing logic.
        </p>
      ) : (
        <div className="space-y-4">
          {routingGroups.map((group, groupIndex) => (
            <Card key={group.group_id} className="bg-indigo-50 border-2 border-indigo-200">
              <CardContent className="p-4 space-y-4">
                {/* Group Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                      Group {groupIndex + 1}
                    </Badge>
                    <Settings2 className="w-4 h-4 text-indigo-600" />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveGroup(groupIndex)}
                    className="h-6 w-6 text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                {/* Group Name & Operator */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Group Name</Label>
                    <Input
                      value={group.group_name}
                      onChange={(e) => handleGroupChange(groupIndex, "group_name", e.target.value)}
                      placeholder="e.g., Route to Active NFE"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Combine Conditions Using</Label>
                    <Select
                      value={group.group_operator}
                      onValueChange={(value) => handleGroupChange(groupIndex, "group_operator", value)}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AND">AND (all must match)</SelectItem>
                        <SelectItem value="OR">OR (any can match)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold">Conditions</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddCondition(groupIndex)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Condition
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {group.conditions.map((condition, condIndex) => (
                      <div key={condition.condition_id} className="p-3 bg-white border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            Condition {condIndex + 1}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveCondition(groupIndex, condIndex)}
                            className="h-6 w-6 text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>

                        {/* Condition Type */}
                        <div>
                          <Label className="text-xs">Condition Type</Label>
                          <Select
                            value={condition.condition_type}
                            onValueChange={(value) => handleConditionChange(groupIndex, condIndex, "condition_type", value)}
                          >
                            <SelectTrigger className="h-8 text-xs mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="selected_options">Selected Options</SelectItem>
                              <SelectItem value="selection_count">Selection Count</SelectItem>
                              <SelectItem value="field_comparison">Field Comparison</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Condition Configuration - Selected Options */}
                        {condition.condition_type === "selected_options" && (
                          <div>
                            <Label className="text-xs mb-2 block">
                              If user selects ANY of these options:
                            </Label>
                            <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded border">
                              {availableOptions.map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`group-${groupIndex}-cond-${condIndex}-opt-${idx}`}
                                    checked={condition.option_values?.includes(opt.value) || false}
                                    onCheckedChange={(checked) => {
                                      const currentValues = condition.option_values || [];
                                      const newValues = checked
                                        ? [...currentValues, opt.value]
                                        : currentValues.filter(v => v !== opt.value);
                                      handleConditionChange(groupIndex, condIndex, "option_values", newValues);
                                    }}
                                  />
                                  <Label htmlFor={`group-${groupIndex}-cond-${condIndex}-opt-${idx}`} className="text-xs cursor-pointer">
                                    {opt.label} ({opt.value})
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Condition Configuration - Selection Count */}
                        {condition.condition_type === "selection_count" && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Operator</Label>
                              <Select
                                value={condition.count_operator}
                                onValueChange={(value) => handleConditionChange(groupIndex, condIndex, "count_operator", value)}
                              >
                                <SelectTrigger className="h-8 text-xs mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="=">Equals (=)</SelectItem>
                                  <SelectItem value="!=">Not Equals (≠)</SelectItem>
                                  <SelectItem value=">">Greater Than (&gt;)</SelectItem>
                                  <SelectItem value="<">Less Than (&lt;)</SelectItem>
                                  <SelectItem value=">=">Greater or Equal (≥)</SelectItem>
                                  <SelectItem value="<=">Less or Equal (≤)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Count</Label>
                              <Input
                                type="number"
                                min="0"
                                value={condition.count_value || 0}
                                onChange={(e) => handleConditionChange(groupIndex, condIndex, "count_value", parseInt(e.target.value) || 0)}
                                placeholder="e.g., 2"
                                className="h-8 text-xs mt-1"
                              />
                            </div>
                          </div>
                        )}

                        {/* Condition Configuration - Field Comparison */}
                        {condition.condition_type === "field_comparison" && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Step ID / Field</Label>
                                <Select
                                  value={condition.field || ""}
                                  onValueChange={(value) => handleConditionChange(groupIndex, condIndex, "field", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue placeholder="Select field..." />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px]">
                                    {Object.entries(availableConditionFields.reduce((acc, field) => {
                                      if (!acc[field.group]) acc[field.group] = [];
                                      acc[field.group].push(field);
                                      return acc;
                                    }, {})).map(([group, fields]) => (
                                      <React.Fragment key={group}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1 first:border-t-0 first:mt-0">
                                          {group}
                                        </div>
                                        {fields.map(field => (
                                          <SelectItem key={`field-${field.value}`} value={field.value}>
                                            {field.label} {field.isCountry && '🌍'}
                                          </SelectItem>
                                        ))}
                                      </React.Fragment>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Operator</Label>
                                <Select
                                  value={condition.operator}
                                  onValueChange={(value) => handleConditionChange(groupIndex, condIndex, "operator", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="=">Equals (=)</SelectItem>
                                    <SelectItem value="!=">Not Equals (≠)</SelectItem>
                                    <SelectItem value=">">Greater Than (&gt;)</SelectItem>
                                    <SelectItem value="<">Less Than (&lt;)</SelectItem>
                                    <SelectItem value=">=">Greater or Equal (≥)</SelectItem>
                                    <SelectItem value="<=">Less or Equal (≤)</SelectItem>
                                    <SelectItem value="contains">Contains</SelectItem>
                                    <SelectItem value="in">In</SelectItem>
                                    <SelectItem value="not_in">Not In</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Value Type</Label>
                                <Select
                                  value={condition.value_type || "static"}
                                  onValueChange={(value) => handleConditionChange(groupIndex, condIndex, "value_type", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="static">Static</SelectItem>
                                    <SelectItem value="field_reference">Field Ref</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">
                                {condition.value_type === 'field_reference' ? 'Reference Field' : 'Value'}
                              </Label>
                              {condition.value_type === 'field_reference' ? (
                                <Select
                                  value={condition.value || ""}
                                  onValueChange={(value) => handleConditionChange(groupIndex, condIndex, "value", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue placeholder="Select field to compare..." />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px]">
                                    {Object.entries(availableConditionFields.reduce((acc, field) => {
                                      if (!acc[field.group]) acc[field.group] = [];
                                      acc[field.group].push(field);
                                      return acc;
                                    }, {})).map(([group, fields]) => (
                                      <React.Fragment key={`ref-${group}`}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1 first:border-t-0 first:mt-0">
                                          {group}
                                        </div>
                                        {fields.map(field => (
                                          <SelectItem key={`ref-${field.value}`} value={field.value}>
                                            {field.label} {field.isCountry && '🌍'}
                                          </SelectItem>
                                        ))}
                                      </React.Fragment>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={condition.value || ""}
                                  onChange={(e) => handleConditionChange(groupIndex, condIndex, "value", e.target.value)}
                                  placeholder="value"
                                  className="h-8 text-xs mt-1"
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Steps for this Group */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                  <div>
                    <Label className="text-xs font-semibold text-green-700">
                      If conditions match → Go to:
                    </Label>
                    <Select
                      value={group.next_step}
                      onValueChange={(value) => handleGroupChange(groupIndex, "next_step", value)}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1 border-green-300">
                        <SelectValue placeholder="Select next step..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allSteps
                          .filter(s => s.step_id !== currentStepId)
                          .map(s => (
                            <SelectItem key={s.step_id} value={s.step_id}>
                              {s.step_title}
                            </SelectItem>
                          ))}
                        <SelectItem value="complete">Complete Workflow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-red-700">
                      Otherwise (don't match) → Go to:
                    </Label>
                    <Select
                      value={group.false_step || ""}
                      onValueChange={(value) => handleGroupChange(groupIndex, "false_step", value)}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1 border-red-300">
                        <SelectValue placeholder="Continue to next group..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Continue to next group</SelectItem>
                        {allSteps
                          .filter(s => s.step_id !== currentStepId)
                          .map(s => (
                            <SelectItem key={s.step_id} value={s.step_id}>
                              {s.step_title}
                            </SelectItem>
                          ))}
                        <SelectItem value="complete">Complete Workflow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Default Step */}
      {routingGroups.length > 0 && (
        <div className="pt-3 border-t">
          <Label className="text-xs font-semibold text-slate-700">
            Default (no groups match) → Go to:
          </Label>
          <Select
            value={defaultStep}
            onValueChange={onDefaultStepChange}
          >
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue placeholder="Select default next step..." />
            </SelectTrigger>
            <SelectContent>
              {allSteps
                .filter(s => s.step_id !== currentStepId)
                .map(s => (
                  <SelectItem key={s.step_id} value={s.step_id}>
                    {s.step_title}
                  </SelectItem>
                ))}
              <SelectItem value="complete">Complete Workflow</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}