import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, X, AlertCircle, Loader2, CheckCircle2, Copy } from "lucide-react";

export default function InviteUserForm({ tenant, onComplete, onCancel }) {
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    job_title: "",
    department: "",
    user_role: "tenant_user",
    permissions: {
      manage_entities: false,
      manage_accounts: false,
      classify_accounts: true,
      generate_reports: false,
      manage_users: false,
      configure_branding: false,
      view_audit_logs: false
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Send invitation email
      await base44.integrations.Core.SendEmail({
        to: formData.email,
        subject: `You've been invited to join ${tenant?.name || "CRS Platform"}`,
        body: `
          <h2>Welcome to ${tenant?.name || "CRS Platform"}!</h2>
          <p>Hello ${formData.full_name},</p>
          <p>You have been invited to join ${tenant?.name || "CRS Platform"} as a ${formData.user_role === "tenant_admin" ? "Tenant Administrator" : "Team Member"}.</p>
          <p><strong>Your Role:</strong> ${formData.job_title || formData.user_role}</p>
          <p>Please click the link below to set up your account and get started:</p>
          <p><a href="${window.location.origin}">Access the Platform</a></p>
          <p>If you have any questions, please contact your organization's administrator.</p>
          <br/>
          <p>Best regards,<br/>The ${tenant?.name || "CRS Platform"} Team</p>
        `
      });

      onComplete();
    } catch (err) {
      console.error("Failed to invite user:", err);
      setError(err.message || "Failed to send invitation. Please try again.");
    } finally {
      setLoading(false);
    }
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
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="user@company.com"
            required
            className="mt-1.5"
          />
          <p className="text-xs text-slate-500 mt-1">
            User will receive an invitation email to join {tenant?.name || "the organization"}
          </p>
        </div>

        <div>
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="John Doe"
            required
            className="mt-1.5"
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
          <Label htmlFor="user_role">User Role *</Label>
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
              <SelectItem value="tenant_user">
                <div className="flex flex-col">
                  <span className="font-medium">User</span>
                  <span className="text-xs text-slate-500">Limited access, can classify accounts</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
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
          disabled={loading || !formData.email || !formData.full_name}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Send Invitation
        </Button>
      </div>
    </form>
  );
}