import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Database, FlaskConical, GitCompare, Layers, Loader2, Lock, PencilRuler } from "lucide-react";
import PackList from "@/components/rulelibrary/PackList";
import RuleEditor from "@/components/rulelibrary/RuleEditor";
import PackCompare from "@/components/rulelibrary/PackCompare";
import TestPublish from "@/components/rulelibrary/TestPublish";
import ReferenceData from "@/components/rulelibrary/ReferenceData";
import { usePacks, usePackRules, scopeOf, STATUS_STYLE } from "@/components/rulelibrary/useRuleLibrary";

/**
 * CRS Rule Library — super admin only.
 * Versioned CRS rule packs used by the Classification Studio: edit (parameters, wording, optional steps, extra
 * questions), compare, test on the Handbook reference cases and real accounts, impact report, publish and rollback.
 * All writes go through the studioRulePack backend function. Manual classification workflows are not affected.
 */
export default function CrsRuleLibrary() {
  const { data: user, isLoading } = useQuery({ queryKey: ["crs-rule-library-user"], queryFn: () => base44.auth.me() });
  const isSuperAdmin = user?.app_role === "super_admin";
  const { data: packs = [], isLoading: packsLoading } = usePacks();
  const [tab, setTab] = useState("packs");
  const [packId, setPackId] = useState(null);
  const [compareId, setCompareId] = useState(null);

  const published = useMemo(() => packs.filter((p) => p.status === "published"), [packs]);
  const globalPub = published.find((p) => scopeOf(p) === "global") || null;
  const overridePubs = published.filter((p) => scopeOf(p) !== "global");

  // Rules of the published packs (for override drafts, tests and impact).
  const { data: publishedRules } = useQuery({
    queryKey: ["rule-library-rules", "published", published.map((p) => p.id).join(",")],
    queryFn: async () => Object.fromEntries(await Promise.all(published.map(async (p) => [p.id, await base44.entities.CrsRule.filter({ pack_id: p.id }, "order", 500)]))),
    enabled: isSuperAdmin && published.length > 0,
  });
  const globalPublished = globalPub && publishedRules ? { ...globalPub, rules: publishedRules[globalPub.id] || [] } : null;
  const overridesByScope = useMemo(() => Object.fromEntries(overridePubs.map((p) => [scopeOf(p), { ...p, rules: publishedRules?.[p.id] || [] }])), [overridePubs, publishedRules]);

  const defaultPack = packs.find((p) => p.status === "draft") || globalPub || packs[0] || null;
  const pack = packs.find((p) => p.id === packId) || defaultPack;
  const { data: rules = [], isLoading: rulesLoading } = usePackRules(pack?.id);

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
  }
  if (!isSuperAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-slate-500" />Access denied</CardTitle><CardDescription>Only super admins can manage the CRS Rule Library.</CardDescription></CardHeader></Card>
      </div>
    );
  }

  const open = (id) => { setPackId(id); setTab("editor"); };
  const packPicker = (
    <Select value={pack?.id || ""} onValueChange={setPackId}>
      <SelectTrigger className="w-80"><SelectValue placeholder="Choose a version" /></SelectTrigger>
      <SelectContent>{packs.map((p) => <SelectItem key={p.id} value={p.id}>{scopeOf(p) === "global" ? "Global" : scopeOf(p)} · v{p.version} · {p.status}</SelectItem>)}</SelectContent>
    </Select>
  );
  const needsPack = (content) => (packsLoading || (pack && rulesLoading) || (published.length > 0 && !publishedRules)) ? (
    <div className="flex items-center gap-2 py-12 justify-center text-sm text-slate-500"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" />Loading rules…</div>
  ) : !pack ? <p className="text-sm text-slate-500">No rule pack yet. Create a draft on the Rule packs tab.</p> : content;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900">CRS Rule Library</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            The rules the Classification Studio uses, based on the OECD CRS Implementation Handbook. Core Handbook steps are locked. Every change is tested on the Handbook reference cases and checked against real accounts before it is published. Changes here never touch the manual classification workflows.
          </p>
        </div>
        <div className="text-xs text-slate-600 text-right space-y-1">
          <div>In use: {globalPub ? <Badge variant="outline" className={STATUS_STYLE.published}>Global v{globalPub.version}</Badge> : <Badge variant="outline">Built-in baseline</Badge>}</div>
          {overridePubs.length > 0 && <div>{overridePubs.map((p) => <Badge key={p.id} variant="outline" className={`${STATUS_STYLE.published} ml-1`}>{scopeOf(p)} v{p.version}</Badge>)}</div>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="packs"><Layers className="w-4 h-4 mr-2" />Rule packs</TabsTrigger>
          <TabsTrigger value="editor"><PencilRuler className="w-4 h-4 mr-2" />Rules</TabsTrigger>
          <TabsTrigger value="compare"><GitCompare className="w-4 h-4 mr-2" />Compare</TabsTrigger>
          <TabsTrigger value="test"><FlaskConical className="w-4 h-4 mr-2" />Test and publish</TabsTrigger>
          <TabsTrigger value="reference"><Database className="w-4 h-4 mr-2" />Reference data</TabsTrigger>
        </TabsList>

        <TabsContent value="packs" className="mt-4">
          {packsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackList packs={packs} onOpen={open} onCompare={(id) => { setCompareId(id); setTab("compare"); }} />}
        </TabsContent>
        <TabsContent value="editor" className="mt-4 space-y-3">
          {packPicker}
          {needsPack(pack && <RuleEditor key={pack.id} pack={pack} rules={rules} globalPublished={globalPublished} />)}
        </TabsContent>
        <TabsContent value="compare" className="mt-4">
          {packsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackCompare packs={packs} initialRightId={compareId || pack?.id} />}
        </TabsContent>
        <TabsContent value="test" className="mt-4 space-y-3">
          {packPicker}
          {needsPack(pack && <TestPublish key={`${pack.id}-${pack.rules_fingerprint}`} pack={pack} rules={rules} globalPublished={globalPublished} overridesByScope={overridesByScope} />)}
        </TabsContent>
        <TabsContent value="reference" className="mt-4">
          <ReferenceData user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
