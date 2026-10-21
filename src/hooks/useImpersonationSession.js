import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Reads the authoritative impersonation state from the server (not browser storage).
export default function useImpersonationSession(enabled) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Remove legacy browser-storage flags; they are no longer a source of truth.
    sessionStorage.removeItem("super_admin_impersonating");
    localStorage.removeItem("super_admin_impersonating");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    base44.functions
      .invoke("switchRole", { action: "status" })
      .then((res) => {
        if (!cancelled) setSession(res.data?.active ? res.data.session : null);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { session, loading };
}