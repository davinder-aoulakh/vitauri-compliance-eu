/**
 * Centralized FI Type Template Definitions
 * Each fi_type maps to its allowed account types, validations, and example values.
 */

export const FI_TYPE_TEMPLATES = {
  custodial_institution: {
    label: "Custodial Institution",
    accountTypeValidation: '"custodial,equity_debt_interest"',
    accountTypeNote: "Select from dropdown: custodial | equity_debt_interest",
    exampleAccountType: "custodial",
    allowedAccountTypes: ["custodial", "equity_debt_interest"],
  },
  depository_institution: {
    label: "Depository Institution",
    accountTypeValidation: '"depository"',
    accountTypeNote: "Select from dropdown: depository",
    exampleAccountType: "depository",
    allowedAccountTypes: ["depository"],
  },
  investment_entity: {
    label: "Investment Entity",
    accountTypeValidation: '"custodial,equity_debt_interest,depository"',
    accountTypeNote: "Select from dropdown: custodial | equity_debt_interest | depository",
    exampleAccountType: "custodial",
    allowedAccountTypes: ["custodial", "equity_debt_interest", "depository"],
  },
  specified_insurance_company: {
    label: "Specified Insurance Company",
    accountTypeValidation: '"cash_value_insurance,annuity"',
    accountTypeNote: "Select from dropdown: cash_value_insurance | annuity",
    exampleAccountType: "cash_value_insurance",
    allowedAccountTypes: ["cash_value_insurance", "annuity"],
  },
  not_applicable: {
    label: "Not Applicable",
    accountTypeValidation: '"depository,custodial,equity_debt_interest,cash_value_insurance,annuity"',
    accountTypeNote: "Select from dropdown: depository | custodial | equity_debt_interest | cash_value_insurance | annuity",
    exampleAccountType: "depository",
    allowedAccountTypes: ["depository", "custodial", "equity_debt_interest", "cash_value_insurance", "annuity"],
  },
};

export const GENERIC_FI_CONFIG = {
  label: "All FI Types",
  accountTypeValidation: '"depository,custodial,equity_debt_interest,cash_value_insurance,annuity"',
  accountTypeNote: "Select from dropdown: depository | custodial | equity_debt_interest | cash_value_insurance | annuity",
  exampleAccountType: "depository",
  allowedAccountTypes: ["depository", "custodial", "equity_debt_interest", "cash_value_insurance", "annuity"],
};

export function getFiTypeConfig(fiType) {
  return FI_TYPE_TEMPLATES[fiType] || GENERIC_FI_CONFIG;
}

/**
 * Fetch DB overrides and merge with hardcoded defaults.
 * Returns a map keyed by fi_type.
 * Usage: const configs = await getEffectiveFiTypeConfigs(base44);
 */
export async function getEffectiveFiTypeConfigs(base44Client) {
  try {
    const dbTemplates = await base44Client.entities.FITypeTemplate.filter({ is_active: true });
    const merged = { ...FI_TYPE_TEMPLATES };
    dbTemplates.forEach(db => {
      if (merged[db.fi_type]) {
        merged[db.fi_type] = {
          ...merged[db.fi_type],
          label: db.label || merged[db.fi_type].label,
          allowedAccountTypes: db.allowed_account_types?.length ? db.allowed_account_types : merged[db.fi_type].allowedAccountTypes,
          accountTypeNote: db.account_type_note || merged[db.fi_type].accountTypeNote,
          exampleAccountType: db.example_account_type || merged[db.fi_type].exampleAccountType,
          customColumns: db.custom_columns || [],
          accountTypeValidation: db.allowed_account_types?.length
            ? `"${db.allowed_account_types.join(",")}"`
            : merged[db.fi_type].accountTypeValidation,
        };
      }
    });
    return merged;
  } catch {
    return FI_TYPE_TEMPLATES;
  }
}