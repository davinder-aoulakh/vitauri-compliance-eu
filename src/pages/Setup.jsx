import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, CheckCircle2, User, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Setup() {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Load all users for super admin via backend function
      if (currentUser.app_role === "super_admin") {
        const response = await base44.functions.invoke('listAllUsers', {});
        setAllUsers(response.data?.users || []);
      }
    } catch (error) {
      console.error("Error loading user:", error);
      setMessage({ type: "error", text: "Failed to load user data" });
    } finally {
      setLoading(false);
    }
  };

  const switchRole = async (role, tenantId, jobTitle, permissions) => {
    setUpdating(true);
    setMessage(null);
    
    try {
      const response = await base44.functions.invoke('switchRole', {
        action: role === 'super_admin' ? 'return' : 'start',
        role,
        tenant_id: tenantId,
        job_title: jobTitle,
        permissions
      });
      
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      
      setMessage({ 
        type: "success", 
        text: `Successfully switched to ${role.replace("_", " ")}! Reloading page...` 
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error("Error updating user:", error);
      setMessage({ 
        type: "error", 
        text: "Failed to update role: " + error.message 
      });
      setUpdating(false);
    }
  };

  const makeSuperAdmin = () => {
    switchRole("super_admin", null, null, {
      manage_entities: true,
      manage_accounts: true,
      classify_accounts: true,
      generate_reports: true,
      manage_users: true,
      configure_branding: true,
      view_audit_logs: true
    });
  };

  const makeACMETenantAdmin = async () => {
    setUpdating(true);
    setMessage(null);
    
    try {
      const tenants = await base44.entities.Tenant.list();
      const acmeTenant = tenants.find(t => 
        t.short_name === "ACME Financial" || 
        t.name?.includes("ACME")
      );
      
      if (!acmeTenant) {
        setMessage({ type: "error", text: "ACME tenant not found. Please create it first." });
        setUpdating(false);
        return;
      }
      
      await switchRole("tenant_admin", acmeTenant.id, "Compliance Director", {
        manage_entities: true,
        manage_accounts: true,
        classify_accounts: true,
        generate_reports: true,
        manage_users: true,
        configure_branding: true,
        view_audit_logs: true
      });
    } catch (error) {
      setMessage({ type: "error", text: "Failed: " + error.message });
      setUpdating(false);
    }
  };

  const makeACMETenantUser = async () => {
    setUpdating(true);
    setMessage(null);
    
    try {
      const tenants = await base44.entities.Tenant.list();
      const acmeTenant = tenants.find(t => 
        t.short_name === "ACME Financial" || 
        t.name?.includes("ACME")
      );
      
      if (!acmeTenant) {
        setMessage({ type: "error", text: "ACME tenant not found. Please create it first." });
        setUpdating(false);
        return;
      }
      
      await switchRole("tenant_user", acmeTenant.id, "Compliance Officer", {
        manage_entities: false,
        manage_accounts: true,
        classify_accounts: true,
        generate_reports: false,
        manage_users: false,
        configure_branding: false,
        view_audit_logs: false
      });
    } catch (error) {
      setMessage({ type: "error", text: "Failed: " + error.message });
      setUpdating(false);
    }
  };

  const updateUserRole = async () => {
    if (!selectedUserId || !selectedRole) {
      setMessage({ type: "error", text: "Please select both user and role" });
      return;
    }

    setUpdating(true);
    setMessage(null);

    try {
      const response = await base44.functions.invoke('updateUserRole', {
        userId: selectedUserId,
        role: selectedRole
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setMessage({ 
        type: "success", 
        text: "User role updated successfully! Reloading..." 
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Error updating user:", error);
      setMessage({ 
        type: "error", 
        text: "Failed to update user: " + error.message 
      });
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const isSuperAdmin = user?.app_role === "super_admin";
  const isTenantAdmin = user?.app_role === "tenant_admin";
  const isTenantUser = user?.app_role === "tenant_user";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Account Setup</h1>
          <p className="text-slate-600">
            Configure your role and permissions for testing the CRS platform
          </p>
        </div>

        {/* Current Status */}
        <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              Current Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Name:</span>
              <span className="font-semibold text-slate-900">{user?.full_name || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Email:</span>
              <span className="font-semibold text-slate-900">{user?.email || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Current Role:</span>
              <Badge 
                variant="outline" 
                className={`capitalize ${
                  isSuperAdmin ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                  isTenantAdmin ? "bg-blue-100 text-blue-800 border-blue-300" :
                  "bg-green-100 text-green-800 border-green-300"
                }`}
              >
                {user?.app_role?.replace(/_/g, " ") || "user"}
              </Badge>
            </div>
            {user?.tenant_id && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Tenant:</span>
                <span className="text-sm text-slate-600">{user?.tenant_id}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Super Admin: Update Any User's Role */}
        {user?.app_role === "super_admin" && (
          <Card className="border-2 border-purple-100 bg-gradient-to-br from-white to-purple-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Update User Role
              </CardTitle>
              <CardDescription>
                As super admin, you can update any user's role
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Select User
                </label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email} ({u.app_role || "no role"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Select New Role
                </label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                    <SelectItem value="tenant_supervisor">Tenant Supervisor</SelectItem>
                    <SelectItem value="tenant_user">Tenant User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={updateUserRole}
                disabled={updating || !selectedUserId || !selectedRole}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
              >
                {updating ? "Updating..." : "Update User Role"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Messages */}
        {message && (
          <Alert className={message.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <Shield className="w-4 h-4 text-red-600" />
            )}
            <AlertDescription className={message.type === "success" ? "text-green-800" : "text-red-800"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Role Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Super Admin */}
          <Card className={`cursor-pointer hover:shadow-lg transition-all ${isSuperAdmin ? "border-2 border-yellow-400 bg-yellow-50" : ""}`}>
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Super Admin</CardTitle>
              <CardDescription>
                Full system access, manage all tenants and workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSuperAdmin ? (
                <Badge className="w-full justify-center bg-yellow-100 text-yellow-800 border-yellow-300">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Active Role
                </Badge>
              ) : (
                <Button 
                  onClick={makeSuperAdmin}
                  disabled={updating}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                >
                  {updating ? "Updating..." : "Become Super Admin"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Tenant Admin */}
          <Card className={`cursor-pointer hover:shadow-lg transition-all ${isTenantAdmin ? "border-2 border-blue-400 bg-blue-50" : ""}`}>
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-3">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">ACME Admin</CardTitle>
              <CardDescription>
                Full access to ACME Financial tenant data and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isTenantAdmin && user?.tenant_id ? (
                <Badge className="w-full justify-center bg-blue-100 text-blue-800 border-blue-300">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Active Role
                </Badge>
              ) : (
                <Button 
                  onClick={makeACMETenantAdmin}
                  disabled={updating}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                >
                  {updating ? "Updating..." : "Become ACME Admin"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Tenant User */}
          <Card className={`cursor-pointer hover:shadow-lg transition-all ${isTenantUser ? "border-2 border-green-400 bg-green-50" : ""}`}>
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-3">
                <User className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">ACME User</CardTitle>
              <CardDescription>
                Limited access to ACME tenant - compliance officer role
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isTenantUser && user?.tenant_id ? (
                <Badge className="w-full justify-center bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Active Role
                </Badge>
              ) : (
                <Button 
                  onClick={makeACMETenantUser}
                  disabled={updating}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  {updating ? "Updating..." : "Become ACME User"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What Each Role Can Do</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-yellow-700 mb-2">🛡️ Super Admin</h4>
              <ul className="text-sm text-slate-600 space-y-1 ml-4">
                <li>• Create and manage all tenants</li>
                <li>• Configure global compliance workflows</li>
                <li>• Access system-wide audit logs</li>
                <li>• View all tenant data (read-only oversight)</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-blue-700 mb-2">👔 Tenant Admin (ACME)</h4>
              <ul className="text-sm text-slate-600 space-y-1 ml-4">
                <li>• Manage ACME entities and accounts</li>
                <li>• Generate CRS XML reports</li>
                <li>• Invite and manage ACME users</li>
                <li>• Customize ACME branding</li>
                <li>• View ACME audit logs</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-green-700 mb-2">👤 Tenant User (ACME)</h4>
              <ul className="text-sm text-slate-600 space-y-1 ml-4">
                <li>• View and update ACME accounts</li>
                <li>• Classify accounts for reportability</li>
                <li>• View dashboard and reports</li>
                <li>• Cannot manage users or settings</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}