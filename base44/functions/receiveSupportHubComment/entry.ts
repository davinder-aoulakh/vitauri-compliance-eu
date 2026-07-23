import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const SUPPORT_HUB_SHARED_SECRET = Deno.env.get("SUPPORT_HUB_SHARED_SECRET");
  try {
    // Validate shared secret
    const incomingSecret = req.headers.get("x-shared-secret") || req.headers.get("x-webhook-secret");
    if (!SUPPORT_HUB_SHARED_SECRET || incomingSecret !== SUPPORT_HUB_SHARED_SECRET) {
      console.warn("[receiveSupportHubComment] Unauthorized: invalid shared secret");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("[receiveSupportHubComment] Received payload:", JSON.stringify(body));

    const {
      event_type,
      crs_internal_id,
      support_hub_comment_id,
      comment_text,
      is_internal,
      author_name,
      author_email,
      author_type,
      attachment_urls,
      source_app
    } = body;

    if (!crs_internal_id || !comment_text) {
      return Response.json({ error: "crs_internal_id and comment_text are required" }, { status: 400 });
    }

    const isCrsOriginated = source_app === "crs_compliance";

    const base44 = createClientFromRequest(req);

    // ── comment_updated: find and update existing comment ──────────────────────
    if (event_type === "comment_updated" && support_hub_comment_id) {
      const existing = await base44.asServiceRole.entities.TicketComment.filter({ support_hub_comment_id });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.TicketComment.update(existing[0].id, {
          comment_text,
          attachment_urls: attachment_urls || []
        });
        console.log(`[receiveSupportHubComment] Comment ${support_hub_comment_id} updated.`);
        return Response.json({ success: true, comment_id: existing[0].id, action: "updated" });
      }
      console.warn(`[receiveSupportHubComment] comment_updated: no match for ${support_hub_comment_id} — will create.`);
    }

    // ── Idempotency: skip if already exists ───────────────────────────────────
    if (support_hub_comment_id) {
      const existing = await base44.asServiceRole.entities.TicketComment.filter({ support_hub_comment_id });
      if (existing.length > 0) {
        console.log(`[receiveSupportHubComment] Comment ${support_hub_comment_id} already exists, skipping.`);
        return Response.json({ success: true, message: "Already processed (idempotent)" });
      }
    }

    // ── CRS echo: stamp hub ID onto original CRS comment, no duplicate ────────
    if (isCrsOriginated && support_hub_comment_id) {
      const allTicketComments = await base44.asServiceRole.entities.TicketComment.filter({
        ticket_id: crs_internal_id,
        source_app: "crs_compliance"
      });
      const match = allTicketComments.find(c => !c.support_hub_comment_id && c.comment_text === comment_text);
      if (match) {
        await base44.asServiceRole.entities.TicketComment.update(match.id, { support_hub_comment_id });
        console.log(`[receiveSupportHubComment] Echo: stamped hub ID ${support_hub_comment_id} onto CRS comment ${match.id}.`);
        return Response.json({ success: true, comment_id: match.id, action: "echo_stamped" });
      }
    }

    // ── Create new TicketComment record ───────────────────────────────────────
    const newComment = await base44.asServiceRole.entities.TicketComment.create({
      ticket_id:              crs_internal_id,
      comment_text,
      created_by_name:        author_name  || "Support Team",
      created_by_user_email:  author_email || "",
      created_by_role:        author_type === "client" ? "tenant_user" : "support_team",
      is_internal:            is_internal || false,
      support_hub_comment_id: support_hub_comment_id || null,
      source_app:             source_app || "support_hub",
      attachment_urls:        attachment_urls || []
    });

    // ── Update Ticket unread badge — suppress if CRS-originated ───────────────
    if (!isCrsOriginated) {
      const ticketResults = await base44.asServiceRole.entities.Ticket.filter({ id: crs_internal_id });
      const ticket = ticketResults[0] || null;
      if (ticket) {
        await base44.asServiceRole.entities.Ticket.update(crs_internal_id, {
          has_unread_updates:      true,
          unread_updates_count:    (ticket.unread_updates_count || 0) + 1,
          unread_update_summary:   [...(ticket.unread_update_summary || []), "New comment added"],
          first_unread_comment_id: ticket.first_unread_comment_id || newComment.id
        });

        // ── Send email notification to ticket creator for new comment ──────────
        // Fall back to User lookup if creator_email not stored on old tickets
        let creatorEmail = ticket.creator_email;
        let creatorName  = ticket.creator_name;
        if (!creatorEmail && ticket.tenant_user_id) {
          try {
            const users = await base44.asServiceRole.entities.User.filter({ id: ticket.tenant_user_id });
            if (users.length > 0) {
              creatorEmail = users[0].email;
              creatorName  = users[0].full_name || users[0].email;
              console.log(`[receiveSupportHubComment] Resolved creator email from User record: ${creatorEmail}`);
            }
          } catch (uErr) {
            console.warn("[receiveSupportHubComment] Could not resolve creator email:", uErr.message);
          }
        }
        if (creatorEmail) {
          const commentedAtFormatted = new Date().toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " UTC";
          const agentDisplay = author_name
            ? `${author_name}${author_email ? ` (${author_email})` : ""}`
            : "Vitauri Support Team";

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

        <!-- Header -->
        <tr>
          <td style="background-color:#1e293b;padding:24px 32px;">
            <span style="color:#a78bfa;font-size:20px;font-weight:bold;">💬 New Comment — ${ticket.ticket_id}</span>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:24px 32px 8px 32px;color:#374151;font-size:15px;line-height:1.6;">
            Dear <strong>${creatorName || "User"}</strong>,<br><br>
            A new comment has been added to your support ticket by <strong>${agentDisplay}</strong>.
          </td>
        </tr>

        <!-- Comment Box -->
        <tr>
          <td style="padding:16px 32px 8px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <tr style="background-color:#f0f9ff;">
                <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">
                  Comment from ${agentDisplay} &nbsp;·&nbsp; ${commentedAtFormatted}
                </td>
              </tr>
              <tr>
                <td style="padding:16px;font-size:14px;color:#374151;line-height:1.7;font-style:italic;">"${comment_text.replace(/\n/g, "<br>")}"</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Ticket Snapshot -->
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

        <!-- Footer -->
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
            await base44.integrations.Core.SendEmail({ to: creatorEmail, subject, body: emailBody });
            console.log(`[receiveSupportHubComment] New comment notification sent to ${creatorEmail} for ticket ${ticket.ticket_id}`);
          } catch (emailErr) {
            console.error("[receiveSupportHubComment] Email send FAILED for", creatorEmail, ":", emailErr.message, emailErr);
          }
        }
      } else {
        console.warn(`[receiveSupportHubComment] Could not find ticket ${crs_internal_id} to update unread badge.`);
      }
    } else {
      console.log(`[receiveSupportHubComment] CRS-originated comment — skipping unread notification and email.`);
    }

    console.log(`[receiveSupportHubComment] Comment created for ticket ${crs_internal_id}. source_app: ${source_app}`);
    return Response.json({ success: true, comment_id: newComment.id, action: "created" });

  } catch (error) {
    console.error("[receiveSupportHubComment] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});