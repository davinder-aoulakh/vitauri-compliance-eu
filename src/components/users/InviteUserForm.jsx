import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, X, AlertCircle, Loader2, CheckCircle2, Mail } from "lucide-react";

export default function InviteUserForm({ tenant, onComplete, onCancel }) {
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    job_title: "",
    department: "",
    user_role: "tenant_user"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRoleChange = (role) => {
    setFormData(prev => ({
      ...prev,
      user_role: role
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Use backend function with service role to invite user
      const response = await base44.functions.invoke('inviteUser', {
        email: formData.email,
        full_name: formData.full_name,
        app_role: formData.user_role,
        tenant_id: tenant?.id,
        job_title: formData.job_title,
        department: formData.department
      });
      
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      
      setSuccess(true);
    } catch (err) {
      console.error("Failed to invite user:", err);
      setError(err.message || "Failed to send invitation. Please try again.");
    } finally {
      setLoading(false);
    }
  };



  if (success) {
    return (
      <div className="space-y-6">
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Invitation Sent!</strong>
            <p className="mt-1">
              An email invitation has been sent to <strong>{formData.email}</strong>. 
              They will receive a link to join {tenant?.name || "your organization"}.
            </p>
          </AlertDescription>
        </Alert>

        <div className="p-4 bg-slate-50 rounded-lg border">
          <Label className="text-sm font-medium text-slate-700">Invite Details</Label>
          <div className="mt-2 space-y-2 text-sm">
            <p><strong>Name:</strong> {formData.full_name}</p>
            <p><strong>Email:</strong> {formData.email}</p>
            <p><strong>Role:</strong> {formData.user_role === "tenant_admin" ? "Administrator" : "User"}</p>
            {formData.job_title && <p><strong>Job Title:</strong> {formData.job_title}</p>}
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">What happens next?</p>
              <ul className="text-sm text-blue-800 mt-1 space-y-1">
                <li>• The user will receive an email with a secure invitation link</li>
                <li>• They click the link to set up their account</li>
                <li>• Once they join, they'll appear in your team list</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onComplete} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Done
          </Button>
        </div>
      </div>
    );
  }

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
            An invitation email will be sent to this address
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
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
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