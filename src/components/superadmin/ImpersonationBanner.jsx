import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Shield, LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImpersonationBanner() {
  const [impersonation, setImpersonation] = useState(null);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Browser storage is no longer the source of truth; clear any stale copies
    sessionStorage.removeItem("super_admin_impersonating");
    localStorage.removeItem("super_admin_impersonating");

    base44.functions
      .invoke("switchRole", { action: "status" })
      .then((res) => {
        if (res.data?.active) setImpersonation(res.data);
      })
      .catch(() => {});
  }, []);

  if (!impersonation) return null;

  const handleRevert = async () => {
    setReverting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("switchRole", { action: "return" });
      if (res.data?.error) throw new Error(res.data.error);
      window.location.href = createPageUrl("TenantManagement");
    } catch (err) {
      setError("Failed to return to Super Admin: " + err.message);
      setReverting(false);
    }
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Shield className="w-4 h-4" />
          <span>Super Admin Mode:</span>
          <Building2 className="w-4 h-4 ml-1" />
          <span className="font-bold">Acting as Tenant Admin for "{impersonation.tenant_name}"</span>
          {error && <span className="ml-3 bg-red-600 px-2 py-0.5 rounded text-xs">{error}</span>}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRevert}
          disabled={reverting}
          className="bg-white text-amber-700 border-amber-300 hover:bg-amber-50 h-7 text-xs font-semibold"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          {reverting ? "Reverting..." : "Return to Super Admin"}
        </Button>
      </div>
      <div className="h-10" aria-hidden="true" />
    </>
  );
}