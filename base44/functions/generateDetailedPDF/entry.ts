import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { report, accounts, controllingPersons, includeFields } = await req.json();

    if (!report) {
      return Response.json({ error: 'Report data is required' }, { status: 400 });
    }

    const {
      summary = true,
      accounts: includeAccounts = true,
      controllingPersons: includeCP = true,
      validation = true,
      metadata = true
    } = includeFields || {};

    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont('Helvetica');
    const helveticaBold = await pdfDoc.embedFont('Helvetica-Bold');

    let page = pdfDoc.addPage([595, 842]);
    let yPos = 800;
    const marginLeft = 40;
    const marginRight = 40;

    const darkColor = rgb(0.12, 0.16, 0.24);
    const textColor = rgb(0.2, 0.2, 0.2);

    // Title
    page.drawText(`CRS Report - ${report.reporting_year}`, {
      x: marginLeft,
      y: yPos,
      size: 20,
      color: darkColor,
      font: helveticaBold
    });
    yPos -= 30;

    // Metadata
    if (metadata) {
      const metadataLines = [
        `Jurisdiction: ${report.reporting_jurisdiction || 'N/A'} | Status: ${report.status || 'N/A'}`,
        `Type: ${report.report_type?.replace('_', ' ') || 'N/A'} | Schema: ${report.schema_version || 'N/A'}`,
        `Created: ${report.created_date ? new Date(report.created_date).toLocaleDateString() : 'N/A'} | Submitted: ${report.submission_date ? new Date(report.submission_date).toLocaleDateString() : 'N/A'}`
      ];

      for (const line of metadataLines) {
        page.drawText(line, {
          x: marginLeft,
          y: yPos,
          size: 10,
          color: textColor,
          font: helvetica
        });
        yPos -= 15;
      }
      yPos -= 10;
    }

    // Summary Statistics - Card Style
    if (summary && report.summary_stats) {
      const cardWidth = 110;
      const cardHeight = 50;
      const cardSpacing = 15;
      const colors = [
        rgb(0.4, 0.5, 0.9), // Blue
        rgb(0.6, 0.4, 0.8), // Purple
        rgb(0.2, 0.8, 0.4), // Green
        rgb(1.0, 0.65, 0.2)  // Orange
      ];

      const stats = [
        { label: 'Reportable Accounts', value: report.summary_stats.total_reportable_accounts || 0 },
        { label: 'Controlling Persons', value: report.summary_stats.total_controlling_persons || 0 },
        { label: 'Total Balance', value: `$${(report.summary_stats.total_account_balance || 0) > 1000000 ? (report.summary_stats.total_account_balance / 1000000).toFixed(1) + 'M' : '$' + (report.summary_stats.total_account_balance || 0).toLocaleString()}` },
        { label: 'Jurisdictions', value: report.summary_stats.jurisdictions_reported?.length || 1 }
      ];

      let xPos = marginLeft;
      for (let i = 0; i < stats.length; i++) {
        // Card background
        page.drawRectangle({
          x: xPos,
          y: yPos - cardHeight,
          width: cardWidth,
          height: cardHeight,
          color: rgb(0.95, 0.95, 0.97),
          borderColor: rgb(0.9, 0.9, 0.95),
          borderWidth: 1
        });

        // Value (large)
        page.drawText(String(stats[i].value), {
          x: xPos + 8,
          y: yPos - 25,
          size: 16,
          color: colors[i],
          font: helveticaBold
        });

        // Label
        page.drawText(stats[i].label, {
          x: xPos + 8,
          y: yPos - 38,
          size: 8,
          color: textColor,
          font: helvetica
        });

        xPos += cardWidth + cardSpacing;
      }
      yPos -= cardHeight + 20;
    }

    // Accounts Table
    if (includeAccounts && accounts?.length > 0) {
      if (yPos < 150) {
        page = pdfDoc.addPage([595, 842]);
        yPos = 800;
      }

      page.drawText(`Reportable Accounts (${accounts.length})`, {
        x: marginLeft,
        y: yPos,
        size: 14,
        color: darkColor,
        font: helveticaBold
      });
      yPos -= 18;

      const colWidths = [90, 110, 70, 85, 95, 70];
      const headers = ['Account', 'Holder', 'Type', 'Balance', 'Country', 'Self-Cert'];
      
      let xPos = marginLeft;
      for (let i = 0; i < headers.length; i++) {
        page.drawText(headers[i], {
          x: xPos,
          y: yPos,
          size: 9,
          color: rgb(1, 1, 1),
          font: helveticaBold
        });
        xPos += colWidths[i];
      }
      yPos -= 14;

      for (const acc of accounts.slice(0, 15)) {
        if (yPos < 60) {
          page = pdfDoc.addPage([595, 842]);
          yPos = 800;
        }

        const row = [
          (acc.account_number || 'N/A').substring(0, 10),
          (acc.account_holder_name || 'N/A').substring(0, 12),
          (acc.account_type || 'N/A').substring(0, 8),
          `$${(acc.year_end_cash_value || 0).toLocaleString().substring(0, 8)}`,
          (acc.country_of_residence || 'N/A').substring(0, 10),
          acc.self_certification_obtained ? 'Yes' : 'No'
        ];

        xPos = marginLeft;
        for (let i = 0; i < row.length; i++) {
          page.drawText(row[i], {
            x: xPos,
            y: yPos,
            size: 8,
            color: textColor,
            font: helvetica
          });
          xPos += colWidths[i];
        }
        yPos -= 12;
      }

      if (accounts.length > 15) {
        page.drawText(`... and ${accounts.length - 15} more accounts`, {
          x: marginLeft,
          y: yPos,
          size: 9,
          color: textColor,
          font: helvetica
        });
      }
      yPos -= 15;
    }

    // Controlling Persons Table
    if (includeCP && controllingPersons?.length > 0) {
      if (yPos < 150) {
        page = pdfDoc.addPage([595, 842]);
        yPos = 800;
      }

      page.drawText(`Controlling Persons (${controllingPersons.length})`, {
        x: marginLeft,
        y: yPos,
        size: 14,
        color: darkColor,
        font: helveticaBold
      });
      yPos -= 18;

      const colWidths = [130, 80, 100, 110, 75];
      const headers = ['Name', 'DOB', 'Country', 'Control Type', 'Reportable'];
      
      let xPos = marginLeft;
      for (let i = 0; i < headers.length; i++) {
        page.drawText(headers[i], {
          x: xPos,
          y: yPos,
          size: 9,
          color: rgb(1, 1, 1),
          font: helveticaBold
        });
        xPos += colWidths[i];
      }
      yPos -= 14;

      for (const cp of controllingPersons.slice(0, 10)) {
        if (yPos < 60) {
          page = pdfDoc.addPage([595, 842]);
          yPos = 800;
        }

        const name = cp.first_name && cp.last_name ? `${cp.first_name} ${cp.last_name}` : cp.full_name || 'N/A';
        const row = [
          name.substring(0, 16),
          cp.date_of_birth ? new Date(cp.date_of_birth).toLocaleDateString().substring(0, 10) : 'N/A',
          (cp.country_of_residence || 'N/A').substring(0, 12),
          (cp.control_type?.replace(/_/g, ' ') || 'N/A').substring(0, 14),
          cp.is_reportable ? 'Yes' : 'No'
        ];

        xPos = marginLeft;
        for (let i = 0; i < row.length; i++) {
          page.drawText(row[i], {
            x: xPos,
            y: yPos,
            size: 8,
            color: textColor,
            font: helvetica
          });
          xPos += colWidths[i];
        }
        yPos -= 12;
      }

      if (controllingPersons.length > 10) {
        page.drawText(`... and ${controllingPersons.length - 10} more controlling persons`, {
          x: marginLeft,
          y: yPos,
          size: 9,
          color: textColor,
          font: helvetica
        });
      }
    }

    // Validation Results
    if (validation && report.validation_results) {
      if (yPos < 150) {
        page = pdfDoc.addPage([595, 842]);
        yPos = 800;
      }

      page.drawText('Validation Results', {
        x: marginLeft,
        y: yPos,
        size: 14,
        color: darkColor,
        font: helveticaBold
      });
      yPos -= 18;

      page.drawText(`Status: ${report.validation_results.is_valid ? 'Valid' : 'Invalid'}`, {
        x: marginLeft + 10,
        y: yPos,
        size: 10,
        color: textColor,
        font: helvetica
      });
      yPos -= 12;

      if (report.validation_results.errors?.length > 0) {
        page.drawText(`Errors (${report.validation_results.errors.length}):`, {
          x: marginLeft + 10,
          y: yPos,
          size: 10,
          color: darkColor,
          font: helveticaBold
        });
        yPos -= 12;

        for (const err of report.validation_results.errors.slice(0, 5)) {
          page.drawText(`• ${err.substring(0, 80)}`, {
            x: marginLeft + 20,
            y: yPos,
            size: 8,
            color: textColor,
            font: helvetica
          });
          yPos -= 10;
        }
      }

      if (report.validation_results.warnings?.length > 0) {
        page.drawText(`Warnings (${report.validation_results.warnings.length}):`, {
          x: marginLeft + 10,
          y: yPos,
          size: 10,
          color: darkColor,
          font: helveticaBold
        });
        yPos -= 12;

        for (const warn of report.validation_results.warnings.slice(0, 5)) {
          page.drawText(`• ${warn.substring(0, 80)}`, {
            x: marginLeft + 20,
            y: yPos,
            size: 8,
            color: textColor,
            font: helvetica
          });
          yPos -= 10;
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = btoa(String.fromCharCode.apply(null, pdfBytes));

    return Response.json({
      success: true,
      pdf: pdfBase64,
      filename: `CRS_Report_${report.reporting_year}_${report.reporting_jurisdiction}.pdf`
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});