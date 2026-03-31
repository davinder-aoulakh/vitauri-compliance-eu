// XML Utilities for CRS/FATCA Report Generation

// ISO Alpha-2 Country Code Mapping
// Full country names (various formats) → ISO Alpha-2 codes
const COUNTRY_NAME_TO_CODE = {
  // Common variations and full names
  "curaçao": "CW",
  "curacao": "CW",
  "netherlands antilles": "CW",
  "portugal": "PT",
  "panama": "PA",
  "israel": "IL",
  "italy": "IT",
  "brazil": "BR",
  "costa rica": "CR",
  "spain": "ES",
  "united kingdom": "GB",
  "united kingdom of great britain and northern ireland": "GB",
  "united kingdom of great britain and northern ireland (the)": "GB",
  "great britain": "GB",
  "england": "GB",
  "uk": "GB",
  "united states": "US",
  "united states of america": "US",
  "usa": "US",
  "netherlands": "NL",
  "the netherlands": "NL",
  "germany": "DE",
  "france": "FR",
  "belgium": "BE",
  "switzerland": "CH",
  "austria": "AT",
  "australia": "AU",
  "canada": "CA",
  "mexico": "MX",
  "japan": "JP",
  "china": "CN",
  "india": "IN",
  "russia": "RU",
  "russian federation": "RU",
  "south africa": "ZA",
  "argentina": "AR",
  "chile": "CL",
  "colombia": "CO",
  "peru": "PE",
  "venezuela": "VE",
  "ecuador": "EC",
  "uruguay": "UY",
  "paraguay": "PY",
  "bolivia": "BO",
  "ireland": "IE",
  "scotland": "GB",
  "wales": "GB",
  "northern ireland": "GB",
  "sweden": "SE",
  "norway": "NO",
  "denmark": "DK",
  "finland": "FI",
  "iceland": "IS",
  "poland": "PL",
  "czech republic": "CZ",
  "czechia": "CZ",
  "slovakia": "SK",
  "hungary": "HU",
  "romania": "RO",
  "bulgaria": "BG",
  "greece": "GR",
  "turkey": "TR",
  "türkiye": "TR",
  "cyprus": "CY",
  "malta": "MT",
  "luxembourg": "LU",
  "liechtenstein": "LI",
  "monaco": "MC",
  "san marino": "SM",
  "andorra": "AD",
  "singapore": "SG",
  "hong kong": "HK",
  "taiwan": "TW",
  "south korea": "KR",
  "republic of korea": "KR",
  "korea": "KR",
  "new zealand": "NZ",
  "indonesia": "ID",
  "malaysia": "MY",
  "thailand": "TH",
  "philippines": "PH",
  "vietnam": "VN",
  "united arab emirates": "AE",
  "uae": "AE",
  "saudi arabia": "SA",
  "qatar": "QA",
  "kuwait": "KW",
  "bahrain": "BH",
  "oman": "OM",
  "egypt": "EG",
  "morocco": "MA",
  "nigeria": "NG",
  "kenya": "KE",
  "ghana": "GH",
  "cayman islands": "KY",
  "british virgin islands": "VG",
  "bermuda": "BM",
  "bahamas": "BS",
  "barbados": "BB",
  "jamaica": "JM",
  "trinidad and tobago": "TT",
  "aruba": "AW",
  "bonaire": "BQ",
  "sint maarten": "SX",
  "guernsey": "GG",
  "jersey": "JE",
  "isle of man": "IM",
  "gibraltar": "GI",
  "croatia": "HR",
  "slovenia": "SI",
  "serbia": "RS",
  "ukraine": "UA",
  "belarus": "BY",
  "estonia": "EE",
  "latvia": "LV",
  "lithuania": "LT",
  "portugal": "PT",
  "tel aviv": "IL", // City sometimes used as country
  "telaviv": "IL"
};

/**
 * Normalizes a country value to ISO Alpha-2 code
 * @param {string} country - Country name or code
 * @returns {string} ISO Alpha-2 country code (uppercase)
 */
export const normalizeCountryCode = (country) => {
  if (!country) return '';
  
  const trimmed = String(country).trim();
  
  // Already a 2-letter code - just uppercase it
  if (/^[a-zA-Z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  
  // Look up in mapping (case-insensitive)
  const normalized = trimmed.toLowerCase();
  const code = COUNTRY_NAME_TO_CODE[normalized];
  
  if (code) {
    return code;
  }
  
  // Try partial matching for common patterns
  for (const [name, isoCode] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (normalized.includes(name) || name.includes(normalized)) {
      return isoCode;
    }
  }
  
  // If no match found, return original (uppercase if looks like a code)
  console.warn(`Unknown country: "${country}" - could not normalize to ISO code`);
  return trimmed.toUpperCase().substring(0, 2);
};

/**
 * Sanitizes TIN values by removing invalid prefixes and trimming
 * @param {string} tin - Tax Identification Number
 * @returns {string} Cleaned TIN value
 */
export const sanitizeTIN = (tin) => {
  if (!tin) return '';
  
  let cleaned = String(tin).trim();
  
  // Remove common prefixes that users accidentally include
  const prefixPatterns = [
    /^UTR:\s*/i,      // UK UTR prefix
    /^TIN:\s*/i,      // Generic TIN prefix
    /^SSN:\s*/i,      // US SSN prefix
    /^EIN:\s*/i,      // US EIN prefix
    /^ITIN:\s*/i,     // US ITIN prefix
    /^NIF:\s*/i,      // Spain/Portugal NIF prefix
    /^CUIT:\s*/i,     // Argentina CUIT prefix
    /^RUT:\s*/i,      // Chile RUT prefix
    /^RFC:\s*/i,      // Mexico RFC prefix
    /^CPF:\s*/i,      // Brazil CPF prefix
    /^CNPJ:\s*/i,     // Brazil CNPJ prefix
    /^CI\s+/i,        // Document type label prefix (e.g. "CI 801550273")
    /^[A-Z]{1,3}\s+(?=\d)/,  // Generic 1-3 letter label followed by space before number
  ];
  
  for (const pattern of prefixPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  return cleaned.trim();
};

/**
 * Sanitizes text for XML by trimming whitespace and normalizing special characters
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export const sanitizeText = (text) => {
  if (!text) return '';
  
  let cleaned = String(text).trim();
  
  // Normalize various dash types to standard hyphen
  cleaned = cleaned.replace(/[\u2013\u2014\u2015]/g, '-'); // en-dash, em-dash, horizontal bar
  
  // Remove or replace problematic characters while preserving UTF-8
  // (The XML escaping will handle &, <, >, etc.)
  
  return cleaned;
};

/**
 * Validates and sanitizes postal code based on country rules
 * @param {string} postalCode - Postal code value
 * @param {string} countryCode - ISO country code
 * @returns {string|null} Sanitized postal code or null if should be omitted
 */
export const sanitizePostalCode = (postalCode, countryCode) => {
  const normalizedCountry = normalizeCountryCode(countryCode);
  
  // Countries that don't use postal codes - return null to omit element
  const noPostalCodeCountries = ['CW', 'AW', 'BQ', 'SX', 'HK', 'IE', 'PA', 'QA', 'AE', 'OM', 'BH', 'KW', 'SA'];
  
  if (noPostalCodeCountries.includes(normalizedCountry)) {
    return null; // Omit postal code entirely
  }
  
  if (!postalCode) return null;
  
  const trimmed = String(postalCode).trim();
  
  // Reject invalid values
  if (trimmed === '0' || trimmed === '00' || trimmed === '000' || trimmed === '0000') {
    return null;
  }
  
  return trimmed;
};

/**
 * Validates that required address fields are present
 * @param {object} address - Address object
 * @param {string} context - Context for error messages
 * @returns {object} Validation result with isValid and errors
 */
export const validateAddress = (address, context) => {
  const errors = [];
  
  if (!address) {
    return { isValid: false, errors: [`${context}: Address is missing`] };
  }
  
  if (!address.city || !address.city.trim()) {
    errors.push(`${context}: City is mandatory`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Export the country code map for reference/lookup
export const COUNTRY_CODES = COUNTRY_NAME_TO_CODE;