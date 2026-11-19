// Classification Studio — PDF of one decision and the Excel export of decision records.
// The builders take the library class as an argument, so they can run in tests; the download helpers load
// jspdf / exceljs on demand.

import { OUTCOME_TEXT, SOURCE_TEXT, TRIGGER_TEXT, showValue, decisionRows, stepRows, aiRows } from "../../../base44/shared/crs/timeline.js";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "—");
const holderOf = (a) => (a ? a.account_holder_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || "" : "");

/** Build the PDF for one decision. Returns the jsPDF document. */
export function buildDecisionPdf(JsPDF, { decision: d, account, tenantName = "", changes = [], generatedBy = "", now = new Date() }) {
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 42;
  let y = M;

  const ensure = (h) => { if (y + h > H - M - 18) { doc.addPage(); y = M; } };
  const text = (str, { size = 9.5, bold = false, color = [30, 41, 59], indent = 0, gap = 3 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(str ?? ""), W - 2 * M - indent);
    for (const line of lines) { ensure(size + 2); doc.text(line, M + indent, y); y += size + 2.5; }
    y += gap;
  };
  const heading = (str) => { y += 6; ensure(26); doc.setDrawColor(203, 213, 225); doc.line(M, y, W - M, y); y += 14; text(str, { size: 11.5, bold: true, color: [15, 23, 42] }); };
  const pair = (label, value) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
    const lines = doc.splitTextToSize(String(value ?? "—"), W - 2 * M - 150);
    ensure(lines.length * 12 + 2);
    doc.text(label, M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(30, 41, 59);
    lines.forEach((l, i) => doc.text(l, M + 150, y + i * 12));
    y += lines.length * 12 + 3;
  };

  // Title
  text("CRS classification decision record", { size: 16, bold: true, color: [15, 23, 42], gap: 2 });
  text(`${tenantName ? `${tenantName} · ` : ""}Reporting jurisdiction ${d.input_snapshot?.settings?.reporting_jurisdiction || "—"}`, { size: 9.5, color: [71, 85, 105] });

  // Outcome box
  const outcome = OUTCOME_TEXT[d.outcome] || d.outcome || "—";
  const juris = (d.reportable_jurisdictions || []).join(", ");
  const reasonLines = doc.splitTextToSize(String(d.reason || ""), W - 2 * M - 24);
  const boxH = 44 + reasonLines.length * 12;
  ensure(boxH + 8);
  doc.setDrawColor(...(d.outcome === "reportable" || d.outcome === "undocumented" ? [234, 88, 12] : [22, 163, 74]));
  doc.setLineWidth(1.4); doc.roundedRect(M, y, W - 2 * M, boxH, 4, 4); doc.setLineWidth(0.5);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(15, 23, 42);
  doc.text(`${outcome}${juris ? ` · ${juris}` : ""}`, M + 12, y + 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
  doc.text(`Decision #${d.sequence ?? "—"} · ${d.status || ""}`, W - M - 12, y + 20, { align: "right" });
  doc.setTextColor(30, 41, 59);
  reasonLines.forEach((l, i) => doc.text(l, M + 12, y + 38 + i * 12));
  y += boxH + 12;

  heading("Account");
  pair("Account number", account?.account_number || d.target_id);
  pair("Account holder", holderOf(account) || d.input_snapshot?.account?.account_holder_name || "—");
  pair("Holder type", account?.account_holder_type || d.input_snapshot?.account?.account_holder_type || "—");
  if (d.reportable_persons?.length) pair("Reportable persons", d.reportable_persons.map((p) => `${p.name} (${p.role}: ${(p.jurisdictions || []).join(", ")})`).join("; "));

  heading("Decision");
  pair("Trigger", TRIGGER_TEXT[d.trigger] || d.trigger || "—");
  pair("Decided by", `${d.decided_by || "—"} · ${fmt(d.decided_at)}`);
  if (d.reviewer) pair("Second sign-off", `${d.reviewer} · ${fmt(d.reviewed_at)}`);
  if (d.note) pair("Note", d.note);
  pair("Supersedes", d.supersedes_id || "—");
  if (d.superseded_by_id) pair("Superseded by", d.superseded_by_id);
  pair("Reporting year", d.reporting_year ?? "—");
  if (d.reportable_from) pair("Reportable from", d.reportable_from);
  pair("Rule pack", d.rule_pack_version || "—");
  pair("Reportable list", d.reportable_list_version || "—");
  pair("Engine", d.engine_version || "—");
  pair("Input hash", d.input_hash || "—");
  pair("Keep until", d.retention_until || "—");

  heading("What changed since the previous decision");
  if (!changes.length) text(d.supersedes_id ? "No material input changed (confirmed again on the same data)." : "First decision for this account.", { color: [71, 85, 105] });
  else changes.forEach((c) => text(`${c.section} · ${c.field}: ${showValue(c.before)} → ${showValue(c.after)}`, { size: 9 }));

  heading(`Decision path (${(d.step_trace || []).length} steps)`);
  (d.step_trace || []).forEach((s, i) => {
    ensure(40);
    text(`${i + 1}. ${s.question || s.step_id}`, { bold: true, size: 9.5, gap: 1 });
    text(`Answer: ${s.answer || "—"}   ·   Source: ${SOURCE_TEXT[s.source] || s.source || "—"}`, { indent: 14, size: 9, gap: 1 });
    if (s.evidence) text(`Evidence: ${s.evidence}`, { indent: 14, size: 8.5, color: [71, 85, 105], gap: 1 });
    const refs = [s.crs_ref && `CRS ${s.crs_ref}`, s.hb_ref && `Handbook ${s.hb_ref}`].filter(Boolean).join(" · ");
    text(`${refs || "No reference"}   [${s.step_id}]`, { indent: 14, size: 8, color: [100, 116, 139], gap: 5 });
  });

  if (d.gap_answers?.length) {
    heading("Answers given to open questions");
    d.gap_answers.forEach((g) => text(`${g.key}: ${showValue(g.value)} (${g.source === "ai" ? "AI suggestion accepted" : "user answer"})`, { size: 9 }));
  }
  if (d.ai_suggestions?.length) {
    heading("AI suggestions");
    d.ai_suggestions.forEach((s) => text(`${s.question}: ${s.answer} · confidence ${typeof s.confidence === "number" ? Math.round(s.confidence * 100) + "%" : "—"} · ${s.accepted ? "accepted" : "not used"}${s.rationale ? ` — ${s.rationale}` : ""}`, { size: 9 }));
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
    doc.text(`Generated ${fmt(now.toISOString())}${generatedBy ? ` by ${generatedBy}` : ""} · Decision ${d.id || ""} · Permanent record`, M, H - 22);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 22, { align: "right" });
  }
  return doc;
}

export async function downloadDecisionPdf(args) {
  const { jsPDF } = await import("jspdf");
  const doc = buildDecisionPdf(jsPDF, args);
  const acc = String(args.account?.account_number || args.decision.target_id || "account").replace(/[^A-Za-z0-9_-]/g, "_");
  doc.save(`CRS-decision-${acc}-${args.decision.sequence ?? 1}.pdf`);
}

const SHEETS = {
  Decisions: [
    ["account_number", "Account number", 16], ["holder", "Account holder", 26], ["outcome", "Outcome", 18], ["jurisdictions", "Reportable jurisdictions", 16],
    ["reportable_persons", "Reportable persons", 30], ["reason", "Reason", 60], ["status", "Status", 12], ["sequence", "Decision #", 10], ["trigger", "Trigger", 20],
    ["decided_by", "Decided by", 26], ["decided_at", "Decided at", 22], ["reviewer", "Second sign-off", 24], ["reviewed_at", "Signed off at", 22],
    ["reporting_year", "Reporting year", 12], ["reportable_from", "Reportable from", 14], ["rule_pack_version", "Rule pack", 16], ["reportable_list_version", "Reportable list", 16],
    ["engine_version", "Engine", 10], ["supersedes", "Supersedes", 26], ["superseded_by", "Superseded by", 26], ["retention_until", "Keep until", 12],
    ["input_hash", "Input hash", 40], ["note", "Note", 30], ["decision_id", "Decision id", 26], ["account_id", "Account id", 26],
  ],
  Steps: [
    ["account_number", "Account number", 16], ["sequence", "Decision #", 10], ["step", "Step", 6], ["step_id", "Rule", 26], ["question", "Question", 50],
    ["answer", "Answer", 34], ["source", "Source", 20], ["evidence", "Evidence", 50], ["crs_ref", "CRS reference", 18], ["hb_ref", "Handbook reference", 22], ["decision_id", "Decision id", 26],
  ],
  "AI suggestions": [
    ["account_number", "Account number", 16], ["sequence", "Decision #", 10], ["question", "Question", 26], ["answer", "Suggested answer", 20],
    ["confidence", "Confidence", 11], ["accepted", "Accepted", 10], ["rationale", "Rationale", 70], ["decision_id", "Decision id", 26],
  ],
};

/** Build the decision-records workbook. Returns the ExcelJS workbook. */
export function buildRecordsWorkbook(ExcelJS, { decisions, accountsById = {}, tenantName = "", jurisdiction = "", year = "", statusFilter = "", generatedBy = "", now = new Date() }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Classification Studio";
  wb.created = now;
  const data = { Decisions: decisionRows(decisions, accountsById), Steps: stepRows(decisions, accountsById), "AI suggestions": aiRows(decisions, accountsById) };
  for (const [name, cols] of Object.entries(SHEETS)) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map(([key, header, width]) => ({ key, header, width }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    data[name].forEach((r) => ws.addRow(r));
    ws.eachRow((row, i) => { if (i > 1) row.alignment = { vertical: "top", wrapText: true }; });
    if (data[name].length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }
  const about = wb.addWorksheet("About");
  about.columns = [{ key: "k", width: 26 }, { key: "v", width: 80 }];
  [
    ["Report", "CRS classification decision records (Classification Studio)"],
    ["Organisation", tenantName], ["Reporting jurisdiction", jurisdiction], ["Reporting year", String(year || "All")],
    ["Statuses included", statusFilter || "All"], ["Decisions", String(decisions.length)],
    ["Generated", `${now.toISOString()}${generatedBy ? ` by ${generatedBy}` : ""}`],
    ["Note", "Decision records are permanent. A changed decision is superseded by a new record; the old one is kept with its rule pack version, inputs and decision path."],
  ].forEach(([k, v]) => about.addRow({ k, v }));
  about.getColumn(1).font = { bold: true };
  return wb;
}

export async function downloadRecordsWorkbook(args) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = buildRecordsWorkbook(ExcelJS, args);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `CRS-decision-records-${args.jurisdiction || "tenant"}-${args.year || "all"}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}
