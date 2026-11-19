import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { evaluate } from "../../../base44/shared/crs/index.js";

/**
 * Loads everything the Classification Studio needs for one tenant and evaluates every account
 * with the shared CRS engine (in the browser; read-only — nothing is written).
 *
 * Queues:
 *  - classified: a confirmed ClassificationDecision exists (Phase 4+)
 *  - changed:    a proposed decision exists for an account that was already classified (Phase 7+)
 *  - needs:      the engine needs answers the data can't give
 *  - ready:      fully answered by the data, waiting for confirmation
 */
export const OUTCOME_LABELS = {
  reportable: "Reportable",
  non_reportable: "Non-reportable",
  excluded: "Excluded",
  undocumented: "Undocumented",
  pending: "Needs input",
};

export const MANUAL_LABELS = {
  reportable: "Reportable",
  non_reportable: "Non-reportable",
  excluded: "Excluded",
  pending_review: "Pending review",
  work_in_progress: "In progress",
};

/** Does the studio outcome agree with the manual reportability status? */
export function compareWithManual(manual, studio) {
  if (studio === "pending") return "needs_input";
  if (!manual || manual === "pending_review" || manual === "work_in_progress") return "manual_open";
  const m = manual === "excluded" ? "non_reportable" : manual;
  const s = studio === "excluded" ? "non_reportable" : studio === "undocumented" ? "reportable" : studio;
  return m === s ? "agree" : "differ";
}

const LIMIT = 5000;

export function useStudioData(tenantId) {
  const enabled = !!tenantId;

  const settingsQ = useQuery({
    queryKey: ["studio-settings", tenantId],
    queryFn: async () => (await base44.entities.StudioSettings.filter({ tenant_id: tenantId }))[0] || null,
    enabled,
  });
  const jurisdiction = settingsQ.data?.reporting_jurisdiction;

  const listQ = useQuery({
    queryKey: ["studio-reportable-list", jurisdiction],
    queryFn: async () => {
      const rows = await base44.entities.ReportableJurisdictionList.filter({ reporting_jurisdiction: jurisdiction });
      return rows.filter((r) => r.status !== "retired").sort((a, b) => (b.year || 0) - (a.year || 0))[0] || null;
    },
    enabled: !!jurisdiction,
  });

  const countriesQ = useQuery({
    queryKey: ["studio-countries"],
    queryFn: () => base44.entities.CrsCountryInfo.filter({}, "country_code", 1000),
    staleTime: 10 * 60 * 1000,
  });

  const packQ = useQuery({
    queryKey: ["studio-rule-pack"],
    queryFn: async () => {
      const packs = await base44.entities.CrsRulePack.filter({ status: "published" }, "-published_at", 10);
      const pack = packs.find((p) => !p.jurisdiction_scope || p.jurisdiction_scope === "global") || null;
      if (!pack) return null;
      const rules = await base44.entities.CrsRule.filter({ pack_id: pack.id }, "order", 500);
      return { ...pack, rules };
    },
    staleTime: 5 * 60 * 1000,
  });

  const accountsQ = useQuery({
    queryKey: ["studio-accounts", tenantId],
    queryFn: () => base44.entities.Account.filter({ tenant_id: tenantId }, "-updated_date", LIMIT),
    enabled,
  });
  const cpsQ = useQuery({
    queryKey: ["studio-cps", tenantId],
    queryFn: () => base44.entities.ControllingPerson.filter({ tenant_id: tenantId }, "-updated_date", LIMIT),
    enabled,
  });
  const evidenceQ = useQuery({
    queryKey: ["studio-evidence", tenantId],
    queryFn: () => base44.entities.StudioEvidence.filter({ tenant_id: tenantId }, "-updated_date", LIMIT),
    enabled,
  });
  const decisionsQ = useQuery({
    queryKey: ["studio-decisions", tenantId],
    queryFn: () => base44.entities.ClassificationDecision.filter({ tenant_id: tenantId, status: { $in: ["confirmed", "proposed"] } }, "-created_date", LIMIT),
    enabled,
  });
  const entitiesQ = useQuery({
    queryKey: ["studio-rfi-entities", tenantId],
    queryFn: () => base44.entities.Entity.filter({ tenant_id: tenantId }, "entity_name", 1000),
    enabled,
  });

  const queries = [settingsQ, countriesQ, accountsQ, cpsQ, evidenceQ, decisionsQ, entitiesQ, packQ];
  const isLoading = queries.some((q) => q.isLoading) || (!!jurisdiction && listQ.isLoading);
  const error = queries.find((q) => q.error)?.error || listQ.error || null;

  const rows = useMemo(() => {
    if (isLoading || !accountsQ.data || !settingsQ.data) return [];
    const cpsByAccount = {};
    for (const c of cpsQ.data || []) (cpsByAccount[c.account_id] ||= []).push(c);
    const evidenceByAccount = {};
    for (const e of evidenceQ.data || []) evidenceByAccount[e.account_id] = e;
    const confirmed = {}; const proposed = {};
    for (const d of decisionsQ.data || []) {
      if (d.target_type !== "account") continue;
      if (d.status === "confirmed" && !confirmed[d.target_id]) confirmed[d.target_id] = d;
      if (d.status === "proposed" && !proposed[d.target_id]) proposed[d.target_id] = d;
    }
    const entityNames = Object.fromEntries((entitiesQ.data || []).map((e) => [e.id, e.entity_name]));
    const base = { settings: settingsQ.data, reportableList: listQ.data || null, countries: countriesQ.data || [], pack: packQ.data || null };

    return accountsQ.data.map((account) => {
      const evidence = evidenceByAccount[account.id] || {};
      const input = { ...base, account, controllingPersons: cpsByAccount[account.id] || [], evidence, linkedAccounts: [] };
      let result;
      try {
        result = evaluate(input, evidence.draft_gap_answers || {});
      } catch (e) {
        console.error("Studio engine failed for account", account.id, e);
        result = { steps: [], gaps: [], outcome: { status: "pending", jurisdictions: [], persons: [], reason: "The engine couldn't evaluate this account. Please report this to support." }, error: String(e) };
      }
      const confirmedDecision = confirmed[account.id] || null;
      const proposedDecision = proposed[account.id] || null;
      let queue;
      if (proposedDecision && confirmedDecision) queue = "changed";
      else if (confirmedDecision) queue = "classified";
      else if (result.outcome.status === "pending" || result.gaps.length) queue = "needs";
      else queue = "ready";
      return {
        id: account.id,
        account,
        input,
        result,
        queue,
        confirmedDecision,
        proposedDecision,
        entityName: entityNames[account.entity_id] || "",
        holderName: account.account_holder_name || [account.first_name, account.last_name].filter(Boolean).join(" ") || "Unnamed holder",
        comparison: compareWithManual(account.reportability_status, result.outcome.status),
      };
    });
  }, [isLoading, accountsQ.data, settingsQ.data, listQ.data, countriesQ.data, packQ.data, cpsQ.data, evidenceQ.data, decisionsQ.data, entitiesQ.data]);

  return {
    isLoading,
    error,
    settings: settingsQ.data,
    reportableList: listQ.data,
    pack: packQ.data,
    entities: entitiesQ.data || [],
    rows,
  };
}
