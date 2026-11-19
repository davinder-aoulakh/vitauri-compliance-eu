// Classification Studio — re-evaluation after a change (pure). Decides what an automatic re-check should record.
// Used by the studioReevaluate backend function and the tests.

import { snapshotChanges, showValue } from "./timeline.js";

const sameSet = (a = [], b = []) => [...a].sort().join(",") === [...b].sort().join(",");
const BALANCE_FIELDS = new Set(["year_end_cash_value", "year_end_cash_value_currency"]);
const VERSION_FIELDS = new Set(["reportable_list_version", "rule_pack_version", "override_pack"]);

/**
 * Change-in-circumstances due date: the later of 90 days after the change was detected or the last day of the
 * reporting period (31 December) — Handbook ¶165, ¶202, ¶220. Returns an ISO date.
 */
export function changeCaseDueDate(detectedAt) {
  const d = new Date(detectedAt);
  const plus90 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 90));
  const yearEnd = new Date(Date.UTC(d.getUTCFullYear(), 11, 31));
  return (plus90 > yearEnd ? plus90 : yearEnd).toISOString().slice(0, 10);
}

/**
 * What a re-check should record for an account with a confirmed decision.
 * @returns {{ kind: "none"|"no_change"|"changed", trigger?: string, changes: Array, final?: boolean }}
 *  - none:      the material inputs didn't change (and no forced re-check) → record nothing
 *  - no_change: inputs changed but the outcome, jurisdictions and questions are the same → "checked, no change"
 *  - changed:   a different outcome or new open questions → change case (+ proposal when final)
 */
export function reevaluationOutcome({ confirmed, result, snapshot, hash, lastHash, forced = false, thresholds = {} }) {
  if (!confirmed) return { kind: "none", changes: [] };
  if (!forced && hash && lastHash && hash === lastHash) return { kind: "none", changes: [] };
  const changes = snapshotChanges(confirmed.input_snapshot, snapshot);
  const final = result.outcome.status !== "pending" && (result.gaps || []).length === 0;
  const same = final && result.outcome.status === confirmed.outcome && sameSet(result.outcome.jurisdictions, confirmed.reportable_jurisdictions || []);
  const trigger = triggerFor(changes, confirmed, snapshot, forced, thresholds);
  return { kind: same ? "no_change" : "changed", trigger, changes, final };
}

function triggerFor(changes, confirmed, snapshot, forced, { high_value_threshold_usd = 1000000, entity_threshold_usd = 250000 }) {
  if (!changes.length && forced) return "year_end";
  const fields = changes.map((c) => c.field);
  if (fields.length && changes.every((c) => c.section === "Versions" && VERSION_FIELDS.has(c.field))) return "rule_pack_published";
  if (fields.length && changes.every((c) => c.section === "Account" && BALANCE_FIELDS.has(c.field))) {
    const before = Number(confirmed.input_snapshot?.account?.year_end_cash_value);
    const after = Number(snapshot?.account?.year_end_cash_value);
    const crossed = (line) => Number.isFinite(before) && Number.isFinite(after) && (before > line) !== (after > line);
    if (crossed(high_value_threshold_usd) || crossed(entity_threshold_usd)) return "balance_threshold";
  }
  return "change_in_circumstances";
}

/** ChangeCase.changed_fields rows (strings only, as the schema stores them). */
export function changeCaseFields(changes = []) {
  return changes.slice(0, 100).map((c) => ({ field: `${c.section} · ${c.field}`, before: showValue(c.before), after: showValue(c.after) }));
}

/** Is this decision a proposal the studio created itself (not one waiting for a second sign-off)? */
export const isSystemProposal = (d) => d?.status === "proposed" && d?.decided_by === "system";
