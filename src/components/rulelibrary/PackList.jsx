import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { GitCompare, Loader2, Pencil, Plus, RotateCcw, Trash2, Eye } from "lucide-react";
import { callLibrary, scopeOf, STATUS_STYLE, useInvalidateLibrary } from "./useRuleLibrary";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");

/** Rule pack versions: create drafts, open, compare, roll back, delete drafts. */
export default function PackList({ packs, onOpen, onCompare }) {
  const invalidate = useInvalidateLibrary();
  const [busy, setBusy] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [scope, setScope] = useState("global");
  const [confirm, setConfirm] = useState(null); // { kind: "delete"|"rollback", pack }

  const run = async (key, fn, success) => {
    setBusy(key);
    try { const out = await fn(); toast.success(success); await invalidate(); return out; }
    catch (e) { toast.error(e.message); return null; }
    finally { setBusy(null); }
  };

  const createDraft = async () => {
    const out = await run("new", () => callLibrary("create_draft", { scope }), "Draft created");
    setNewOpen(false);
    if (out?.pack) onOpen(out.pack.id);
  };

  const scopes = [...new Set(packs.map(scopeOf))].sort((a, b) => (a === "global" ? -1 : b === "global" ? 1 : a.localeCompare(b)));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Rule pack versions</CardTitle>
          <CardDescription>
            The global pack applies to every tenant. A jurisdiction pack (for example CW) holds only the rules it changes and applies to tenants that report in that jurisdiction.
          </CardDescription>
        </div>
        <Button onClick={() => setNewOpen(true)} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-1" />New draft</Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[260px]">Change note</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-slate-500 py-8">No rule packs yet. The studio uses the built-in Handbook rules.</TableCell></TableRow>
              ) : scopes.flatMap((sc) => packs.filter((p) => scopeOf(p) === sc)).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-mono font-medium">{p.version}</div>
                    <div className="text-xs text-slate-500">{p.title}</div>
                    {p.rollback_of && <div className="text-xs text-violet-700">Rollback to {p.rollback_of}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{scopeOf(p) === "global" ? "Global" : scopeOf(p)}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_STYLE[p.status]}>{p.status}</Badge></TableCell>
                  <TableCell className="text-xs text-slate-600">{p.change_note || <span className="text-slate-400">—</span>}{p.based_on_version ? <span className="block text-slate-400">Based on {p.based_on_version}</span> : null}</TableCell>
                  <TableCell className="text-xs text-slate-600 whitespace-nowrap">{p.published_at ? <>{fmt(p.published_at)}<span className="block text-slate-400">{p.published_by}</span></> : <span className="text-slate-400">Draft by {p.created_by_email || p.created_by}</span>}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => onOpen(p.id)} title={p.status === "draft" ? "Edit" : "View"}>{p.status === "draft" ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                    <Button size="sm" variant="ghost" onClick={() => onCompare(p.id)} title="Compare"><GitCompare className="w-4 h-4" /></Button>
                    {p.status === "retired" && (
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "rollback", pack: p })} disabled={!!busy} title="Roll back to this version"><RotateCcw className="w-4 h-4" /></Button>
                    )}
                    {p.status === "draft" && (
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "delete", pack: p })} disabled={!!busy} title="Delete draft"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New draft</DialogTitle>
            <DialogDescription>A global draft starts as a copy of the published global pack. A jurisdiction draft starts empty and holds only the rules you change for that jurisdiction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="draft-scope">Scope</label>
            <Input id="draft-scope" value={scope} onChange={(e) => setScope(e.target.value)} placeholder='global, or a code such as CW' />
            <p className="text-xs text-slate-500">Type <span className="font-mono">global</span>, or a two-letter reporting jurisdiction code.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={createDraft} disabled={busy === "new"}>{busy === "new" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Create draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.kind === "delete" ? `Delete draft ${confirm?.pack.version}?` : `Roll back to ${confirm?.pack.version}?`}</DialogTitle>
            <DialogDescription>
              {confirm?.kind === "delete" ? "The draft and its rules are deleted. Published versions are not affected."
                : "This creates a new draft with the rules of that version. It goes through the same tests and impact report before you publish it."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm?.kind === "delete" ? "destructive" : "default"} disabled={!!busy} onClick={async () => {
              const c = confirm; setConfirm(null);
              if (c.kind === "delete") await run("del", () => callLibrary("delete_draft", { pack_id: c.pack.id }), "Draft deleted");
              else { const out = await run("rb", () => callLibrary("rollback", { pack_id: c.pack.id }), "Rollback draft created"); if (out?.pack) onOpen(out.pack.id); }
            }}>{confirm?.kind === "delete" ? "Delete" : "Create rollback draft"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
