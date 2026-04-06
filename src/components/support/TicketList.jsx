import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, Eye, Bell, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS = {
  "Open": "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  "Waiting for Customer": "bg-purple-50 text-purple-700 border-purple-200",
  "Resolved": "bg-green-50 text-green-700 border-green-200",
  "Closed": "bg-slate-100 text-slate-500 border-slate-200"
};

const STATUS_CARD_STYLES = {
  "Open":                 { card: "bg-blue-50 border-blue-200",   num: "text-blue-600",   label: "text-blue-500"   },
  "In Progress":          { card: "bg-amber-50 border-amber-200", num: "text-amber-600",  label: "text-amber-500"  },
  "Waiting for Customer": { card: "bg-orange-50 border-orange-200", num: "text-orange-500", label: "text-orange-400" },
  "Resolved":             { card: "bg-green-50 border-green-200", num: "text-green-600",  label: "text-green-500"  },
  "Closed":               { card: "bg-slate-50 border-slate-200", num: "text-slate-700",  label: "text-slate-500"  }
};

const PRIORITY_COLORS = {
  "Critical": "bg-red-100 text-red-700 border-red-200",
  "High":     "bg-orange-100 text-orange-700 border-orange-200",
  "Medium":   "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Low":      "bg-slate-100 text-slate-500 border-slate-200"
};

const SORT_OPTIONS = [
  { value: "latest_updated", label: "Latest Updated" },
  { value: "oldest_updated", label: "Oldest Updated" },
  { value: "latest_created", label: "Latest Created" },
  { value: "oldest_created", label: "Oldest Created" },
  { value: "priority_high",  label: "Priority: High First" },
  { value: "priority_low",   label: "Priority: Low First" }
];

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function UnreadBadge({ ticket }) {
  const [show, setShow] = useState(false);
  const summary = ticket.unread_update_summary || [];
  const count = summary.length || ticket.unread_updates_count || 1;
  return (
    <span
      className="relative inline-flex items-center gap-0.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold flex-shrink-0 cursor-default"
      onMouseEnter={() => summary.length > 0 && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Bell className="w-3 h-3" />
      {count}
      {show && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[9999] pointer-events-none"
          style={{ minWidth: 220 }}
        >
          <div className="w-0 h-0 mx-auto border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-slate-900" />
          <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-2xl max-h-48 overflow-y-auto">
            <p className="font-semibold text-slate-300 mb-1.5">Updates:</p>
            <ul className="space-y-1">
              {summary.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </span>
  );
}

function AgentAvatar({ name }) {
  if (!name) return <span className="text-slate-400 italic text-xs">Unassigned</span>;
  const initial = name.charAt(0).toUpperCase();
  const colors = ["bg-indigo-500", "bg-purple-500", "bg-blue-500", "bg-teal-500", "bg-pink-500"];
  const color = colors[initial.charCodeAt(0) % colors.length];
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold ${color}`}>
        {initial}
      </span>
      <span className="text-slate-700 text-sm">{name}</span>
    </span>
  );
}

export default function TicketList({ tickets, onSelectTicket, onCreateNew }) {
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy]         = useState("latest_updated");
  const [showFilters, setShowFilters] = useState(false);

  const statusCounts = useMemo(() => ({
    "Open":                 tickets.filter(t => t.status === "Open").length,
    "In Progress":          tickets.filter(t => t.status === "In Progress").length,
    "Waiting for Customer": tickets.filter(t => t.status === "Waiting for Customer").length,
    "Resolved":             tickets.filter(t => t.status === "Resolved").length,
    "Closed":               tickets.filter(t => t.status === "Closed").length
  }), [tickets]);

  const filtered = useMemo(() => {
    let list = tickets.filter(t => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        t.ticket_title?.toLowerCase().includes(q) ||
        t.ticket_id?.toLowerCase().includes(q);
      const matchStatus   = statusFilter === "all"   || t.status === statusFilter;
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "latest_updated": return new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date);
        case "oldest_updated": return new Date(a.updated_date || a.created_date) - new Date(b.updated_date || b.created_date);
        case "latest_created": return new Date(b.created_date) - new Date(a.created_date);
        case "oldest_created": return new Date(a.created_date) - new Date(b.created_date);
        case "priority_high":  return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        case "priority_low":   return (PRIORITY_ORDER[b.priority] ?? 9) - (PRIORITY_ORDER[a.priority] ?? 9);
        default: return 0;
      }
    });
    return list;
  }, [tickets, search, statusFilter, priorityFilter, sortBy]);

  const hasActiveFilters = statusFilter !== "all" || priorityFilter !== "all" || sortBy !== "latest_updated";

  return (
    <div className="space-y-4">
      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Object.entries(statusCounts).map(([status, count]) => {
          const style = STATUS_CARD_STYLES[status];
          const active = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(active ? "all" : status)}
              className={`rounded-xl border p-4 text-center transition-all hover:shadow-md ${style.card} ${
                active ? "ring-2 ring-indigo-500 ring-offset-1 shadow-md" : ""
              }`}
            >
              <p className={`text-3xl font-bold ${style.num}`}>{count}</p>
              <p className={`text-xs font-medium mt-0.5 ${style.label}`}>{status}</p>
            </button>
          );
        })}
      </div>

      {/* Search + Filters Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by Ticket ID or Title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Button
          variant="outline"
          className={`gap-2 ${hasActiveFilters ? "border-indigo-400 text-indigo-600 bg-indigo-50" : ""}`}
          onClick={() => setShowFilters(f => !f)}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 bg-indigo-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {[statusFilter !== "all", priorityFilter !== "all", sortBy !== "latest_updated"].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {/* Expanded Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {["Open", "In Progress", "Waiting for Customer", "Resolved", "Closed"].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Priority</p>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {["Critical", "High", "Medium", "Low"].map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Sort By</p>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              className="text-slate-500 text-sm w-full"
              onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setSortBy("latest_updated"); }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No tickets found</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or create a new ticket.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Ticket ID ↕</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Title ↕</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Assigned To</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Priority</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Created ↕</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Last Updated ↕</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(ticket => {
                const isCritical = ticket.priority === "Critical";
                return (
                  <tr
                    key={ticket.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => onSelectTicket(ticket)}
                  >
                    {/* Ticket ID */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isCritical && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                        <span className="font-mono text-indigo-600 font-semibold text-xs hover:underline">
                          {ticket.ticket_id}
                        </span>
                      </div>
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-800 font-medium truncate" title={ticket.ticket_title}>
                          {ticket.ticket_title?.length > 32
                            ? ticket.ticket_title.slice(0, 32) + "..."
                            : ticket.ticket_title}
                        </span>
                        {ticket.has_unread_updates && (
                          <UnreadBadge ticket={ticket} />
                        )}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 text-slate-600">{ticket.ticket_type || "—"}</td>

                    {/* Assigned To */}
                    <td className="px-4 py-3">
                      <AgentAvatar name={ticket.assigned_agent_name} />
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs font-semibold ${PRIORITY_COLORS[ticket.priority] || ""}`}>
                        {ticket.priority}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs font-semibold ${STATUS_COLORS[ticket.status] || ""}`}>
                        {ticket.status}
                      </Badge>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {ticket.created_date ? format(new Date(ticket.created_date), "d MMM yyyy") : "—"}
                    </td>

                    {/* Last Updated */}
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {ticket.updated_date ? format(new Date(ticket.updated_date), "d MMM yyyy") : "—"}
                    </td>

                    {/* Eye action */}
                    <td className="px-4 py-3">
                      <button
                        onClick={e => { e.stopPropagation(); onSelectTicket(ticket); }}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title="View ticket"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""} found
          </div>
        </div>
      )}
    </div>
  );
}