import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/** All rule pack versions, newest first. */
export function usePacks() {
  return useQuery({
    queryKey: ["rule-library-packs"],
    queryFn: () => base44.entities.CrsRulePack.filter({}, "-created_date", 500),
  });
}

/** The rules of one pack. */
export function usePackRules(packId) {
  return useQuery({
    queryKey: ["rule-library-rules", packId],
    queryFn: () => base44.entities.CrsRule.filter({ pack_id: packId }, "order", 500),
    enabled: !!packId,
  });
}

/** Load a pack together with its rules (for tests, compare and impact). */
export async function loadPackWithRules(pack) {
  if (!pack) return null;
  const rules = await base44.entities.CrsRule.filter({ pack_id: pack.id }, "order", 500);
  return { ...pack, rules };
}

export const scopeOf = (p) => p?.jurisdiction_scope || "global";
export const publishedFor = (packs, scope) => (packs || []).find((p) => p.status === "published" && scopeOf(p) === scope) || null;

/** Call the studioRulePack backend function; throws an Error with the server's message (and details) on failure. */
export async function callLibrary(action, params = {}) {
  try {
    const res = await base44.functions.invoke("studioRulePack", { action, ...params });
    const data = res?.data || {};
    if (data.error) { const e = new Error(data.error); e.details = data.details; throw e; }
    return data;
  } catch (err) {
    const data = err?.response?.data;
    if (data?.error) { const e = new Error(data.error); e.details = data.details; throw e; }
    throw err;
  }
}

export function useInvalidateLibrary() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ["rule-library-packs"] }),
    qc.invalidateQueries({ queryKey: ["rule-library-rules"] }),
    qc.invalidateQueries({ queryKey: ["studio-rule-pack"] }),
  ]);
}

export const STATUS_STYLE = {
  draft: "bg-amber-50 text-amber-800 border-amber-200",
  published: "bg-green-50 text-green-800 border-green-200",
  retired: "bg-slate-100 text-slate-600 border-slate-200",
};
