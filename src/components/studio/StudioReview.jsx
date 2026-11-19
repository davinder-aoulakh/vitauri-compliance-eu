import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, ArrowUpRight, CheckCircle2, HelpCircle, Loader2, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { evaluate, inputHash } from "../../../base44/shared/crs/index.js";
import { OUTCOME_LABELS, MANUAL_LABELS } from "./useStudioData";

const SOURCE = {
  data: { label: "From account data", cls: "bg-teal-50 text-teal-800 border-teal-200" },
  rule: { label: "Calculated", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  reference: { label: "Reference data", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  user: { label: "Your answer", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  ai: { label: "AI suggestion · accepted", cls: "bg-violet-50 text-violet-800 border-violet-200" },
};

const OUTCOME_STYLE = {
  reportable: "border-orange-500 text-orange-700",
  non_reportable: "border-green-600 text-green-700",
  excluded: "border-green-600 text-green-700",
  undocumented: "border-fuchsia-600 text-fuchsia-700",
  pending: "border-blue-500 border-dashed text-blue-700",
};

export function OutcomeBadge({ status, jurisdictions = [] }) {
  const cls = {
    reportable: "bg-orange-50 text-orange-700 border-orange-200",
    non_reportable: "bg-green-50 text-green-700 border-green-200",
    excluded: "bg-green-50 text-green-700 border-green-200",
    undocumented: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    pending: "bg-blue-50 text-blue-700 border-blue-200",
  }[status] || "bg-slate-50 text-slate-700";
  return (
    <Badge variant="outline" className={`${cls} whitespace-nowrap`}>
      {OUTCOME_LABELS[status] || status}{(status === "reportable" || status === "undocumented") && jurisdictions.length ? ` · ${jurisdictions.join(", ")}` : ""}
    </Badge>
  );
}

function money(value, currency) {
  if (value === null || value === undefined || value === "") return "No balance";
  return `${currency || "USD"} ${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");

/** The error text from a failed functions.invoke call. */
export function invokeError(err) {
  return err?.response?.data?.error || err?.data?.error || err?.message || String(err);
}

// Only the fields StudioEvidence stores for a suggestion.
const storedSuggestion = (s) => ({ gap_key: s.gap_key, answer: s.answer, confidence: s.confidence, rationale: s.rationale, fields_used: s.fields_used || [], suggested_at: s.suggested_at, accepted: !!s.accepted });

export default function StudioReview({ row, settings, reportableList, pack, user, canConfirm, readOnly = false, onChanged }) {
  const evidence = row?.input?.evidence || {};
  const [answers, setAnswers] = useState(() => ({ ...(evidence.draft_gap_answers || {}) }));
  const [suggestions, setSuggestions] = useState(() => evidence.draft_ai_suggestions || []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const live = useMemo(() => {
    if (!row) return null;
    try { return evaluate(row.input, answers); } catch (e) { console.error(e); return row.result; }
  }, [row, answers]);

  if (!row) {
    return (
      <Card className="h-full">
        <CardContent className="py-16 text-center text-sm text-slate-500">Select an account to see how the CRS rules apply to it.</CardContent>
      </Card>
    );
  }

  const { account } = row;
  const { outcome, steps, gaps } = live;
  const manual = account.reportability_status;
  const confirmedDecision = row.confirmedDecision;
  const proposal = row.proposedDecision;
  const ready = outcome.status !== "pending" && gaps.length === 0;
  const aiEnabled = settings?.ai_suggestions_enabled !== false && !readOnly;
  const suggestionFor = (key) => suggestions.find((s) => s.gap_key === key && !s.dismissed);
  const acceptedFor = (key) => suggestions.find((s) => s.gap_key === key && s.accepted);
  const liveDiffersFromConfirmed = confirmedDecision && (confirmedDecision.outcome !== outcome.status
    || [...(confirmedDecision.reportable_jurisdictions || [])].sort().join(",") !== [...(outcome.jurisdictions || [])].sort().join(","));
  const differsFromManual = !confirmedDecision && row.comparison === "differ";

  const answer = (key, value, fromAi = false) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setSuggestions((list) => list.map((s) => (s.gap_key === key ? { ...s, accepted: fromAi && String(s.answer) === String(value) } : s)));
    setDirty(true);
  };
  const clearAnswer = (key) => {
    setAnswers((a) => { const next = { ...a }; delete next[key]; return next; });
    setSuggestions((list) => list.map((s) => (s.gap_key === key ? { ...s, accepted: false } : s)));
    setDirty(true);
  };

  const save = async ({ quiet = false } = {}) => {
    setSaving(true);
    try {
      const payload = {
        draft_gap_answers: answers,
        draft_ai_suggestions: suggestions.filter((s) => !s.dismissed).map(storedSuggestion),
        updated_by: user?.email || "",
      };
      if (evidence.id) await base44.entities.StudioEvidence.update(evidence.id, payload);
      else await base44.entities.StudioEvidence.create({ tenant_id: account.tenant_id, account_id: account.id, ...payload });
      setDirty(false);
      if (!quiet) toast.success("Answers saved");
      await onChanged?.();
      return true;
    } catch (e) {
      toast.error(`Couldn't save the answers: ${e.message || e}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const suggest = async () => {
    setSuggesting(true);
    try {
      const res = await base44.functions.invoke("studioSuggestGaps", { accountId: account.id, answers });
      if (res?.data?.error) throw new Error(res.data.error);
      const incoming = res?.data?.suggestions || [];
      if (!incoming.length) { toast.info("There are no open questions to suggest answers for."); return; }
      setSuggestions((list) => [...list.filter((s) => !incoming.some((n) => n.gap_key === s.gap_key)), ...incoming]);
      setDirty(true);
    } catch (e) {
      toast.error(`AI suggestion failed: ${invokeError(e)}`);
    } finally {
      setSuggesting(false);
    }
  };

  const confirm = async () => {
    setConfirming(true);
    try {
      if (dirty && !(await save({ quiet: true }))) return;
      const hash = await inputHash(row.input);
      const res = await base44.functions.invoke("studioConfirmDecision", { accountIds: [account.id], expectedHashes: { [account.id]: hash }, note });
      const data = res?.data || {};
      if (data.error) throw new Error(data.error);
      if (data.skipped?.length) { toast.error(data.skipped[0].reason); return; }
      const done = data.confirmed?.[0];
      toast.success(done?.awaiting_sign_off ? "Decision proposed. A second admin or supervisor needs to sign it off." : "Decision confirmed and saved to the account.");
      setConfirmOpen(false);
      setNote("");
      await onChanged?.();
    } catch (e) {
      toast.error(`Couldn't confirm: ${invokeError(e)}`);
    } finally {
      setConfirming(false);
    }
  };

  const signOff = async () => {
    setConfirming(true);
    try {
      const res = await base44.functions.invoke("studioConfirmDecision", { signOffDecisionId: proposal.id });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success("Signed off. The decision is confirmed and saved to the account.");
      await onChanged?.();
    } catch (e) {
      toast.error(`Couldn't sign off: ${invokeError(e)}`);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 break-words">{row.holderName}</h2>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
              <span className="font-mono">{account.account_number || account.id}</span>
              <span className="capitalize">{account.account_holder_type || "holder type not set"}</span>
              <span>{(account.account_type || "account type not set").replaceAll("_", " ")}</span>
              <span>{money(account.year_end_cash_value, account.year_end_cash_value_currency)}</span>
              {account.account_creation_date && <span>Opened {account.account_creation_date}</span>}
              {row.entityName && <span>RFI: {row.entityName}</span>}
            </div>
          </div>
          <div className="text-xs text-slate-500 text-right">
            <div>Rules <span className="font-mono text-slate-700">v{live.rule_pack_version}</span>{pack ? "" : " (built-in)"}</div>
            <div>Reportable list <span className="font-mono text-slate-700">{reportableList?.version || "none"}</span>{reportableList?.status === "provisional" ? " (provisional)" : ""}</div>
            <div>Jurisdiction <span className="font-mono text-slate-700">{settings?.reporting_jurisdiction}</span></div>
          </div>
        </div>

        {confirmedDecision && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-green-900">
              <CheckCircle2 className="w-4 h-4" />Confirmed decision #{confirmedDecision.sequence}
              <OutcomeBadge status={confirmedDecision.outcome} jurisdictions={confirmedDecision.reportable_jurisdictions || []} />
            </p>
            <p className="text-xs text-green-900 mt-1">
              By {confirmedDecision.decided_by} on {fmtDate(confirmedDecision.decided_at)}
              {confirmedDecision.reviewer ? ` · signed off by ${confirmedDecision.reviewer}` : ""}
              {confirmedDecision.retention_until ? ` · kept until ${confirmedDecision.retention_until}` : ""}
            </p>
            {confirmedDecision.note && <p className="text-xs text-green-900 mt-1">Note: {confirmedDecision.note}</p>}
            {liveDiffersFromConfirmed && (
              <p className="text-xs text-amber-800 mt-2 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 flex-none mt-0.5" />The data has changed since this was confirmed: the rules now give a different result (below). Review it and confirm again if it is right.</p>
            )}
          </div>
        )}

        {proposal && (
          <Alert className="border-violet-300 bg-violet-50">
            <AlertDescription className="text-sm text-violet-900 flex flex-wrap items-center justify-between gap-3">
              <span>Proposed by {proposal.decided_by} on {fmtDate(proposal.decided_at)}: <strong>{OUTCOME_LABELS[proposal.outcome]}</strong>{proposal.reportable_jurisdictions?.length ? ` · ${proposal.reportable_jurisdictions.join(", ")}` : ""}. Waiting for a second sign-off.</span>
              {canConfirm && proposal.decided_by !== user?.email && (
                <Button size="sm" onClick={signOff} disabled={confirming}>{confirming ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}Sign off</Button>
              )}
              {canConfirm && proposal.decided_by === user?.email && <span className="text-xs">A different admin or supervisor must sign off.</span>}
            </AlertDescription>
          </Alert>
        )}

        <div className={`rounded-lg border-2 p-4 ${OUTCOME_STYLE[outcome.status] || ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{outcome.status === "pending" ? "Outcome so far" : confirmedDecision ? "Studio outcome now" : "Studio outcome"}</p>
              <p className="text-lg font-bold flex flex-wrap items-center gap-2">
                {outcome.status === "pending" ? (gaps.length ? `Waiting on ${gaps.length} answer${gaps.length > 1 ? "s" : ""}` : "Action needed") : OUTCOME_LABELS[outcome.status]}
                {outcome.jurisdictions.length > 0 && <Badge variant="outline" className="border-orange-300 text-orange-700">{outcome.jurisdictions.join(", ")}</Badge>}
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="text-slate-500">Account status today</p>
              <p className="font-semibold text-slate-800">{MANUAL_LABELS[manual] || manual || "Not set"}</p>
            </div>
          </div>
          <p className="text-sm text-slate-700 mt-2">{outcome.reason}</p>
          {outcome.persons?.length > 0 && (
            <ul className="mt-2 text-xs text-slate-600 list-disc pl-5">
              {outcome.persons.map((p, i) => <li key={i}>{p.name} · {p.role} · {p.jurisdictions.join(", ")}</li>)}
            </ul>
          )}
        </div>

        {differsFromManual && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-900 text-sm">
              The studio reaches a different outcome from the manual classification ({MANUAL_LABELS[manual] || manual}). Check the decision path below before confirming. Confirming replaces the account status.
              {account.reportability_reason && <span className="block mt-1 text-xs">Manual reason: {String(account.reportability_reason).slice(0, 240)}</span>}
            </AlertDescription>
          </Alert>
        )}

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Decision path · {steps.length} step{steps.length === 1 ? "" : "s"}</p>
            {gaps.length > 0 && aiEnabled && (
              <Button size="sm" variant="outline" onClick={suggest} disabled={suggesting} className="border-violet-300 text-violet-800">
                {suggesting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}Suggest answers with AI
              </Button>
            )}
          </div>
          <ol className="space-y-3">
            {steps.map((s, i) => {
              const sug = s.gap ? suggestionFor(s.key) : null;
              const fromAi = !s.gap && s.source === "user" && acceptedFor(s.key) && String(acceptedFor(s.key).answer) === String(s.value);
              const src = fromAi ? "ai" : s.source;
              return (
                <li key={`${s.key}-${i}`} className="flex gap-3">
                  <span className={`flex-none w-6 h-6 rounded-full text-[11px] font-mono grid place-items-center border ${s.gap ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-500 border-slate-200"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium text-sm text-slate-900">{s.question}</span>
                      {(s.crs_ref || s.hb_ref) && (
                        <span className="text-[11px] font-mono text-slate-500 border border-dashed border-slate-300 rounded px-1">
                          {s.crs_ref ? `CRS ${s.crs_ref}` : ""}{s.crs_ref && s.hb_ref ? " · " : ""}{s.hb_ref ? `HB ${s.hb_ref}` : ""}
                        </span>
                      )}
                      {s.holder && <Badge variant="secondary" className="text-[10px]">Holder {s.holder}</Badge>}
                    </div>
                    {s.gap ? (
                      <div className="mt-2 rounded-md border border-blue-300 bg-blue-50 p-3 space-y-2">
                        <p className="text-xs text-blue-900 flex gap-1"><HelpCircle className="w-3.5 h-3.5 mt-0.5 flex-none" />The data can't answer this.{s.help ? ` ${s.help}` : ""}</p>
                        {s.options?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {s.options.map((o) => (
                              <Button key={o.value} type="button" size="sm" variant="outline" className="h-auto py-1.5 text-xs bg-white whitespace-normal text-left" onClick={() => answer(s.key, o.value)}>
                                {o.label}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-blue-900">Record this on the account, then come back.</p>
                        )}
                        {sug && (
                          <div className="rounded border border-violet-200 bg-white p-2 text-xs space-y-1">
                            <p className="font-semibold text-violet-900 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />AI suggests: {sug.answer === "unknown" ? "Not enough information" : (s.options.find((o) => o.value === sug.answer)?.label || sug.answer)}
                              <span className="font-mono font-normal text-violet-700">· {Math.round((sug.confidence || 0) * 100)}% confident</span></p>
                            {sug.rationale && <p className="text-slate-700">{sug.rationale}</p>}
                            {sug.fields_used?.length > 0 && <p className="font-mono text-[11px] text-slate-500">Used: {sug.fields_used.join(", ")}</p>}
                            <div className="flex gap-2 pt-1">
                              {sug.answer !== "unknown" && s.options.some((o) => o.value === sug.answer) && (
                                <Button size="sm" className="h-7 text-xs bg-violet-700 hover:bg-violet-800" onClick={() => answer(s.key, sug.answer, true)}>Use this</Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setSuggestions((l) => l.filter((x) => x.gap_key !== s.key)); setDirty(true); }}><X className="w-3 h-3 mr-1" />Dismiss</Button>
                            </div>
                            <p className="text-[11px] text-slate-500">You decide: a suggestion is only used if you choose it.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-sm font-semibold text-slate-800">{s.answer}</span>
                          <span className={`text-[11px] font-semibold border rounded px-1.5 ${SOURCE[src]?.cls || ""}`}>{SOURCE[src]?.label || src}</span>
                          {s.source === "user" && (
                            <button type="button" className="text-[11px] text-slate-500 underline hover:text-slate-800 inline-flex items-center gap-0.5" onClick={() => clearAnswer(s.key)}>
                              <RotateCcw className="w-3 h-3" />Change
                            </button>
                          )}
                        </div>
                        {s.evidence && <p className="text-[11.5px] font-mono text-slate-500 mt-1 break-words">{s.evidence}</p>}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {!proposal && canConfirm && (
              <Button onClick={() => setConfirmOpen(true)} disabled={!ready || confirming} className="bg-teal-700 hover:bg-teal-800">
                <CheckCircle2 className="w-4 h-4 mr-1" />{confirmedDecision ? "Confirm again" : "Confirm decision"}
              </Button>
            )}
            {!readOnly && (
              <Button variant="outline" onClick={() => save()} disabled={!dirty || saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Save answers
              </Button>
            )}
            {dirty && !readOnly && <span className="text-xs text-amber-700">Unsaved answers</span>}
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to={createPageUrl("Accounts")}>Classify manually on the Accounts page <ArrowUpRight className="w-3.5 h-3.5 ml-1" /></Link>
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          {readOnly ? "Super admin view: you can try answers here, but nothing is saved or confirmed."
            : !canConfirm ? "You can answer questions and save them. A tenant admin or supervisor confirms the decision."
            : !ready ? "Answer the open questions to confirm." : "Confirming saves a permanent decision record and updates the account's reportability status."}
        </p>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm this decision?</DialogTitle>
              <DialogDescription>
                {row.holderName} · <strong>{OUTCOME_LABELS[outcome.status]}</strong>{outcome.jurisdictions.length ? ` · ${outcome.jurisdictions.join(", ")}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm text-slate-700">
              <p>The rules are re-checked on the server. A permanent decision record with the full decision path is saved{settings?.require_second_signoff ? " and sent for a second sign-off" : ", and the account status is set to " + (outcome.status === "undocumented" ? "Reportable (undocumented)" : OUTCOME_LABELS[outcome.status])}.</p>
              {manual && !confirmedDecision && <p className="text-xs text-slate-500">Current account status: {MANUAL_LABELS[manual] || manual}.</p>}
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={2000} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={confirming}>Cancel</Button>
              <Button onClick={confirm} disabled={confirming} className="bg-teal-700 hover:bg-teal-800">
                {confirming ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
