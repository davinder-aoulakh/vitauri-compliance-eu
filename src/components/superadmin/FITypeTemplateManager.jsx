import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileSpreadsheet, Edit, RotateCcw, CheckCircle2, AlertTriangle, Plus, Trash2, Info
} from "lucide-react";
import { FI_TYPE_TEMPLATES } from "@/lib/fiTypeTemplates";

const FI_TYPES = [
  "custodial_institution",
  "depository_institution",
  "investment_entity",
  "specified_insurance_company",
  "not_applicable",
];

const ALL_ACCOUNT_TYPES = [
  "depository",
  "custodial",
  "equity_debt_interest",
  "cash_value_insurance",
  "annuity",
];

export default function FITypeTemplateManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // { fiType, record or null }
  const [saved, setSaved] = useState(null);

  const { data: dbTemplates = [], isLoading } = useQuery({
    queryKey: ["fi-type-templates"],
    queryFn: () => base44.entities.FITypeTemplate.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ existing, data }) => {
      const user = await base44.auth.me();
      const payload = { ...data, last_updated_by: user.email };
      if (existing) {
        return base44.entities.FITypeTemplate.update(existing.id, payload);
      }
      return base44.entities.FITypeTemplate.create(payload);
    },
    onSuccess: (_, { data }) => {
      queryClient.invalidateQueries(["fi-type-templates"]);
      setSaved(data.fi_type);
      setEditing(null);
      setTimeout(() => setSaved(null), 3000);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (record) => base44.entities.FITypeTemplate.delete(record.id),
    onSuccess: () => queryClient.invalidateQueries(["fi-type-templates"]),
  });

  // Merge hardcoded defaults with DB overrides
  const getEffectiveConfig = (fiType) => {
    const db = dbTemplates.find(t => t.fi_type === fiType);
    const defaults = FI_TYPE_TEMPLATES[fiType];
    if (db && db.is_active !== false) {
      return {
        label: db.label,
        allowedAccountTypes: db.allowed_account_types || [],
        accountTypeNote: db.account_type_note || defaults?.accountTypeNote || "",
        exampleAccountType: db.example_account_type || defaults?.exampleAccountType || "",
        custom_columns: db.custom_columns || [],
        notes: db.notes || "",
        isCustomised: true,
        dbRecord: db,
      };
    }
    return {
      label: defaults?.label || fiType,
      allowedAccountTypes: defaults?.allowedAccountTypes || [],
      accountTypeNote: defaults?.accountTypeNote || "",
      exampleAccountType: defaults?.exampleAccountType || "",
      custom_columns: [],
      notes: "",
      isCustomised: false,
      dbRecord: null,
    };
  };

  const openEdit = (fiType) => {
    const config = getEffectiveConfig(fiType);
    setEditing({
      fiType,
      dbRecord: config.dbRecord,
      form: {
        fi_type: fiType,
        label: config.label,
        allowed_account_types: [...config.allowedAccountTypes],
        account_type_note: config.accountTypeNote,
        example_account_type: config.exampleAccountType,
        custom_columns: config.custom_columns,
        notes: config.notes,
        is_active: true,
      },
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-indigo-300" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">FI Type Template Configuration</h2>
          <p className="text-indigo-200 text-sm mt-1">
            Customise the account import template for each Financial Institution type. Overrides replace the platform defaults.
          </p>
        </div>
      </div>

      {saved && (
        <Alert className="bg-green-900/30 border-green-500/40 text-green-300">
          <CheckCircle2 className="w-4 h-4" />
          <AlertDescription>Template for <strong>{FI_TYPE_TEMPLATES[saved]?.label || saved}</strong> saved successfully.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4">
        {FI_TYPES.map((fiType) => {
          const config = getEffectiveConfig(fiType);
          return (
            <Card key={fiType} className="bg-white/10 backdrop-blur-sm border border-white/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{config.label}</p>
                        {config.isCustomised ? (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">Customised</Badge>
                        ) : (
                          <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30 text-xs">Default</Badge>
                        )}
                      </div>
                      <p className="text-xs text-indigo-300 mt-0.5">
                        Allowed: {config.allowedAccountTypes.join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {config.isCustomised && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => resetMutation.mutate(config.dbRecord)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Reset
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30"
                      onClick={() => openEdit(fiType)}
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      {config.isCustomised ? "Edit" : "Customise"}
                    </Button>
                  </div>
                </div>
                {config.notes && (
                  <p className="mt-2 text-xs text-indigo-300 bg-white/5 rounded p-2 border border-white/10">
                    <Info className="w-3 h-3 inline mr-1" />{config.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      {editing && (
        <FITypeEditDialog
          editing={editing}
          onSave={(formData) => saveMutation.mutate({ existing: editing.dbRecord, data: formData })}
          onClose={() => setEditing(null)}
          isSaving={saveMutation.isPending}
        />
      )}
    </div>
  );
}

function FITypeEditDialog({ editing, onSave, onClose, isSaving }) {
  const [form, setForm] = useState(editing.form);
  const [newCol, setNewCol] = useState({ header: "", key: "", width: 20, required: false, note: "" });
  const [showAddCol, setShowAddCol] = useState(false);

  const toggleAccountType = (type) => {
    setForm(prev => ({
      ...prev,
      allowed_account_types: prev.allowed_account_types.includes(type)
        ? prev.allowed_account_types.filter(t => t !== type)
        : [...prev.allowed_account_types, type],
    }));
  };

  const addColumn = () => {
    if (!newCol.header || !newCol.key) return;
    setForm(prev => ({ ...prev, custom_columns: [...prev.custom_columns, { ...newCol }] }));
    setNewCol({ header: "", key: "", width: 20, required: false, note: "" });
    setShowAddCol(false);
  };

  const removeColumn = (idx) => {
    setForm(prev => ({ ...prev, custom_columns: prev.custom_columns.filter((_, i) => i !== idx) }));
  };

  // Auto-build account_type_note from selections
  const autoNote = form.allowed_account_types.length > 0
    ? `Select from dropdown: ${form.allowed_account_types.join(" | ")}`
    : "";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customise Template — {FI_TYPE_TEMPLATES[editing.fiType]?.label || editing.fiType}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Label */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Display Label</label>
            <Input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} />
          </div>

          {/* Allowed Account Types */}
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
              <p className="text-xs text-slate-500 mt-2">Auto note: {autoNote}</p>
            )}
          </div>

          {/* Example Account Type */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Example Account Type (for template row)</label>
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

          {/* Custom Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Additional Template Columns</label>
              <Button size="sm" variant="outline" onClick={() => setShowAddCol(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Column
              </Button>
            </div>
            {form.custom_columns.length === 0 && (
              <p className="text-xs text-slate-400 italic">No extra columns. Standard columns will be used.</p>
            )}
            {form.custom_columns.map((col, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 border rounded mb-1">
                <FileSpreadsheet className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <span className="font-medium">{col.header}</span>
                  <span className="text-slate-400 ml-2">key: {col.key}</span>
                  {col.required && <Badge className="ml-2 text-xs" variant="destructive">Required</Badge>}
                </div>
                <Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0" onClick={() => removeColumn(idx)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            {showAddCol && (
              <div className="mt-2 p-3 border border-dashed border-slate-300 rounded space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600">Column Header *</label>
                    <Input placeholder="e.g. GIIN Number" value={newCol.header} onChange={e => setNewCol(p => ({ ...p, header: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Field Key *</label>
                    <Input placeholder="e.g. giin_number" value={newCol.key} onChange={e => setNewCol(p => ({ ...p, key: e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600">Column Width</label>
                    <Input type="number" value={newCol.width} onChange={e => setNewCol(p => ({ ...p, width: parseInt(e.target.value) || 20 }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Note / Instruction</label>
                    <Input placeholder="Optional" value={newCol.note} onChange={e => setNewCol(p => ({ ...p, note: e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={newCol.required} onCheckedChange={v => setNewCol(p => ({ ...p, required: !!v }))} />
                  Mark as required
                </label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addColumn} className="bg-indigo-600 text-white hover:bg-indigo-700">Add</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddCol(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Internal Notes</label>
            <Textarea
              placeholder="Optional notes for this template configuration..."
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
            {isSaving ? "Saving..." : "Save Template Config"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}