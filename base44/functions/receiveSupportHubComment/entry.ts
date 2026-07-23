import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const SUPPORT_HUB_SHARED_SECRET = Deno.env.get("SUPPORT_HUB_SHARED_SECRET");
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

    const base44 = createClientFromRequest(req);

    // ── comment_updated: find and update existing comment ──────────────────────
    if (event_type === "comment_updated" && support_hub_comment_id) {
      const existing = await base44.asServiceRole.entities.TicketComment.filter({ support_hub_comment_id });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.TicketComment.update(existing[0].id, {
          comment_text,
          attachment_urls: attachment_urls || []
        });
        console.log(`[receiveSupportHubComment] Comment ${support_hub_comment_id} updated.`);
        return Response.json({ success: true, comment_id: existing[0].id, action: "updated" });
      }
      console.warn(`[receiveSupportHubComment] comment_updated: no match for ${support_hub_comment_id} — will create.`);
    }

    // ── Idempotency: skip if already exists ───────────────────────────────────
    if (support_hub_comment_id) {
      const existing = await base44.asServiceRole.entities.TicketComment.filter({ support_hub_comment_id });
      if (existing.length > 0) {
        console.log(`[receiveSupportHubComment] Comment ${support_hub_comment_id} already exists, skipping.`);
        return Response.json({ success: true, message: "Already processed (idempotent)" });
      }
    }

    // ── CRS echo: stamp hub ID onto original CRS comment, no duplicate ────────
    if (isCrsOriginated && support_hub_comment_id) {
      const allTicketComments = await base44.asServiceRole.entities.TicketComment.filter({
        ticket_id: crs_internal_id,
        source_app: "crs_compliance"
      });
      const match = allTicketComments.find(c => !c.support_hub_comment_id && c.comment_text === comment_text);
      if (match) {
        await base44.asServiceRole.entities.TicketComment.update(match.id, { support_hub_comment_id });
        console.log(`[receiveSupportHubComment] Echo: stamped hub ID ${support_hub_comment_id} onto CRS comment ${match.id}.`);
        return Response.json({ success: true, comment_id: match.id, action: "echo_stamped" });
      }
    }

    // ── Create new TicketComment record ───────────────────────────────────────
    const newComment = await base44.asServiceRole.entities.TicketComment.create({
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

    // ── Update Ticket unread badge — suppress if CRS-originated ───────────────
    if (!isCrsOriginated) {
      const ticketResults = await base44.asServiceRole.entities.Ticket.filter({ id: crs_internal_id });
      const ticket = ticketResults[0] || null;
      if (ticket) {
        await base44.asServiceRole.entities.Ticket.update(crs_internal_id, {
          has_unread_updates:      true,
          unread_updates_count:    (ticket.unread_updates_count || 0) + 1,
          unread_update_summary:   [...(ticket.unread_update_summary || []), "New comment added"],
          first_unread_comment_id: ticket.first_unread_comment_id || newComment.id
        });

        // ── Send email notification to ticket creator for new comment ──────────
        if (ticket.creator_email) {
          const commentedAt = new Date().toLocaleString("en-GB", { timeZone: "UTC" });
          const agentLine = author_name
            ? `From: ${author_name}${author_email ? ` (${author_email})` : ""}`
            : "From: Vitauri Support Team";

          const subject = `💬 New Comment on Ticket ${ticket.ticket_id}: ${ticket.ticket_title}`;
          const emailBody = `Dear ${ticket.creator_name || "User"},

A new comment has been added to your support ticket by the Vitauri Support Team.

─────────────────────────────────────────
NEW COMMENT
─────────────────────────────────────────
${agentLine}
Posted at: ${commentedAt} UTC

"${comment_text}"
─────────────────────────────────────────
TICKET SNAPSHOT
─────────────────────────────────────────
Ticket ID:  ${ticket.ticket_id}
Title:      ${ticket.ticket_title}
Status:     ${ticket.status}
Priority:   ${ticket.priority}
Type:       ${ticket.ticket_type}
Assigned:   ${ticket.assigned_agent_name || "Unassigned"}
─────────────────────────────────────────

Please log in to the Vitauri CRS Compliance platform to view and respond to this comment.

Thank you,
Vitauri Compliance Support`;

          try {
            await base44.integrations.Core.SendEmail({ to: ticket.creator_email, subject, body: emailBody });
            console.log(`[receiveSupportHubComment] New comment notification sent to ${ticket.creator_email} for ticket ${ticket.ticket_id}`);
          } catch (emailErr) {
            console.warn("[receiveSupportHubComment] Email send failed:", emailErr.message);
          }
        }
      } else {
        console.warn(`[receiveSupportHubComment] Could not find ticket ${crs_internal_id} to update unread badge.`);
      }
    } else {
      console.log(`[receiveSupportHubComment] CRS-originated comment — skipping unread notification and email.`);
    }

    console.log(`[receiveSupportHubComment] Comment created for ticket ${crs_internal_id}. source_app: ${source_app}`);
    return Response.json({ success: true, comment_id: newComment.id, action: "created" });

  } catch (error) {
    console.error("[receiveSupportHubComment] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});