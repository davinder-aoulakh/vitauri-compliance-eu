// Classification Studio — country of an international phone number, for CRS indicium (c)
// (a current telephone number in a reportable jurisdiction and none in the FI's jurisdiction, CRS III(B)(2)(c)).
// Only numbers written in international form (+ or 00) are read. Ambiguous codes return null:
// +1 (US / Canada, except the Caribbean area codes listed) and +7 (Russia / Kazakhstan).

const CODES = {
  "20": "EG", "27": "ZA", "30": "GR", "31": "NL", "32": "BE", "33": "FR", "34": "ES", "36": "HU", "39": "IT", "40": "RO", "41": "CH",
  "43": "AT", "44": "GB", "45": "DK", "46": "SE", "47": "NO", "48": "PL", "49": "DE", "51": "PE", "52": "MX", "53": "CU", "54": "AR",
  "55": "BR", "56": "CL", "57": "CO", "58": "VE", "60": "MY", "61": "AU", "62": "ID", "63": "PH", "64": "NZ", "65": "SG", "66": "TH",
  "81": "JP", "82": "KR", "84": "VN", "86": "CN", "90": "TR", "91": "IN", "92": "PK", "93": "AF", "94": "LK", "95": "MM", "98": "IR",
  "212": "MA", "213": "DZ", "216": "TN", "218": "LY", "220": "GM", "221": "SN", "224": "GN", "225": "CI", "233": "GH", "234": "NG",
  "237": "CM", "241": "GA", "242": "CG", "243": "CD", "248": "SC", "254": "KE", "257": "BI", "297": "AW",
  "350": "GI", "351": "PT", "352": "LU", "353": "IE", "354": "IS", "355": "AL", "356": "MT", "357": "CY", "358": "FI", "359": "BG",
  "370": "LT", "371": "LV", "372": "EE", "376": "AD", "377": "MC", "378": "SM", "385": "HR", "386": "SI", "389": "MK",
  "420": "CZ", "421": "SK", "423": "LI", "501": "BZ", "506": "CR", "507": "PA", "597": "SR", "598": "UY",
  "852": "HK", "853": "MO", "880": "BD", "886": "TW", "960": "MV", "961": "LB", "962": "JO", "965": "KW", "966": "SA",
  "971": "AE", "972": "IL", "973": "BH", "974": "QA", "977": "NP",
  "5999": "CW", "5997": "BQ",
};
// North American Numbering Plan area codes of Caribbean jurisdictions (+1 NXX).
const NANP = { "721": "SX", "268": "AG", "246": "BB", "473": "GD", "869": "KN", "758": "LC", "784": "VC", "242": "BS", "876": "JM", "658": "JM", "284": "VG", "345": "KY", "649": "TC", "441": "BM", "264": "AI", "664": "MS", "767": "DM", "809": "DO", "829": "DO", "849": "DO", "868": "TT" };

/** ISO country code of an international phone number, or null when it can't be told. */
export function phoneCountry(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let digits;
  if (s.startsWith("+")) digits = s.slice(1).replace(/\D/g, "");
  else if (s.startsWith("00")) digits = s.slice(2).replace(/\D/g, "");
  else return null; // local format: no country information
  if (digits.length < 6) return null;
  if (digits.startsWith("1")) return NANP[digits.slice(1, 4)] || null;
  if (digits.startsWith("7")) return null;
  for (const len of [4, 3, 2]) { const c = CODES[digits.slice(0, len)]; if (c) return c; }
  return null;
}
