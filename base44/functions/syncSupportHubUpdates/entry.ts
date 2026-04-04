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
      title,
      description,
      category,
      resolution_summary,
      root_cause,
      assigned_agent_name,
      assigned_agent_id,
      resolved_at,
      closed_at,
      attachment_urls
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

    // ── Always apply ALL fields from the incoming payload ──────────────────
    // No diff detection — CRS always receives and stores the full current state
    // from Support Hub. Build a summary of what was sent for the unread badge.
    const changeSummary = [];

    if (status && status !== ticket.status)                       changeSummary.push(`Status updated to ${status}`);
    if (priority && priority !== ticket.priority)                 changeSummary.push(`Priority changed to ${priority}`);
    if (ticket_type && ticket_type !== ticket.ticket_type)        changeSummary.push(`Type changed to ${ticket_type}`);
    if (assigned_agent_name && assigned_agent_name !== ticket.assigned_agent_name) changeSummary.push(`Assigned to ${assigned_agent_name}`);
    if (resolution_summary && resolution_summary !== ticket.resolution_summary)    changeSummary.push(`Resolution summary updated`);
    if (status === "Closed" || status === "Resolved")             changeSummary.push(`Ticket ${status.toLowerCase()}`);

    // Deduplicate summary entries
    const uniqueSummary = [...new Set(changeSummary)];

    const currentCount   = ticket.unread_updates_count  || 0;
    const currentSummary = ticket.unread_update_summary || [];

    // Build the update payload — include every field that was sent
    const updatePayload = {
      support_hub_sync_status: "synced",
      has_unread_updates:      uniqueSummary.length > 0,
      unread_updates_count:    currentCount + uniqueSummary.length,
      unread_update_summary:   [...currentSummary, ...uniqueSummary]
    };

    if (hub_ticket_id)       updatePayload.support_hub_ticket_id = hub_ticket_id;
    if (status)              updatePayload.status = status;
    if (priority)            updatePayload.priority = priority;
    if (ticket_type)         updatePayload.ticket_type = ticket_type;
    if (title)               updatePayload.ticket_title = title;
    if (description)         updatePayload.description = description;
    if (category)            updatePayload.category = category;
    if (resolution_summary)  updatePayload.resolution_summary = resolution_summary;
    if (root_cause)          updatePayload.root_cause = root_cause;
    if (assigned_agent_name) updatePayload.assigned_agent_name = assigned_agent_name;
    if (assigned_agent_id)   updatePayload.assigned_agent_id   = assigned_agent_id;
    if (resolved_at)         updatePayload.resolved_at = resolved_at;
    if (closed_at)           updatePayload.closed_at   = closed_at;
    if (Array.isArray(attachment_urls) && attachment_urls.length > 0) {
      updatePayload.attachment_urls = attachment_urls;
    }

    await base44.asServiceRole.entities.Ticket.update(crs_internal_id, updatePayload);

    console.log(`[syncSupportHubUpdates] Ticket ${crs_internal_id} updated. Fields applied:`, Object.keys(updatePayload).join(", "));
    return Response.json({ success: true, fields_applied: Object.keys(updatePayload), changes: uniqueSummary });

  } catch (error) {
    console.error("[syncSupportHubUpdates] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});