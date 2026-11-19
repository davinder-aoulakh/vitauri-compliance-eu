import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { diffPacks, baselineRuleRows } from "../../../base44/shared/crs/index.js";
import { loadPackWithRules, scopeOf } from "./useRuleLibrary";

const BASELINE = "__baseline__";
const show = (v) => (v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Side-by-side differences between two versions (or a version and the built-in baseline). */
export default function PackCompare({ packs, initialRightId }) {
  const [leftId, setLeftId] = useState(BASELINE);
  const [rightId, setRightId] = useState(initialRightId || packs[0]?.id || BASELINE);
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (initialRightId) setRightId(initialRightId); }, [initialRightId]);
  useEffect(() => {
    const right = packs.find((p) => p.id === rightId);
    if (right && leftId === BASELINE) {
      const sameScopePublished = packs.find((p) => p.status === "published" && scopeOf(p) === scopeOf(right) && p.id !== right.id);
      if (sameScopePublished) setLeftId(sameScopePublished.id);
    }
    // only when the right side changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const load = async (id) => (id === BASELINE ? baselineRuleRows() : (await loadPackWithRules(packs.find((p) => p.id === id)))?.rules || []);
      const [a, b] = await Promise.all([load(leftId), load(rightId)]);
      if (alive) { setDiff(diffPacks(a, b)); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [leftId, rightId, packs]);

  const label = (p) => `${scopeOf(p) === "global" ? "Global" : scopeOf(p)} v${p.version} (${p.status})`;
  const picker = (value, onChange) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={BASELINE}>Built-in Handbook baseline</SelectItem>
        {packs.map((p) => <SelectItem key={p.id} value={p.id}>{label(p)}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compare versions</CardTitle>
        <CardDescription>A jurisdiction pack only holds the rules it changes, so compare it with the built-in baseline or another version of the same jurisdiction.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">{picker(leftId, setLeftId)}<span className="text-slate-400">→</span>{picker(rightId, setRightId)}</div>
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> : !diff?.length ? (
          <p className="text-sm text-slate-500">No differences.</p>
        ) : (
          <div className="space-y-3">
            {diff.map((d) => (
              <div key={d.rule_key} className="border rounded">
                <div className="px-3 py-2 bg-slate-50 border-b flex items-center gap-2">
                  <span className="font-mono text-sm">{d.rule_key}</span>
                  <Badge variant="outline" className={d.change === "added" ? "border-green-300 text-green-800" : d.change === "removed" ? "border-red-300 text-red-800" : "border-amber-300 text-amber-800"}>{d.change}</Badge>
                </div>
                {d.fields.length > 0 && (
                  <div className="divide-y">
                    {d.fields.map((f) => (
                      <div key={f.field} className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] px-3 py-2 text-xs">
                        <span className="font-mono text-slate-500">{f.field}</span>
                        <span className="bg-red-50 text-red-900 rounded px-1 break-words">{show(f.before)}</span>
                        <span className="bg-green-50 text-green-900 rounded px-1 break-words">{show(f.after)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
