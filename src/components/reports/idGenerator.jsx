/**
 * Standardized ID Generation for CRS Reports
 * Format: <CountryCode><FiscalYear><DestinationCountry><SerialNumber>
 * 
 * Example: GB2024GB001
 * - GB: Sending country code
 * - 2024: Fiscal year
 * - GB: Destination country code
 * - 001: Serial number (padded to 3 digits)
 */

/**
 * Generate a standardized CRS Message Reference ID
 */
export function generateMessageRefId({ 
  sendingCountry, 
  fiscalYear, 
  destinationCountry, 
  serialNumber,
  type = 'MSG'
}) {
  const country = (sendingCountry || 'XX').toUpperCase().substring(0, 3);
  const year = String(fiscalYear || new Date().getFullYear()).substring(0, 4);
  const dest = (destinationCountry || country).toUpperCase().substring(0, 3);
  const serial = String(serialNumber || '001').padStart(3, '0');
  
  return `${country}${year}${dest}${type}${serial}`;
}

/**
 * Generate a standardized CRS Document Reference ID
 */
export function generateDocRefId({
  sendingCountry,
  fiscalYear,
  destinationCountry,
  serialNumber,
  type = 'ACC',
  tin
}) {
  const country = (sendingCountry || 'XX').toUpperCase().substring(0, 3);
  const year = String(fiscalYear || new Date().getFullYear()).substring(0, 4);
  const dest = (destinationCountry || country).toUpperCase().substring(0, 3);
  const serial = String(serialNumber || '001').padStart(6, '0');
  
  const tinPart = tin ? `_${tin.replace(/[^A-Za-z0-9]/g, '').substring(0, 15)}` : '';
  
  return `${country}${year}${dest}${type}${serial}${tinPart}`;
}

/**
 * Validate ID format against CRS requirements
 */
export function validateIdFormat(id, type = 'MessageRefId') {
  const errors = [];
  
  if (!id || typeof id !== 'string') {
    return { isValid: false, errors: ['ID is required and must be a string'] };
  }
  
  const minLength = type === 'MessageRefId' ? 15 : 20;
  const maxLength = type === 'MessageRefId' ? 35 : 50;
  
  if (id.length < minLength || id.length > maxLength) {
    errors.push(`${type} length must be between ${minLength} and ${maxLength} characters`);
  }
  
  const validCharsRegex = /^[A-Za-z0-9_-]+$/;
  if (!validCharsRegex.test(id)) {
    errors.push(`${type} contains invalid characters. Only alphanumeric, underscore, and hyphen allowed`);
  }
  
  const formatRegex = /^[A-Z]{2,3}\d{4}/;
  if (!formatRegex.test(id)) {
    errors.push(`${type} must start with 2-3 letter country code followed by 4-digit year`);
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
  const sendingCountry = originalReport.reporting_jurisdiction?.substring(0, 3) || 'XX';
  const fiscalYear = originalReport.reporting_year;
  const serialNumber = String(Date.now()).substring(-6);
  
  const messageRefId = generateMessageRefId({
    sendingCountry,
    fiscalYear,
    destinationCountry: sendingCountry,
    serialNumber,
    type: correctionType === 'deletion' ? 'DEL' : 'COR'
  });
  
  return {
    correctionMessageRefId: messageRefId,
    messageTypeIndic: correctionType === 'deletion' ? 'CRS703' : 'CRS702'
  };
}