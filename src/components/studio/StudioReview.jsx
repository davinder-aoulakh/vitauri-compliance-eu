import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowUpRight, HelpCircle, Info } from "lucide-react";
import { OUTCOME_LABELS, MANUAL_LABELS } from "./useStudioData";

const SOURCE = {
  data: { label: "From account data", cls: "bg-teal-50 text-teal-800 border-teal-200" },
  rule: { label: "Calculated", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  reference: { label: "Reference data", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  user: { label: "Your answer", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  ai: { label: "AI suggestion", cls: "bg-violet-50 text-violet-800 border-violet-200" },
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
      {OUTCOME_LABELS[status] || status}{status === "reportable" && jurisdictions.length ? ` · ${jurisdictions.join(", ")}` : ""}
    </Badge>
  );
}

function money(value, currency) {
  if (value === null || value === undefined || value === "") return "No balance";
  return `${currency || "USD"} ${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export default function StudioReview({ row, settings, reportableList, pack }) {
  if (!row) {
    return (
      <Card className="h-full">
        <CardContent className="py-16 text-center text-sm text-slate-500">Select an account to see how the CRS rules apply to it.</CardContent>
      </Card>
    );
  }
  const { account, result } = row;
  const { outcome, steps, gaps } = result;
  const manual = account.reportability_status;
  const differs = row.comparison === "differ";

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
            <div>Rules <span className="font-mono text-slate-700">v{result.rule_pack_version}</span>{pack ? "" : " (built-in)"}</div>
            <div>Reportable list <span className="font-mono text-slate-700">{reportableList?.version || "none"}</span>{reportableList?.status === "provisional" ? " (provisional)" : ""}</div>
            <div>Jurisdiction <span className="font-mono text-slate-700">{settings?.reporting_jurisdiction}</span></div>
          </div>
        </div>

        <div className={`rounded-lg border-2 p-4 ${OUTCOME_STYLE[outcome.status] || ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{outcome.status === "pending" ? "Outcome so far" : "Studio outcome"}</p>
              <p className="text-lg font-bold flex flex-wrap items-center gap-2">
                {outcome.status === "pending" ? `Waiting on ${gaps.length || "an"} answer${gaps.length > 1 ? "s" : ""}` : OUTCOME_LABELS[outcome.status]}
                {outcome.jurisdictions.length > 0 && <Badge variant="outline" className="border-orange-300 text-orange-700">{outcome.jurisdictions.join(", ")}</Badge>}
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="text-slate-500">Manual classification today</p>
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

        {differs && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-900 text-sm">
              The studio reaches a different outcome from the manual classification ({MANUAL_LABELS[manual] || manual}). Check the decision path below before the pilot confirms anything.
              {account.reportability_reason && <span className="block mt-1 text-xs">Manual reason: {String(account.reportability_reason).slice(0, 240)}</span>}
            </AlertDescription>
          </Alert>
        )}

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">Decision path · {steps.length} step{steps.length === 1 ? "" : "s"}</p>
          <ol className="space-y-3">
            {steps.map((s, i) => (
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
                      {s.options?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {s.options.map((o) => (
                            <span key={o.value} className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-600">{o.label}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-blue-800 flex gap-1"><Info className="w-3 h-3 mt-0.5 flex-none" />Answering questions in the studio comes in the next update. Until then, record the information on the account or use the manual classification.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-sm font-semibold text-slate-800">{s.answer}</span>
                        <span className={`text-[11px] font-semibold border rounded px-1.5 ${SOURCE[s.source]?.cls || ""}`}>{SOURCE[s.source]?.label || s.source}</span>
                      </div>
                      {s.evidence && <p className="text-[11.5px] font-mono text-slate-500 mt-1 break-words">{s.evidence}</p>}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-slate-500 max-w-xl">
            Read-only preview. Nothing is saved and the account's status doesn't change. Confirming decisions arrives in the next update.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to={createPageUrl("Accounts")}>Classify manually on the Accounts page <ArrowUpRight className="w-3.5 h-3.5 ml-1" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
