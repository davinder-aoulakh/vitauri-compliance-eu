import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Loader2, Headphones } from "lucide-react";
import TicketList from "@/components/support/TicketList";
import TicketDetail from "@/components/support/TicketDetail";
import CreateTicketForm from "@/components/support/CreateTicketForm";

export default function Support() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [view, setView] = useState("list"); // list | create | detail
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Role guard: only tenant_admin and super_admin
      const allowedRoles = ["tenant_admin", "super_admin"];
      if (!allowedRoles.includes(currentUser.app_role)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      if (currentUser.tenant_id) {
        const tenantData = await base44.entities.Tenant.filter({ id: currentUser.tenant_id });
        if (tenantData.length > 0) {
          setTenant(tenantData[0]);

          // Feature flag guard
          if (tenantData[0].enabled_features?.compliance_support === false) {
            setAccessDenied(true);
            setLoading(false);
            return;
          }
        }
      }

      await loadTickets(currentUser);
      setLoading(false);

      // Real-time subscription for ticket updates
      const unsubscribe = base44.entities.Ticket.subscribe((event) => {
        if (event.type === "create") {
          setTickets(prev => [event.data, ...prev]);
        } else if (event.type === "update") {
          setTickets(prev => prev.map(t => t.id === event.id ? { ...t, ...event.data } : t));
          setSelectedTicket(prev => prev && prev.id === event.id ? { ...prev, ...event.data } : prev);
        } else if (event.type === "delete") {
          setTickets(prev => prev.filter(t => t.id !== event.id));
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Support page init error:", error);
      setLoading(false);
    }
  };

  const loadTickets = async (currentUser) => {
    const u = currentUser || user;
    if (!u?.tenant_id) return;
    try {
      const data = await base44.entities.Ticket.filter({ tenant_id: u.tenant_id });
      data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setTickets(data);
    } catch (err) {
      console.error("Failed to load tickets:", err);
    }
  };

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setView("detail");
  };

  const handleBack = () => {
    setSelectedTicket(null);
    setView("list");
    loadTickets();
  };

  const handleCreateSuccess = () => {
    loadTickets();
    setTimeout(() => setView("list"), 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-8">
        <Headphones className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700 mb-2">Access Restricted</h2>
        <p className="text-slate-500">You don't have permission to access the Support Hub.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Page Header */}
        {view === "list" && (
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Compliance Support</h1>
              <p className="text-slate-500 mt-1">Raise tickets, track progress, and access help resources.</p>
            </div>
            <button
              onClick={() => setView("create")}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow transition-colors"
            >
              <span className="text-lg leading-none">+</span> New Ticket
            </button>
          </div>
        )}

        {view === "list" && (
          <TicketList
            tickets={tickets}
            onSelectTicket={handleSelectTicket}
            onCreateNew={() => setView("create")}
          />
        )}

        {view === "create" && (
          <CreateTicketForm
            onBack={handleBack}
            onSuccess={handleCreateSuccess}
          />
        )}

        {view === "detail" && selectedTicket && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 h-[calc(100vh-10rem)] flex flex-col">
            <TicketDetail
              ticket={selectedTicket}
              user={user}
              onBack={handleBack}
            />
          </div>
        )}
      </div>
    </div>
  );
}