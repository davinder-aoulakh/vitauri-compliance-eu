import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Shield, LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImpersonationBanner({ session }) {
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState(null);

  if (!session) return null;

  const roleLabel = (session.impersonated_role || "tenant_admin").replace(/_/g, " ");

  const handleRevert = async () => {
    setReverting(true);
    setError(null);
    try {
      await base44.functions.invoke("switchRole", { action: "return" });
      window.location.href = createPageUrl("TenantManagement");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to return");
      setReverting(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Shield className="w-4 h-4" />
        <span>Super Admin Mode:</span>
        <Building2 className="w-4 h-4 ml-1" />
        <span className="font-bold capitalize">
          Acting as {roleLabel} for "{session.impersonated_tenant_name}"
        </span>
        {error && <span className="ml-3 bg-red-600 rounded px-2 py-0.5 text-xs">Return failed: {error}</span>}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRevert}
        disabled={reverting}
        className="bg-white text-amber-700 border-amber-300 hover:bg-amber-50 h-7 text-xs font-semibold"
      >
        <LogOut className="w-3.5 h-3.5 mr-1.5" />
        {reverting ? "Returning..." : error ? "Retry return" : "Return to Super Admin"}
      </Button>
    </div>
  );
}