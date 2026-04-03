const SUPPORT_HUB_API_URL = Deno.env.get("SUPPORT_HUB_API_URL");
const SUPPORT_HUB_API_KEY = Deno.env.get("SUPPORT_HUB_API_KEY");

// Fields that are purely internal/status fields - changes to ONLY these should not trigger a sync
const INTERNAL_ONLY_FIELDS = ["support_hub_sync_status", "updated_date", "created_date"];

Deno.serve(async (req) => {
  try {
    const body = await req.json();

    // Support both direct call (tenant object) and automation payload (event + data)
    const tenant = body?.data || body;
    const changedFields = body?.changed_fields || [];
    const eventType = body?.event?.type || "unknown";

    if (!tenant || !tenant.id) {
      return Response.json({ error: "Invalid tenant data: missing id" }, { status: 400 });
    }

    // Guard: for update events, skip if ONLY internal fields changed (prevents infinite loop)
    if (eventType === "update" && changedFields.length > 0) {
      const hasRealChange = changedFields.some(f => !INTERNAL_ONLY_FIELDS.includes(f));
      if (!hasRealChange) {
        console.log(`[syncTenantToSupportHub] Skipping tenant ${tenant.id} - only internal fields changed: ${changedFields.join(", ")}`);
        return Response.json({ success: true, message: "Skipped: no meaningful field changes." });
      }
    }

    if (!SUPPORT_HUB_API_URL || !SUPPORT_HUB_API_KEY) {
      console.warn("[syncTenantToSupportHub] Support Hub credentials not configured. Skipping sync.");
      return Response.json({ success: false, message: "Support Hub credentials not configured." });
    }

    const tenantPayload = {
      id: tenant.id,
      name: tenant.name,
      short_name: tenant.short_name,
      jurisdiction: tenant.jurisdiction,
      tax_id: tenant.tax_id,
      contact_email: tenant.contact_email,
      contact_phone: tenant.contact_phone,
      address: tenant.address,
      branding: tenant.branding,
      subscription_status: tenant.subscription_status,
      subscription_tier: tenant.subscription_tier,
      enabled_features: tenant.enabled_features,
      navigation_settings: tenant.navigation_settings,
    };

    console.log(`[syncTenantToSupportHub] Syncing tenant ${tenant.id} (event: ${eventType}, changed: ${changedFields.join(", ") || "n/a"})`);

    const response = await fetch(`${SUPPORT_HUB_API_URL}/createTenantFromCRS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-crs-api-key": SUPPORT_HUB_API_KEY,
      },
      body: JSON.stringify(tenantPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[syncTenantToSupportHub] Sync failed for tenant ${tenant.id}:`, response.status, data);
      return Response.json({ error: "Failed to sync tenant to Support Hub", details: data }, { status: response.status });
    }

    const operation = data.operation || "unknown";
    console.log(`[syncTenantToSupportHub] Tenant ${tenant.id} successfully ${operation} in Support Hub.`);
    return Response.json({ success: true, operation, tenant: data.tenant });

  } catch (error) {
    console.error("[syncTenantToSupportHub] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});