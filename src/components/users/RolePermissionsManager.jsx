import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Eye, Edit, Trash2, Plus, Save, CheckCircle2, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Roles shown in the UI
const ROLES = [
  { value: 'tenant_admin',      label: 'Administrator', color: 'bg-blue-100 text-blue-800' },
  { value: 'tenant_supervisor', label: 'Supervisor',    color: 'bg-purple-100 text-purple-800' },
  { value: 'tenant_user',       label: 'User',          color: 'bg-green-100 text-green-800' },
];

// All resources (admin + supervisor see all 6)
const ALL_RESOURCES = [
  { value: 'Account',   label: 'Accounts',        icon: Eye },
  { value: 'Entity',    label: 'Entities',         icon: Shield },
  { value: 'Report',    label: 'Reports',          icon: CheckCircle2 },
  { value: 'Dashboard', label: 'Dashboards',       icon: Eye },
  { value: 'User',      label: 'User Management',  icon: Shield },
  { value: 'Settings',  label: 'Settings',         icon: Edit },
];

// tenant_user only sees these 4 resources
const USER_VISIBLE_RESOURCES = ['Account', 'Entity', 'Report', 'Dashboard'];

// Default values used when no DB record exists
const DEFAULT_VALUES = {
  tenant_admin:      { can_view: true,  can_create: true,  can_edit: true,  can_delete: true  },
  tenant_supervisor: { can_view: true,  can_create: true,  can_edit: true,  can_delete: true  },
};

// View-only defaults for tenant_user (the 4 visible resources)
const USER_RESOURCE_DEFAULTS = {
  Account:   { can_view: true, can_create: false, can_edit: false, can_delete: false },
  Entity:    { can_view: true, can_create: false, can_edit: false, can_delete: false },
  Report:    { can_view: true, can_create: false, can_edit: false, can_delete: false },
  Dashboard: { can_view: true, can_create: false, can_edit: false, can_delete: false },
};

const PERMISSION_TYPES = [
  { key: 'can_view',   label: 'View',   icon: Eye,    color: 'text-blue-600'  },
  { key: 'can_create', label: 'Create', icon: Plus,   color: 'text-green-600' },
  { key: 'can_edit',   label: 'Edit',   icon: Edit,   color: 'text-amber-600' },
  { key: 'can_delete', label: 'Delete', icon: Trash2, color: 'text-red-600'   },
];

/** Returns the resource list to show for a given role */
function getResourcesForRole(roleValue) {
  if (roleValue === 'tenant_user') {
    return ALL_RESOURCES.filter(r => USER_VISIBLE_RESOURCES.includes(r.value));
  }
  return ALL_RESOURCES;
}

export default function RolePermissionsManager({ tenant }) {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [localPermissions, setLocalPermissions] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      return await base44.entities.RolePermission.filter({ tenant_id: tenant.id });
    },
    enabled: !!tenant?.id,
  });

  useEffect(() => {
    // Build a map from saved DB records
    const permMap = {};
    permissions.forEach(p => {
      const key = `${p.role_name}___${p.resource_type}`;
      permMap[key] = {
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        id: p.id,
      };
    });

    // Pre-populate entries for every role+resource combination.
    // For tenant_admin: always show all-true (display only).
    // For tenant_supervisor: all-true by default if no DB record.
    // For tenant_user: use USER_RESOURCE_DEFAULTS (view=true, rest=false) for the 4
    //   visible resources — even if a stale all-false DB record exists from before
    //   this feature was introduced (detect by checking if can_view is false when
    //   the resource should default to view=true, and no explicit user change exists).
    ROLES.forEach(role => {
      const resources = getResourcesForRole(role.value);
      resources.forEach(resource => {
        const key = `${role.value}___${resource.value}`;

        if (role.value === 'tenant_admin') {
          // Always force all-true for admin tab (cosmetic/reference)
          permMap[key] = { can_view: true, can_create: true, can_edit: true, can_delete: true, id: permMap[key]?.id };
        } else if (!permMap[key]) {
          // No DB record — use built-in defaults
          if (role.value === 'tenant_user') {
            permMap[key] = { ...USER_RESOURCE_DEFAULTS[resource.value] };
          } else {
            permMap[key] = { ...DEFAULT_VALUES[role.value] };
          }
        } else if (role.value === 'tenant_user' && USER_VISIBLE_RESOURCES.includes(resource.value)) {
          // DB record exists for tenant_user — but if it was saved with the old
          // all-false default (can_view=false), upgrade can_view to true so the
          // intent of "view-only by default" is honoured. Admins can turn it off
          // explicitly if needed (the toggle is editable for this role).
          if (permMap[key].can_view === false &&
              permMap[key].can_create === false &&
              permMap[key].can_edit === false &&
              permMap[key].can_delete === false) {
            permMap[key] = { ...USER_RESOURCE_DEFAULTS[resource.value], id: permMap[key].id };
          }
        }
      });
    });

    setLocalPermissions(permMap);
  }, [permissions]);

  const savePermissionsMutation = useMutation({
    mutationFn: async (updates) => {
      const promises = [];
      for (const [key, perms] of Object.entries(updates)) {
        const sepIdx = key.indexOf('___');
        const role_name = key.substring(0, sepIdx);
        const resource_type = key.substring(sepIdx + 3);

        // Only save resources that are displayed for this role
        const visibleResources = getResourcesForRole(role_name).map(r => r.value);
        if (!visibleResources.includes(resource_type)) continue;

        if (perms.id) {
          promises.push(
            base44.entities.RolePermission.update(perms.id, {
              can_view: perms.can_view,
              can_create: perms.can_create,
              can_edit: perms.can_edit,
              can_delete: perms.can_delete,
            })
          );
        } else {
          promises.push(
            base44.entities.RolePermission.create({
              tenant_id: tenant.id,
              role_name,
              resource_type,
              can_view: perms.can_view,
              can_create: perms.can_create,
              can_edit: perms.can_edit,
              can_delete: perms.can_delete,
            })
          );
        }
      }
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['role-permissions']);
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error) => {
      console.error('Error saving permissions:', error);
      alert('Failed to save permissions: ' + error.message);
    },
  });

  const handlePermissionChange = (role, resource, permission, value) => {
    const key = `${role}___${resource}`;
    setLocalPermissions(prev => ({
      ...prev,
      [key]: { ...prev[key], [permission]: value },
    }));
    setHasChanges(true);
  };

  const getPermission = (role, resource, permission) => {
    const key = `${role}___${resource}`;
    return localPermissions[key]?.[permission] || false;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Role Permissions
            </CardTitle>
            <CardDescription className="mt-1">
              Configure granular access control for different user roles
            </CardDescription>
          </div>
          {hasChanges && (
            <Button
              onClick={() => savePermissionsMutation.mutate(localPermissions)}
              disabled={savePermissionsMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {savePermissionsMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {hasChanges && (
          <Alert className="mb-6 bg-amber-50 border-amber-200">
            <AlertDescription className="text-amber-900">
              You have unsaved changes. Click "Save Changes" to apply your modifications.
            </AlertDescription>
          </Alert>
        )}
        {saveSuccess && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Role permissions saved successfully.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="tenant_admin" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {ROLES.map(role => (
              <TabsTrigger key={role.value} value={role.value}>
                <Badge variant="outline" className={`${role.color} border-0`}>
                  {role.label}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {ROLES.map(role => {
            const resources = getResourcesForRole(role.value);
            return (
              <TabsContent key={role.value} value={role.value} className="mt-6">
                {/* Role-specific info banners */}
                {role.value === 'tenant_admin' && (
                  <Alert className="mb-4 bg-blue-50 border-blue-200">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Administrators always have <strong>full access</strong> to all resources.
                      These toggles are shown for reference only and do not restrict admin users.
                    </AlertDescription>
                  </Alert>
                )}
                {role.value === 'tenant_user' && (
                  <Alert className="mb-4 bg-slate-50 border-slate-200">
                    <Info className="h-4 w-4 text-slate-600" />
                    <AlertDescription className="text-slate-700">
                      Regular users have <strong>view-only access</strong> to core resources by default.
                      <strong> User Management</strong> and <strong>Settings</strong> are not accessible to this role.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  {resources.map(resource => {
                    const ResourceIcon = resource.icon;
                    const isAdminRole = role.value === 'tenant_admin';
                    return (
                      <Card key={resource.value} className="border-slate-200">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ResourceIcon className="w-4 h-4 text-slate-600" />
                            {resource.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {PERMISSION_TYPES.map(perm => {
                              const PermIcon = perm.icon;
                              const isEnabled = getPermission(role.value, resource.value, perm.key);
                              return (
                                <div
                                  key={perm.key}
                                  className="flex items-center justify-between p-3 rounded-lg border bg-slate-50"
                                >
                                  <div className="flex items-center gap-2">
                                    <PermIcon className={`w-4 h-4 ${perm.color}`} />
                                    <span className="text-sm font-medium text-slate-700">
                                      {perm.label}
                                    </span>
                                  </div>
                                  <Switch
                                    checked={isEnabled}
                                    disabled={isAdminRole}
                                    onCheckedChange={(checked) =>
                                      handlePermissionChange(role.value, resource.value, perm.key, checked)
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> These permissions control what Supervisors and Users can see and do.
            <strong> Administrators always have full access</strong> regardless of these settings.
            Changes take effect immediately for all users of that role upon next page load.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}