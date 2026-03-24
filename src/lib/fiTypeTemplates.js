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