import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { inputHash } from "../../../base44/shared/crs/index.js";
import StudioReview, { OutcomeBadge, invokeError } from "./StudioReview";

const QUEUES = [
  { key: "ready", label: "Ready to confirm", help: "Every CRS question is answered by the account data or saved answers. Check the decision path, then confirm." },
  { key: "needs", label: "Needs input", help: "The data can't answer every CRS question. Only the open questions will be asked." },
  { key: "changed", label: "Changed", help: "Something changed after classification. The confirmed status stays until someone confirms the proposal." },
  { key: "classified", label: "Classified", help: "Confirmed decisions with a permanent record of why." },
];
const PAGE = 50;
const MAX_BULK = 100;

export default function StudioQueues({ data, initialAccountId, user, canConfirm, readOnly = false }) {
  const { rows, settings, reportableList, pack, entities } = data;
  const initialRow = rows.find((r) => r.id === initialAccountId);
  const [queue, setQueue] = useState(initialRow?.queue || "ready");
  const [selectedId, setSelectedId] = useState(initialRow?.id || null);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => {
    if (initialRow) { setQueue(initialRow.queue); setSelectedId(initialRow.id); }
  }, [initialRow?.id]);

  const counts = useMemo(() => Object.fromEntries(QUEUES.map((q) => [q.key, rows.filter((r) => r.queue === q.key).length])), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => r.queue === queue
      && (entityFilter === "all" || r.account.entity_id === entityFilter)
      && (!term || r.holderName.toLowerCase().includes(term) || String(r.account.account_number || "").toLowerCase().includes(term)));
  }, [rows, queue, search, entityFilter]);

  useEffect(() => { setPage(0); setPicked(new Set()); }, [queue, search, entityFilter]);
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const selected = rows.find((r) => r.id === selectedId) || null;
  const current = QUEUES.find((q) => q.key === queue);

  // Bulk confirm: only rows that are fully answered and not waiting for a sign-off.
  const bulkable = (r) => r.queue === "ready" && !r.awaitingSignOff && r.result.gaps.length === 0 && r.result.outcome.status !== "pending";
  const showBulk = canConfirm && queue === "ready";
  const pageBulkable = pageRows.filter(bulkable);
  const pickedRows = rows.filter((r) => picked.has(r.id) && bulkable(r));
  const togglePick = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < MAX_BULK) n.add(id); return n; });
  const allOnPage = pageBulkable.length > 0 && pageBulkable.every((r) => picked.has(r.id));
  const togglePage = () => setPicked((s) => {
    const n = new Set(s);
    if (allOnPage) pageBulkable.forEach((r) => n.delete(r.id));
    else for (const r of pageBulkable) { if (n.size >= MAX_BULK) break; n.add(r.id); }
    return n;
  });

  const runBulk = async () => {
    setBulkBusy(true);
    try {
      const expectedHashes = {};
      for (const r of pickedRows) expectedHashes[r.id] = await inputHash(r.input);
      const res = await base44.functions.invoke("studioConfirmDecision", { accountIds: pickedRows.map((r) => r.id), expectedHashes });
      const out = res?.data || {};
      if (out.error) throw new Error(out.error);
      setBulkResult(out);
      setPicked(new Set());
      toast.success(`${out.confirmed?.length || 0} confirmed${out.skipped?.length ? `, ${out.skipped.length} skipped` : ""}`);
      await data.refetch?.();
    } catch (e) {
      toast.error(`Couldn't confirm: ${invokeError(e)}`);
    } finally {
      setBulkBusy(false);
    }
  };
  const nameOf = (id) => rows.find((r) => r.id === id)?.holderName || id;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start">
      <Card className="overflow-hidden">
        <div className="flex overflow-x-auto border-b">
          {QUEUES.map((q) => (
            <button key={q.key} type="button" onClick={() => setQueue(q.key)}
              className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${queue === q.key ? "border-teal-700 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {q.label} <span className="ml-1 text-xs font-mono bg-slate-100 rounded-full px-1.5">{counts[q.key] || 0}</span>
            </button>
          ))}
        </div>
        <div className="p-3 space-y-2 border-b bg-slate-50">
          <p className="text-xs text-slate-500">{current?.help}</p>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
            <Input id="studio-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search holder or account number" className="pl-8 h-9" />
          </div>
          {showBulk && pageBulkable.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Checkbox checked={allOnPage} onCheckedChange={togglePage} />Select all on this page
              </label>
              <Button size="sm" disabled={pickedRows.length === 0} onClick={() => { setBulkResult(null); setBulkOpen(true); }} className="bg-teal-700 hover:bg-teal-800">
                <CheckCircle2 className="w-4 h-4 mr-1" />Confirm selected ({pickedRows.length})
              </Button>
            </div>
          )}
          {entities.length > 1 && (
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All RFI entities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All RFI entities</SelectItem>
                {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <CardContent className="p-0">
          {pageRows.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              {queue === "classified" ? "No confirmed decisions yet." :
                queue === "changed" ? "Nothing has changed since classification." : "No accounts in this queue."}
            </p>
          ) : (
            <ul className="divide-y">
              {pageRows.map((r) => (
                <li key={r.id} className="flex items-stretch">
                  {showBulk && (
                    <div className="flex items-center pl-3">
                      <Checkbox checked={picked.has(r.id)} disabled={!bulkable(r)} onCheckedChange={() => togglePick(r.id)} aria-label={`Select ${r.holderName}`} />
                    </div>
                  )}
                  <button type="button" onClick={() => setSelectedId(r.id)}
                    className={`flex-1 min-w-0 text-left px-3 py-2.5 hover:bg-slate-50 ${selectedId === r.id ? "bg-teal-50" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-slate-900 truncate">{r.holderName}</span>
                      <OutcomeBadge status={r.result.outcome.status} jurisdictions={r.result.outcome.jurisdictions} />
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{r.account.account_number || r.id.slice(-6)}</span>
                      <span className="capitalize">{r.account.account_holder_type}</span>
                      {r.result.gaps.length > 0 && <span className="text-blue-700">{r.result.gaps.length} question{r.result.gaps.length > 1 ? "s" : ""}</span>}
                      {r.result.outcome.action_required && <span className="text-blue-700">Action needed</span>}
                      {r.comparison === "differ" && !r.confirmedDecision && <span className="text-amber-700">Differs from manual</span>}
                      {r.awaitingSignOff && <span className="text-violet-700">Awaiting sign-off</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filtered.length > PAGE && (
            <div className="flex items-center justify-between p-2 border-t text-xs text-slate-500">
              <span>{page * PAGE + 1}–{Math.min(filtered.length, (page + 1) * PAGE)} of {filtered.length}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <StudioReview key={selected?.id || "none"} row={selected} settings={settings} reportableList={reportableList} pack={pack}
        user={user} canConfirm={canConfirm} readOnly={readOnly} onChanged={data.refetch} />

      <Dialog open={bulkOpen} onOpenChange={(o) => { if (!bulkBusy) setBulkOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{bulkResult ? "Result" : `Confirm ${pickedRows.length} decision${pickedRows.length === 1 ? "" : "s"}?`}</DialogTitle>
            <DialogDescription>
              {bulkResult ? "Confirmed accounts now show in the Classified queue." :
                `Each account is re-checked on the server. A permanent decision record is saved for each${settings?.require_second_signoff ? " and sent for a second sign-off" : " and its reportability status is updated"}.`}
            </DialogDescription>
          </DialogHeader>
          {!bulkResult ? (
            <ul className="max-h-64 overflow-y-auto text-sm divide-y border rounded">
              {pickedRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="truncate">{r.holderName}</span>
                  <OutcomeBadge status={r.result.outcome.status} jurisdictions={r.result.outcome.jurisdictions} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm space-y-2">
              <p className="text-green-800">{bulkResult.confirmed?.length || 0} {settings?.require_second_signoff ? "proposed for sign-off" : "confirmed"}.</p>
              {bulkResult.skipped?.length > 0 && (
                <div>
                  <p className="text-amber-800">{bulkResult.skipped.length} skipped:</p>
                  <ul className="max-h-48 overflow-y-auto text-xs list-disc pl-5">
                    {bulkResult.skipped.map((x) => <li key={x.id}>{nameOf(x.id)}: {x.reason}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {bulkResult ? <Button onClick={() => setBulkOpen(false)}>Close</Button> : (
              <>
                <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>Cancel</Button>
                <Button onClick={runBulk} disabled={bulkBusy || pickedRows.length === 0} className="bg-teal-700 hover:bg-teal-800">
                  {bulkBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}Confirm {pickedRows.length}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
