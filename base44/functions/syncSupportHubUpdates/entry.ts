import { createClient } from 'npm:@base44/sdk@0.8.23';

const SUPPORT_HUB_SHARED_SECRET = Deno.env.get("SUPPORT_HUB_SHARED_SECRET");
const BASE44_APP_ID = Deno.env.get("BASE44_APP_ID");

// Initialize a service-role client at module level — safe for unauthenticated webhooks
const base44 = createClient({ appId: BASE44_APP_ID });

Deno.serve(async (req) => {
  try {
    // Validate shared secret FIRST before anything else
    const incomingSecret = req.headers.get("x-shared-secret") || req.headers.get("x-webhook-secret");
    if (!SUPPORT_HUB_SHARED_SECRET || incomingSecret !== SUPPORT_HUB_SHARED_SECRET) {
      console.warn("[syncSupportHubUpdates] Unauthorized: invalid shared secret");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("[syncSupportHubUpdates] Received payload:", JSON.stringify(body));

    const {
      event_type,
      crs_internal_id,
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
      source_app
    } = body;

    if (!event_type || !crs_internal_id) {
      return Response.json({ error: "Missing event_type or crs_internal_id" }, { status: 400 });
    }

    if (event_type !== "ticket_updated") {
      return Response.json({ error: `Unknown event_type: ${event_type}` }, { status: 400 });
    }

    // Fetch existing ticket
    const tickets = await base44.entities.Ticket.filter({ id: crs_internal_id });
    if (!tickets.length) {
      console.error(`[syncSupportHubUpdates] Ticket ${crs_internal_id} not found`);
      return Response.json({ error: "Ticket not found" }, { status: 404 });
    }

    const ticket = tickets[0];
    const isCrsOriginated = source_app === "crs_compliance";

    // Detect initial sync confirmation — ticket was pending and Support Hub is confirming receipt
    const isInitialSync = ticket.support_hub_sync_status === "pending" ||
      (ticket.support_hub_ticket_id == null && hub_ticket_id != null);

    // Helper: determine closed_at value
    const getClosedAt = () => {
      if (status === "Closed") {
        if (closed_at) return closed_at;
        if (ticket.status !== "Closed") return new Date().toISOString();
        return undefined;
      }
      if (ticket.status === "Closed") return null; // re-opened — clear it
      return undefined;
    };

    // Build the update object — always apply all fields sent in payload
    const updates = {};

    if (hub_ticket_id)                   updates.support_hub_ticket_id = hub_ticket_id;
    if (status)                          updates.status = status;
    if (priority !== undefined)          updates.priority = priority;
    if (ticket_type !== undefined)       updates.ticket_type = ticket_type;
    if (title)                           updates.ticket_title = title;
    if (description)                     updates.description = description;
    if (category)                        updates.category = category;
    if (resolution_summary)              updates.resolution_summary = resolution_summary;
    if (root_cause)                      updates.root_cause = root_cause;
    if (assigned_agent_name !== undefined) updates.assigned_agent_name = assigned_agent_name;
    if (assigned_agent_id !== undefined)   updates.assigned_agent_id = assigned_agent_id;
    if (resolved_at)                     updates.resolved_at = resolved_at;
    if (Array.isArray(attachment_urls) && attachment_urls.length > 0) {
      updates.attachment_urls = attachment_urls;
    }

    const computedClosedAt = getClosedAt();
    if (computedClosedAt !== undefined)  updates.closed_at = computedClosedAt;

    updates.support_hub_sync_status = "synced";

    if (isInitialSync) {
      // Clean initial confirmation — reset all unread flags
      updates.has_unread_updates      = false;
      updates.unread_updates_count    = 0;
      updates.unread_update_summary   = [];
      updates.first_unread_comment_id = null;
      console.log(`[syncSupportHubUpdates] Initial sync confirmed for ticket ${crs_internal_id}`);
    } else if (!isCrsOriginated) {
      // Real update from Support Hub — detect what changed for the unread badge
      const currentUpdateSummary = new Set(ticket.unread_update_summary || []);
      const currentCount = ticket.unread_updates_count || 0;

      if (status && status !== ticket.status)                               currentUpdateSummary.add("Status updated");
      if (priority && priority !== ticket.priority)                         currentUpdateSummary.add("Priority updated");
      if (ticket_type && ticket_type !== ticket.ticket_type)                currentUpdateSummary.add("Type updated");
      if (assigned_agent_name && assigned_agent_name !== ticket.assigned_agent_name) currentUpdateSummary.add("Assigned To updated");
      if (resolution_summary && resolution_summary !== ticket.resolution_summary)    currentUpdateSummary.add("Resolution summary updated");

      const hadChanges = currentUpdateSummary.size > (ticket.unread_update_summary || []).length ||
        [...currentUpdateSummary].some(s => !(ticket.unread_update_summary || []).includes(s));

      if (hadChanges) {
        updates.has_unread_updates    = true;
        updates.unread_updates_count  = currentCount + 1;
        updates.unread_update_summary = Array.from(currentUpdateSummary);
      }
    }

    await base44.entities.Ticket.update(crs_internal_id, updates);

    console.log(`[syncSupportHubUpdates] Ticket ${crs_internal_id} updated. Fields: ${Object.keys(updates).join(", ")}. Initial: ${isInitialSync}, CRS-originated: ${isCrsOriginated}`);
    return Response.json({ success: true, message: "Ticket updated", fields_applied: Object.keys(updates) });

  } catch (error) {
    console.error("[syncSupportHubUpdates] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});