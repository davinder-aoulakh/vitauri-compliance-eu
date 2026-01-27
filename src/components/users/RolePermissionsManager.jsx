import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Eye, Edit, Trash2, Plus, Save, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function RolePermissionsManager({ tenant }) {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [localPermissions, setLocalPermissions] = useState({});

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      return await base44.entities.RolePermission.filter({ tenant_id: tenant.id });
    },
    enabled: !!tenant?.id
  });

  useEffect(() => {
    if (permissions.length > 0) {
      const permMap = {};
      permissions.forEach(p => {
        const key = `${p.role_name}_${p.resource_type}`;
        permMap[key] = {
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
          id: p.id
        };
      });
      setLocalPermissions(permMap);
    }
  }, [permissions]);

  const savePermissionsMutation = useMutation({
    mutationFn: async (updates) => {
      const promises = [];
      
      for (const [key, perms] of Object.entries(updates)) {
        const [role_name, resource_type] = key.split('_');
        
        if (perms.id) {
          // Update existing
          promises.push(
            base44.entities.RolePermission.update(perms.id, {
              can_view: perms.can_view,
              can_create: perms.can_create,
              can_edit: perms.can_edit,
              can_delete: perms.can_delete
            })
          );
        } else {
          // Create new
          promises.push(
            base44.entities.RolePermission.create({
              tenant_id: tenant.id,
              role_name,
              resource_type,
              can_view: perms.can_view,
              can_create: perms.can_create,
              can_edit: perms.can_edit,
              can_delete: perms.can_delete
            })
          );
        }
      }
      
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['role-permissions']);
      setHasChanges(false);
      alert('Role permissions updated successfully!');
    },
    onError: (error) => {
      console.error('Error saving permissions:', error);
      alert('Failed to save permissions: ' + error.message);
    }
  });

  const handlePermissionChange = (role, resource, permission, value) => {
    const key = `${role}_${resource}`;
    setLocalPermissions(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [permission]: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    savePermissionsMutation.mutate(localPermissions);
  };

  const getPermission = (role, resource, permission) => {
    const key = `${role}_${resource}`;
    return localPermissions[key]?.[permission] || false;
  };

  const roles = [
    { value: 'tenant_admin', label: 'Administrator', color: 'bg-blue-100 text-blue-800' },
    { value: 'tenant_supervisor', label: 'Supervisor', color: 'bg-purple-100 text-purple-800' },
    { value: 'tenant_user', label: 'User', color: 'bg-green-100 text-green-800' }
  ];

  const resources = [
    { value: 'Account', label: 'Accounts', icon: Eye },
    { value: 'Entity', label: 'Entities', icon: Shield },
    { value: 'Report', label: 'Reports', icon: CheckCircle2 },
    { value: 'User', label: 'User Management', icon: Shield },
    { value: 'Dashboard', label: 'Dashboards', icon: Eye },
    { value: 'Settings', label: 'Settings', icon: Edit }
  ];

  const permissionTypes = [
    { key: 'can_view', label: 'View', icon: Eye, color: 'text-blue-600' },
    { key: 'can_create', label: 'Create', icon: Plus, color: 'text-green-600' },
    { key: 'can_edit', label: 'Edit', icon: Edit, color: 'text-amber-600' },
    { key: 'can_delete', label: 'Delete', icon: Trash2, color: 'text-red-600' }
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
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
              onClick={handleSave}
              disabled={savePermissionsMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
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

        <Tabs defaultValue="tenant_admin" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {roles.map(role => (
              <TabsTrigger key={role.value} value={role.value}>
                <Badge variant="outline" className={`${role.color} border-0`}>
                  {role.label}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {roles.map(role => (
            <TabsContent key={role.value} value={role.value} className="mt-6">
              <div className="space-y-4">
                {resources.map(resource => {
                  const ResourceIcon = resource.icon;
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
                          {permissionTypes.map(perm => {
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
          ))}
        </Tabs>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> These permissions control what users can do with different resources.
            Changes apply to all users with the selected role.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}