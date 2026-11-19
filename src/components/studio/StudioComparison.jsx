import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { OutcomeBadge } from "./StudioReview";
import { MANUAL_LABELS, OUTCOME_LABELS } from "./useStudioData";

const FILTERS = [
  { key: "differ", label: "Different outcome" },
  { key: "needs_input", label: "Studio needs input" },
  { key: "manual_open", label: "Manual still open" },
  { key: "agree", label: "Same outcome" },
  { key: "all", label: "All accounts" },
];

const csvCell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

/** Shadow comparison: studio outcome vs today's manual reportability status. Read-only. */
export default function StudioComparison({ data, onOpen }) {
  const { rows } = data;
  const [filter, setFilter] = useState("differ");

  const counts = useMemo(() => {
    const c = { agree: 0, differ: 0, needs_input: 0, manual_open: 0 };
    rows.forEach((r) => { c[r.comparison] = (c[r.comparison] || 0) + 1; });
    return c;
  }, [rows]);

  const gapTypes = useMemo(() => {
    const m = {};
    rows.forEach((r) => r.result.gaps.forEach((g) => { m[g.question] = (m[g.question] || 0) + 1; }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  const shown = rows.filter((r) => filter === "all" || r.comparison === filter);

  const exportCsv = () => {
    const header = ["Account number", "Holder", "Holder type", "Account type", "Manual status", "Studio outcome", "Studio jurisdictions", "Comparison", "Open question", "Studio reason", "Manual reason"];
    const lines = rows.map((r) => [r.account.account_number || r.id, r.holderName, r.account.account_holder_type, r.account.account_type,
      MANUAL_LABELS[r.account.reportability_status] || r.account.reportability_status, OUTCOME_LABELS[r.result.outcome.status],
      r.result.outcome.jurisdictions.join(" "), r.comparison, r.result.gaps.map((g) => g.question).join(" | "), r.result.outcome.reason, r.account.reportability_reason].map(csvCell).join(","));
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `studio-vs-manual-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const tile = (label, value, cls) => (
    <div className="rounded-lg border p-3"><p className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</p><p className="text-xs text-slate-500">{label}</p></div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Studio vs manual classification</CardTitle>
          <CardDescription>
            A read-only comparison of the studio's outcome with each account's current manual status. Use it to review the rules before anyone confirms decisions in the studio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            {tile("Accounts", rows.length, "text-slate-900")}
            {tile("Same outcome", counts.agree, "text-green-700")}
            {tile("Different outcome", counts.differ, "text-amber-700")}
            {tile("Studio needs input", counts.needs_input, "text-blue-700")}
            {tile("Manual still open", counts.manual_open, "text-slate-600")}
          </div>
          {gapTypes.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">Most common open questions</p>
              <ul className="text-sm text-slate-700 space-y-0.5">
                {gapTypes.map(([q, n]) => <li key={q}><span className="font-mono text-xs text-slate-500 mr-2">{n}×</span>{q}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{FILTERS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Manual today</TableHead>
                  <TableHead>Studio</TableHead>
                  <TableHead className="min-w-[320px]">Why (studio)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-slate-500 py-8">No accounts match this filter.</TableCell></TableRow>
                ) : shown.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(r.id)}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.holderName}</div>
                      <div className="text-xs text-slate-500 font-mono">{r.account.account_number || r.id.slice(-6)}</div>
                    </TableCell>
                    <TableCell className="text-sm">{MANUAL_LABELS[r.account.reportability_status] || r.account.reportability_status || "Not set"}</TableCell>
                    <TableCell><OutcomeBadge status={r.result.outcome.status} jurisdictions={r.result.outcome.jurisdictions} /></TableCell>
                    <TableCell className="text-xs text-slate-600">{r.result.gaps[0]?.question || r.result.outcome.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
