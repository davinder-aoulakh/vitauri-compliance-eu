import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * usePermissions
 * 
 * Fetches RolePermission records for the current user's role + tenant.
 * Returns a `can(resource, action)` helper.
 * 
 * Rules:
 *  - super_admin and tenant_admin always get full access (bypass DB rules).
 *  - tenant_supervisor and tenant_user are governed by RolePermission records.
 *  - If NO RolePermission record exists for a role+resource combination, access is DENIED by default.
 * 
 * Resources: Account, Entity, Report, Workflow, User, Dashboard, Settings
 * Actions: view, create, edit, delete
 */
export function usePermissions(user, tenant) {
  const role = user?.app_role;
  const tenantId = user?.tenant_id;

  // Admins and super admins always have full access — skip DB fetch
  const isFullAccess = role === "super_admin" || role === "tenant_admin";

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["role-permissions", tenantId, role],
    queryFn: () =>
      base44.entities.RolePermission.filter({ tenant_id: tenantId, role_name: role }),
    enabled: !!tenantId && !!role && !isFullAccess,
    staleTime: 60 * 1000, // cache for 1 minute
  });

  /**
   * can(resource, action)
   * @param {string} resource - e.g. "Account", "Entity", "Report", "User", "Dashboard", "Settings"
   * @param {string} action   - "view" | "create" | "edit" | "delete"
   * @returns {boolean}
   */
  const can = (resource, action) => {
    if (isFullAccess) return true;
    const rule = permissions.find((p) => p.resource_type === resource);
    if (!rule) return false;
    return rule[`can_${action}`] === true;
  };

  return { can, isLoading, isFullAccess };
}