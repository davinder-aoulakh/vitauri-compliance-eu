import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function SelectionCountBranching({ 
  conditionalLogic, 
  allSteps, 
  currentStepId, 
  optionsCount,
  onConditionalLogicChange 
}) {
  return (
    <div className="p-3 bg-blue-50 rounded border border-blue-200">
      <p className="text-xs text-blue-900 mb-3">
        <strong>Count-based branching:</strong> Navigate based on how many total options the user selects
      </p>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Operator</Label>
          <Select
            value={conditionalLogic?.selection_count_operator || "="}
            onValueChange={(value) => onConditionalLogicChange("selection_count_operator", value)}
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
            value={conditionalLogic?.selection_count_value || ""}
            onChange={(e) => onConditionalLogicChange("selection_count_value", parseInt(e.target.value) || 0)}
            placeholder="e.g., 3"
            className="h-8 text-xs mt-1"
          />
        </div>
        <div className="text-xs text-slate-500 flex items-end pb-2">
          of {optionsCount} total options
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t">
        <div>
          <Label className="text-xs text-green-700 font-semibold">
            If condition met → Go to:
          </Label>
          <Select
            value={conditionalLogic?.selection_count_next_step || ""}
            onValueChange={(value) => {
              const finalValue = value === "" ? null : value;
              onConditionalLogicChange("selection_count_next_step", finalValue);
              if (finalValue) {
                onConditionalLogicChange("use_selection_count", true);
              }
            }}
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
            Otherwise → Go to:
          </Label>
          <Select
            value={conditionalLogic?.selection_count_else_step || ""}
            onValueChange={(value) => {
              const finalValue = value === "" ? null : value;
              onConditionalLogicChange("selection_count_else_step", finalValue);
              if (finalValue) {
                onConditionalLogicChange("use_selection_count", true);
              }
            }}
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
    </div>
  );
}