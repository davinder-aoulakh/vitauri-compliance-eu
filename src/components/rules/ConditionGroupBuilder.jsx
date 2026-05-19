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
import { Plus, Trash2, GitBranch, Layers } from "lucide-react";

export default function ConditionGroupBuilder({ group, onChange, accountFields, operators, depth = 0 }) {
  const updateCondition = (index, field, value) => {
    const newConditions = [...(group.conditions || [])];
    newConditions[index] = { ...newConditions[index], [field]: value };
    onChange({ ...group, conditions: newConditions });
  };

  const addCondition = () => {
    onChange({
      ...group,
      conditions: [
        ...(group.conditions || []),
        { field: "", operator: "equals", value: "" }
      ]
    });
  };

  const removeCondition = (index) => {
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index)
    });
  };

  const addSubGroup = () => {
    onChange({
      ...group,
      subGroups: [
        ...(group.subGroups || []),
        { logic_operator: "AND", conditions: [], subGroups: [] }
      ]
    });
  };

  const updateSubGroup = (index, updatedSubGroup) => {
    const newSubGroups = [...(group.subGroups || [])];
    newSubGroups[index] = updatedSubGroup;
    onChange({ ...group, subGroups: newSubGroups });
  };

  const removeSubGroup = (index) => {
    onChange({
      ...group,
      subGroups: group.subGroups.filter((_, i) => i !== index)
    });
  };

  const updateGroupLogic = (value) => {
    onChange({ ...group, logic_operator: value });
  };

  const bgColor = depth === 0 ? "bg-slate-50" : depth === 1 ? "bg-blue-50" : "bg-purple-50";
  const borderColor = depth === 0 ? "border-slate-300" : depth === 1 ? "border-blue-300" : "border-purple-300";
  const badgeColor = depth === 0 ? "bg-slate-200 text-slate-800" : depth === 1 ? "bg-blue-200 text-blue-800" : "bg-purple-200 text-purple-800";

  return (
    <Card className={`${borderColor} border-2`}>
      <CardContent className={`p-4 ${bgColor} space-y-4`}>
        {/* Group Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <Badge className={badgeColor}>
              Group Level {depth + 1}
            </Badge>
            <Select value={group.logic_operator || "AND"} onValueChange={updateGroupLogic}>
              <SelectTrigger className="h-8 w-24 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {depth > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Conditions */}
        <div className="space-y-2">
          {group.conditions?.map((condition, index) => (
            <Card key={index} className="bg-white border">
              <CardContent className="p-3">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <Select
                      value={condition.field || ""}
                      onValueChange={(value) => {
                        const newConditions = [...(group.conditions || [])];
                        newConditions[index] = { 
                          ...newConditions[index], 
                          field: value,
                          value: ""
                        };
                        onChange({ ...group, conditions: newConditions });
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {accountFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Select
                      value={condition.operator || "equals"}
                      onValueChange={(value) => updateCondition(index, "operator", value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {operators.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-1">
                    {(() => {
                      const selectedField = accountFields.find(f => f.value === condition.field);
                      const isDateOperator = condition.operator?.includes('ago');
                      const isEmptyOperator = condition.operator === 'is_empty' || condition.operator === 'is_not_empty';
                      
                      if (isEmptyOperator) {
                        return (
                          <Input
                            value="N/A"
                            disabled
                            className="h-9 bg-slate-100 flex-1"
                            placeholder="No value needed"
                          />
                        );
                      }
                      
                      if (isDateOperator) {
                        return (
                          <Input
                            type="number"
                            value={condition.value || ""}
                            onChange={(e) => updateCondition(index, "value", e.target.value)}
                            placeholder="Enter number"
                            className="h-9 flex-1"
                          />
                        );
                      }
                      
                      if (selectedField?.type === "select" && selectedField?.options) {
                        return (
                          <Select
                            value={condition.value || ""}
                            onValueChange={(value) => updateCondition(index, "value", value)}
                          >
                            <SelectTrigger className="h-9 flex-1">
                              <SelectValue placeholder="Select value" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {selectedField.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      }
                      
                      if (selectedField?.type === "date") {
                        return (
                          <Input
                            type="date"
                            value={condition.value || ""}
                            onChange={(e) => updateCondition(index, "value", e.target.value)}
                            className="h-9 flex-1"
                          />
                        );
                      }
                      
                      return (
                        <Input
                          type={selectedField?.type === "number" ? "number" : "text"}
                          value={condition.value || ""}
                          onChange={(e) => updateCondition(index, "value", e.target.value)}
                          placeholder="Value"
                          className="h-9 flex-1"
                        />
                      );
                    })()}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(index)}
                      className="h-9 w-9 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sub Groups */}
        {group.subGroups?.map((subGroup, index) => (
          <div key={index} className="ml-4 border-l-2 border-slate-300 pl-4">
            <ConditionGroupBuilder
              group={subGroup}
              onChange={(updated) => {
                if (updated === null) {
                  removeSubGroup(index);
                } else {
                  updateSubGroup(index, updated);
                }
              }}
              accountFields={accountFields}
              operators={operators}
              depth={depth + 1}
            />
          </div>
        ))}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Condition
          </Button>
          {depth < 2 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSubGroup}
              className="gap-1"
            >
              <GitBranch className="w-3 h-3" />
              Add Sub-Group
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}