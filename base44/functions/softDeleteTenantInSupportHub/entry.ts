const SUPPORT_HUB_API_URL = Deno.env.get("SUPPORT_HUB_API_URL");
const SUPPORT_HUB_API_KEY = Deno.env.get("SUPPORT_HUB_API_KEY");

Deno.serve(async (req) => {
  try {
    const body = await req.json();

    // The automation payload for delete events contains the deleted entity's data
    const deletedTenant = body?.data;
    const eventType = body?.event?.type || "unknown";

    if (!deletedTenant || !deletedTenant.id) {
      console.error("[softDeleteTenantInSupportHub] Missing deleted tenant data or ID in payload.");
      return Response.json({ error: "Missing tenant data or ID in payload" }, { status: 400 });
    }

    if (!SUPPORT_HUB_API_URL || !SUPPORT_HUB_API_KEY) {
      console.warn("[softDeleteTenantInSupportHub] Support Hub credentials not configured. Skipping soft-delete.");
      return Response.json({ success: false, message: "Support Hub credentials not configured." });
    }

    console.log(`[softDeleteTenantInSupportHub] Initiating soft-delete for tenant ${deletedTenant.id} (event: ${eventType})`);

    const response = await fetch(`${SUPPORT_HUB_API_URL}/functions/deleteTenantFromCRS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-crs-api-key": SUPPORT_HUB_API_KEY,
      },
      body: JSON.stringify({
        crs_tenant_id: deletedTenant.id,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`[softDeleteTenantInSupportHub] Soft-delete failed for tenant ${deletedTenant.id}:`, response.status, responseData);
      return Response.json({
        error: "Failed to soft-delete tenant in Support Hub",
        details: responseData,
      }, { status: response.status });
    }

    console.log(`[softDeleteTenantInSupportHub] Tenant ${deletedTenant.id} successfully soft-deleted in Support Hub.`);
    return Response.json({ success: true, tenantId: deletedTenant.id, message: "Tenant soft-deleted in Support Hub." });

  } catch (error) {
    console.error("[softDeleteTenantInSupportHub] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});