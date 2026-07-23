import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Helper: only include field in update if the incoming value is explicitly provided (not undefined/null)
function ifProvided(value) {
  return value !== undefined && value !== null;
}

Deno.serve(async (req) => {
  const SUPPORT_HUB_SHARED_SECRET = Deno.env.get("SUPPORT_HUB_SHARED_SECRET");
  try {
    // Validate shared secret FIRST
    const incomingSecret = req.headers.get("x-shared-secret") || req.headers.get("x-webhook-secret");
    if (!SUPPORT_HUB_SHARED_SECRET || incomingSecret !== SUPPORT_HUB_SHARED_SECRET) {
      console.warn("[syncSupportHubUpdates] Unauthorized: invalid shared secret");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("[syncSupportHubUpdates] Received payload:", JSON.stringify(body));

    const {
      event_type,
      crs_internal_id: _crs_internal_id,
      crs_ticket_id: _crs_ticket_id,
      support_hub_ticket_id: hub_ticket_id,
      status,
      priority,
      ticket_type,
      title,
      description,
      category,
      resolution_summary,
      root_cause,
      assigned_agent_name,
      assigned_agent_id,
      resolved_at,
      closed_at,
      attachment_urls,
      source_app,
      updated_by_name,
      updated_by_email
    } = body;

    // Accept both field names — Support Hub may send either crs_ticket_id or crs_internal_id
    const crs_internal_id = _crs_internal_id || _crs_ticket_id;

    if (!event_type || !crs_internal_id) {
      return Response.json({ error: "Missing event_type or crs_internal_id/crs_ticket_id" }, { status: 400 });
    }

    if (event_type !== "ticket_updated") {
      return Response.json({ error: `Unknown event_type: ${event_type}` }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Fetch existing ticket
    let ticket = null;
    const byId = await base44.asServiceRole.entities.Ticket.filter({ id: crs_internal_id });
    if (byId.length > 0) ticket = byId[0];

    if (!ticket && hub_ticket_id) {
      const byHub = await base44.asServiceRole.entities.Ticket.filter({ support_hub_ticket_id: hub_ticket_id });
      if (byHub.length > 0) ticket = byHub[0];
    }
    if (!ticket) {
      console.log(`[syncSupportHubUpdates] Ticket not found for crs_internal_id: ${crs_internal_id}. Skipping.`);
      return Response.json({ success: true, message: "Ticket not found, skipping." });
    }

    const isCrsOriginated = source_app === "crs_compliance";

    // isInitialSync: ONLY true when this is the first confirmation from Support Hub
    const isInitialSync =
      ifProvided(hub_ticket_id) &&
      !ticket.support_hub_ticket_id &&
      ticket.support_hub_sync_status === "pending";

    // ── Build updates object ──────────────────────────────────────────────────
    const updates: Record<string, any> = {};

    if (ifProvided(hub_ticket_id))           updates.support_hub_ticket_id = hub_ticket_id;
    if (ifProvided(status))                  updates.status = status;
    if (ifProvided(priority))                updates.priority = priority;
    if (ifProvided(ticket_type))             updates.ticket_type = ticket_type;
    if (ifProvided(title))                   updates.ticket_title = title;
    if (ifProvided(description))             updates.description = description;
    if (ifProvided(category))                updates.category = category;
    if (ifProvided(resolution_summary))      updates.resolution_summary = resolution_summary;
    if (ifProvided(root_cause))              updates.root_cause = root_cause;
    if (ifProvided(assigned_agent_name))     updates.assigned_agent_name = assigned_agent_name;
    if (ifProvided(assigned_agent_id))       updates.assigned_agent_id = assigned_agent_id;
    if (ifProvided(resolved_at))             updates.resolved_at = resolved_at;
    if (Array.isArray(attachment_urls) && attachment_urls.length > 0) {
      updates.attachment_urls = attachment_urls;
    }

    // Closed-at handling
    if (ifProvided(status)) {
      if (status === "Closed") {
        updates.closed_at = ifProvided(closed_at) ? closed_at : (ticket.status !== "Closed" ? new Date().toISOString() : ticket.closed_at);
      } else if (ticket.status === "Closed" && status !== "Closed") {
        updates.closed_at = null;
      }
    } else if (ifProvided(closed_at)) {
      updates.closed_at = closed_at;
    }

    updates.support_hub_sync_status = "synced";

    // ── Compute what actually changed (for notifications & unread badge) ───────
    const changeItems: string[] = [];

    if (ifProvided(status) && status !== ticket.status)
      changeItems.push(`Status changed from "${ticket.status}" to "${status}"`);
    if (ifProvided(priority) && priority !== ticket.priority)
      changeItems.push(`Priority changed from "${ticket.priority}" to "${priority}"`);
    if (ifProvided(ticket_type) && ticket_type !== ticket.ticket_type)
      changeItems.push(`Type changed from "${ticket.ticket_type || "—"}" to "${ticket_type}"`);
    if (ifProvided(assigned_agent_name) && assigned_agent_name !== ticket.assigned_agent_name)
      changeItems.push(`Assigned to "${assigned_agent_name}" (was "${ticket.assigned_agent_name || "Unassigned"}")`);
    if (ifProvided(resolution_summary) && resolution_summary !== ticket.resolution_summary)
      changeItems.push("Resolution summary added/updated");
    if (ifProvided(title) && title !== ticket.ticket_title)
      changeItems.push("Title updated");
    if (ifProvided(description) && description !== ticket.description)
      changeItems.push("Description updated");

    // ── Unread notification logic ─────────────────────────────────────────────
    if (isInitialSync) {
      updates.has_unread_updates      = false;
      updates.unread_updates_count    = 0;
      updates.unread_update_summary   = [];
      updates.first_unread_comment_id = null;
      console.log(`[syncSupportHubUpdates] Initial sync confirmed for ticket ${crs_internal_id}`);
    } else if (!isCrsOriginated && changeItems.length > 0) {
      const currentSummarySet = new Set(ticket.unread_update_summary || []);
      changeItems.forEach(s => currentSummarySet.add(s));
      const allSummary = Array.from(currentSummarySet);
      updates.has_unread_updates    = true;
      updates.unread_updates_count  = allSummary.length;
      updates.unread_update_summary = allSummary;
      console.log(`[syncSupportHubUpdates] Unread updates for ticket ${ticket.id}:`, changeItems);
    } else {
      console.log(`[syncSupportHubUpdates] No notification changes for ticket ${ticket.id}. isCrsOriginated: ${isCrsOriginated}`);
    }

    await base44.asServiceRole.entities.Ticket.update(ticket.id, updates);

    // ── Send email notification to the original creator ───────────────────────
    // If creator_email missing on old ticket records, fall back to looking up user by tenant_user_id
    let creatorEmail = ticket.creator_email;
    let creatorName  = ticket.creator_name;
    if (!creatorEmail && ticket.tenant_user_id) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ id: ticket.tenant_user_id });
        if (users.length > 0) {
          creatorEmail = users[0].email;
          creatorName  = users[0].full_name || users[0].email;
          console.log(`[syncSupportHubUpdates] Resolved creator email from User record: ${creatorEmail}`);
        }
      } catch (uErr) {
        console.warn("[syncSupportHubUpdates] Could not resolve creator email:", uErr.message);
      }
    }

    // Skip for: initial sync (just a confirmation echo), CRS-originated updates, or no real changes
    if (!isInitialSync && !isCrsOriginated && changeItems.length > 0 && creatorEmail) {
      const updatedAtFormatted = new Date().toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " UTC";
      const updatedByText = updated_by_name
        ? `${updated_by_name}${updated_by_email ? ` (${updated_by_email})` : ""}`
        : "Vitauri Support Team";

      const currentStatus   = updates.status             || ticket.status;
      const currentPriority = updates.priority            || ticket.priority;
      const currentType     = updates.ticket_type         || ticket.ticket_type;
      const currentAgent    = updates.assigned_agent_name || ticket.assigned_agent_name || "Unassigned";

      const statusColor = currentStatus === "Resolved" || currentStatus === "Closed"
        ? "background:#dcfce7;color:#166534;"
        : currentStatus === "In Progress"
        ? "background:#dbeafe;color:#1d4ed8;"
        : currentStatus === "Waiting for Customer"
        ? "background:#fef3c7;color:#92400e;"
        : "background:#dcfce7;color:#166534;";

      const changeRows = changeItems.map(c =>
        `<tr><td style="padding:8px 16px;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">• ${c}</td></tr>`
      ).join("");

      const subject = `[Vitauri CRS] Ticket Updated — ${ticket.ticket_id}`;
      const emailBody = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background-color:#1e293b;padding:24px 32px;color:#60a5fa;font-size:20px;font-weight:bold;">🔔 Ticket Updated — ${ticket.ticket_id}</td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:24px 32px 8px 32px;color:#374151;font-size:15px;line-height:1.6;">
            Dear <strong>${creatorName || "User"}</strong>,<br><br>
            Your support ticket has been updated in the Vitauri Support Hub.
            Updated by <strong>${updatedByText}</strong> on ${updatedAtFormatted}.
          </td>
        </tr>

        <!-- What Changed -->
        <tr>
          <td style="padding:16px 32px 8px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <tr style="background-color:#fef3c7;">
                <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">What Changed</td>
              </tr>
              ${changeRows}
            </table>
          </td>
        </tr>

        <!-- Current Snapshot -->
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
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Type</td>
                <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f3f4f6;">${currentType}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Priority</td>
                <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f3f4f6;">${currentPriority}</td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;white-space:nowrap;">Assigned To</td>
                <td style="padding:10px 16px;font-size:14px;">${currentAgent}</td>
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
        console.log(`[syncSupportHubUpdates] Update notification email sent to ${creatorEmail} for ticket ${ticket.ticket_id}`);
      } catch (emailErr) {
        console.error("[syncSupportHubUpdates] Email send FAILED for", creatorEmail, ":", emailErr.message, emailErr);
      }
    }

    console.log(`[syncSupportHubUpdates] Ticket ${ticket.id} updated. Fields: ${Object.keys(updates).join(", ")}. isInitialSync: ${isInitialSync}, isCrsOriginated: ${isCrsOriginated}`);
    return Response.json({
      success: true,
      message: "Ticket updated",
      fields_applied: Object.keys(updates),
      is_initial_sync: isInitialSync
    });

  } catch (error) {
    console.error("[syncSupportHubUpdates] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});