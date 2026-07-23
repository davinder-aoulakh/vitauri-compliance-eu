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
    const sendCreationEmail = async (supportHubTicketId?: string) => {
      if (!user.email) return;
      const supportHubLink = supportHubTicketId
        ? `\n\nView your ticket in Support Hub: reference ID ${supportHubTicketId}`
        : "";
      const subject = `✅ Support Ticket Created: ${ticket_id} — ${ticket_title}`;
      const body = `Dear ${user.full_name || "User"},

Your support ticket has been successfully created and is now being tracked in the Vitauri Support Hub.

─────────────────────────────────────────
TICKET DETAILS
─────────────────────────────────────────
Ticket ID:    ${ticket_id}
Title:        ${ticket_title}
Type:         ${ticketType}
Priority:     ${ticketPriority}
Status:       Open
Created:      ${new Date(createdAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC

Description:
${description}
─────────────────────────────────────────

Your ticket is now being reviewed by the Vitauri support team. You will receive an email notification whenever there is an update.${supportHubLink}

Thank you,
Vitauri Compliance Support`;

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
          await sendCreationEmail(data.support_hub_ticket_id);
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