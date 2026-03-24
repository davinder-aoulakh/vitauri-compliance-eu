import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FI_TYPE_TEMPLATES } from "@/lib/fiTypeTemplates";

const ALL_ACCOUNT_TYPES = [
  "depository", "custodial", "equity_debt_interest", "cash_value_insurance", "annuity",
];

export default function FITypeEditDialog({ editing, onSave, onClose, isSaving }) {
  const [form, setForm] = useState(editing.form);

  const toggleAccountType = (type) => {
    setForm(prev => ({
      ...prev,
      allowed_account_types: prev.allowed_account_types.includes(type)
        ? prev.allowed_account_types.filter(t => t !== type)
        : [...prev.allowed_account_types, type],
    }));
  };

  const autoNote = form.allowed_account_types.length > 0
    ? `Select from dropdown: ${form.allowed_account_types.join(" | ")}`
    : "";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Template Settings — {FI_TYPE_TEMPLATES[editing.fiType]?.label || editing.fiType}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Display Label</label>
            <Input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Allowed Account Types</label>
            <div className="flex flex-wrap gap-3">
              {ALL_ACCOUNT_TYPES.map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.allowed_account_types.includes(type)}
                    onCheckedChange={() => toggleAccountType(type)}
                  />
                  <span className="text-sm text-slate-700 capitalize">{type.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
            {form.allowed_account_types.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">Dropdown note: {autoNote}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Example Account Type</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={form.example_account_type}
              onChange={e => setForm(p => ({ ...p, example_account_type: e.target.value }))}
            >
              <option value="">Select...</option>
              {form.allowed_account_types.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Internal Notes</label>
            <Textarea
              placeholder="Optional notes..."
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({ ...form, account_type_note: autoNote || form.account_type_note })}
            disabled={isSaving || form.allowed_account_types.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}