import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SUPPORT_HUB_SHARED_SECRET = Deno.env.get("SUPPORT_HUB_SHARED_SECRET");

Deno.serve(async (req) => {
  try {
    // Validate shared secret FIRST before anything else
    const incomingSecret = req.headers.get("x-shared-secret");
    if (!SUPPORT_HUB_SHARED_SECRET || incomingSecret !== SUPPORT_HUB_SHARED_SECRET) {
      console.warn("[receiveSupportHubComment] Unauthorized: invalid shared secret");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const {
      crs_internal_id,
      support_hub_comment_id,
      comment_text,
      is_internal,
      author_name,
      author_email,
      attachment_urls,
      crs_comment_id
    } = body;

    if (!crs_internal_id || !comment_text) {
      return Response.json({ error: "crs_internal_id and comment_text are required" }, { status: 400 });
    }

    // Use service role directly — no user auth needed for incoming webhooks
    const base44 = createClientFromRequest(req);

    // Idempotency: check if comment already exists
    if (support_hub_comment_id) {
      const existing = await base44.asServiceRole.entities.TicketComment.filter({ support_hub_comment_id });
      if (existing.length > 0) {
        console.log(`[receiveSupportHubComment] Comment ${support_hub_comment_id} already exists, skipping.`);
        return Response.json({ success: true, message: "Already processed (idempotent)" });
      }
    }

    // Echo loop prevention: if crs_comment_id is set, this is our own comment bouncing back
    if (crs_comment_id) {
      try {
        await base44.asServiceRole.entities.TicketComment.update(crs_comment_id, {
          support_hub_comment_id
        });
        console.log(`[receiveSupportHubComment] Echo detected for crs_comment_id ${crs_comment_id}. Stored hub ID.`);
        return Response.json({ success: true, message: "Echo detected, stored hub ID" });
      } catch (e) {
        console.warn("[receiveSupportHubComment] Could not update crs_comment_id:", e.message);
        return Response.json({ success: true, message: "Echo detected, skipped" });
      }
    }

    // Create TicketComment record
    const newComment = await base44.asServiceRole.entities.TicketComment.create({
      ticket_id: crs_internal_id,
      comment_text,
      created_by_name: author_name || "Support Team",
      created_by_user_email: author_email || "",
      created_by_role: "support_team",
      is_internal: is_internal || false,
      support_hub_comment_id: support_hub_comment_id || null,
      source_app: "support_hub",
      attachment_urls: attachment_urls || []
    });

    // Update Ticket unread status
    const tickets = await base44.asServiceRole.entities.Ticket.filter({ id: crs_internal_id });
    if (tickets.length > 0) {
      const ticket = tickets[0];
      const currentCount = ticket.unread_updates_count || 0;
      const currentSummary = ticket.unread_update_summary || [];

      await base44.asServiceRole.entities.Ticket.update(crs_internal_id, {
        has_unread_updates: true,
        unread_updates_count: currentCount + 1,
        unread_update_summary: [...currentSummary, "New comment added"],
        first_unread_comment_id: ticket.first_unread_comment_id || newComment.id
      });
    }

    console.log(`[receiveSupportHubComment] Comment received and stored for ticket ${crs_internal_id}`);
    return Response.json({ success: true, comment_id: newComment.id });

  } catch (error) {
    console.error("[receiveSupportHubComment] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});