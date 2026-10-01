import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Resolves a boolean tenant feature flag (tenant.enabled_features[featureKey])
 * for the signed-in user's tenant. Cached per session via react-query so the
 * user + tenant lookup only costs one request, regardless of how many
 * components/dialogs call this hook.
 *
 * Returns `true` only when the flag is explicitly set to true — any tenant
 * record missing the key (or with it false) resolves to disabled, matching
 * the default-off behaviour of the other feature toggles.
 */
export function useTenantFeatureFlag(featureKey) {
  const { data: tenant } = useQuery({
    queryKey: ["current-user-tenant-features"],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user?.tenant_id) return null;
      const tenants = await base44.entities.Tenant.filter({ id: user.tenant_id });
      return tenants[0] || null;
    },
    staleTime: Infinity,
  });

  return tenant?.enabled_features?.[featureKey] === true;
}