const SUPPORT_HUB_SHARED_SECRET = Deno.env.get("SUPPORT_HUB_SHARED_SECRET");
const APP_ID = Deno.env.get("BASE44_APP_ID");
const API_BASE = `https://api.base44.com/api/apps/${APP_ID}/entities`;

// Direct REST helper — bypasses SDK auth requirement for unauthenticated webhooks
async function dbFilter(entity, query) {
  const res = await fetch(`${API_BASE}/${entity}/filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "app-id": APP_ID },
    body: JSON.stringify(query)
  });
  if (!res.ok) throw new Error(`DB filter ${entity} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function dbUpdate(entity, id, data) {
  const res = await fetch(`${API_BASE}/${entity}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "app-id": APP_ID },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`DB update ${entity} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Helper: only include field in update if the incoming value is explicitly provided (not undefined)
function ifProvided(value) {
  return value !== undefined && value !== null;
}

Deno.serve(async (req) => {
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
    const tickets = await dbFilter("Ticket", { id: crs_internal_id });
    if (!tickets.length) {
      console.error(`[syncSupportHubUpdates] Ticket ${crs_internal_id} not found`);
      return Response.json({ error: "Ticket not found" }, { status: 404 });
    }

    const ticket = tickets[0];
    const isCrsOriginated = source_app === "crs_compliance";

    // isInitialSync: ONLY true when this is the first confirmation from Support Hub
    // (hub is sending back its own ticket ID for the first time after creation)
    const isInitialSync =
      ifProvided(hub_ticket_id) &&
      !ticket.support_hub_ticket_id &&
      ticket.support_hub_sync_status === "pending";

    // ── Build updates object ──────────────────────────────────────────────────
    const updates = {};

    // All fields use explicit undefined check — allows empty string / null to be written
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
        // Ticket was re-opened from Support Hub side
        updates.closed_at = null;
      }
    } else if (ifProvided(closed_at)) {
      updates.closed_at = closed_at;
    }

    updates.support_hub_sync_status = "synced";

    // ── Unread notification logic ─────────────────────────────────────────────
    if (isInitialSync) {
      // First confirmation back from Support Hub — clear any stale unread flags
      updates.has_unread_updates      = false;
      updates.unread_updates_count    = 0;
      updates.unread_update_summary   = [];
      updates.first_unread_comment_id = null;
      console.log(`[syncSupportHubUpdates] Initial sync confirmed for ticket ${crs_internal_id}`);
    } else if (!isCrsOriginated) {
      // Real external update from Support Hub — track what changed for the tenant
      const currentSummarySet = new Set(ticket.unread_update_summary || []);
      const newSummaryItems = [];

      if (ifProvided(status) && status !== ticket.status)
        newSummaryItems.push("Status updated");
      if (ifProvided(priority) && priority !== ticket.priority)
        newSummaryItems.push("Priority updated");
      if (ifProvided(ticket_type) && ticket_type !== ticket.ticket_type)
        newSummaryItems.push("Type updated");
      if (ifProvided(assigned_agent_name) && assigned_agent_name !== ticket.assigned_agent_name)
        newSummaryItems.push("Agent assigned");
      if (ifProvided(resolution_summary) && resolution_summary !== ticket.resolution_summary)
        newSummaryItems.push("Resolution summary updated");
      if (ifProvided(title) && title !== ticket.ticket_title)
        newSummaryItems.push("Title updated");
      if (ifProvided(description) && description !== ticket.description)
        newSummaryItems.push("Description updated");

      // Only new items not already in existing summary
      const trulyNewItems = newSummaryItems.filter(s => !currentSummarySet.has(s));

      if (trulyNewItems.length > 0) {
        trulyNewItems.forEach(s => currentSummarySet.add(s));
        updates.has_unread_updates    = true;
        updates.unread_updates_count  = (ticket.unread_updates_count || 0) + trulyNewItems.length;
        updates.unread_update_summary = Array.from(currentSummarySet);
        console.log(`[syncSupportHubUpdates] Unread updates for ticket ${crs_internal_id}:`, trulyNewItems);
      } else {
        console.log(`[syncSupportHubUpdates] No new unread items for ticket ${crs_internal_id} (changes already known or no tracked fields changed)`);
      }
    } else {
      console.log(`[syncSupportHubUpdates] CRS-originated update — skipping unread notification for ticket ${crs_internal_id}`);
    }

    await dbUpdate("Ticket", crs_internal_id, updates);

    console.log(`[syncSupportHubUpdates] Ticket ${crs_internal_id} updated successfully. Fields applied: ${Object.keys(updates).join(", ")}. isInitialSync: ${isInitialSync}, isCrsOriginated: ${isCrsOriginated}`);
    return Response.json({
      success: true,
      message: "Ticket updated",
      fields_applied: Object.keys(updates),
      is_initial_sync: isInitialSync,
      unread_items_added: updates.unread_update_summary ? updates.unread_update_summary.length : 0
    });

  } catch (error) {
    console.error("[syncSupportHubUpdates] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});