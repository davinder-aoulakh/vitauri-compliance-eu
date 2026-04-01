import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

const W = 595;
const H = 842;
const ML = 40;
const MR = 40;
const CONTENT_W = W - ML - MR;

const C = {
  black:      rgb(0.08, 0.10, 0.14),
  dark:       rgb(0.18, 0.22, 0.30),
  mid:        rgb(0.38, 0.42, 0.52),
  light:      rgb(0.60, 0.64, 0.72),
  xlight:     rgb(0.88, 0.91, 0.95),
  bg:         rgb(0.97, 0.97, 0.98),
  white:      rgb(1, 1, 1),
  green:      rgb(0.13, 0.65, 0.35),
  greenLight: rgb(0.90, 0.97, 0.92),
  blue:       rgb(0.24, 0.42, 0.88),
  blueLight:  rgb(0.91, 0.94, 0.99),
  amber:      rgb(0.85, 0.55, 0.10),
  amberLight: rgb(0.99, 0.96, 0.88),
  red:        rgb(0.80, 0.18, 0.18),
  redLight:   rgb(0.99, 0.91, 0.91),
  pill1:      rgb(0.88, 0.93, 0.99), // equity/debt pill bg
  pill1txt:   rgb(0.24, 0.42, 0.88),
  pill2:      rgb(0.90, 0.97, 0.92), // depository pill bg
  pill2txt:   rgb(0.13, 0.65, 0.35),
};

// Avatar palette for controlling persons
const AVATAR_COLORS = [
  [rgb(0.53, 0.71, 0.95), rgb(0.08, 0.28, 0.65)],
  [rgb(0.72, 0.60, 0.92), rgb(0.35, 0.10, 0.65)],
  [rgb(0.60, 0.88, 0.72), rgb(0.08, 0.48, 0.28)],
  [rgb(0.95, 0.75, 0.53), rgb(0.65, 0.30, 0.05)],
  [rgb(0.92, 0.62, 0.72), rgb(0.62, 0.10, 0.28)],
  [rgb(0.62, 0.88, 0.92), rgb(0.08, 0.45, 0.55)],
];

function clamp(text, max) {
  if (!text) return '';
  return String(text).length > max ? String(text).substring(0, max - 1) + '…' : String(text);
}

function formatBalance(val) {
  if (!val || val === 0) return '$0';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${Math.round(val).toLocaleString()}`;
  return `$${val}`;
}

function formatDate(d) {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatControlType(ct) {
  if (!ct) return 'N/A';
  const map = {
    legal_person_ownership: 'Legal person — ownership',
    legal_person_other_means: 'Legal person — other means',
    legal_person_senior_managing_official: 'Legal person — SMO',
    trust_settlor: 'Trust — settlor',
    trust_trustee: 'Trust — trustee',
    trust_protector: 'Trust — protector',
    trust_beneficiary: 'Trust — beneficiary',
    trust_other: 'Trust — other',
    legal_arrangement_settlor_equivalent: 'Arrangement — settlor equiv.',
    legal_arrangement_trustee_equivalent: 'Arrangement — trustee equiv.',
    legal_arrangement_protector_equivalent: 'Arrangement — protector equiv.',
    legal_arrangement_beneficiary_equivalent: 'Arrangement — beneficiary equiv.',
    legal_arrangement_other_equivalent: 'Legal arrangement — other',
  };
  return map[ct] || ct.replace(/_/g, ' ');
}

function initials(cp) {
  const fn = cp.first_name || '';
  const ln = cp.last_name || '';
  if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
  const full = cp.full_name || '';
  const parts = full.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return full.substring(0, 2).toUpperCase() || 'CP';
}

function fullName(cp) {
  if (cp.first_name && cp.last_name) return `${cp.first_name} ${cp.last_name}`;
  return cp.full_name || 'Unknown';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { report, accounts = [], controllingPersons = [], includeFields } = await req.json();
    if (!report) return Response.json({ error: 'Report data is required' }, { status: 400 });

    const {
      summary = true,
      accounts: inclAccounts = true,
      controllingPersons: inclCP = true,
      validation = true,
      metadata = true
    } = includeFields || {};

    const pdfDoc = await PDFDocument.create();
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Build index: account_id → array of CPs
    const cpByAccount = {};
    for (const cp of controllingPersons) {
      if (!cpByAccount[cp.account_id]) cpByAccount[cp.account_id] = [];
      cpByAccount[cp.account_id].push(cp);
    }

    // Unique MCAA jurisdictions from reportable CPs
    const reportableCPs = controllingPersons.filter(cp => cp.is_reportable);
    const mcaaSet = new Set();
    for (const cp of reportableCPs) {
      const countries = cp.tax_residencies?.map(r => r.country) || [];
      if (cp.country_of_residence_code) countries.push(cp.country_of_residence_code);
      countries.forEach(c => c && mcaaSet.add(c));
    }
    const mcaaJurisdictions = [...mcaaSet];

    let page = pdfDoc.addPage([W, H]);
    let y = H - 40;

    const needPage = (needed) => {
      if (y < needed) {
        page = pdfDoc.addPage([W, H]);
        y = H - 40;
      }
    };

    const drawText = (text, x, yy, size, color, font, opts = {}) => {
      page.drawText(String(text), { x, y: yy, size, color, font, ...opts });
    };

    const drawRect = (x, yy, w, h, color, border, borderW) => {
      page.drawRectangle({ x, y: yy, width: w, height: h, color, ...(border ? { borderColor: border, borderWidth: borderW || 1 } : {}) });
    };

    const drawLine = (x1, y1, x2, y2, color, thickness = 0.5) => {
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
    };

    // ── HEADER ─────────────────────────────────────────────────────────
    // Title
    drawText(`CRS Report ${report.reporting_year}`, ML, y, 22, C.black, bold);
    y -= 22;

    // Subtitle line
    const jurisdiction = report.reporting_jurisdiction || 'N/A';
    const entityLabel  = `Jurisdiction: ${jurisdiction}`;
    const period = `Reporting period: 1 Jan ${report.reporting_year} – 31 Dec ${report.reporting_year}`;
    const created = `Created: ${formatDate(report.created_date)}`;
    const subtitleParts = [entityLabel, period, created];

    drawText(subtitleParts.join('   '), ML, y, 9, C.mid, regular);
    y -= 16;

    // Status badges
    const badges = [];
    const statusLabels = { validated: 'Validated', draft: 'Draft', submitted: 'Submitted', accepted: 'Accepted', rejected: 'Rejected' };
    badges.push({ label: statusLabels[report.status] || report.status, bg: report.status === 'validated' || report.status === 'accepted' ? C.greenLight : report.status === 'rejected' ? C.redLight : C.blueLight, txt: report.status === 'validated' || report.status === 'accepted' ? C.green : report.status === 'rejected' ? C.red : C.blue });
    badges.push({ label: report.report_type === 'nil_report' ? 'NIL Report' : 'CRS XML', bg: C.blueLight, txt: C.blue });
    if (report.is_test_supply) badges.push({ label: 'TEST', bg: C.amberLight, txt: C.amber });

    let bx = ML;
    for (const b of badges) {
      const bw = bold.widthOfTextAtSize(b.label, 8) + 16;
      drawRect(bx, y - 12, bw, 16, b.bg, b.txt, 0.8);
      drawText(b.label, bx + 8, y - 9, 8, b.txt, bold);
      bx += bw + 6;
    }
    y -= 24;

    // Divider
    drawLine(ML, y, W - MR, y, C.xlight, 0.8);
    y -= 18;

    // ── VALIDATION BAR (if available) ───────────────────────────────────
    if (validation && report.validation_results) {
      const vr = report.validation_results;
      const isValid = vr.is_valid;
      const barBg  = isValid ? C.greenLight : C.redLight;
      const barTxt = isValid ? C.green : C.red;
      const barH = 26;
      drawRect(ML, y - barH, CONTENT_W, barH, barBg, isValid ? C.green : C.red, 0.6);
      const validLabel = isValid ? '[PASSED]  XML Validation Passed' : '[FAILED]  XML Validation Failed';
      drawText(validLabel, ML + 10, y - 17, 9.5, barTxt, bold);
      if (!isValid) {
        const errCount = vr.errors?.length || 0;
        const warnCount = vr.warnings?.length || 0;
        drawText(`${errCount} error${errCount !== 1 ? 's' : ''}  ·  ${warnCount} warning${warnCount !== 1 ? 's' : ''}`, W - MR - 130, y - 17, 9, barTxt, regular);
      } else {
        const warnCount = vr.warnings?.length || 0;
        if (warnCount > 0) drawText(`${warnCount} warning${warnCount !== 1 ? 's' : ''}`, W - MR - 80, y - 17, 9, C.amber, regular);
      }
      y -= barH + 14;
    }

    // ── SUMMARY METRICS STRIP ──────────────────────────────────────────
    if (summary) {
      const totalBalance = accounts.reduce((s, a) => s + (a.year_end_cash_value || 0), 0);
      const cardW = (CONTENT_W - 15) / 4;
      const cardH = 58;
      const metrics = [
        { label: 'Reportable accounts', value: String(accounts.length), sub: 'All entity types' },
        { label: 'Controlling persons', value: String(controllingPersons.length), sub: `${reportableCPs.length} reportable` },
        { label: 'Total balance', value: formatBalance(totalBalance), sub: 'USD equivalent' },
        { label: 'MCAA jurisdictions', value: String(mcaaJurisdictions.length), sub: mcaaJurisdictions.slice(0, 6).join(' ') || 'N/A' },
      ];

      let cx = ML;
      for (const m of metrics) {
        drawRect(cx, y - cardH, cardW, cardH, C.bg, C.xlight, 0.8);
        drawText(m.label, cx + 10, y - 13, 8, C.mid, regular);
        drawText(m.value, cx + 10, y - 33, 20, C.black, bold);
        drawText(m.sub, cx + 10, y - 46, 7.5, C.light, regular);
        cx += cardW + 5;
      }
      y -= cardH + 18;
    }

    // ── ACCOUNTS TABLE ─────────────────────────────────────────────────
    if (inclAccounts && accounts.length > 0) {
      needPage(160);

      // Section header
      drawText('Reportable accounts', ML, y, 13, C.dark, bold);
      drawText(`${accounts.length} accounts`, W - MR - bold.widthOfTextAtSize(`${accounts.length} accounts`, 9), y, 9, C.light, regular);
      y -= 14;

      drawLine(ML, y, W - MR, y, C.xlight, 0.5);
      y -= 1;

      // Column layout: Account(160) Type(72) ControllingPersons(160) MCAA(70) Balance(55)
      const cols = [
        { label: 'Account',             x: ML,        w: 155 },
        { label: 'Type',                x: ML + 158,  w: 72  },
        { label: 'Controlling persons', x: ML + 233,  w: 158 },
        { label: 'MCAA countries',      x: ML + 394,  w: 70  },
        { label: 'Balance',             x: ML + 467,  w: 55, right: true },
      ];

      // Header row
      y -= 12;
      drawRect(ML, y - 4, CONTENT_W, 16, C.bg);
      for (const col of cols) {
        const lx = col.right ? col.x + col.w - regular.widthOfTextAtSize(col.label, 8) : col.x + 4;
        drawText(col.label, lx, y, 8, C.mid, regular);
      }
      y -= 18;
      drawLine(ML, y, W - MR, y, C.xlight, 0.5);
      y -= 1;

      let rowCount = 0;
      for (const acc of accounts) {
        const rowH = 32;
        needPage(rowH + 20);

        const isAlt = rowCount % 2 === 1;
        if (isAlt) drawRect(ML, y - rowH + 4, CONTENT_W, rowH, rgb(0.98, 0.98, 0.99));

        // Account name + number
        const holderName = acc.account_holder_name || `${acc.first_name || ''} ${acc.last_name || ''}`.trim() || 'N/A';
        drawText(clamp(holderName, 26), cols[0].x + 4, y - 9, 9, C.dark, bold);
        drawText(clamp(acc.account_number, 18), cols[0].x + 4, y - 21, 8, C.light, regular);

        // Type pill
        const atype = acc.account_type || '';
        const isDepository = atype === 'depository';
        const typeLabel = isDepository ? 'Depository' : atype === 'equity_debt_interest' ? 'Equity /\ndebt' : atype.replace(/_/g, ' ');
        const pillBg = isDepository ? C.pill2 : C.pill1;
        const pillTxt = isDepository ? C.pill2txt : C.pill1txt;
        const pillW = 58;
        const pillH = 22;
        drawRect(cols[1].x + 4, y - 24, pillW, pillH, pillBg, pillTxt, 0.5);
        if (isDepository) {
          drawText('Depository', cols[1].x + 7, y - 14, 7.5, pillTxt, bold);
        } else {
          drawText('Equity /', cols[1].x + 7, y - 13, 7.5, pillTxt, bold);
          drawText('debt', cols[1].x + 7, y - 22, 7.5, pillTxt, bold);
        }

        // Controlling persons inline
        const cps = cpByAccount[acc.id] || [];
        const cpNames = cps.map(cp => fullName(cp));
        const cpStr = cpNames.length > 0 ? clamp(cpNames.slice(0, 2).join(', ') + (cpNames.length > 2 ? ` +${cpNames.length - 2}` : ''), 32) : '—';
        drawText(cpStr, cols[2].x + 4, y - 15, 8, C.dark, regular);

        // MCAA countries
        const acpList = cps.filter(cp => cp.is_reportable);
        const mcaaCountries = [...new Set(acpList.flatMap(cp => {
          const cs = cp.tax_residencies?.map(r => r.country) || [];
          if (cp.country_of_residence_code) cs.push(cp.country_of_residence_code);
          return cs;
        }))].slice(0, 3);
        const mcaaStr = mcaaCountries.length > 0 ? mcaaCountries.join(' · ') : '—';
        drawText(mcaaStr, cols[3].x + 4, y - 15, 8, C.dark, regular);

        // Balance (right-aligned)
        const bal = acc.year_end_cash_value || 0;
        const balStr = formatBalance(bal);
        const balColor = bal === 0 ? C.light : C.dark;
        const balFont  = bal === 0 ? regular : bold;
        const balW = balFont.widthOfTextAtSize(balStr, 9);
        drawText(balStr, cols[4].x + cols[4].w - balW, y - 15, 9, balColor, balFont);

        y -= rowH;
        drawLine(ML, y, W - MR, y, C.xlight, 0.3);
        rowCount++;
      }
      y -= 20;
    }

    // ── CONTROLLING PERSONS GRID ───────────────────────────────────────
    if (inclCP && controllingPersons.length > 0) {
      needPage(120);

      // Section header
      drawText('Controlling persons', ML, y, 13, C.dark, bold);
      const cpSubLabel = `${controllingPersons.length} reported · ${reportableCPs.length} reportable to MCAA countries`;
      drawText(cpSubLabel, W - MR - regular.widthOfTextAtSize(cpSubLabel, 9), y, 9, C.light, regular);
      y -= 14;
      drawLine(ML, y, W - MR, y, C.xlight, 0.5);
      y -= 12;

      // Two-column grid
      const colW = (CONTENT_W - 10) / 2;
      const cardH = 62;

      for (let i = 0; i < controllingPersons.length; i += 2) {
        needPage(cardH + 8);

        for (let col = 0; col < 2; col++) {
          const cp = controllingPersons[i + col];
          if (!cp) continue;

          const cx = ML + col * (colW + 10);
          const isReportable = cp.is_reportable;
          const alpha = isReportable ? 1.0 : 0.45;

          // Card background
          const cardBg = isReportable ? C.white : C.bg;
          drawRect(cx, y - cardH, colW, cardH, cardBg, C.xlight, 0.8);

          // Avatar circle
          const avatarIdx = (i + col) % AVATAR_COLORS.length;
          const [avatarBg, avatarTxt] = AVATAR_COLORS[avatarIdx];
          const ax = cx + 10;
          const ay = y - cardH / 2;
          const radius = 15;
          page.drawCircle({ x: ax + radius, y: ay, size: radius, color: avatarBg });
          const initStr = initials(cp);
          const iw = bold.widthOfTextAtSize(initStr, 9);
          drawText(initStr, ax + radius - iw / 2, ay - 4, 9, avatarTxt, bold);

          // Name and meta
          const nameX = cx + 38;
          const cpFullName = clamp(fullName(cp), 30);
          const nameColor = isReportable ? C.dark : C.mid;
          drawText(cpFullName, nameX, y - 12, 9.5, nameColor, isReportable ? bold : regular);

          // Country · DOB · Type
          const country = cp.country_of_residence || cp.country_of_residence_code || 'N/A';
          const dob = cp.date_of_birth ? `DOB ${new Date(cp.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
          const metaStr = [country, dob].filter(Boolean).join('   ');
          drawText(clamp(metaStr, 40), nameX, y - 24, 7.5, C.light, regular);

          // Control type
          const ctLabel = clamp(formatControlType(cp.control_type), 35);
          drawText(ctLabel, nameX, y - 35, 7.5, C.light, regular);

          // Reportable badge
          if (isReportable) {
            const badgeLabel = 'Reportable';
            const badgeW = bold.widthOfTextAtSize(badgeLabel, 7.5) + 12;
            drawRect(nameX, y - 52, badgeW, 14, C.greenLight, C.green, 0.6);
            drawText(badgeLabel, nameX + 6, y - 46, 7.5, C.green, bold);
          } else {
            drawText('Non-reportable', nameX, y - 47, 7.5, C.light, regular);
          }
        }
        y -= cardH + 6;
      }
      y -= 10;
    }

    // ── VALIDATION DETAIL (errors/warnings) ────────────────────────────
    if (validation && report.validation_results) {
      const vr = report.validation_results;
      const hasDetail = (vr.errors?.length > 0) || (vr.warnings?.length > 0);
      if (hasDetail) {
        needPage(80);
        drawText('Validation detail', ML, y, 11, C.dark, bold);
        y -= 14;

        if (vr.errors?.length > 0) {
          for (const err of vr.errors.slice(0, 8)) {
            needPage(22);
            drawRect(ML, y - 15, 6, 15, C.red);
            drawText(clamp(err, 90), ML + 12, y - 11, 8, C.dark, regular);
            y -= 18;
          }
          if (vr.errors.length > 8) {
            drawText(`… and ${vr.errors.length - 8} more errors`, ML + 12, y - 11, 8, C.red, regular);
            y -= 16;
          }
        }

        if (vr.warnings?.length > 0) {
          for (const warn of vr.warnings.slice(0, 8)) {
            needPage(22);
            drawRect(ML, y - 15, 6, 15, C.amber);
            drawText(clamp(warn, 90), ML + 12, y - 11, 8, C.dark, regular);
            y -= 18;
          }
          if (vr.warnings.length > 8) {
            drawText(`… and ${vr.warnings.length - 8} more warnings`, ML + 12, y - 11, 8, C.amber, regular);
            y -= 16;
          }
        }
      }
    }

    // ── FOOTER on every page ───────────────────────────────────────────
    const pageCount = pdfDoc.getPageCount();
    for (let p = 0; p < pageCount; p++) {
      const pg = pdfDoc.getPage(p);
      pg.drawLine({ start: { x: ML, y: 28 }, end: { x: W - MR, y: 28 }, thickness: 0.5, color: C.xlight });
      pg.drawText(`CRS Report ${report.reporting_year}  ·  ${jurisdiction}  ·  Generated ${formatDate(new Date().toISOString())}`, {
        x: ML, y: 16, size: 7, color: C.light, font: regular
      });
      pg.drawText(`Page ${p + 1} of ${pageCount}`, {
        x: W - MR - 55, y: 16, size: 7, color: C.light, font: regular
      });
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

    return Response.json({
      success: true,
      pdf: pdfBase64,
      filename: `CRS_Report_${report.reporting_year}_${jurisdiction}.pdf`
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});