import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Lock, Layers, PencilRuler, GitCompare, FlaskConical, Rocket, Database } from "lucide-react";

/**
 * CRS Rule Library (Phase 0 scaffold) — super admin only.
 *
 * Will hold the versioned CRS rule packs used by the Classification Studio:
 * parameters, wording/references and logic, with test bench, impact report,
 * publish and rollback. It does not affect the manual classification workflows.
 */

const SECTIONS = [
  { icon: Layers, title: "Rule packs", text: "Versions of the CRS rules (draft, published, retired), with jurisdiction scope and change notes." },
  { icon: PencilRuler, title: "Rule editor", text: "Change thresholds, question wording, CRS references and conditions. Core Handbook steps are locked." },
  { icon: GitCompare, title: "Compare versions", text: "Side-by-side differences between two rule pack versions." },
  { icon: FlaskConical, title: "Test bench", text: "Run a draft against test cases and real accounts before publishing." },
  { icon: Rocket, title: "Impact and publish", text: "See how many accounts would change, then publish. Publishing only creates proposals for review." },
  { icon: Database, title: "Reference data", text: "Reportable jurisdiction lists per year, TIN rules per country and exchange rates." },
];

export default function CrsRuleLibrary() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["crs-rule-library-user"],
    queryFn: () => base44.auth.me(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (user?.app_role !== "super_admin") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-slate-500" />Access denied</CardTitle>
            <CardDescription>Only super admins can manage the CRS Rule Library.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-900">CRS Rule Library</h1>
          <Badge variant="outline">Coming soon</Badge>
        </div>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          The rules the Classification Studio uses, based on the OECD CRS Implementation Handbook. Changes here never touch the
          manual classification workflows.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><s.icon className="w-4 h-4 text-indigo-600" />{s.title}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-sm text-slate-600">{s.text}</p></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
