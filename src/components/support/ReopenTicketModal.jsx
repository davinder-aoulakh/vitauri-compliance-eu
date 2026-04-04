import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function ReopenTicketModal({ ticket, open, onClose, onSuccess }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleReopen = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for reopening.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await base44.functions.invoke("reopenTicket", {
        crs_ticket_id: ticket.id,
        reopen_comment: reason
      });
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to reopen ticket.");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reopen Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600">
            Ticket: <span className="font-semibold">{ticket?.ticket_id}</span>
          </p>
          <div>
            <Label htmlFor="reopen_reason">Reason for Reopening *</Label>
            <Textarea
              id="reopen_reason"
              placeholder="Explain why you're reopening this ticket..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="mt-1 min-h-[100px]"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleReopen} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reopening...</> : "Reopen Ticket"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}