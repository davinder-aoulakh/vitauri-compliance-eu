import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { TRANSITION_OPERATORS } from "@/lib/workflowTransitions";

function FieldSelect({ value, onChange, fields, placeholder }) {
  const grouped = fields.reduce((acc, f) => {
    (acc[f.group] = acc[f.group] || []).push(f);
    return acc;
  }, {});
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {Object.entries(grouped).map(([group, items]) => (
          <React.Fragment key={group}>
            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1 first:border-t-0 first:mt-0">{group}</div>
            {items.map(f => (
              <SelectItem key={`${group}-${f.value}`} value={f.value}>{f.label} {f.isCountry && "🌍"}</SelectItem>
            ))}
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function TransitionConditionRow({ condition, fields, onChange, onRemove }) {
  const isCrs = condition.operator === "is_crs" || condition.operator === "is_not_crs";
  const isRef = condition.value_type === "field_reference";
  const selected = fields.find(f => f.value === condition.field);
  const valueOptions = selected?.options?.length ? selected.options
    : selected?.enum?.length ? selected.enum.map(v => ({ value: v, label: v }))
    : selected?.type === "yes_no" ? [{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }]
    : selected?.type === "boolean" ? [{ value: "true", label: "True" }, { value: "false", label: "False" }]
    : null;
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-4">
        <FieldSelect value={condition.field} onChange={(v) => onChange({ field: v })} fields={fields} placeholder="Select field..." />
      </div>
      <div className="col-span-2">
        <Select value={condition.operator || "="} onValueChange={(v) => onChange({ operator: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRANSITION_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Select value={condition.value_type || "static"} onValueChange={(v) => onChange({ value_type: v, value: "" })} disabled={isCrs}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Static value</SelectItem>
            <SelectItem value="field_reference">Field reference</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-3">
        {isRef && !isCrs ? (
          <FieldSelect value={condition.value} onChange={(v) => onChange({ value: v })} fields={fields} placeholder="Compare to field..." />
        ) : valueOptions && !["in", "not_in", "contains"].includes(condition.operator) ? (
          <Select value={condition.value || ""} onValueChange={(v) => onChange({ value: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select value..." /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {valueOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input className="h-8 text-xs" disabled={isCrs} placeholder={isCrs ? "N/A" : "Value"} value={condition.value || ""} onChange={(e) => onChange({ value: e.target.value })} />
        )}
      </div>
      <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8" onClick={onRemove}>
        <Trash2 className="w-3 h-3 text-red-500" />
      </Button>
    </div>
  );
}