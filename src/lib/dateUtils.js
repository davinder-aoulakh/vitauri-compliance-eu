// Centralized date formatting helpers to standardize display as DD/MM/YYYY.
// Database storage stays ISO YYYY-MM-DD — these are display/input helpers only.

// ---- Primary API ----------------------------------------------------------

// For date-only fields (YYYY-MM-DD stored in DB). Parses ISO parts directly to
// avoid timezone-midnight conversion bugs (new Date("YYYY-MM-DD") parses as UTC midnight).
// Passes through values already in DD/MM/YYYY form. Returns "" for empty input.
export function toDisplayDate(value) {
  if (!value) return "";
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  return s;
}

// For timestamp fields (created_date, updated_date, upload_date — have time components).
// Uses UTC getters to avoid timezone shifts. Outputs DD/MM/YYYY HH:mm:ss.
export function toDisplayDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Converts a DD/MM/YYYY display string to ISO YYYY-MM-DD for storage. Returns
// null if the input doesn't match the expected display format.
export function parseDisplayDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ---- Backward-compatible aliases (existing call sites) --------------------
// These fall back to "—" for empty values, matching prior behavior.

export function formatDateDDMMYYYY(value) {
  if (!value) return "—";
  return toDisplayDate(value);
}

export function formatDateTimeDDMMYYYY(value) {
  if (!value) return "—";
  return toDisplayDateTime(value);
}