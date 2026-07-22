import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const SUPPORT_HUB_API_URL = Deno.env.get("SUPPORT_HUB_API_URL");
  const SUPPORT_HUB_SHARED_SECRET = Deno.env.get("SUPPORT_HUB_SHARED_SECRET");
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      support_hub_ticket_id,
      crs_comment_id,
      comment_text,
      is_internal,
      created_by_user_id,
      created_by_name,
      created_by_email,
      created_by_role,
      attachment_urls
    } = body;

    if (!support_hub_ticket_id) {
      return Response.json({ error: "support_hub_ticket_id is required" }, { status: 400 });
    }
    if (!comment_text && (!attachment_urls || attachment_urls.length === 0)) {
      return Response.json({ error: "Either comment_text or attachment_urls is required" }, { status: 400 });
    }

    if (!SUPPORT_HUB_API_URL || !SUPPORT_HUB_SHARED_SECRET) {
      console.warn("[sendCommentToSupportHub] Support Hub credentials not configured.");
      return Response.json({ success: false, message: "Support Hub credentials not configured." });
    }

    const response = await fetch(`${SUPPORT_HUB_API_URL}/receiveCommentFromCRS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shared-secret": SUPPORT_HUB_SHARED_SECRET
      },
      body: JSON.stringify({
        support_hub_ticket_id,
        crs_comment_id,
        comment_text,
        is_internal: is_internal || false,
        created_by_user_id,
        created_by_name,
        created_by_email,
        created_by_role,
        attachment_urls: attachment_urls || [],
        source_app: "crs_compliance"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[sendCommentToSupportHub] Failed:", response.status, data);
      return Response.json({ error: "Failed to send comment to Support Hub", details: data }, { status: response.status });
    }

    console.log(`[sendCommentToSupportHub] Comment sent. Hub comment ID: ${data.support_hub_comment_id}`);
    return Response.json({ success: true, support_hub_comment_id: data.support_hub_comment_id });

  } catch (error) {
    console.error("[sendCommentToSupportHub] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});