// Classification Studio — readable CRS and Handbook references, with the Handbook page each one is on.
// Rule data keeps short codes ("Fig. 8, ¶129–130", "FAQ II-8"); this turns them into words and page links,
// so no ¶ or · symbols reach the screen or the exports.

import { PARAGRAPH_PAGES, FIGURE_PAGES, TABLE_PAGES, FAQ_PAGES, PRINTED_PAGE_OFFSET } from "./handbookIndex.js";

/**
 * The Handbook PDF in the app's media library (uploaded from docs/ in the repo).
 * The media host serves it as application/octet-stream, so browsers would download it instead of opening it:
 * links go to the in-app viewer page, which loads the file and opens it at the page.
 */
export const HANDBOOK_URL = "https://media.base44.com/files/public/69f35134a131013751aa0482/8719315b1e7aafcb29040d47b3daa440_oecd-crs-implementation-handbook-2nd-ed.pdf";
export const HANDBOOK_VIEWER_PATH = "/HandbookViewer";
export const HANDBOOK_TITLE = "OECD CRS Implementation Handbook (2nd edition)";

const FAQ_GROUP_LABEL = { I: "Section I", II: "Sections II–VII", VIIIA: "Section VIII(A)", VIIIB: "Section VIII(B)", VIIIC: "Section VIII(C)", VIIID: "Section VIII(D)", VIIIE: "Section VIII(E)" };

/** Printed page number (as shown in the Handbook's footer) for a PDF page. */
export const printedPage = (pdfPage) => (pdfPage ? pdfPage - PRINTED_PAGE_OFFSET : null);

/** Link to a Handbook page, or null when the PDF isn't available yet. */
export function handbookLink(pdfPage, url = HANDBOOK_URL) {
  return url && pdfPage ? `${url}#page=${pdfPage}` : null;
}

/** Link to the in-app Handbook viewer at a PDF page, or null when there is no page or no PDF. */
export function handbookViewerLink(pdfPage, { url = HANDBOOK_URL, viewer = HANDBOOK_VIEWER_PATH } = {}) {
  return url && pdfPage ? `${viewer}?page=${pdfPage}` : null;
}

/**
 * Parse a Handbook reference such as "Fig. 8, ¶129–130", "Table 3, ¶190", "¶183, FAQ II-9–11",
 * "¶135, Part I ¶23–28" or "Ch. 6.4" into items: [{ label, pdfPage, printed, kind }].
 */
export function parseHandbookRef(ref) {
  if (!ref) return [];
  const items = [];
  for (const raw of String(ref).split(/\s*,\s*/).filter(Boolean)) {
    const part = raw.trim();
    let m;
    if ((m = part.match(/^(?:Part (I{1,2}) )?¶\s*(\d+)(?:\s*[–-]\s*(\d+))?$/))) {
      const from = Number(m[2]); const to = m[3] ? Number(m[3]) : null;
      const pdfPage = PARAGRAPH_PAGES[from] || null;
      items.push({ kind: "paragraph", label: `${m[1] ? `Part ${m[1]}, ` : ""}${to ? `paragraphs ${from}–${to}` : `paragraph ${from}`}`, pdfPage, printed: printedPage(pdfPage) });
    } else if ((m = part.match(/^Fig(?:ure|\.)?\s*(\d+)$/i))) {
      const pdfPage = FIGURE_PAGES[Number(m[1])] || null;
      items.push({ kind: "figure", label: `Figure ${m[1]}`, pdfPage, printed: printedPage(pdfPage) });
    } else if ((m = part.match(/^Table\s*(\d+)$/i))) {
      const pdfPage = TABLE_PAGES[Number(m[1])] || null;
      items.push({ kind: "table", label: `Table ${m[1]}`, pdfPage, printed: printedPage(pdfPage) });
    } else if ((m = part.match(/^FAQ\s*([IVX]+(?:[A-E])?)\s*-\s*(\d+)(?:\s*[–-]\s*(\d+))?$/))) {
      const group = m[1]; const from = Number(m[2]); const to = m[3] ? Number(m[3]) : null;
      const pdfPage = FAQ_PAGES[`${group}-${from}`] || null;
      items.push({ kind: "faq", label: `FAQ ${to ? `${from}–${to}` : from} on ${FAQ_GROUP_LABEL[group] || `Section ${group}`} (Annex I)`, pdfPage, printed: printedPage(pdfPage) });
    } else if ((m = part.match(/^Ch(?:apter|\.)?\s*([\d.]+)$/i))) {
      items.push({ kind: "chapter", label: `Chapter ${m[1]}`, pdfPage: null, printed: null });
    } else {
      items.push({ kind: "text", label: deglyph(part), pdfPage: null, printed: null });
    }
  }
  return items;
}

/** "VIII(C)(17)" → "CRS Section VIII(C)(17)"; several sections stay comma-separated. */
export function formatCrsRef(ref) {
  if (!ref) return "";
  return `CRS ${String(ref).split(/\s*,\s*/).map((s, i) => (i === 0 && /^[IVX]+\b/.test(s) ? `Section ${s}` : s)).join(", ")}`;
}

/**
 * Plain text for exports: "CRS Section VIII(C)(17); Handbook: Figure 8 (page 64), paragraphs 129–130 (page 63)".
 * Page numbers are the printed ones.
 */
export function formatReferencesText(crsRef, hbRef) {
  const parts = [];
  if (crsRef) parts.push(formatCrsRef(crsRef));
  const items = parseHandbookRef(hbRef);
  if (items.length) parts.push(`Handbook: ${items.map((i) => (i.printed ? `${i.label} (page ${i.printed})` : i.label)).join(", ")}`);
  return parts.join("; ");
}

/** Replace the ¶ and · glyphs in free text (reasons, help) with words. */
export function deglyph(text) {
  if (!text) return text;
  return String(text)
    .replace(/¶\s*(\d+)\s*[–-]\s*(\d+)/g, "paragraphs $1–$2")
    .replace(/¶\s*(\d+)/g, "paragraph $1")
    .replace(/\bHB\b/g, "Handbook");
}

