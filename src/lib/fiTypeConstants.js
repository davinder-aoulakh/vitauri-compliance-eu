/**
 * Canonical "Type of Financial Institution" constants.
 * This is the single source of truth used across:
 *   - AccountForm (dropdown options)
 *   - AIDataCleaner (normalization on bulk import)
 *   - AIFieldMapper (INSTANT_RULES awareness)
 *   - Account entity schema (enum values)
 */

export const FI_TYPE_OPTIONS = [
  { value: "custodial_institution",      label: "Custodial Institution" },
  { value: "depository_institution",     label: "Depository Institution" },
  { value: "investment_entity_type_a",   label: "Type A Investment Entity" },
  { value: "investment_entity_type_b",   label: "Type B Investment Entity" },
  { value: "specified_insurance_company",label: "Specified Insurance Company" },
];

/** Returns the display label for a stored canonical value */
export const getFITypeLabel = (value) => {
  if (!value) return "—";
  return FI_TYPE_OPTIONS.find(o => o.value === value)?.label ?? value;
};

/**
 * Normalizes any free-text or legacy FI type value to a canonical stored value.
 * Used in AIDataCleaner and any bulk import pipeline.
 *
 * @param {string} raw  - The raw value from a spreadsheet or old database record
 * @returns {string}    - A canonical value, or "" if the input is truly empty/unknown
 */
export const normalizeFIType = (raw) => {
  if (!raw) return "";
  const v = String(raw).toLowerCase().trim();

  // Already canonical → pass through
  if (FI_TYPE_OPTIONS.some(o => o.value === v)) return v;

  // Type A Investment Entity variations
  if (
    v === "type_a" ||
    v === "type a" ||
    v === "type_a_investment_entity" ||
    v === "type a investment entity" ||
    v === "investment entity type a" ||
    v === "investment entity (type a)" ||
    (v.includes("investment") && v.includes("type a")) ||
    (v.includes("investment_entity") && v.includes("type_a"))
  ) return "investment_entity_type_a";

  // Type B Investment Entity variations
  if (
    v === "type_b" ||
    v === "type b" ||
    v === "type_b_investment_entity" ||
    v === "type b investment entity" ||
    v === "investment entity type b" ||
    v === "investment entity (type b)" ||
    (v.includes("investment") && v.includes("type b")) ||
    (v.includes("investment_entity") && v.includes("type_b"))
  ) return "investment_entity_type_b";

  // Generic investment entity (no type suffix) → default to Type A
  if (v === "investment_entity" || v === "investment entity") return "investment_entity_type_a";

  // Custodial variations
  if (v.includes("custodial")) return "custodial_institution";

  // Depository variations
  if (v.includes("deposit")) return "depository_institution";

  // Insurance variations
  if (v.includes("insurance")) return "specified_insurance_company";

  // Legacy "financial_institution" (generic) — flag as manual review by returning empty
  if (v === "financial_institution" || v === "financial institution") return "";

  return ""; // Unknown — leave empty for manual review
};