import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SUPPORT_HUB_API_URL = Deno.env.get("SUPPORT_HUB_API_URL");
const SUPPORT_HUB_API_KEY = Deno.env.get("SUPPORT_HUB_API_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const asService = base44.asServiceRole;

    const body = await req.json();

    // Support both direct call (tenant object) and automation payload (event + data)
    const tenant = body?.data || body;
    const changedFields = body?.changed_fields || [];

    if (!tenant || !tenant.id) {
      return Response.json({ error: "Invalid tenant data: missing id" }, { status: 400 });
    }

    // Guard: skip if the only change was the sync status itself (prevents infinite loop)
    if (changedFields.length > 0 && changedFields.every(f => f === "support_hub_sync_status" || f === "updated_date")) {
      console.log("[syncTenantToSupportHub] Skipping - only sync status changed, not a real update.");
      return Response.json({ success: true, message: "Skipped: sync status update only." });
    }

    if (!SUPPORT_HUB_API_URL || !SUPPORT_HUB_API_KEY) {
      console.warn("Support Hub API URL or CRS_SYNC_API_KEY_EXPECTED not configured. Skipping sync.");
      await asService.entities.Tenant.update(tenant.id, { support_hub_sync_status: "failed" });
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
      console.error("Support Hub tenant sync failed:", response.status, data);
      await asService.entities.Tenant.update(tenant.id, { support_hub_sync_status: "failed" });
      return Response.json({ error: "Failed to sync tenant to Support Hub", details: data }, { status: response.status });
    }

    const operation = data.operation || "unknown";
    console.log(`[syncTenantToSupportHub] Tenant ${operation} in Support Hub:`, tenant.id);
    await asService.entities.Tenant.update(tenant.id, { support_hub_sync_status: "synced" });
    return Response.json({ success: true, operation, tenant: data.tenant });

  } catch (error) {
    console.error("Error in syncTenantToSupportHub:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});