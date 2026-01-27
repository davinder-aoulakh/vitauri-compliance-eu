import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, X } from "lucide-react";

export default function EditUserForm({ user, tenant, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    display_name: user?.display_name || user?.full_name || "",
    job_title: user?.job_title || "",
    department: user?.department || "",
    user_role: user?.user_role || "tenant_user",
    permissions: user?.permissions || {
      manage_entities: false,
      manage_accounts: false,
      classify_accounts: true,
      generate_reports: false,
      manage_users: false,
      configure_branding: false,
      view_audit_logs: false
    }
  });

  const handlePermissionChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: value
      }
    }));
  };

  const handleRoleChange = (role) => {
    const isAdmin = role === "tenant_admin";
    setFormData(prev => ({
      ...prev,
      user_role: role,
      permissions: {
        manage_entities: isAdmin,
        manage_accounts: isAdmin,
        classify_accounts: true,
        generate_reports: isAdmin,
        manage_users: isAdmin,
        configure_branding: isAdmin,
        view_audit_logs: isAdmin
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const permissionsList = [
    { key: "manage_entities", label: "Manage Entities", description: "Create, edit, and classify legal entities" },
    { key: "manage_accounts", label: "Manage Accounts", description: "Create and edit account records" },
    { key: "classify_accounts", label: "Classify Accounts", description: "Determine account reportability status" },
    { key: "generate_reports", label: "Generate Reports", description: "Create and submit CRS XML reports" },
    { key: "manage_users", label: "Manage Users", description: "Invite and manage team members" },
    { key: "configure_branding", label: "Configure Branding", description: "Customize organization appearance" },
    { key: "view_audit_logs", label: "View Audit Logs", description: "Access compliance audit trail" }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* User Email (Read-only) */}
      <div className="p-4 bg-slate-50 rounded-lg border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
            {formData.display_name?.[0]?.toUpperCase() || user?.display_name?.[0]?.toUpperCase() || user?.full_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="display_name">Display Name</Label>
        <Input
          id="display_name"
          value={formData.display_name}
          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
          placeholder="John Doe"
          className="mt-1.5"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="job_title">Job Title</Label>
          <Input
            id="job_title"
            value={formData.job_title}
            onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
            placeholder="Compliance Officer"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            placeholder="e.g., Compliance"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="user_role">User Role</Label>
        <Select
          value={formData.user_role}
          onValueChange={handleRoleChange}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tenant_admin">
              <div className="flex flex-col">
                <span className="font-medium">Administrator</span>
                <span className="text-xs text-slate-500">Full access to manage organization</span>
              </div>
            </SelectItem>
            <SelectItem value="tenant_supervisor">
              <div className="flex flex-col">
                <span className="font-medium">Supervisor</span>
                <span className="text-xs text-slate-500">Elevated access with oversight capabilities</span>
              </div>
            </SelectItem>
            <SelectItem value="tenant_user">
              <div className="flex flex-col">
                <span className="font-medium">User</span>
                <span className="text-xs text-slate-500">Limited access, can classify accounts</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Permissions */}
      <div className="border-t pt-4">
        <Label className="text-base font-semibold">Permissions</Label>
        <div className="mt-3 space-y-3">
          {permissionsList.map((perm) => (
            <div key={perm.key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-900">{perm.label}</p>
                <p className="text-xs text-slate-500">{perm.description}</p>
              </div>
              <Switch
                checked={formData.permissions[perm.key]}
                onCheckedChange={(checked) => handlePermissionChange(perm.key, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </form>
  );
}