import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SUPPORT_HUB_API_URL = Deno.env.get("SUPPORT_HUB_API_URL");
const INCOMING_TICKET_API_KEY = Deno.env.get("INCOMING_TICKET_API_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.app_role !== "tenant_admin") {
      return Response.json({ error: "Forbidden: Only tenant admins can reopen tickets" }, { status: 403 });
    }

    const body = await req.json();
    const { crs_ticket_id, reopen_comment } = body;

    if (!crs_ticket_id) {
      return Response.json({ error: "crs_ticket_id is required" }, { status: 400 });
    }

    // Fetch the ticket
    const tickets = await base44.asServiceRole.entities.Ticket.filter({ id: crs_ticket_id });
    if (!tickets.length) {
      return Response.json({ error: "Ticket not found" }, { status: 404 });
    }

    const ticket = tickets[0];

    if (ticket.tenant_id !== user.tenant_id) {
      return Response.json({ error: "Forbidden: Ticket does not belong to your tenant" }, { status: 403 });
    }

    if (ticket.status !== "Closed") {
      return Response.json({ error: "Only Closed tickets can be reopened" }, { status: 400 });
    }

    // Create audit comment locally
    const auditComment = await base44.asServiceRole.entities.TicketComment.create({
      ticket_id: crs_ticket_id,
      tenant_id: ticket.tenant_id,
      comment_text: reopen_comment || "Ticket reopened by tenant admin.",
      created_by_user_id: user.id,
      created_by_user_email: user.email,
      created_by_name: user.full_name,
      created_by_role: "tenant_admin",
      is_internal: false,
      source_app: "crs_compliance"
    });

    // Send reopen request to Support Hub
    if (SUPPORT_HUB_API_URL && INCOMING_TICKET_API_KEY && ticket.support_hub_ticket_id) {
      try {
        const response = await fetch(`${SUPPORT_HUB_API_URL}/reopenTicketFromCRS`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": INCOMING_TICKET_API_KEY
          },
          body: JSON.stringify({
            ticket_id: ticket.support_hub_ticket_id,
            crs_internal_id: crs_ticket_id,
            reopen_comment: reopen_comment || "Ticket reopened by tenant admin.",
            crs_comment_id: auditComment.id,
            user_details: {
              id: user.id,
              email: user.email,
              name: user.full_name,
              role: user.app_role
            }
          })
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("[reopenTicket] Support Hub reopen failed:", data);
          return Response.json({ success: true, warning: "Reopened locally but Support Hub sync failed", details: data });
        }

        console.log(`[reopenTicket] Ticket ${crs_ticket_id} reopen request sent to Support Hub.`);
        return Response.json({ success: true, message: "Reopen request sent. Status will update via webhook." });

      } catch (syncError) {
        console.error("[reopenTicket] Network error:", syncError.message);
        return Response.json({ success: true, warning: "Reopened locally but Support Hub sync failed" });
      }
    }

    return Response.json({ success: true, message: "Reopen comment added locally. Support Hub not configured." });

  } catch (error) {
    console.error("[reopenTicket] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});