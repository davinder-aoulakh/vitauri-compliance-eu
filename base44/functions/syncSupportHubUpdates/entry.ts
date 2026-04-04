import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SUPPORT_HUB_SHARED_SECRET = Deno.env.get("SUPPORT_HUB_SHARED_SECRET");

Deno.serve(async (req) => {
  try {
    // Validate shared secret FIRST before anything else
    const incomingSecret = req.headers.get("x-shared-secret") || req.headers.get("x-webhook-secret");
    if (!SUPPORT_HUB_SHARED_SECRET || incomingSecret !== SUPPORT_HUB_SHARED_SECRET) {
      console.warn("[syncSupportHubUpdates] Unauthorized: invalid shared secret");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const {
      crs_internal_id,
      hub_ticket_id,
      status,
      priority,
      ticket_type,
      assigned_agent_name,
      assigned_agent_id,
      closed_at
    } = body;

    if (!crs_internal_id) {
      return Response.json({ error: "crs_internal_id is required" }, { status: 400 });
    }

    // Use service role directly — no user auth needed for incoming webhooks
    const base44 = createClientFromRequest(req);

    // Fetch existing ticket
    const tickets = await base44.asServiceRole.entities.Ticket.filter({ id: crs_internal_id });
    if (!tickets.length) {
      console.error(`[syncSupportHubUpdates] Ticket ${crs_internal_id} not found`);
      return Response.json({ error: "Ticket not found" }, { status: 404 });
    }

    const ticket = tickets[0];

    // Detect initial sync confirmation
    const isInitialSync = ticket.support_hub_sync_status === "pending" || !ticket.support_hub_ticket_id;

    if (isInitialSync) {
      await base44.asServiceRole.entities.Ticket.update(crs_internal_id, {
        support_hub_ticket_id: hub_ticket_id || ticket.support_hub_ticket_id,
        support_hub_sync_status: "synced",
        status: status || ticket.status,
        has_unread_updates: false,
        unread_updates_count: 0,
        unread_update_summary: [],
        first_unread_comment_id: null,
        assigned_agent_name: assigned_agent_name || ticket.assigned_agent_name,
        assigned_agent_id: assigned_agent_id || ticket.assigned_agent_id
      });
      console.log(`[syncSupportHubUpdates] Initial sync confirmed for ticket ${crs_internal_id}`);
      return Response.json({ success: true, message: "Initial sync confirmed" });
    }

    // Real update — detect what changed
    const changes = {};
    const changeSummary = [];

    if (status && status !== ticket.status) {
      changes.status = status;
      changeSummary.push(`Status updated to ${status}`);
      if (status === "Closed" && closed_at) {
        changes.closed_at = closed_at;
      }
    }

    if (priority && priority !== ticket.priority) {
      changes.priority = priority;
      changeSummary.push(`Priority changed to ${priority}`);
    }

    if (ticket_type && ticket_type !== ticket.ticket_type) {
      changes.ticket_type = ticket_type;
      changeSummary.push(`Type changed to ${ticket_type}`);
    }

    if (assigned_agent_name && assigned_agent_name !== ticket.assigned_agent_name) {
      changes.assigned_agent_name = assigned_agent_name;
      changes.assigned_agent_id = assigned_agent_id || ticket.assigned_agent_id;
      changeSummary.push(`Assigned to ${assigned_agent_name}`);
    }

    if (hub_ticket_id && hub_ticket_id !== ticket.support_hub_ticket_id) {
      changes.support_hub_ticket_id = hub_ticket_id;
    }

    if (changeSummary.length === 0) {
      console.log(`[syncSupportHubUpdates] No meaningful changes for ticket ${crs_internal_id}`);
      return Response.json({ success: true, message: "No changes detected" });
    }

    const currentCount = ticket.unread_updates_count || 0;
    const currentSummary = ticket.unread_update_summary || [];

    await base44.asServiceRole.entities.Ticket.update(crs_internal_id, {
      ...changes,
      support_hub_sync_status: "synced",
      has_unread_updates: true,
      unread_updates_count: currentCount + changeSummary.length,
      unread_update_summary: [...currentSummary, ...changeSummary]
    });

    console.log(`[syncSupportHubUpdates] Ticket ${crs_internal_id} updated:`, changeSummary);
    return Response.json({ success: true, changes: changeSummary });

  } catch (error) {
    console.error("[syncSupportHubUpdates] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});