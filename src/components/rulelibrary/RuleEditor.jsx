import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Lock, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { resolvePack, PARAM_SPECS, PROCEDURE_LABELS, BASELINE_RULES } from "../../../base44/shared/crs/index.js";
import { callLibrary, scopeOf, STATUS_STYLE, useInvalidateLibrary } from "./useRuleLibrary";
import ExtraQuestionForm from "./ExtraQuestionForm";

const baseKeys = new Set(BASELINE_RULES.map((r) => r.rule_key));
const PROCEDURE_ORDER = ["general", "individual_preexisting", "individual_new", "entity_preexisting", "entity_new", "controlling_persons", "custom"];

/** Editor for one pack. Drafts are editable; published and retired versions are read-only. */
export default function RuleEditor({ pack, rules, globalPublished }) {
  const invalidate = useInvalidateLibrary();
  const isDraft = pack.status === "draft";
  const isOverride = scopeOf(pack) !== "global";
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);

  // What the engine would use: a global pack over the baseline, or an override over the published global pack.
  const effective = useMemo(() => {
    const own = { version: pack.version, jurisdiction_scope: scopeOf(pack), rules };
    return isOverride ? resolvePack(globalPublished, own).rules : resolvePack(own).rules;
  }, [pack, rules, globalPublished, isOverride]);
  const ownKeys = useMemo(() => new Set(rules.map((r) => r.rule_key)), [rules]);

  const groups = PROCEDURE_ORDER.map((proc) => ({
    proc,
    rules: effective.filter((r) => (r.custom ? "custom" : r.procedure) === proc).sort((a, b) => (a.order || 0) - (b.order || 0)),
  })).filter((g) => g.rules.length || g.proc === "custom");

  const current = effective.find((r) => r.rule_key === selected) || null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{isOverride ? `${scopeOf(pack)} overrides` : "Global rules"} · v{pack.version}</span>
              <Badge variant="outline" className={STATUS_STYLE[pack.status]}>{pack.status}</Badge>
              {pack.rollback_of && <Badge variant="outline" className="border-violet-300 text-violet-700">Rollback to {pack.rollback_of}</Badge>}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isDraft ? "Changes are saved to this draft only. Nothing reaches the studio until you test and publish it."
                : "This version is read-only. Create a new draft to change the rules."}
              {isOverride && " Rules marked 'Overridden' differ from the global pack for this jurisdiction."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-start">
        <Card className="overflow-hidden">
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            {groups.map((g) => (
              <div key={g.proc}>
                <div className="px-3 py-2 bg-slate-50 border-b text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center justify-between">
                  {PROCEDURE_LABELS[g.proc] || g.proc}
                  {g.proc === "custom" && isDraft && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setAdding(true); setSelected(null); }}><Plus className="w-3 h-3 mr-1" />Add</Button>
                  )}
                </div>
                {g.rules.length === 0 && <p className="px-3 py-2 text-xs text-slate-400 border-b">No extra questions.</p>}
                {g.rules.map((r) => (
                  <button key={r.rule_key} type="button" onClick={() => { setSelected(r.rule_key); setAdding(false); }}
                    className={`w-full text-left px-3 py-2 border-b hover:bg-slate-50 ${selected === r.rule_key ? "bg-indigo-50" : ""}`}>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
                      {r.locked && <Lock className="w-3 h-3" />}{r.rule_key}
                      {r.enabled === false && <Badge variant="outline" className="text-[10px] py-0">Off</Badge>}
                      {isOverride && ownKeys.has(r.rule_key) && <Badge variant="outline" className="text-[10px] py-0 border-indigo-300 text-indigo-700">Overridden</Badge>}
                    </div>
                    <div className="text-sm text-slate-800 line-clamp-2">{r.question}</div>
                  </button>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <div>
          {adding ? (
            <ExtraQuestionForm key="new" pack={pack} existingKeys={effective.map((r) => r.rule_key)} onDone={async (key) => { setAdding(false); await invalidate(); if (key) setSelected(key); }} />
          ) : !current ? (
            <Card><CardContent className="py-16 text-center text-sm text-slate-500">Choose a rule to see or change it.</CardContent></Card>
          ) : current.custom ? (
            <ExtraQuestionForm key={current.rule_key} pack={pack} rule={current} readOnly={!isDraft} existingKeys={effective.map((r) => r.rule_key)} onDone={async () => { await invalidate(); }} />
          ) : (
            <HandbookRuleForm key={`${current.rule_key}-${pack.id}`} pack={pack} rule={current} readOnly={!isDraft} overridden={isOverride && ownKeys.has(current.rule_key)} isOverride={isOverride} onSaved={invalidate} />
          )}
        </div>
      </div>
    </div>
  );
}

function HandbookRuleForm({ pack, rule, readOnly, overridden, isOverride, onSaved }) {
  const specs = PARAM_SPECS[rule.rule_key] || {};
  const [form, setForm] = useState(() => ({
    question: rule.question || "", help: rule.help || "", crs_ref: rule.crs_ref || "", hb_ref: rule.hb_ref || "", ai_guidance: rule.ai_guidance || "",
    enabled: rule.enabled !== false, options: (rule.options || []).map((o) => ({ value: o.value, label: o.label })),
    params: { ...(rule.params || {}) },
  }));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  useEffect(() => { setErrors([]); }, [rule.rule_key]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setErrors([]);
    try {
      const params = {};
      for (const [k, spec] of Object.entries(specs)) {
        const v = form.params[k];
        params[k] = spec.type === "number" ? Number(v) : Array.isArray(v) ? v : String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
      }
      await callLibrary("save_rule", { pack_id: pack.id, rule: {
        rule_key: rule.rule_key, question: form.question, help: form.help, crs_ref: form.crs_ref, hb_ref: form.hb_ref, ai_guidance: form.ai_guidance,
        ...(rule.locked ? {} : { enabled: form.enabled }), options: form.options, ...(Object.keys(specs).length ? { params } : {}),
      } });
      toast.success("Rule saved to the draft");
      await onSaved();
    } catch (e) {
      setErrors(e.details?.map((d) => d.message) || [e.message]);
    } finally { setSaving(false); }
  };

  const revert = async () => {
    setSaving(true);
    try { await callLibrary("delete_rule", { pack_id: pack.id, rule_key: rule.rule_key }); toast.success("Reverted to the global rule"); await onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-slate-500">{rule.rule_key}</span>
          {rule.locked ? <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" />Core Handbook step</Badge> : <Badge variant="outline">Optional step</Badge>}
          {overridden && <Badge variant="outline" className="border-indigo-300 text-indigo-700">Overridden for {scopeOf(pack)}</Badge>}
        </CardTitle>
        <CardDescription>
          {rule.locked ? "Wording, answer labels and references can change. The step can't be switched off and its answer values are fixed, so the procedure stays compliant with the Standard."
            : "This step is optional under the Handbook. Switching it off applies to every tenant in scope, whatever their own settings."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!rule.locked && (
          <div className="flex items-center gap-3">
            <Switch id="rule-enabled" checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} disabled={readOnly} />
            <Label htmlFor="rule-enabled">{form.enabled ? "Step is on" : "Step is off"}</Label>
          </div>
        )}

        {Object.keys(specs).length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(specs).map(([k, spec]) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={`p-${k}`}>{spec.label}</Label>
                <Input id={`p-${k}`} disabled={readOnly} type={spec.type === "number" ? "number" : "text"}
                  value={spec.type === "list" ? (Array.isArray(form.params[k]) ? form.params[k].join(", ") : form.params[k] || "") : form.params[k] ?? ""}
                  onChange={(e) => set("params", { ...form.params, [k]: e.target.value })} />
                {spec.type === "list" && <p className="text-[11px] text-slate-500">Comma separated. Allowed: {spec.allowed.join(", ")}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="r-question">Question</Label>
          <Textarea id="r-question" rows={2} disabled={readOnly} value={form.question} onChange={(e) => set("question", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-help">Help text</Label>
          <Textarea id="r-help" rows={3} disabled={readOnly} value={form.help} onChange={(e) => set("help", e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="r-crs">CRS reference</Label><Input id="r-crs" disabled={readOnly} value={form.crs_ref} onChange={(e) => set("crs_ref", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="r-hb">Handbook reference</Label><Input id="r-hb" disabled={readOnly} value={form.hb_ref} onChange={(e) => set("hb_ref", e.target.value)} /></div>
        </div>
        {form.options.length > 0 && (
          <div className="space-y-2">
            <Label>Answer options <span className="text-xs font-normal text-slate-500">(labels can change; values are fixed)</span></Label>
            {form.options.map((o, i) => (
              <div key={o.value} className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-500 w-28 shrink-0 truncate">{o.value}</span>
                <Input disabled={readOnly} value={o.label} onChange={(e) => set("options", form.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              </div>
            ))}
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="r-ai">AI guidance for this question</Label>
          <Textarea id="r-ai" rows={2} disabled={readOnly} value={form.ai_guidance} onChange={(e) => set("ai_guidance", e.target.value)} placeholder="What the AI may rely on, and when it must answer 'not enough information'." />
        </div>

        {errors.length > 0 && <Alert className="border-red-300 bg-red-50"><AlertDescription className="text-sm text-red-800">{errors.map((m, i) => <div key={i}>{m}</div>)}</AlertDescription></Alert>}

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Save to draft</Button>
            {isOverride && overridden && <Button variant="outline" onClick={revert} disabled={saving}><RotateCcw className="w-4 h-4 mr-1" />Revert to global rule</Button>}
          </div>
        )}
        {!baseKeys.has(rule.rule_key) && <p className="text-xs text-red-600"><Trash2 className="w-3 h-3 inline" /> Unknown rule.</p>}
      </CardContent>
    </Card>
  );
}
