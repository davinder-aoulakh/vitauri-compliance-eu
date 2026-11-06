import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { COMPUTED_OPERATORS, COMPUTED_FIELD_HINT } from "@/lib/transitionComputed";

export default function TransitionComputedRow({ condition, onChange, onRemove }) {
  return (
    <div className="border border-green-200 bg-green-50/40 rounded-md p-2">
      <div className="grid grid-cols-12 gap-2 items-start">
        <div className="col-span-12 md:col-span-6">
          <Input
            className="h-8 text-xs bg-white"
            placeholder="e.g., year_end_cash_value + gross_payments"
            value={condition.expression || ""}
            onChange={(e) => onChange({ expression: e.target.value })}
          />
          <p className="text-xs text-slate-500 mt-1">Available fields: {COMPUTED_FIELD_HINT.join(", ")} (use + - * / and parentheses)</p>
        </div>
        <div className="col-span-5 md:col-span-2">
          <Select value={condition.operator || "greater_than"} onValueChange={(v) => onChange({ operator: v })}>
            <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPUTED_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-5 md:col-span-3">
          <Input
            type="number"
            className="h-8 text-xs bg-white"
            placeholder="Value"
            value={condition.value ?? ""}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        </div>
        <div className="col-span-2 md:col-span-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onRemove}><Trash2 className="w-4 h-4 text-red-500" /></Button>
        </div>
      </div>
    </div>
  );
}