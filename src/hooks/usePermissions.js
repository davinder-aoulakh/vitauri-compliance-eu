import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Built-in defaults applied when no DB record exists for a role+resource.
 * Priority: isFullAccess → DB record → DEFAULT_PERMISSIONS → false
 */
const DEFAULT_PERMISSIONS = {
  tenant_supervisor: {
    Account:   { can_view: true, can_create: true, can_edit: true, can_delete: true },
    Entity:    { can_view: true, can_create: true, can_edit: true, can_delete: true },
    Report:    { can_view: true, can_create: true, can_edit: true, can_delete: true },
    Dashboard: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    User:      { can_view: true, can_create: true, can_edit: true, can_delete: true },
    Settings:  { can_view: true, can_create: true, can_edit: true, can_delete: true },
    Workflow:  { can_view: true, can_create: true, can_edit: true, can_delete: true },
  },
  tenant_user: {
    Account:   { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    Entity:    { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    Report:    { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    Dashboard: { can_view: true,  can_create: false, can_edit: false, can_delete: false },
    User:      { can_view: false, can_create: false, can_edit: false, can_delete: false },
    Settings:  { can_view: false, can_create: false, can_edit: false, can_delete: false },
    Workflow:  { can_view: false, can_create: false, can_edit: false, can_delete: false },
  },
};

/**
 * usePermissions(user, tenant)
 *
 * Returns a `can(resource, action)` helper driven by RolePermission DB records,
 * with built-in defaults when no record exists.
 *
 * - super_admin / tenant_admin: always full access, no DB fetch.
 * - tenant_supervisor / tenant_user: DB record → DEFAULT_PERMISSIONS fallback.
 *
 * Resources: Account, Entity, Report, Workflow, User, Dashboard, Settings
 * Actions: view | create | edit | delete
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
    staleTime: 60 * 1000,
  });

  /**
   * can(resource, action)
   * 1. isFullAccess → true
   * 2. DB record found → use it
   * 3. No DB record → DEFAULT_PERMISSIONS[role][resource][can_action]
   * 4. No default → false
   */
  const can = (resource, action) => {
    if (isFullAccess) return true;
    const rule = permissions.find((p) => p.resource_type === resource);
    if (rule) return rule[`can_${action}`] === true;
    // Fall back to built-in defaults
    return DEFAULT_PERMISSIONS[role]?.[resource]?.[`can_${action}`] ?? false;
  };

  return { can, isLoading, isFullAccess };
}