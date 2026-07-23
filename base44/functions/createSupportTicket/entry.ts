import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const SUPPORT_HUB_API_URL = Deno.env.get("SUPPORT_HUB_API_URL");
  const SUPPORT_HUB_API_KEY = Deno.env.get("SUPPORT_HUB_API_KEY");
  console.log("[createSupportTicket] Secret check - URL set:", !!SUPPORT_HUB_API_URL, "| KEY set:", !!SUPPORT_HUB_API_KEY);

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles = ["tenant_admin"];
    if (!allowedRoles.includes(user.app_role)) {
      return Response.json({ error: "Forbidden: Only tenant users can create tickets" }, { status: 403 });
    }

    const body = await req.json();
    const { ticket_title, description, priority, ticket_type, attachment_urls } = body;

    if (!ticket_title || !description) {
      return Response.json({ error: "ticket_title and description are required" }, { status: 400 });
    }

    // Generate unique ticket ID
    const existingTickets = await base44.asServiceRole.entities.Ticket.filter({ tenant_id: user.tenant_id });
    const ticketNumber = String(existingTickets.length + 1).padStart(6, "0");
    const ticket_id = `CRS-${ticketNumber}`;

    // Fetch tenant name for context
    let tenantName = "Unknown Tenant";
    try {
      const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: user.tenant_id });
      if (tenants.length > 0) tenantName = tenants[0].name || tenants[0].short_name || "Unknown Tenant";
    } catch (e) {
      console.warn("[createSupportTicket] Could not fetch tenant name:", e.message);
    }

    const createdAt = new Date().toISOString();
    const ticketPriority = priority || "Medium";
    const ticketType = ticket_type || "Support Request";

    // Create Ticket record in CRS DB — store creator_email and creator_name
    const newTicket = await base44.asServiceRole.entities.Ticket.create({
      ticket_id,
      tenant_id: user.tenant_id,
      tenant_user_id: user.id,
      creator_email: user.email,
      creator_name: user.full_name || user.email,
      ticket_title,
      description,
      priority: ticketPriority,
      ticket_type: ticketType,
      status: "Open",
      attachment_urls: attachment_urls || [],
      support_hub_sync_status: "pending",
      has_unread_updates: false,
      unread_updates_count: 0,
      unread_update_summary: []
    });

    // Helper to send the creation confirmation email
    const sendCreationEmail = async () => {
      if (!user.email) return;
      const createdAtFormatted = new Date(createdAt).toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " UTC";

      const subject = `[Vitauri CRS] New Ticket Created — ${ticket_id}`;
      const body = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background-color:#1e293b;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#f59e0b;font-size:20px;font-weight:bold;">🎫 New Ticket Created — ${ticket_id}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:24px 32px 8px 32px;color:#374151;font-size:15px;line-height:1.6;">
            Dear <strong>${user.full_name || user.email}</strong>,<br><br>
            Your support ticket has been successfully created and is now being tracked in the Vitauri Support Hub. You will receive an email notification whenever there is an update.
          </td>
        </tr>

        <!-- Ticket Details Table -->
        <tr>
          <td style="padding:16px 32px 24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <tr style="background-color:#f8fafc;">
                <td colspan="2" style="padding:12px 16px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Ticket Details</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;width:160px;">Ticket ID</td>
                <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#1e293b;border-bottom:1px solid #f3f4f6;">${ticket_id}</td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Title</td>
                <td style="padding:10px 16px;font-size:14px;font-weight:600;border-bottom:1px solid #f3f4f6;">${ticket_title}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Type</td>
                <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f3f4f6;">${ticketType}</td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Priority</td>
                <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f3f4f6;">${ticketPriority}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Status</td>
                <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f3f4f6;"><span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">Open</span></td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">Created At</td>
                <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f3f4f6;">${createdAtFormatted}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Description -->
        <tr>
          <td style="padding:0 32px 24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <tr style="background-color:#f8fafc;">
                <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Description</td>
              </tr>
              <tr>
                <td style="padding:16px;font-size:14px;color:#374151;line-height:1.6;">${description.replace(/\n/g, "<br>")}</td>
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
        await base44.integrations.Core.SendEmail({ to: user.email, subject, body });
        console.log(`[createSupportTicket] Confirmation email sent to ${user.email}`);
      } catch (emailErr) {
        console.warn("[createSupportTicket] Email send failed:", emailErr.message);
      }
    };

    // Sync to Support Hub
    if (SUPPORT_HUB_API_URL && SUPPORT_HUB_API_KEY) {
      try {
        const response = await fetch(`${SUPPORT_HUB_API_URL}/createTicketFromCRS`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": SUPPORT_HUB_API_KEY
          },
          body: JSON.stringify({
            crs_ticket_id: newTicket.id,
            tenant_id: user.tenant_id,
            tenant_user_id: user.id,
            tenant_name: tenantName,
            ticket_title,
            description,
            priority: ticketPriority,
            ticket_type: ticketType,
            attachment_urls: attachment_urls || [],
            requester_email: user.email,
            requester_name: user.full_name,
            source_app: "crs_compliance"
          })
        });

        const data = await response.json();

        if (response.ok && data.support_hub_ticket_id) {
          await base44.asServiceRole.entities.Ticket.update(newTicket.id, {
            support_hub_ticket_id: data.support_hub_ticket_id,
            support_hub_sync_status: "synced"
          });
          console.log(`[createSupportTicket] Ticket ${ticket_id} synced to Support Hub: ${data.support_hub_ticket_id}`);
          // Send confirmation email with Support Hub ticket ID
          await sendCreationEmail();
          return Response.json({ success: true, ticket_id, ticket_db_id: newTicket.id, support_hub_ticket_id: data.support_hub_ticket_id });
        } else {
          await base44.asServiceRole.entities.Ticket.update(newTicket.id, { support_hub_sync_status: "failed" });
          console.error("[createSupportTicket] Sync failed:", data);
          // Still send confirmation email — ticket exists in CRS even if sync failed
          await sendCreationEmail();
          return Response.json({ success: true, ticket_id, ticket_db_id: newTicket.id, sync_warning: "Ticket created locally but failed to sync to Support Hub" });
        }
      } catch (syncError) {
        await base44.asServiceRole.entities.Ticket.update(newTicket.id, { support_hub_sync_status: "failed" });
        console.error("[createSupportTicket] Network error during sync:", syncError.message);
        await sendCreationEmail();
        return Response.json({ success: true, ticket_id, ticket_db_id: newTicket.id, sync_warning: "Ticket created locally but failed to sync to Support Hub" });
      }
    } else {
      console.warn("[createSupportTicket] Support Hub credentials not configured.");
      await sendCreationEmail();
      return Response.json({ success: true, ticket_id, ticket_db_id: newTicket.id, sync_warning: "Support Hub not configured" });
    }

  } catch (error) {
    console.error("[createSupportTicket] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});