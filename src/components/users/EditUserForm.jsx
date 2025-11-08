import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XCircle, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function EditUserForm({ user, tenant, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(user || {
    full_name: "",
    user_role: "tenant_user",
    job_title: "",
    department: "",
    permissions: {
      can_manage_entities: false,
      can_manage_accounts: true,
      can_classify_accounts: true,
      can_generate_reports: false,
      can_manage_users: false,
      can_configure_branding: false,
      can_view_audit_logs: false
    }
  });

  const handleRoleChange = (role) => {
    const permissions = role === "tenant_admin" ? {
      can_manage_entities: true,
      can_manage_accounts: true,
      can_classify_accounts: true,
      can_generate_reports: true,
      can_manage_users: true,
      can_configure_branding: true,
      can_view_audit_logs: true
    } : formData.permissions;

    setFormData(prev => ({
      ...prev,
      user_role: role,
      permissions
    }));
  };

  const handlePermissionChange = (permission, value) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: value
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            disabled
            className="mt-1.5 bg-slate-50"
          />
          <p className="text-xs text-slate-500 mt-1">
            Email address cannot be changed
          </p>
        </div>

        <div>
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
            placeholder="John Doe"
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="job_title">Job Title</Label>
            <Input
              id="job_title"
              value={formData.job_title}
              onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
              placeholder="e.g., Compliance Officer"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
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
                <div className="flex flex-col items-start">
                  <span className="font-medium">Administrator</span>
                  <span className="text-xs text-slate-500">Full access to all features</span>
                </div>
              </SelectItem>
              <SelectItem value="tenant_user">
                <div className="flex flex-col items-start">
                  <span className="font-medium">User</span>
                  <span className="text-xs text-slate-500">Limited access, can classify accounts</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-t pt-4">
          <Label className="text-base mb-3 block">Permissions</Label>
          <div className="space-y-3 bg-slate-50 rounded-lg p-4">
            <PermissionSwitch
              label="Manage Entities"
              description="Create, edit, and classify legal entities"
              checked={formData.permissions?.can_manage_entities || false}
              onCheckedChange={(checked) => handlePermissionChange("can_manage_entities", checked)}
              disabled={formData.user_role === "tenant_admin"}
            />
            <PermissionSwitch
              label="Manage Accounts"
              description="Create and edit account records"
              checked={formData.permissions?.can_manage_accounts || false}
              onCheckedChange={(checked) => handlePermissionChange("can_manage_accounts", checked)}
              disabled={formData.user_role === "tenant_admin"}
            />
            <PermissionSwitch
              label="Classify Accounts"
              description="Determine account reportability status"
              checked={formData.permissions?.can_classify_accounts || false}
              onCheckedChange={(checked) => handlePermissionChange("can_classify_accounts", checked)}
              disabled={formData.user_role === "tenant_admin"}
            />
            <PermissionSwitch
              label="Generate Reports"
              description="Create and submit CRS XML reports"
              checked={formData.permissions?.can_generate_reports || false}
              onCheckedChange={(checked) => handlePermissionChange("can_generate_reports", checked)}
              disabled={formData.user_role === "tenant_admin"}
            />
            <PermissionSwitch
              label="Manage Users"
              description="Invite and manage team members"
              checked={formData.permissions?.can_manage_users || false}
              onCheckedChange={(checked) => handlePermissionChange("can_manage_users", checked)}
              disabled={formData.user_role === "tenant_admin"}
            />
            <PermissionSwitch
              label="Configure Branding"
              description="Customize organization appearance"
              checked={formData.permissions?.can_configure_branding || false}
              onCheckedChange={(checked) => handlePermissionChange("can_configure_branding", checked)}
              disabled={formData.user_role === "tenant_admin"}
            />
            <PermissionSwitch
              label="View Audit Logs"
              description="Access compliance audit trail"
              checked={formData.permissions?.can_view_audit_logs || false}
              onCheckedChange={(checked) => handlePermissionChange("can_view_audit_logs", checked)}
              disabled={formData.user_role === "tenant_admin"}
            />
          </div>
          {formData.user_role === "tenant_admin" && (
            <p className="text-xs text-blue-600 mt-2">
              ℹ️ Administrators automatically have all permissions enabled
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </form>
  );
}

function PermissionSwitch({ label, description, checked, onCheckedChange, disabled }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 pr-4">
        <p className="font-medium text-sm text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <Switch 
        checked={checked} 
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}