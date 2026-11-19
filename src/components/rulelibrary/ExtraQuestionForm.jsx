import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import ConditionGroupBuilder from "@/components/rules/ConditionGroupBuilder";
import { CONDITION_FACTS, CONDITION_OPERATORS, HOOK_LABELS } from "../../../base44/shared/crs/index.js";
import { callLibrary } from "./useRuleLibrary";

const EMPTY_GROUP = { logic_operator: "AND", conditions: [], subGroups: [] };

/**
 * An extra question added to the studio's procedure (e.g. a local-law check). Its answers can only let the
 * classification continue or put it on hold ("Action needed"); they never make an account non-reportable.
 */
export default function ExtraQuestionForm({ pack, rule, readOnly = false, existingKeys = [], onDone }) {
  const isNew = !rule;
  const [form, setForm] = useState(() => ({
    rule_key: rule?.rule_key || "X.",
    hook: rule?.hook || "after_general",
    order: rule?.order ?? 100,
    enabled: rule?.enabled !== false,
    question: rule?.question || "",
    help: rule?.help || "",
    crs_ref: rule?.crs_ref || "",
    hb_ref: rule?.hb_ref || "",
    ai_guidance: rule?.ai_guidance || "",
    options: rule?.options?.length ? rule.options.map((o) => ({ value: o.value, label: o.label, effect: o.effect || "continue", reason: o.reason || "" }))
      : [{ value: "done", label: "Yes · done", effect: "continue", reason: "" }, { value: "not_done", label: "No · not yet", effect: "hold", reason: "" }],
    condition: rule?.condition || EMPTY_GROUP,
  }));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setOpt = (i, k, v) => set("options", form.options.map((o, j) => (j === i ? { ...o, [k]: v } : o)));

  const save = async () => {
    setErrors([]);
    if (isNew && existingKeys.includes(form.rule_key)) { setErrors(["That key is already used."]); return; }
    setSaving(true);
    try {
      const hasCondition = (form.condition.conditions || []).some((c) => c.field) || (form.condition.subGroups || []).length > 0;
      await callLibrary("save_rule", { pack_id: pack.id, rule: { ...form, order: Number(form.order) || 100, condition: hasCondition ? form.condition : null } });
      toast.success(isNew ? "Extra question added to the draft" : "Extra question saved");
      await onDone?.(form.rule_key);
    } catch (e) {
      setErrors(e.details?.map((d) => d.message) || [e.message]);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    try { await callLibrary("delete_rule", { pack_id: pack.id, rule_key: rule.rule_key }); toast.success("Extra question removed"); await onDone?.(null); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{isNew ? "Add an extra question" : <span className="font-mono text-sm">{rule.rule_key}</span>}</CardTitle>
        <CardDescription>
          For checks your jurisdiction or institution adds on top of the Handbook. An answer can only let the classification continue or put it on hold with an action; it can never make an account non-reportable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="x-key">Key</Label>
            <Input id="x-key" disabled={readOnly || !isNew} value={form.rule_key} onChange={(e) => set("rule_key", e.target.value.toUpperCase().replace(/[^A-Z0-9_.]/g, ""))} placeholder="X.LOCAL_CHECK" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Asked</Label>
            <Select value={form.hook} onValueChange={(v) => set("hook", v)} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(HOOK_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2"><Switch id="x-on" checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} disabled={readOnly} /><Label htmlFor="x-on">{form.enabled ? "On" : "Off"}</Label></div>
          <div className="flex items-center gap-2"><Label htmlFor="x-order">Order</Label><Input id="x-order" type="number" className="w-24" disabled={readOnly} value={form.order} onChange={(e) => set("order", e.target.value)} /></div>
        </div>
        <div className="space-y-1"><Label htmlFor="x-q">Question</Label><Textarea id="x-q" rows={2} disabled={readOnly} value={form.question} onChange={(e) => set("question", e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="x-h">Help text</Label><Textarea id="x-h" rows={2} disabled={readOnly} value={form.help} onChange={(e) => set("help", e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="x-crs">Legal reference</Label><Input id="x-crs" disabled={readOnly} value={form.crs_ref} onChange={(e) => set("crs_ref", e.target.value)} placeholder="e.g. local regulation article" /></div>
          <div className="space-y-1"><Label htmlFor="x-hb">Guidance reference</Label><Input id="x-hb" disabled={readOnly} value={form.hb_ref} onChange={(e) => set("hb_ref", e.target.value)} /></div>
        </div>

        <div className="space-y-2">
          <Label>Answers</Label>
          {form.options.map((o, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_150px_auto] items-start border rounded p-2">
              <Input disabled={readOnly} value={o.value} onChange={(e) => setOpt(i, "value", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="value" aria-label="Value" />
              <Input disabled={readOnly} value={o.label} onChange={(e) => setOpt(i, "label", e.target.value)} placeholder="Label shown to users" aria-label="Label" />
              <Select value={o.effect} onValueChange={(v) => setOpt(i, "effect", v)} disabled={readOnly}>
                <SelectTrigger aria-label="Effect"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="continue">Continue</SelectItem><SelectItem value="hold">Put on hold</SelectItem></SelectContent>
              </Select>
              {!readOnly && form.options.length > 2 ? <Button size="icon" variant="ghost" onClick={() => set("options", form.options.filter((_, j) => j !== i))} aria-label="Remove answer"><Trash2 className="w-4 h-4" /></Button> : <span />}
              {o.effect === "hold" && (
                <Input className="sm:col-span-4" disabled={readOnly} value={o.reason} onChange={(e) => setOpt(i, "reason", e.target.value)} placeholder="Action shown to the user, e.g. 'Complete the local check before classifying.'" aria-label="Hold reason" />
              )}
            </div>
          ))}
          {!readOnly && <Button size="sm" variant="outline" onClick={() => set("options", [...form.options, { value: "", label: "", effect: "continue", reason: "" }])}><Plus className="w-4 h-4 mr-1" />Add answer</Button>}
        </div>

        <div className="space-y-2">
          <Label>Only ask when <span className="text-xs font-normal text-slate-500">(leave empty to ask for every account at this point)</span></Label>
          {readOnly ? (
            <pre className="text-xs bg-slate-50 border rounded p-2 overflow-x-auto">{JSON.stringify(form.condition, null, 1)}</pre>
          ) : (
            <ConditionGroupBuilder group={form.condition} onChange={(g) => set("condition", g)} accountFields={CONDITION_FACTS} operators={CONDITION_OPERATORS} />
          )}
        </div>

        <div className="space-y-1"><Label htmlFor="x-ai">AI guidance</Label><Textarea id="x-ai" rows={2} disabled={readOnly} value={form.ai_guidance} onChange={(e) => set("ai_guidance", e.target.value)} /></div>

        {errors.length > 0 && <Alert className="border-red-300 bg-red-50"><AlertDescription className="text-sm text-red-800">{errors.map((m, i) => <div key={i}>{m}</div>)}</AlertDescription></Alert>}

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}{isNew ? "Add to draft" : "Save to draft"}</Button>
            {!isNew && <Button variant="outline" onClick={remove} disabled={saving}><Trash2 className="w-4 h-4 mr-1" />Remove</Button>}
            {isNew && <Button variant="ghost" onClick={() => onDone?.(null)}>Cancel</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
