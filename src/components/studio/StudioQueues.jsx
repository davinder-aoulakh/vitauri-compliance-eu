import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import StudioReview, { OutcomeBadge } from "./StudioReview";

const QUEUES = [
  { key: "ready", label: "Ready to confirm", help: "Fully answered by the account data. Check the decision path, then confirm (confirming arrives in the next update)." },
  { key: "needs", label: "Needs input", help: "The data can't answer every CRS question. Only the open questions will be asked." },
  { key: "changed", label: "Changed", help: "Something changed after classification. The confirmed status stays until someone confirms the proposal." },
  { key: "classified", label: "Classified", help: "Confirmed decisions with a permanent record of why." },
];
const PAGE = 50;

export default function StudioQueues({ data, initialAccountId }) {
  const { rows, settings, reportableList, pack, entities } = data;
  const initialRow = rows.find((r) => r.id === initialAccountId);
  const [queue, setQueue] = useState(initialRow?.queue || "ready");
  const [selectedId, setSelectedId] = useState(initialRow?.id || null);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [page, setPage] = useState(0);

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

  useEffect(() => { setPage(0); }, [queue, search, entityFilter]);
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const selected = rows.find((r) => r.id === selectedId) || null;
  const current = QUEUES.find((q) => q.key === queue);

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
              {queue === "classified" ? "No confirmed decisions yet. They appear here once confirming is switched on." :
                queue === "changed" ? "Nothing has changed since classification." : "No accounts in this queue."}
            </p>
          ) : (
            <ul className="divide-y">
              {pageRows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 ${selectedId === r.id ? "bg-teal-50" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-slate-900 truncate">{r.holderName}</span>
                      <OutcomeBadge status={r.result.outcome.status} jurisdictions={r.result.outcome.jurisdictions} />
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{r.account.account_number || r.id.slice(-6)}</span>
                      <span className="capitalize">{r.account.account_holder_type}</span>
                      {r.result.gaps.length > 0 && <span className="text-blue-700">{r.result.gaps.length} question{r.result.gaps.length > 1 ? "s" : ""}</span>}
                      {r.result.outcome.action_required && <span className="text-blue-700">Action needed</span>}
                      {r.comparison === "differ" && <span className="text-amber-700">Differs from manual</span>}
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
      <StudioReview row={selected} settings={settings} reportableList={reportableList} pack={pack} />
    </div>
  );
}
