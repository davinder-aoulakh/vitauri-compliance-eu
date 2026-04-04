import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Search, Bell } from "lucide-react";

const STATUS_COLORS = {
  "Open": "bg-blue-100 text-blue-800 border-blue-200",
  "In Progress": "bg-amber-100 text-amber-800 border-amber-200",
  "Waiting for Customer": "bg-purple-100 text-purple-800 border-purple-200",
  "Resolved": "bg-green-100 text-green-800 border-green-200",
  "Closed": "bg-slate-100 text-slate-600 border-slate-200"
};

const PRIORITY_COLORS = {
  "Critical": "bg-red-100 text-red-800 border-red-200",
  "High": "bg-orange-100 text-orange-800 border-orange-200",
  "Medium": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Low": "bg-slate-100 text-slate-600 border-slate-200"
};

export default function TicketList({ tickets, onSelectTicket, onCreateNew }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const filtered = tickets.filter(t => {
    const matchSearch = !search ||
      t.ticket_title?.toLowerCase().includes(search.toLowerCase()) ||
      t.ticket_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const statusCounts = {
    Open: tickets.filter(t => t.status === "Open").length,
    "In Progress": tickets.filter(t => t.status === "In Progress").length,
    "Waiting for Customer": tickets.filter(t => t.status === "Waiting for Customer").length,
    Resolved: tickets.filter(t => t.status === "Resolved").length,
    Closed: tickets.filter(t => t.status === "Closed").length
  };

  return (
    <div className="space-y-4">
      {/* Status summary boxes */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            className={`p-3 rounded-lg border text-left transition-all ${
              statusFilter === status ? "ring-2 ring-indigo-500" : ""
            } ${STATUS_COLORS[status]} border`}
          >
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs font-medium">{status}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["Open", "In Progress", "Waiting for Customer", "Resolved", "Closed"].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {["Critical", "High", "Medium", "Low"].map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onCreateNew} className="gap-2 ml-auto">
          <Plus className="w-4 h-4" /> New Ticket
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg font-medium mb-2">No tickets found</p>
          <p className="text-sm">Try adjusting your filters or create a new ticket.</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Priority</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Assigned To</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ticket => {
                const isClosed = ["Resolved", "Closed"].includes(ticket.status);
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket)}
                    className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${isClosed ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{ticket.ticket_id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{ticket.ticket_title}</span>
                        {ticket.has_unread_updates && (
                          <span
                            title={(ticket.unread_update_summary || []).join("\n")}
                            className="inline-flex items-center gap-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold"
                          >
                            <Bell className="w-3 h-3" />
                            {ticket.unread_updates_count || 1}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={STATUS_COLORS[ticket.status] || ""}>
                        {ticket.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority] || ""}>
                        {ticket.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ticket.assigned_agent_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(ticket.created_date).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}