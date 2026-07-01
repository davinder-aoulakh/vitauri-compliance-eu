import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Shield, LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImpersonationBanner() {
  const [impersonation, setImpersonation] = useState(null);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    // Check sessionStorage first, fall back to localStorage (survives refresh)
    const stored = sessionStorage.getItem("super_admin_impersonating") 
      || localStorage.getItem("super_admin_impersonating");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setImpersonation(parsed);
        // Ensure both storages are in sync
        sessionStorage.setItem("super_admin_impersonating", stored);
        localStorage.setItem("super_admin_impersonating", stored);
      } catch {
        sessionStorage.removeItem("super_admin_impersonating");
        localStorage.removeItem("super_admin_impersonating");
      }
    }
  }, []);

  if (!impersonation) return null;

  const handleRevert = async () => {
    setReverting(true);
    try {
      await base44.functions.invoke("switchRole", {
        role: "super_admin",
        tenant_id: null,
        job_title: null
      });
      sessionStorage.removeItem("super_admin_impersonating");
      localStorage.removeItem("super_admin_impersonating");
      window.location.href = createPageUrl("TenantManagement");
    } catch (err) {
      alert("Failed to revert: " + err.message);
      setReverting(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Shield className="w-4 h-4" />
        <span>Super Admin Mode:</span>
        <Building2 className="w-4 h-4 ml-1" />
        <span className="font-bold">Acting as Tenant Admin for "{impersonation.tenant_name}"</span>
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
  );
}