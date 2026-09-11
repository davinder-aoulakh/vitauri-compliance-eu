// Centralized date formatting helpers to standardize display as DD/MM/YYYY

// For date-only fields (YYYY-MM-DD stored in DB). Parses ISO parts directly to
// avoid timezone-midnight conversion bugs (new Date("YYYY-MM-DD") parses as UTC midnight).
export function formatDateDDMMYYYY(value) {
  if (!value) return "—";
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return s;
}

// For timestamp fields (created_date, updated_date, upload_date — have time components).
// Uses UTC getters to avoid timezone shifts.
export function formatDateTimeDDMMYYYY(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}