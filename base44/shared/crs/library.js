// Classification Studio — CRS Rule Library helpers (pure). Used by the super admin console and by the
// studioRulePack backend function, so the same checks run in the browser and on the server.

import { BASELINE_RULES } from "./baselinePack.js";
import { EXTRA_QUESTION_HOOKS } from "./engine.js";
import { CONDITION_FACTS, CONDITION_OPERATORS } from "./conditions.js";

const SELF_CERT_ELEMENTS = ["name", "residence_address", "tax_residence", "tin", "date_of_birth", "date"];

/** Allowed parameters per rule, with type and range. Anything else in `params` is refused. */
export const PARAM_SPECS = {
  "GEN.BALANCE": {
    high_value_threshold_usd: { type: "number", min: 1, max: 1e9, label: "High value threshold (USD)" },
    entity_threshold_usd: { type: "number", min: 1, max: 1e9, label: "Entity threshold (USD)" },
  },
  "ENT_PRE.THRESHOLD_250K": { threshold_usd: { type: "number", min: 1, max: 1e9, label: "Entity review threshold (USD)" } },
  "CP.IDENTIFY": { ownership_threshold_pct: { type: "number", min: 1, max: 100, label: "Indicative ownership threshold (%)" } },
  "CP.SELF_CERT": { aml_reliance_limit_usd: { type: "number", min: 1, max: 1e9, label: "AML/KYC reliance limit (USD)" } },
  "IND_NEW.SELF_CERT_VALID": { required_elements: { type: "list", allowed: SELF_CERT_ELEMENTS, label: "Required self-certification elements" } },
};

export const EDITABLE_TEXT_FIELDS = ["question", "help", "crs_ref", "hb_ref", "ai_guidance", "outcome_reason_template"];
export const PROCEDURE_LABELS = {
  general: "General (all accounts)",
  individual_preexisting: "Pre-existing individual accounts (Fig. 13)",
  individual_new: "New individual accounts (Fig. 14)",
  entity_preexisting: "Pre-existing entity accounts (Fig. 15–16)",
  entity_new: "Entity accounts (Fig. 17–18)",
  controlling_persons: "Controlling persons",
  custom: "Extra questions",
};
export const HOOK_LABELS = { after_general: "All accounts, after the balance step", individual: "Individual accounts, before the individual procedure", entity: "Entity accounts, before the entity procedure" };

const baseByKey = new Map(BASELINE_RULES.map((r) => [r.rule_key, r]));

/**
 * Validate a pack's rules. Returns { ok, errors: [{rule_key, field, message}] }.
 * - Every baseline rule must be present; locked rules can't be disabled.
 * - Option values of baseline rules can't change (the engine depends on them); labels can.
 * - Parameters must match PARAM_SPECS.
 * - Custom rules: key starts with "X.", valid hook, a question and at least two options with effect continue/hold.
 */
export function validatePack(rules = []) {
  const errors = [];
  const err = (rule_key, field, message) => errors.push({ rule_key, field, message });
  const seen = new Set();
  for (const r of rules) {
    if (!r || !r.rule_key) { err("?", "rule_key", "A rule has no key."); continue; }
    if (seen.has(r.rule_key)) err(r.rule_key, "rule_key", "Duplicate rule key.");
    seen.add(r.rule_key);
    const base = baseByKey.get(r.rule_key);
    if (base) {
      if (r.custom) err(r.rule_key, "custom", "A Handbook rule can't be marked as an extra question.");
      if (base.locked && r.enabled === false) err(r.rule_key, "enabled", "This is a core Handbook step and can't be switched off.");
      const baseValues = (base.options || []).map((o) => o.value).join("|");
      const values = (r.options || base.options || []).map((o) => o.value).join("|");
      if (baseValues !== values) err(r.rule_key, "options", "Answer options can be renamed, but their values can't be added, removed or changed.");
      for (const o of r.options || []) if (!String(o.label || "").trim()) err(r.rule_key, "options", "Every answer option needs a label.");
      const specs = PARAM_SPECS[r.rule_key] || {};
      for (const [k, v] of Object.entries(r.params || {})) {
        const spec = specs[k];
        if (!spec) { err(r.rule_key, `params.${k}`, `Unknown parameter "${k}".`); continue; }
        if (spec.type === "number") {
          if (typeof v !== "number" || !Number.isFinite(v)) err(r.rule_key, `params.${k}`, `${spec.label} must be a number.`);
          else if (v < spec.min || v > spec.max) err(r.rule_key, `params.${k}`, `${spec.label} must be between ${spec.min.toLocaleString("en-US")} and ${spec.max.toLocaleString("en-US")}.`);
        }
        if (spec.type === "list") {
          if (!Array.isArray(v) || !v.length) err(r.rule_key, `params.${k}`, `${spec.label} needs at least one element.`);
          else if (v.some((x) => !spec.allowed.includes(x))) err(r.rule_key, `params.${k}`, `${spec.label} may only contain: ${spec.allowed.join(", ")}.`);
        }
      }
    } else {
      if (!r.custom) err(r.rule_key, "rule_key", "Unknown rule. Only Handbook rules and extra questions are allowed.");
      if (!/^X\.[A-Z0-9_]{2,40}$/.test(r.rule_key)) err(r.rule_key, "rule_key", "Extra question keys look like X.LOCAL_CHECK (capitals, digits, underscores).");
      if (!EXTRA_QUESTION_HOOKS.includes(r.hook)) err(r.rule_key, "hook", "Choose where the question is asked.");
      if (!String(r.question || "").trim()) err(r.rule_key, "question", "The question text is required.");
      const opts = r.options || [];
      if (opts.length < 2) err(r.rule_key, "options", "Give at least two answer options.");
      const vals = opts.map((o) => o.value);
      if (new Set(vals).size !== vals.length) err(r.rule_key, "options", "Answer option values must be unique.");
      for (const o of opts) {
        if (!/^[a-z0-9_]{1,40}$/.test(String(o.value || ""))) err(r.rule_key, "options", "Option values use lower-case letters, digits and underscores.");
        if (!String(o.label || "").trim()) err(r.rule_key, "options", "Every answer option needs a label.");
        if (!["continue", "hold"].includes(o.effect)) err(r.rule_key, "options", "Each option either continues the classification or puts it on hold.");
      }
      if (!opts.some((o) => o.effect === "continue")) err(r.rule_key, "options", "At least one option must let the classification continue.");
      if (r.condition) {
        const facts = new Set(CONDITION_FACTS.map((f) => f.value));
        const ops = new Set(CONDITION_OPERATORS.map((o) => o.value));
        const walk = (g) => {
          for (const c of g.conditions || []) {
            if (!c.field) continue;
            if (!facts.has(c.field)) err(r.rule_key, "condition", `"${c.field}" can't be used in a condition.`);
            if (!ops.has(c.operator)) err(r.rule_key, "condition", `Unknown operator "${c.operator}".`);
          }
          (g.subGroups || []).forEach(walk);
        };
        walk(r.condition);
      }
    }
  }
  for (const base of BASELINE_RULES) if (!seen.has(base.rule_key)) err(base.rule_key, "rule_key", "Handbook rules can't be removed from a pack.");
  return { ok: errors.length === 0, errors };
}

const RULE_FIELDS = ["enabled", "question", "help", "crs_ref", "hb_ref", "ai_guidance", "outcome_reason_template", "options", "params", "condition", "hook", "order"];

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

// Drop null, undefined and empty-string values (stored rows carry nulls for empty fields).
function clean(v) {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined && x !== "").map(([k, x]) => [k, clean(x)]));
  return v;
}

/** The part of a rule that affects behaviour or wording (no ids, timestamps or pack ids). */
export function ruleContent(r) {
  const out = { rule_key: r.rule_key, custom: !!r.custom };
  for (const f of RULE_FIELDS) {
    const v = clean(r[f]);
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    out[f] = v;
  }
  if (out.enabled === undefined) out.enabled = true;
  return out;
}

/** A deterministic fingerprint of a pack's rules (cyrb53 over a stable JSON form). Ties test runs and impact reports to an exact draft. */
export function packFingerprint(rules = []) {
  const text = stable([...rules].map(ruleContent).sort((a, b) => a.rule_key.localeCompare(b.rule_key)));
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return "fp:" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** Per-rule differences between two packs' rules: [{rule_key, change: added|removed|changed, fields: [{field, before, after}]}]. */
export function diffPacks(beforeRules = [], afterRules = []) {
  const a = new Map(beforeRules.map((r) => [r.rule_key, ruleContent(r)]));
  const b = new Map(afterRules.map((r) => [r.rule_key, ruleContent(r)]));
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  const out = [];
  for (const k of keys) {
    if (!a.has(k)) { out.push({ rule_key: k, change: "added", fields: [] }); continue; }
    if (!b.has(k)) { out.push({ rule_key: k, change: "removed", fields: [] }); continue; }
    const x = a.get(k); const y = b.get(k);
    const fields = [];
    for (const f of [...new Set([...Object.keys(x), ...Object.keys(y)])]) {
      if (stable(x[f]) !== stable(y[f])) fields.push({ field: f, before: x[f], after: y[f] });
    }
    if (fields.length) out.push({ rule_key: k, change: "changed", fields });
  }
  return out;
}

/** Next version for a new draft: bumps the minor version (1.0.0 → 1.1.0). */
export function nextVersion(version, existing = []) {
  const [maj, min] = String(version || "1.0.0").split(".").map((n) => parseInt(n, 10) || 0);
  let m = min + 1;
  while (existing.includes(`${maj}.${m}.0`)) m++;
  return `${maj}.${m}.0`;
}

/** The rules of the baseline as plain CrsRule rows (for seeding a pack). */
export function baselineRuleRows() {
  return BASELINE_RULES.map((r) => ({ ...r }));
}

/**
 * Fingerprint of a draft as it would run: for an override pack (scope such as "CW") it also covers the published
 * global pack it sits on, so an impact report goes stale when either changes.
 */
export function draftFingerprint(pack, rules, globalPack) {
  const fp = packFingerprint(rules);
  const scope = pack?.jurisdiction_scope || "global";
  return scope === "global" ? fp : `${fp}@${globalPack?.version || "baseline"}`;
}

/** The rules used to validate a draft: a global draft as-is, an override draft laid over the published global pack. */
export function effectiveRulesForValidation(pack, rules, globalPackWithRules, resolve) {
  const scope = pack?.jurisdiction_scope || "global";
  if (scope === "global") return rules;
  return resolve(globalPackWithRules, { version: pack.version, jurisdiction_scope: scope, rules }).rules;
}
