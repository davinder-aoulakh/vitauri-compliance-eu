// Shared label helper for the two CRS reporting values (balance and gross payment).
// Display-only wording — never used for stored data, calculations, or XML output.

export function getAccountBalanceLabel(accountType) {
  if (accountType === "depository") {
    return "Account balance/value as of December 31";
  }
  return "Year-end Cash or Surrender Value";
}

export function getAccountGrossPaymentLabel(accountType) {
  if (accountType === "depository") {
    return "Total gross amount of interest paid or credited during the calendar year";
  }
  return "Gross Payments (Redemptions, Annuities)";
}