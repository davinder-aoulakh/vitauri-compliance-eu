/**
 * FATCA-CRS ID Generation for Curaçao (CW) Reports
 * Format: CW{YEAR}{CRIB_NUMBER}{SERIAL}
 *
 * Required format per Annex 7 rules 7, 8, 30:
 * - First 2 chars: CW (Curaçao country code — always hardcoded)
 * - Next 4 chars: fiscal year (e.g. 2016)
 * - Then: CRIB number of the supplying financial institution
 * - Then: unique serial suffix
 * - No spaces allowed. Max 170 characters (per FC XML schema v2.2, page 11).
 *
 * Example: CW2016123456789ABC001
 */

/**
 * Generate a FATCA-CRS Message Reference ID for Curaçao
 * Format: CW{YEAR}{CRIB}{SERIAL}
 */
export function generateMessageRefId({
  fiscalYear,
  cribNumber,
  serialNumber,
  // Legacy params kept for backward compatibility but ignored
  sendingCountry,
  destinationCountry,
  type
}) {
  const year = String(fiscalYear || new Date().getFullYear()).substring(0, 4);
  const crib = (cribNumber || '').replace(/\s/g, '');
  const serial = String(serialNumber || '001').padStart(3, '0');

  const id = `CW${year}${crib}${serial}`;

  // Enforce max 170 characters and no spaces (per FC XML schema v2.2)
  return id.replace(/\s/g, '').substring(0, 170);
}

/**
 * Generate a FATCA-CRS Document Reference ID for Curaçao
 * Format: CW{YEAR}{CRIB}{TYPE}{SERIAL}
 */
export function generateDocRefId({
  fiscalYear,
  cribNumber,
  serialNumber,
  type = 'ACC',
  // Legacy params kept for backward compatibility but ignored
  sendingCountry,
  destinationCountry,
  tin
}) {
  const year = String(fiscalYear || new Date().getFullYear()).substring(0, 4);
  const crib = (cribNumber || '').replace(/\s/g, '');
  const serial = String(serialNumber || '001').padStart(6, '0');

  const id = `CW${year}${crib}${type}${serial}`;

  // Enforce max 170 characters (per FC XML schema v2.2, page 11)
  return id.replace(/\s/g, '').substring(0, 170);
}

/**
 * Validate ID format against FATCA-CRS Curaçao requirements
 * Rules 7, 8, 30: starts with CW + year, no spaces, max 200 chars
 */
export function validateIdFormat(id, type = 'MessageRefId') {
  const errors = [];

  if (!id || typeof id !== 'string') {
    return { isValid: false, errors: ['ID is required and must be a string'] };
  }

  if (id.length > 170) {
    errors.push(`${type} exceeds maximum length of 170 characters (per FC XML schema v2.2)`);
  }

  if (/\s/.test(id)) {
    errors.push(`${type} must not contain spaces`);
  }

  const validCharsRegex = /^[A-Za-z0-9_-]+$/;
  if (!validCharsRegex.test(id)) {
    errors.push(`${type} contains invalid characters. Only alphanumeric, underscore, and hyphen allowed`);
  }

  const formatRegex = /^CW\d{4}/;
  if (!formatRegex.test(id)) {
    errors.push(`${type} must start with 'CW' followed by the 4-digit fiscal year`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate correction IDs based on original report
 */
export function generateCorrectionIds(originalReport, correctionType = 'correction') {
  const fiscalYear = originalReport.reporting_year;
  const cribNumber = originalReport.entity?.tax_id || '';
  const serialNumber = String(Date.now()).slice(-6);

  const messageRefId = generateMessageRefId({
    fiscalYear,
    cribNumber,
    serialNumber
  });

  return {
    correctionMessageRefId: messageRefId,
    messageTypeIndic: correctionType === 'deletion' ? 'CRS703' : 'CRS702'
  };
}