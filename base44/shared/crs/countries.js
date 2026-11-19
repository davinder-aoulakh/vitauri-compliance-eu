// Classification Studio — country helpers (pure, no dependencies; runs in browser and Deno).

const NAME_TO_CODE = {
  "curacao": "CW", "curaçao": "CW", "netherlands": "NL", "the netherlands": "NL", "holland": "NL",
  "united states": "US", "usa": "US", "united states of america": "US", "united kingdom": "GB", "uk": "GB",
  "great britain": "GB", "germany": "DE", "france": "FR", "belgium": "BE", "spain": "ES", "italy": "IT",
  "switzerland": "CH", "luxembourg": "LU", "aruba": "AW", "sint maarten": "SX", "venezuela": "VE",
  "colombia": "CO", "british virgin islands": "VG", "bvi": "VG", "india": "IN", "canada": "CA",
  "cayman islands": "KY", "bahamas": "BS", "panama": "PA", "brazil": "BR", "china": "CN",
};
const CODE_ALIASES = { BVI: "VG", UK: "GB" };

/** Normalise a country code or name to an ISO-3166 alpha-2 code ("Curaçao" → "CW"). Returns null if unknown/empty. */
export function normalizeCountry(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (CODE_ALIASES[upper]) return CODE_ALIASES[upper];
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  const byName = NAME_TO_CODE[raw.toLowerCase()];
  if (byName) return byName;
  return null;
}

/**
 * Build a de-duplicated index from CrsCountryInfo rows (the table holds duplicates).
 * Returns { byCode: {CW: {code, name, participating, tinIssuedToAll}}, participating: Set }.
 */
export function buildCountryIndex(rows = []) {
  const byCode = {};
  for (const r of rows || []) {
    const code = normalizeCountry(r.country_code) || normalizeCountry(r.country_name);
    if (!code) continue;
    const prev = byCode[code];
    byCode[code] = {
      code,
      name: prev?.name || r.country_name || code,
      participating: Boolean(prev?.participating || r.is_crs_country),
      tinIssuedToAll: prev?.tinIssuedToAll ?? (typeof r.tin_issued_to_all === "boolean" ? r.tin_issued_to_all : undefined),
    };
  }
  const participating = new Set(Object.values(byCode).filter((c) => c.participating).map((c) => c.code));
  return { byCode, participating };
}

export function countryName(index, code) {
  return index?.byCode?.[code]?.name || code;
}
