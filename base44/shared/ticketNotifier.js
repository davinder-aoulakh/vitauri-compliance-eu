/**
 * Shared helper for resolving ticket creator and sending email notifications.
 * Used by syncSupportHubUpdates and receiveSupportHubComment.
 */

/**
 * Resolves creator email and name from a ticket record.
 * Falls back to User entity lookup if not stored on the ticket.
 */
export async function resolveTicketCreator(ticket, base44) {
  let creatorEmail = ticket.creator_email;
  let creatorName = ticket.creator_name;

  if (!creatorEmail && ticket.tenant_user_id) {
    try {
      const users = await base44.asServiceRole.entities.User.filter({ id: ticket.tenant_user_id });
      if (users.length > 0) {
        creatorEmail = users[0].email;
        creatorName = users[0].full_name || users[0].email;
        console.log(`[ticketNotifier] Resolved creator email from User record: ${creatorEmail}`);

        // Backfill on the ticket so future lookups don't need this round trip
        if (creatorEmail) {
          await base44.asServiceRole.entities.Ticket.update(ticket.id, {
            creator_email: creatorEmail,
            creator_name: creatorName
          });
          console.log(`[ticketNotifier] Backfilled creator_email on ticket ${ticket.id}`);
        }
      }
    } catch (err) {
      console.warn(`[ticketNotifier] Could not resolve creator from User record: ${err.message}`);
    }
  }

  return { creatorEmail, creatorName };
}

/**
 * Sends an update notification email to the ticket creator.
 */
export async function sendTicketUpdateEmail({ base44, creatorEmail, creatorName, ticket, changeItems, updatedByText, updatedAtFormatted, currentStatus, currentPriority, currentType, currentAgent }) {
  if (!creatorEmail) {
    console.warn(`[ticketNotifier] No creator email — skipping notification for ticket ${ticket.ticket_id}`);
    return;
  }

  const statusColor = currentStatus === "Resolved" || currentStatus === "Closed"
    ? "background:#dcfce7;color:#166534;"
    : currentStatus === "In Progress"
    ? "background:#dbeafe;color:#1d4ed8;"
    : currentStatus === "Waiting for Customer"
    ? "background:#fef3c7;color:#92400e;"
    : "background:#dcfce7;color:#166534;";

  const changeRowsContent = changeItems && changeItems.length > 0
    ? changeItems.map(c => `<tr><td style="padding:8px 16px;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">• ${c}</td></tr>`).join("")
    : `<tr><td style="padding:8px 16px;font-size:14px;color:#374151;">Your ticket has been updated by the support team.</td></tr>`;

  const subject = `[Vitauri CRS] Ticket Updated — ${ticket.ticket_id}`;
  const emailBody = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:#1e293b;padding:24px 32px;color:#60a5fa;font-size:20px;font-weight:bold;">🔔 Ticket Updated — ${ticket.ticket_id}</td>
        </tr>
        <tr>
          <td style="padding:24px 32px 8px 32px;color:#374151;font-size:15px;line-height:1.6;">
            Dear <strong>${creatorName || "User"}</strong>,<br><br>
            Your support ticket has been updated by <strong>${updatedByText}</strong> on ${updatedAtFormatted}.
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 8px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <tr style="background-color:#fef3c7;">
                <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">What Changed</td>
              </tr>
              ${changeRowsContent}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <tr style="background-color:#f8fafc;">
                <td colspan="2" style="padding:12px 16px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Current Ticket Snapshot</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;width:160px;">Ticket ID</td>
                <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#1e293b;border-bottom:1px solid #f3f4f6;">${ticket.ticket_id}</td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Title</td>
                <td style="padding:10px 16px;font-size:14px;font-weight:600;border-bottom:1px solid #f3f4f6;">${ticket.ticket_title}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Status</td>
                <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f3f4f6;"><span style="${statusColor}padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">${currentStatus}</span></td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Priority</td>
                <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f3f4f6;">${currentPriority}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;white-space:nowrap;">Assigned To</td>
                <td style="padding:10px 16px;font-size:14px;">${currentAgent}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px;">
            This is an automated notification from Vitauri CRS Compliance Platform.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({ to: creatorEmail, subject, body: emailBody });
    console.log(`[ticketNotifier] Update email sent to ${creatorEmail} for ticket ${ticket.ticket_id}`);
  } catch (emailErr) {
    console.error(`[ticketNotifier] Email send FAILED for ${creatorEmail} on ticket ${ticket.ticket_id}:`, emailErr.message);
  }
}

/**
 * Sends a new comment notification email to the ticket creator.
 */
export async function sendTicketCommentEmail({ base44, creatorEmail, creatorName, ticket, commentText, agentDisplay, commentedAtFormatted }) {
  if (!creatorEmail) {
    console.warn(`[ticketNotifier] No creator email — skipping comment notification for ticket ${ticket.ticket_id}`);
    return;
  }

  const statusColor = ticket.status === "Resolved" || ticket.status === "Closed"
    ? "background:#dcfce7;color:#166534;"
    : ticket.status === "In Progress"
    ? "background:#dbeafe;color:#1d4ed8;"
    : ticket.status === "Waiting for Customer"
    ? "background:#fef3c7;color:#92400e;"
    : "background:#dcfce7;color:#166534;";

  const subject = `[Vitauri CRS] New Comment on Ticket ${ticket.ticket_id}`;
  const emailBody = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:#1e293b;padding:24px 32px;">
            <span style="color:#a78bfa;font-size:20px;font-weight:bold;">💬 New Comment — ${ticket.ticket_id}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 8px 32px;color:#374151;font-size:15px;line-height:1.6;">
            Dear <strong>${creatorName || "User"}</strong>,<br><br>
            A new comment has been added to your support ticket by <strong>${agentDisplay}</strong>.
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 8px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <tr style="background-color:#f0f9ff;">
                <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">
                  Comment from ${agentDisplay} &nbsp;·&nbsp; ${commentedAtFormatted}
                </td>
              </tr>
              <tr>
                <td style="padding:16px;font-size:14px;color:#374151;line-height:1.7;font-style:italic;">"${commentText.replace(/\n/g, "<br>")}"</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <tr style="background-color:#f8fafc;">
                <td colspan="2" style="padding:12px 16px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Ticket Snapshot</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;width:160px;">Ticket ID</td>
                <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#1e293b;border-bottom:1px solid #f3f4f6;">${ticket.ticket_id}</td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Title</td>
                <td style="padding:10px 16px;font-size:14px;font-weight:600;border-bottom:1px solid #f3f4f6;">${ticket.ticket_title}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Status</td>
                <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f3f4f6;"><span style="${statusColor}padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">${ticket.status}</span></td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Priority</td>
                <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f3f4f6;">${ticket.priority}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;white-space:nowrap;">Assigned To</td>
                <td style="padding:10px 16px;font-size:14px;">${ticket.assigned_agent_name || "Unassigned"}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px;">
            This is an automated notification from Vitauri CRS Compliance Platform.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({ to: creatorEmail, subject, body: emailBody });
    console.log(`[ticketNotifier] Comment email sent to ${creatorEmail} for ticket ${ticket.ticket_id}`);
  } catch (emailErr) {
    console.error(`[ticketNotifier] Comment email FAILED for ${creatorEmail} on ticket ${ticket.ticket_id}:`, emailErr.message);
  }
}