import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Paperclip, X, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

export default function CreateTicketForm({ onBack, onSuccess }) {
  const [form, setForm] = useState({
    ticket_title: "",
    description: "",
    priority: "Medium",
    ticket_type: "Support Request"
  });
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setAttachments(prev => [...prev, {
          file_url,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size
        }]);
      }
    } catch (err) {
      setError("File upload failed: " + err.message);
    }
    setUploading(false);
  };

  const removeAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.ticket_title.trim() || !form.description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("createSupportTicket", {
        ...form,
        attachment_urls: attachments
      });
      setSubmitted(res.data);
      onSuccess && onSuccess(res.data);
    } catch (err) {
      setError(err.message || "Failed to submit ticket.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Ticket Submitted!</h2>
        <p className="text-slate-600 mb-1">Your ticket ID is <span className="font-mono font-bold text-indigo-600">{submitted.ticket_id}</span></p>
        {submitted.sync_warning && (
          <p className="text-amber-600 text-sm mt-2">{submitted.sync_warning}</p>
        )}
        <Button className="mt-6" onClick={onBack}>Back to Tickets</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Tickets
      </button>
      <Card>
        <CardHeader>
          <CardTitle>Create Support Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="ticket_title">Title *</Label>
              <Input
                id="ticket_title"
                placeholder="Brief description of your issue"
                value={form.ticket_title}
                onChange={e => setForm(f => ({ ...f, ticket_title: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide full details about your issue..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="mt-1 min-h-[120px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Low", "Medium", "High", "Critical"].map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.ticket_type} onValueChange={v => setForm(f => ({ ...f, ticket_type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Issue", "Bug", "Support Request", "Other"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Attachments */}
            <div>
              <Label>Attachments</Label>
              <label className="mt-1 flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-500 w-full">
                <Paperclip className="w-4 h-4" />
                {uploading ? "Uploading..." : "Click to attach files"}
                <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((a, i) => (
                    <li key={i} className="flex items-center justify-between text-sm bg-slate-50 px-3 py-1.5 rounded">
                      <span className="truncate">{a.file_name}</span>
                      <button type="button" onClick={() => removeAttachment(i)}>
                        <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : "Submit Ticket"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}