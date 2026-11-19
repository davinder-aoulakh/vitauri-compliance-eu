import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import { buildDecisionPdf, buildRecordsWorkbook } from "../../src/components/studio/decisionExports.js";

const steps = Array.from({ length: 40 }, (_, i) => ({ step_id: `STEP.${i}`, question: `Question ${i} — ${"long text ".repeat(12)}`, answer: "Yes", source: i % 3 ? "data" : "ai", evidence: "field = value ".repeat(8), crs_ref: "III(B)(2)", hb_ref: "¶167" }));
const decision = { id: "dec1", target_id: "a1", sequence: 2, status: "confirmed", trigger: "manual", outcome: "reportable", reportable_jurisdictions: ["DE", "FR"],
  reportable_persons: [{ name: "Anna", role: "Account holder", jurisdictions: ["DE"] }], reason: "Lower value pre-existing account. ".repeat(6),
  decided_by: "admin@acme.test", decided_at: "2026-11-19T10:00:00Z", supersedes_id: "dec0", reporting_year: 2026, reportable_from: "2026-11-19",
  rule_pack_version: "1.0.0", reportable_list_version: "CW-2026-v1", engine_version: "1.1.0", input_hash: "sha256:abc", retention_until: "2036-12-31",
  input_snapshot: { settings: { reporting_jurisdiction: "CW" }, account: { account_holder_name: "Anna" } }, step_trace: steps,
  gap_answers: [{ key: "IND_PRE.CURE", value: "not_cured", source: "ai" }], ai_suggestions: [{ question: "IND_PRE.CURE", answer: "not_cured", confidence: 0.8, accepted: true, rationale: "No cure on file" }] };
const account = { id: "a1", account_number: "ACC-1", account_holder_name: "Anna Schmidt", account_holder_type: "individual" };

describe("decision PDF", () => {
  it("builds a multi-page PDF with every step", () => {
    const doc = buildDecisionPdf(jsPDF, { decision, account, tenantName: "ACME", changes: [{ section: "Account", field: "country", before: "NL", after: "DE" }], generatedBy: "auditor@acme.test", now: new Date("2026-11-19T12:00:00Z") });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const out = doc.output();
    expect(out.startsWith("%PDF-")).toBe(true);
    expect(out).toContain("STEP.39");
    expect(out).toContain("Page 1 of");
  });
});

describe("decision records workbook", () => {
  it("has the four sheets with one row per decision, step and AI suggestion", async () => {
    const wb = buildRecordsWorkbook(ExcelJS, { decisions: [decision], accountsById: { a1: account }, tenantName: "ACME", jurisdiction: "CW", year: "2026", statusFilter: "Confirmed", now: new Date("2026-11-19T12:00:00Z") });
    const buf = await wb.xlsx.writeBuffer();
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf);
    expect(back.worksheets.map((w) => w.name)).toEqual(["Decisions", "Steps", "AI suggestions", "About"]);
    expect(back.getWorksheet("Decisions").rowCount).toBe(2);
    expect(back.getWorksheet("Decisions").getRow(2).getCell(1).value).toBe("ACC-1");
    expect(back.getWorksheet("Steps").rowCount).toBe(41);
    expect(back.getWorksheet("AI suggestions").getRow(2).getCell(6).value).toBe("Yes");
  });
});
