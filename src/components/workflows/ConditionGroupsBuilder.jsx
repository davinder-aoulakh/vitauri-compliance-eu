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
import { Plus, Trash2, Layers, Info, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { base44 } from "@/api/base44Client";

export default function ConditionGroupsBuilder({
  conditionGroups = [],
  overallLogicOperator = "OR",
  overallTrueStep = "",
  overallFalseStep = "",
  availableConditionFields = [],
  allSteps = [],
  currentStepId,
  onGroupsChange,
  onOverallOperatorChange,
  onOverallTrueStepChange,
  onOverallFalseStepChange,
  isLoadingFields = false
}) {
  const handleAddGroup = () => {
    const newGroup = {
      group_id: `group_${Date.now()}`,
      group_name: `Condition Group ${conditionGroups.length + 1}`,
      group_operator: "AND",
      conditions: [],
      true_step: "",
      false_step: ""
    };
    onGroupsChange([...conditionGroups, newGroup]);
  };

  const handleRemoveGroup = (groupIndex) => {
    onGroupsChange(conditionGroups.filter((_, i) => i !== groupIndex));
  };

  const handleGroupChange = (groupIndex, field, value) => {
    const newGroups = [...conditionGroups];
    newGroups[groupIndex] = { ...newGroups[groupIndex], [field]: value };
    onGroupsChange(newGroups);
  };

  const handleAddConditionToGroup = (groupIndex) => {
    const newGroups = [...conditionGroups];
    const newCondition = {
      condition_id: `cond_${Date.now()}`,
      field: "",
      operator: "=",
      value: "",
      value_type: "static"
    };
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      conditions: [...(newGroups[groupIndex].conditions || []), newCondition]
    };
    onGroupsChange(newGroups);
  };

  const handleRemoveConditionFromGroup = (groupIndex, conditionIndex) => {
    const newGroups = [...conditionGroups];
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      conditions: newGroups[groupIndex].conditions.filter((_, i) => i !== conditionIndex)
    };
    onGroupsChange(newGroups);
  };

  const handleConditionChange = (groupIndex, conditionIndex, field, value) => {
    const newGroups = [...conditionGroups];
    newGroups[groupIndex].conditions[conditionIndex] = {
      ...newGroups[groupIndex].conditions[conditionIndex],
      [field]: value
    };
    onGroupsChange(newGroups);
  };

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-xs text-blue-900">
          <strong>Condition Groups (fall-through model):</strong> Groups are evaluated in order. The first group whose TRUE or FALSE destination is set to a concrete step decides the routing immediately. Set a destination to <strong>"None (Use Overall Logic)"</strong> to defer that branch to the next group. If no group decides, the <strong>Overall FALSE</strong> destination is used as the final fallback.
        </AlertDescription>
      </Alert>

      {/* Add Group Button */}
      <div className="flex justify-between items-center">
        <Label className="text-sm font-semibold">
          Condition Groups ({conditionGroups.length})
        </Label>
        <Button size="sm" onClick={handleAddGroup} variant="outline">
          <Plus className="w-3 h-3 mr-1" />
          Add Group
        </Button>
      </div>

      {/* Condition Groups */}
      {conditionGroups.length === 0 ? (
        <p className="text-xs text-slate-500 italic p-3 bg-white rounded border">
          No condition groups defined. Add a group to start building advanced logic.
        </p>
      ) : (
        <div className="space-y-4">
          {conditionGroups.map((group, groupIndex) => (
            <Card key={group.group_id} className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300">
              <CardContent className="p-4 space-y-4">
                {/* Group Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-600" />
                    <Input
                      value={group.group_name}
                      onChange={(e) => handleGroupChange(groupIndex, "group_name", e.target.value)}
                      placeholder="Group Name"
                      className="h-8 text-sm font-semibold w-64"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveGroup(groupIndex)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Group Operator */}
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-medium">Conditions in this group are combined with:</Label>
                  <Select
                    value={group.group_operator || "AND"}
                    onValueChange={(value) => handleGroupChange(groupIndex, "group_operator", value)}
                  >
                    <SelectTrigger className="h-8 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND (all must match)</SelectItem>
                      <SelectItem value="OR">OR (any can match)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Conditions in this Group */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Conditions ({group.conditions?.length || 0})</Label>
                    <Button
                      size="sm"
                      onClick={() => handleAddConditionToGroup(groupIndex)}
                      variant="outline"
                      className="h-7"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Condition
                    </Button>
                  </div>

                  {(!group.conditions || group.conditions.length === 0) ? (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <AlertDescription className="text-xs text-yellow-900">
                        This group has no conditions. Add at least one condition.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      {group.conditions.map((condition, conditionIndex) => {
                        const selectedField = availableConditionFields.find(f => f.value === condition.field);
                        const isCountryField = selectedField?.isCountry;

                        return (
                          <div key={condition.condition_id} className="p-3 bg-white border-2 border-slate-200 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="bg-slate-100 text-slate-800">
                                Condition {conditionIndex + 1}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveConditionFromGroup(groupIndex, conditionIndex)}
                                className="h-6 w-6 text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Step ID / Field</Label>
                                <Select
                                  value={condition.field}
                                  onValueChange={(value) => handleConditionChange(groupIndex, conditionIndex, "field", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue placeholder={isLoadingFields ? "Loading..." : "Select field..."} />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px]">
                                    {Object.entries(availableConditionFields.reduce((acc, field) => {
                                      if (!acc[field.group]) acc[field.group] = [];
                                      acc[field.group].push(field);
                                      return acc;
                                    }, {})).map(([fieldGroup, fields]) => (
                                      <React.Fragment key={fieldGroup}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1 first:border-t-0 first:mt-0">
                                          {fieldGroup}
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
                                  onValueChange={(value) => handleConditionChange(groupIndex, conditionIndex, "operator", value)}
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
                                    {isCountryField && (
                                      <>
                                        <SelectItem value="is_crs">Is CRS Country 🌍</SelectItem>
                                        <SelectItem value="is_not_crs">Is Not CRS Country 🌍</SelectItem>
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs">Value Type</Label>
                                <Select
                                  value={condition.value_type || "static"}
                                  onValueChange={(value) => {
                                    handleConditionChange(groupIndex, conditionIndex, "value_type", value);
                                    handleConditionChange(groupIndex, conditionIndex, "value", "");
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

                            <div>
                              <Label className="text-xs">
                                {condition.value_type === 'field_reference' ? 'Reference Field' : 'Value'}
                              </Label>
                              {condition.value_type === 'field_reference' ? (
                                <Select
                                  value={condition.value}
                                  onValueChange={(value) => handleConditionChange(groupIndex, conditionIndex, "value", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue placeholder="Select field to compare..." />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px]">
                                    {Object.entries(availableConditionFields.reduce((acc, field) => {
                                      if (!acc[field.group]) acc[field.group] = [];
                                      acc[field.group].push(field);
                                      return acc;
                                    }, {})).map(([fieldGroup, fields]) => (
                                      <React.Fragment key={`ref-${fieldGroup}`}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1 first:border-t-0 first:mt-0">
                                          {fieldGroup}
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
                                  type={selectedField?.type === 'number' ? 'number' : 'text'}
                                  value={condition.value}
                                  onChange={(e) => handleConditionChange(groupIndex, conditionIndex, "value", e.target.value)}
                                  placeholder={condition.operator === 'is_crs' || condition.operator === 'is_not_crs' ? 'N/A (CRS lookup)' : 'value or values'}
                                  className="h-8 text-xs mt-1"
                                  disabled={condition.operator === 'is_crs' || condition.operator === 'is_not_crs'}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Group True/False Steps */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-purple-200">
                  <div>
                    <Label className="text-xs text-green-700 font-semibold">
                      If This Group is TRUE → Go to:
                    </Label>
                    <Select
                      value={group.true_step || ""}
                      onValueChange={(value) => handleGroupChange(groupIndex, "true_step", value)}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1 border-green-300">
                        <SelectValue placeholder="Select step..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>None (Use Overall Logic)</SelectItem>
                        {allSteps
                          .filter(s => s.step_id !== currentStepId)
                          .map(s => (
                            <SelectItem key={s.step_id} value={s.step_id}>
                              {s.step_title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-red-700 font-semibold">
                      If This Group is FALSE → Go to:
                    </Label>
                    <Select
                      value={group.false_step || ""}
                      onValueChange={(value) => handleGroupChange(groupIndex, "false_step", value)}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1 border-red-300">
                        <SelectValue placeholder="Select step..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>None (Use Overall Logic)</SelectItem>
                        {allSteps
                          .filter(s => s.step_id !== currentStepId)
                          .map(s => (
                            <SelectItem key={s.step_id} value={s.step_id}>
                              {s.step_title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Overall Logic Configuration */}
      {conditionGroups.length > 1 && (
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <Label className="text-sm font-semibold text-indigo-900">
                Overall Logic (Combine All Groups)
              </Label>
            </div>

            <div>
              <Label className="text-xs font-medium mb-2 block">
                Combine groups using:
              </Label>
              <Select
                value={overallLogicOperator || "OR"}
                onValueChange={onOverallOperatorChange}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND (all groups must be TRUE)</SelectItem>
                  <SelectItem value="OR">OR (any group can be TRUE)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-600 mt-1">
                {overallLogicOperator === "AND" 
                  ? "All condition groups must evaluate to TRUE for the overall result to be TRUE"
                  : "If any condition group evaluates to TRUE, the overall result will be TRUE"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-indigo-200">
              <div>
                <Label className="text-xs text-green-700 font-semibold">
                  Overall TRUE → Go to:
                </Label>
                <Select
                  value={overallTrueStep || ""}
                  onValueChange={onOverallTrueStepChange}
                >
                  <SelectTrigger className="h-8 text-xs mt-1 border-green-300">
                    <SelectValue placeholder="Select step..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None (End)</SelectItem>
                    {allSteps
                      .filter(s => s.step_id !== currentStepId)
                      .map(s => (
                        <SelectItem key={s.step_id} value={s.step_id}>
                          {s.step_title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-red-700 font-semibold">
                  Overall FALSE → Go to:
                </Label>
                <Select
                  value={overallFalseStep || ""}
                  onValueChange={onOverallFalseStepChange}
                >
                  <SelectTrigger className="h-8 text-xs mt-1 border-red-300">
                    <SelectValue placeholder="Select step..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None (End)</SelectItem>
                    {allSteps
                      .filter(s => s.step_id !== currentStepId)
                      .map(s => (
                        <SelectItem key={s.step_id} value={s.step_id}>
                          {s.step_title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visual Representation of Logic */}
      {conditionGroups.length > 0 && (
        <Alert className="bg-slate-50 border-slate-200">
          <Info className="w-4 h-4 text-slate-600" />
          <AlertDescription className="text-xs text-slate-700">
            <strong>Logic Preview:</strong>{" "}
            {conditionGroups.map((group, idx) => (
              <span key={group.group_id}>
                ({group.group_name || `Group ${idx + 1}`}: {group.conditions?.length || 0} conditions with {group.group_operator})
                {idx < conditionGroups.length - 1 && <strong className="text-indigo-600"> {overallLogicOperator} </strong>}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}