import React, { useEffect, useState } from "react";
import { BookOpen, Download, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HANDBOOK_URL, HANDBOOK_TITLE, printedPage } from "../../base44/shared/crs/references.js";
import { HANDBOOK_PAGES } from "../../base44/shared/crs/handbookIndex.js";

/**
 * Opens the OECD CRS Implementation Handbook at a page: /HandbookViewer?page=<PDF page>.
 * The media host serves the PDF as application/octet-stream (browsers would download it), so the file is
 * fetched here and shown as a PDF blob, which the browser's PDF viewer opens at #page=N.
 */
export default function HandbookViewer() {
  const params = new URLSearchParams(window.location.search);
  const requested = Number(params.get("page"));
  const page = Number.isInteger(requested) && requested >= 1 && requested <= HANDBOOK_PAGES ? requested : 1;
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(HANDBOOK_URL);
        if (!res.ok) throw new Error(`The Handbook could not be loaded (HTTP ${res.status}).`);
        const blob = new Blob([await res.arrayBuffer()], { type: "application/pdf" });
        url = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(url);
      } catch (e) {
        if (!cancelled) setError(e.message || "The Handbook could not be loaded.");
      }
    })();
    document.title = `${HANDBOOK_TITLE} · page ${printedPage(page)}`;
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [page]);

  return (
    <div className="flex flex-col gap-3 p-4" style={{ height: "calc(100vh - 2rem)" }}>
      <div className="flex flex-wrap items-center gap-3">
        <BookOpen className="w-5 h-5 text-teal-700" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-900 truncate">{HANDBOOK_TITLE}</h1>
          <p className="text-xs text-slate-500">Opened at page {printedPage(page)} (page {page} of {HANDBOOK_PAGES} in the PDF)</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={HANDBOOK_URL} download="OECD-CRS-Implementation-Handbook.pdf"><Download className="w-4 h-4 mr-1" />Download PDF</a>
        </Button>
      </div>
      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4" />{error} Use Download PDF and go to page {printedPage(page)}.
        </div>
      ) : !blobUrl ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Loading the Handbook…</div>
      ) : (
        <iframe key={page} title={HANDBOOK_TITLE} src={`${blobUrl}#page=${page}`} className="w-full flex-1 rounded-lg border bg-white" />
      )}
    </div>
  );
}
