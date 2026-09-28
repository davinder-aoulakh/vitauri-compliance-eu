// Normalize a country name for comparison: strip accents/diacritics (e.g. "Curaçao" -> "curacao"),
// lowercase, trim. Prevents special characters from causing false "foreign" detections.
export const normalizeCountry = (c) =>
  (c || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Detects foreign indicia (address / tax residency) for an account against the tenant's jurisdiction.
// Used consistently by manual account creation and all import paths.
export function detectIndicia(accountData, tenantJurisdiction) {
  const indicia = [];
  const normalizedJurisdiction = normalizeCountry(tenantJurisdiction);

  const accountCountry = accountData.account_holder_address?.country;
  if (accountCountry && normalizeCountry(accountCountry) !== normalizedJurisdiction) {
    indicia.push('foreign_address');
  }

  const hasForeignTaxResidency = (accountData.tax_residencies || []).some(
    r => r.country && normalizeCountry(r.country) !== normalizedJurisdiction
  );
  if (hasForeignTaxResidency) {
    indicia.push('foreign_tax_residency');
  }

  return indicia;
}