import { createClient } from 'npm:@base44/sdk@0.8.23';

const SUPPORT_HUB_SHARED_SECRET = Deno.env.get("SUPPORT_HUB_SHARED_SECRET");
const BASE44_APP_ID = Deno.env.get("BASE44_APP_ID");

// Service-role client — no user token needed for incoming webhooks
const base44 = createClient({ appId: BASE44_APP_ID });

Deno.serve(async (req) => {
  try {
    // Validate shared secret
    const incomingSecret = req.headers.get("x-shared-secret") || req.headers.get("x-webhook-secret");
    if (!SUPPORT_HUB_SHARED_SECRET || incomingSecret !== SUPPORT_HUB_SHARED_SECRET) {
      console.warn("[receiveSupportHubComment] Unauthorized: invalid shared secret");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("[receiveSupportHubComment] Received payload:", JSON.stringify(body));

    const {
      event_type,
      crs_internal_id,
      support_hub_comment_id,
      comment_text,
      is_internal,
      author_name,
      author_email,
      author_type,
      attachment_urls,
      source_app
    } = body;

    if (!crs_internal_id || !comment_text) {
      return Response.json({ error: "crs_internal_id and comment_text are required" }, { status: 400 });
    }

    const isCrsOriginated = source_app === "crs_compliance";

    // ── comment_updated: find existing comment by support_hub_comment_id and update it ──
    if (event_type === "comment_updated" && support_hub_comment_id) {
      const existing = await base44.entities.TicketComment.filter({ support_hub_comment_id });
      if (existing.length > 0) {
        await base44.entities.TicketComment.update(existing[0].id, {
          comment_text,
          attachment_urls: attachment_urls || []
        });
        console.log(`[receiveSupportHubComment] Comment ${support_hub_comment_id} updated.`);
        return Response.json({ success: true, comment_id: existing[0].id, action: "updated" });
      }
      // Not found by hub ID — fall through to create
      console.warn(`[receiveSupportHubComment] comment_updated: no match for ${support_hub_comment_id} — will create.`);
    }

    // ── Idempotency: skip if already exists by hub comment ID ────────────────
    if (support_hub_comment_id) {
      const existing = await base44.entities.TicketComment.filter({ support_hub_comment_id });
      if (existing.length > 0) {
        console.log(`[receiveSupportHubComment] Comment ${support_hub_comment_id} already exists, skipping duplicate.`);
        return Response.json({ success: true, message: "Already processed (idempotent)" });
      }
    }

    // ── CRS-originated echo: hub is bouncing back our own comment with a new hub ID.
    //    Find the original CRS comment (no hub ID yet, same ticket + text) and just
    //    stamp the hub comment ID onto it — do NOT create a duplicate. ────────────
    if (isCrsOriginated && support_hub_comment_id) {
      const allTicketComments = await base44.entities.TicketComment.filter({
        ticket_id: crs_internal_id,
        source_app: "crs_compliance"
      });
      const match = allTicketComments.find(c => !c.support_hub_comment_id && c.comment_text === comment_text);
      if (match) {
        await base44.entities.TicketComment.update(match.id, { support_hub_comment_id });
        console.log(`[receiveSupportHubComment] Echo: stamped hub ID ${support_hub_comment_id} onto CRS comment ${match.id}.`);
        return Response.json({ success: true, comment_id: match.id, action: "echo_stamped" });
      }
    }

    // ── Create new TicketComment record ───────────────────────────────────────
    const newComment = await base44.entities.TicketComment.create({
      ticket_id:              crs_internal_id,
      comment_text,
      created_by_name:        author_name  || "Support Team",
      created_by_user_email:  author_email || "",
      created_by_role:        author_type === "client" ? "tenant_user" : "support_team",
      is_internal:            is_internal || false,
      support_hub_comment_id: support_hub_comment_id || null,
      source_app:             source_app || "support_hub",
      attachment_urls:        attachment_urls || []
    });

    // ── Update Ticket unread status — suppress if CRS-originated ─────────────
    if (!isCrsOriginated) {
      const tickets = await base44.entities.Ticket.filter({ id: crs_internal_id });
      if (tickets.length > 0) {
        const ticket = tickets[0];
        const currentCount   = ticket.unread_updates_count  || 0;
        const currentSummary = ticket.unread_update_summary || [];

        await base44.entities.Ticket.update(crs_internal_id, {
          has_unread_updates:      true,
          unread_updates_count:    currentCount + 1,
          unread_update_summary:   [...currentSummary, "New comment added"],
          first_unread_comment_id: ticket.first_unread_comment_id || newComment.id
        });
      }
    } else {
      console.log(`[receiveSupportHubComment] CRS-originated comment — skipping unread notification.`);
    }

    console.log(`[receiveSupportHubComment] Comment created for ticket ${crs_internal_id}. source_app: ${source_app}`);
    return Response.json({ success: true, comment_id: newComment.id, action: "created" });

  } catch (error) {
    console.error("[receiveSupportHubComment] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});