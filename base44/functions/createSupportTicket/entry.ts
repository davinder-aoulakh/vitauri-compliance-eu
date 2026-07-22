import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const SUPPORT_HUB_API_URL = Deno.env.get("SUPPORT_HUB_API_URL");
  const SUPPORT_HUB_API_KEY = Deno.env.get("SUPPORT_HUB_API_KEY");
  // DIAG: always log secret presence for debugging
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

    // Create Ticket record in CRS DB
    const newTicket = await base44.asServiceRole.entities.Ticket.create({
      ticket_id,
      tenant_id: user.tenant_id,
      tenant_user_id: user.id,
      ticket_title,
      description,
      priority: priority || "Medium",
      ticket_type: ticket_type || "Support Request",
      status: "Open",
      attachment_urls: attachment_urls || [],
      support_hub_sync_status: "pending",
      has_unread_updates: false,
      unread_updates_count: 0,
      unread_update_summary: []
    });

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
            priority: priority || "Medium",
            ticket_type: ticket_type || "Support Request",
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
          return Response.json({ success: true, ticket_id, ticket_db_id: newTicket.id, support_hub_ticket_id: data.support_hub_ticket_id });
        } else {
          await base44.asServiceRole.entities.Ticket.update(newTicket.id, { support_hub_sync_status: "failed" });
          console.error("[createSupportTicket] Sync failed:", data);
          return Response.json({ success: true, ticket_id, ticket_db_id: newTicket.id, sync_warning: "Ticket created locally but failed to sync to Support Hub" });
        }
      } catch (syncError) {
        await base44.asServiceRole.entities.Ticket.update(newTicket.id, { support_hub_sync_status: "failed" });
        console.error("[createSupportTicket] Network error during sync:", syncError.message);
        return Response.json({ success: true, ticket_id, ticket_db_id: newTicket.id, sync_warning: "Ticket created locally but failed to sync to Support Hub" });
      }
    } else {
      console.warn("[createSupportTicket] Support Hub credentials not configured.");
      return Response.json({ success: true, ticket_id, ticket_db_id: newTicket.id, sync_warning: "Support Hub not configured" });
    }

  } catch (error) {
    console.error("[createSupportTicket] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});