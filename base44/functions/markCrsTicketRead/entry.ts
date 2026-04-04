import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ticket_id } = body;

    if (!ticket_id) {
      return Response.json({ error: "ticket_id is required" }, { status: 400 });
    }

    // Verify ticket belongs to user's tenant
    const tickets = await base44.asServiceRole.entities.Ticket.filter({ id: ticket_id });
    if (!tickets.length) {
      return Response.json({ error: "Ticket not found" }, { status: 404 });
    }

    const ticket = tickets[0];

    // Allow ticket owner, tenant_admin, or super_admin
    const isOwner = ticket.tenant_user_id === user.id;
    const isAdminRole = ["tenant_admin", "super_admin"].includes(user.app_role);
    const isSameTenant = ticket.tenant_id === user.tenant_id;

    if (!((isOwner || isAdminRole) && isSameTenant)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await base44.asServiceRole.entities.Ticket.update(ticket_id, {
      has_unread_updates: false,
      unread_updates_count: 0,
      unread_update_summary: [],
      first_unread_comment_id: null
    });

    console.log(`[markCrsTicketRead] Ticket ${ticket_id} marked as read by user ${user.email}`);
    return Response.json({ success: true });

  } catch (error) {
    console.error("[markCrsTicketRead] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});