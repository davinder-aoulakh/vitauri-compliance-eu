import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { evaluate, loadPublishedPacks, isSystemProposal } from "../../../base44/shared/crs/index.js";

/**
 * Loads everything the Classification Studio needs for one tenant and evaluates every account
 * with the shared CRS engine (in the browser; read-only — nothing is written).
 *
 * Queues:
 *  - classified: a confirmed ClassificationDecision exists
 *  - changed:    a confirmed account the automatic re-check flagged (open change case or studio proposal), or a re-confirm awaiting sign-off
 *  - needs:      the engine needs answers the data can't give
 *  - ready:      fully answered (by the data and saved answers), waiting for confirmation or second sign-off
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
    queryKey: ["studio-rule-pack", jurisdiction],
    queryFn: () => loadPublishedPacks(base44.entities, jurisdiction),
    enabled: !!jurisdiction,
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
  const casesQ = useQuery({
    queryKey: ["studio-change-cases", tenantId],
    queryFn: () => base44.entities.ChangeCase.filter({ tenant_id: tenantId, status: { $in: ["open", "overdue"] } }, "-detected_at", LIMIT),
    enabled,
  });
  const entitiesQ = useQuery({
    queryKey: ["studio-rfi-entities", tenantId],
    queryFn: () => base44.entities.Entity.filter({ tenant_id: tenantId }, "entity_name", 1000),
    enabled,
  });

  const queries = [settingsQ, countriesQ, accountsQ, cpsQ, evidenceQ, decisionsQ, entitiesQ, casesQ];
  const isLoading = queries.some((q) => q.isLoading) || (!!jurisdiction && (listQ.isLoading || packQ.isLoading));
  const error = queries.find((q) => q.error)?.error || listQ.error || packQ.error || null;

  const rows = useMemo(() => {
    if (isLoading || !accountsQ.data || !settingsQ.data) return [];
    const cpsByAccount = {};
    for (const c of cpsQ.data || []) (cpsByAccount[c.account_id] ||= []).push(c);
    const evidenceByAccount = {};
    for (const e of evidenceQ.data || []) evidenceByAccount[e.account_id] = e;
    const confirmed = {}; const proposed = {}; const systemProposed = {};
    for (const d of decisionsQ.data || []) {
      if (d.target_type !== "account") continue;
      if (d.status === "confirmed" && !confirmed[d.target_id]) confirmed[d.target_id] = d;
      if (isSystemProposal(d)) { if (!systemProposed[d.target_id]) systemProposed[d.target_id] = d; }
      else if (d.status === "proposed" && !proposed[d.target_id]) proposed[d.target_id] = d;
    }
    const caseByAccount = {};
    for (const c of casesQ.data || []) if (!caseByAccount[c.account_id]) caseByAccount[c.account_id] = c;
    const entityNames = Object.fromEntries((entitiesQ.data || []).map((e) => [e.id, e.entity_name]));
    const base = { settings: settingsQ.data, reportableList: listQ.data || null, countries: countriesQ.data || [], pack: packQ.data?.pack || null, overridePack: packQ.data?.overridePack || null };

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
      const systemProposal = confirmedDecision ? systemProposed[account.id] || null : null;
      const changeCase = confirmedDecision ? caseByAccount[account.id] || null : null;
      const awaitingSignOff = !!proposedDecision && !confirmedDecision;
      let queue;
      if (confirmedDecision && (proposedDecision || systemProposal || changeCase)) queue = "changed";
      else if (confirmedDecision) queue = "classified";
      else if (awaitingSignOff) queue = "ready";
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
        systemProposal,
        changeCase,
        awaitingSignOff,
        entityName: entityNames[account.entity_id] || "",
        holderName: account.account_holder_name || [account.first_name, account.last_name].filter(Boolean).join(" ") || "Unnamed holder",
        comparison: compareWithManual(account.reportability_status, result.outcome.status),
      };
    });
  }, [isLoading, accountsQ.data, settingsQ.data, listQ.data, countriesQ.data, packQ.data, cpsQ.data, evidenceQ.data, decisionsQ.data, entitiesQ.data, casesQ.data]);

  const refetch = () => Promise.all([accountsQ.refetch(), evidenceQ.refetch(), decisionsQ.refetch(), cpsQ.refetch(), casesQ.refetch()]);

  return {
    isLoading,
    error,
    refetch,
    isFetching: accountsQ.isFetching || evidenceQ.isFetching || decisionsQ.isFetching,
    settings: settingsQ.data,
    reportableList: listQ.data,
    pack: packQ.data?.pack || null,
    overridePack: packQ.data?.overridePack || null,
    entities: entitiesQ.data || [],
    rows,
  };
}
