import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { OUTCOME_TEXT, TRIGGER_TEXT } from "../../../base44/shared/crs/timeline.js";
import { downloadRecordsWorkbook } from "./decisionExports";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
const STATUS_FILTERS = { confirmed: ["confirmed"], all: ["confirmed", "superseded", "proposed", "rejected"] };

/** Decision records per reporting year, with the Excel export an auditor can take away. */
export default function StudioRecords({ tenantId, tenantName, settings, rows, user, onOpen }) {
  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ["studio-all-decisions", tenantId],
    queryFn: () => base44.entities.ClassificationDecision.filter({ tenant_id: tenantId }, "-decided_at", 5000),
    enabled: !!tenantId,
  });
  const years = useMemo(() => [...new Set(decisions.map((d) => d.reporting_year).filter(Boolean))].sort((a, b) => b - a), [decisions]);
  const [year, setYear] = useState("");
  const [statusFilter, setStatusFilter] = useState("confirmed");
  const [busy, setBusy] = useState(false);
  const activeYear = year || (years[0] ? String(years[0]) : "all");

  const accountsById = useMemo(() => Object.fromEntries((rows || []).map((r) => [r.id, r.account])), [rows]);
  const shown = decisions.filter((d) => (activeYear === "all" || String(d.reporting_year) === activeYear) && STATUS_FILTERS[statusFilter].includes(d.status) && d.target_type === "account");

  const exportXlsx = async () => {
    setBusy(true);
    try {
      await downloadRecordsWorkbook({ decisions: shown, accountsById, tenantName, jurisdiction: settings?.reporting_jurisdiction, year: activeYear === "all" ? "" : activeYear,
        statusFilter: statusFilter === "confirmed" ? "Confirmed" : "All (confirmed, superseded, proposed, rejected)", generatedBy: user?.email });
    } catch (e) { toast.error(`Couldn't create the Excel file: ${e.message || e}`); }
    finally { setBusy(false); }
  };

  const holder = (d) => { const a = accountsById[d.target_id]; return a ? a.account_holder_name || [a.first_name, a.last_name].filter(Boolean).join(" ") : d.input_snapshot?.account?.account_holder_name || d.target_id; };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Decision records</CardTitle>
          <CardDescription>Every confirmed decision is a permanent record of how the CRS rules applied, with its steps, evidence and references. Export a reporting year for review or audit.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={activeYear} onValueChange={setYear}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>Reporting year {y}</SelectItem>)}
              <SelectItem value="all">All years</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="confirmed">Confirmed only</SelectItem><SelectItem value="all">Include superseded and proposed</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportXlsx} disabled={busy || shown.length === 0}>{busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}Export Excel</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-teal-700" /></div> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Outcome</TableHead><TableHead>Decision</TableHead><TableHead>Decided</TableHead><TableHead>Rules</TableHead><TableHead>Keep until</TableHead></TableRow></TableHeader>
              <TableBody>
                {shown.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-slate-500 py-8">{decisions.length ? "No decisions match these filters." : "No decisions have been confirmed yet."}</TableCell></TableRow>
                ) : shown.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen?.(d.target_id)}>
                    <TableCell><div className="text-sm font-medium">{holder(d)}</div><div className="text-xs font-mono text-slate-500">{accountsById[d.target_id]?.account_number || ""}</div></TableCell>
                    <TableCell className="text-sm">{OUTCOME_TEXT[d.outcome] || d.outcome}{d.reportable_jurisdictions?.length ? ` · ${d.reportable_jurisdictions.join(", ")}` : ""}</TableCell>
                    <TableCell className="text-xs">#{d.sequence} <Badge variant="outline" className="ml-1 text-[10px]">{d.status}</Badge><div className="text-slate-500">{TRIGGER_TEXT[d.trigger] || d.trigger}</div></TableCell>
                    <TableCell className="text-xs">{fmt(d.decided_at)}<div className="text-slate-500">{d.decided_by}{d.reviewer ? ` · signed off by ${d.reviewer}` : ""}</div></TableCell>
                    <TableCell className="text-xs font-mono">{d.rule_pack_version}</TableCell>
                    <TableCell className="text-xs">{d.retention_until}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
