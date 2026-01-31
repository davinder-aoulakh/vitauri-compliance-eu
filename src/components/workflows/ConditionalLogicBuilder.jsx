import React, { useState } from "react";
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
import { Plus, Trash2, GitBranch, Info, Layers, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ConditionalLogicBuilder({ 
  conditionalLogic, 
  onChange, 
  availableSteps = [] 
}) {
  const [mode, setMode] = useState(
    conditionalLogic?.condition_groups && conditionalLogic.condition_groups.length > 0 
      ? 'grouped' 
      : 'simple'
  );
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

  // Grouped conditions handlers
  const handleAddGroup = () => {
    const newGroupId = `group_${Date.now()}`;
    const newLogic = {
      ...conditionalLogic,
      condition_groups: [
        ...(conditionalLogic?.condition_groups || []),
        {
          group_id: newGroupId,
          group_name: `Group ${(conditionalLogic?.condition_groups?.length || 0) + 1}`,
          conditions: [],
          next_step: "",
          else_step: ""
        }
      ],
      group_evaluation_mode: conditionalLogic?.group_evaluation_mode || "first_match"
    };
    onChange(newLogic);
  };

  const handleRemoveGroup = (groupIndex) => {
    const newLogic = {
      ...conditionalLogic,
      condition_groups: conditionalLogic.condition_groups.filter((_, i) => i !== groupIndex)
    };
    onChange(newLogic);
  };

  const handleUpdateGroup = (groupIndex, field, value) => {
    const newGroups = [...(conditionalLogic?.condition_groups || [])];
    newGroups[groupIndex] = { ...newGroups[groupIndex], [field]: value };
    onChange({ ...conditionalLogic, condition_groups: newGroups });
  };

  const handleAddConditionToGroup = (groupIndex) => {
    const newGroups = [...(conditionalLogic?.condition_groups || [])];
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      conditions: [
        ...(newGroups[groupIndex].conditions || []),
        {
          field: "",
          operator: "=",
          value: "",
          value_type: "static",
          logic_operator: "AND"
        }
      ]
    };
    onChange({ ...conditionalLogic, condition_groups: newGroups });
  };

  const handleRemoveConditionFromGroup = (groupIndex, conditionIndex) => {
    const newGroups = [...(conditionalLogic?.condition_groups || [])];
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      conditions: newGroups[groupIndex].conditions.filter((_, i) => i !== conditionIndex)
    };
    onChange({ ...conditionalLogic, condition_groups: newGroups });
  };

  const handleUpdateConditionInGroup = (groupIndex, conditionIndex, field, value) => {
    const newGroups = [...(conditionalLogic?.condition_groups || [])];
    const newConditions = [...newGroups[groupIndex].conditions];
    newConditions[conditionIndex] = { ...newConditions[conditionIndex], [field]: value };
    newGroups[groupIndex] = { ...newGroups[groupIndex], conditions: newConditions };
    onChange({ ...conditionalLogic, condition_groups: newGroups });
  };

  const handleSwitchToGrouped = () => {
    // Convert existing flat conditions to a single group
    const existingConditions = conditionalLogic?.conditions || [];
    const newLogic = {
      ...conditionalLogic,
      condition_groups: existingConditions.length > 0 ? [{
        group_id: `group_${Date.now()}`,
        group_name: "Group 1",
        conditions: existingConditions,
        next_step: conditionalLogic?.next_step || "",
        else_step: conditionalLogic?.else_step || ""
      }] : [],
      group_evaluation_mode: "first_match"
    };
    onChange(newLogic);
    setMode('grouped');
  };

  const handleSwitchToSimple = () => {
    // Flatten first group back to simple conditions
    const firstGroup = conditionalLogic?.condition_groups?.[0];
    const newLogic = {
      ...conditionalLogic,
      conditions: firstGroup?.conditions || [],
      next_step: firstGroup?.next_step || "",
      else_step: firstGroup?.else_step || "",
      condition_groups: undefined,
      group_evaluation_mode: undefined
    };
    onChange(newLogic);
    setMode('simple');
  };

  const conditions = conditionalLogic?.conditions || [];
  const conditionGroups = conditionalLogic?.condition_groups || [];

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-xs text-blue-900">
          <strong>Advanced Conditional Logic:</strong> Define complex branching rules with multiple condition groups. 
          Each group can have its own conditions and branching paths.
        </AlertDescription>
      </Alert>

      {/* Mode Toggle */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
        <Label className="text-sm font-semibold">Logic Mode:</Label>
        <Button
          type="button"
          variant={mode === 'simple' ? 'default' : 'outline'}
          size="sm"
          onClick={handleSwitchToSimple}
        >
          Simple (Single Group)
        </Button>
        <Button
          type="button"
          variant={mode === 'grouped' ? 'default' : 'outline'}
          size="sm"
          onClick={handleSwitchToGrouped}
        >
          <Layers className="w-3 h-3 mr-1" />
          Grouped (Multiple Groups)
        </Button>
      </div>

      {mode === 'simple' ? (
        <>
          {/* Simple Mode - Single Flat Conditions List */}
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
        </>
      ) : (
        <>
          {/* Grouped Mode - Multiple Condition Groups */}
          <div className="space-y-4">
            {/* Group Evaluation Mode */}
            {conditionGroups.length > 1 && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Group Evaluation Mode</Label>
                <Select
                  value={conditionalLogic?.group_evaluation_mode || "first_match"}
                  onValueChange={(value) => onChange({ ...conditionalLogic, group_evaluation_mode: value })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_match">First Match (use first group that matches)</SelectItem>
                    <SelectItem value="all_must_match">All Must Match (AND between groups)</SelectItem>
                    <SelectItem value="any_must_match">Any Must Match (OR between groups)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Add Group Button */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                Condition Groups ({conditionGroups.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddGroup}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Group
              </Button>
            </div>

            {conditionGroups.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded border border-slate-200">
                No condition groups defined. Add a group to start building grouped logic.
              </p>
            ) : (
              <div className="space-y-4">
                {conditionGroups.map((group, groupIndex) => (
                  <Card key={group.group_id} className="bg-indigo-50 border-indigo-300">
                    <CardContent className="p-4 space-y-3">
                      {/* Group Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-indigo-200 text-indigo-900 font-semibold">
                            {group.group_name || `Group ${groupIndex + 1}`}
                          </Badge>
                          <Input
                            value={group.group_name || ""}
                            onChange={(e) => handleUpdateGroup(groupIndex, "group_name", e.target.value)}
                            placeholder="Group name..."
                            className="h-7 text-xs w-40"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveGroup(groupIndex)}
                          className="h-7 w-7 text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Conditions in Group */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-slate-700">
                            Conditions ({group.conditions?.length || 0})
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddConditionToGroup(groupIndex)}
                            className="h-6 text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Condition
                          </Button>
                        </div>

                        {(!group.conditions || group.conditions.length === 0) ? (
                          <p className="text-xs text-slate-500 italic p-2 bg-white rounded border">
                            No conditions in this group.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {group.conditions.map((condition, conditionIndex) => (
                              <Card key={conditionIndex} className="bg-white border-slate-200">
                                <CardContent className="p-2 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-xs">
                                      Condition {conditionIndex + 1}
                                    </Badge>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveConditionFromGroup(groupIndex, conditionIndex)}
                                      className="h-5 w-5 text-red-600"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2">
                                    {/* Field */}
                                    <div>
                                      <Label className="text-xs">Step ID / Field</Label>
                                      <Select
                                        value={condition.field}
                                        onValueChange={(value) => handleUpdateConditionInGroup(groupIndex, conditionIndex, "field", value)}
                                      >
                                        <SelectTrigger className="h-7 text-xs mt-1">
                                          <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableSteps.map((step) => {
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
                                            return (
                                              <SelectItem key={step.step_id} value={step.step_id}>
                                                {step.step_title || step.step_id}
                                              </SelectItem>
                                            );
                                          })}
                                          <SelectItem value="current_address.country">Current Address Country</SelectItem>
                                          <SelectItem value="account_holder_address.country">Account Holder Address Country</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Operator */}
                                    <div>
                                      <Label className="text-xs">Operator</Label>
                                      <Select
                                        value={condition.operator}
                                        onValueChange={(value) => handleUpdateConditionInGroup(groupIndex, conditionIndex, "operator", value)}
                                      >
                                        <SelectTrigger className="h-7 text-xs mt-1">
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
                                          <SelectItem value="in">In</SelectItem>
                                          <SelectItem value="not_in">Not In</SelectItem>
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
                                          const newGroups = [...(conditionalLogic?.condition_groups || [])];
                                          const newConditions = [...newGroups[groupIndex].conditions];
                                          newConditions[conditionIndex] = { 
                                            ...newConditions[conditionIndex], 
                                            value_type: value,
                                            value: ""
                                          };
                                          newGroups[groupIndex] = { ...newGroups[groupIndex], conditions: newConditions };
                                          onChange({ ...conditionalLogic, condition_groups: newGroups });
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-xs mt-1">
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
                                        onValueChange={(value) => handleUpdateConditionInGroup(groupIndex, conditionIndex, "value", value)}
                                      >
                                        <SelectTrigger className="h-7 text-xs mt-1">
                                          <SelectValue placeholder="Select field..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableSteps.map((step) => (
                                            <SelectItem key={step.step_id} value={step.step_id}>
                                              {step.step_title || step.step_id}
                                            </SelectItem>
                                          ))}
                                          <SelectItem value="current_address.country">Current Address Country</SelectItem>
                                          <SelectItem value="account_holder_address.country">Account Holder Address Country</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input
                                        value={condition.value}
                                        onChange={(e) => handleUpdateConditionInGroup(groupIndex, conditionIndex, "value", e.target.value)}
                                        placeholder={condition.operator === "is_crs" || condition.operator === "is_not_crs" ? "N/A (CRS lookup)" : "value"}
                                        disabled={condition.operator === "is_crs" || condition.operator === "is_not_crs"}
                                        className="h-7 text-xs mt-1"
                                      />
                                    )}
                                  </div>

                                  {/* Logic Operator */}
                                  {conditionIndex < group.conditions.length - 1 && (
                                    <div>
                                      <Label className="text-xs">Combine with next:</Label>
                                      <Select
                                        value={condition.logic_operator || "AND"}
                                        onValueChange={(value) => handleUpdateConditionInGroup(groupIndex, conditionIndex, "logic_operator", value)}
                                      >
                                        <SelectTrigger className="h-7 text-xs mt-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="AND">AND</SelectItem>
                                          <SelectItem value="OR">OR</SelectItem>
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

                      {/* Group Paths */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <div>
                          <Label className="text-xs font-semibold text-green-700 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            Then (if true)
                          </Label>
                          <Select
                            value={group.next_step || ""}
                            onValueChange={(value) => handleUpdateGroup(groupIndex, "next_step", value)}
                          >
                            <SelectTrigger className="h-7 text-xs mt-1 border-green-300">
                              <SelectValue placeholder="Select step..." />
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
                          <Label className="text-xs font-semibold text-red-700 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            Else (if false)
                          </Label>
                          <Select
                            value={group.else_step || ""}
                            onValueChange={(value) => handleUpdateGroup(groupIndex, "else_step", value)}
                          >
                            <SelectTrigger className="h-7 text-xs mt-1 border-red-300">
                              <SelectValue placeholder="Select step..." />
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}