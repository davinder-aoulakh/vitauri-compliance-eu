import React from "react";
import { ExternalLink } from "lucide-react";
import { parseHandbookRef, formatCrsRef, handbookViewerLink, HANDBOOK_TITLE } from "../../../base44/shared/crs/references.js";

/**
 * The reference line under a question: "CRS Section VIII(C)(17)" and "Handbook: Figure 8, paragraphs 129–130",
 * each Handbook item opening the Handbook at its page in a new tab (the in-app viewer) (or showing the page number until the PDF is linked).
 */
export default function References({ crsRef, hbRef, className = "" }) {
  const items = parseHandbookRef(hbRef);
  if (!crsRef && !items.length) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 ${className}`}>
      {crsRef && <span className="font-medium text-slate-600">{formatCrsRef(crsRef)}</span>}
      {items.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-x-1">
          <span>Handbook:</span>
          {items.map((it, i) => {
            const href = handbookViewerLink(it.pdfPage);
            const sep = i < items.length - 1 ? "," : "";
            if (href) {
              return (
                <a key={i} href={href} target="_blank" rel="noopener noreferrer" title={`${HANDBOOK_TITLE}, page ${it.printed}`}
                  className="inline-flex items-center gap-0.5 text-teal-800 underline decoration-dotted underline-offset-2 hover:text-teal-900">
                  {it.label}<ExternalLink className="w-3 h-3" />{sep}
                </a>
              );
            }
            return <span key={i}>{it.label}{it.printed ? ` (page ${it.printed})` : ""}{sep}</span>;
          })}
        </span>
      )}
    </span>
  );
}
