import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Paperclip, X, Send, Loader2, RefreshCw } from "lucide-react";
import ReopenTicketModal from "./ReopenTicketModal";

const STATUS_COLORS = {
  "Open": "bg-blue-100 text-blue-800",
  "In Progress": "bg-amber-100 text-amber-800",
  "Waiting for Customer": "bg-purple-100 text-purple-800",
  "Resolved": "bg-green-100 text-green-800",
  "Closed": "bg-slate-100 text-slate-600"
};

const PRIORITY_COLORS = {
  "Critical": "bg-red-100 text-red-800",
  "High": "bg-orange-100 text-orange-800",
  "Medium": "bg-yellow-100 text-yellow-800",
  "Low": "bg-slate-100 text-slate-600"
};

export default function TicketDetail({ ticket: initialTicket, user, onBack }) {
  const [ticket, setTicket] = useState(initialTicket);
  const [comments, setComments] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState(null);
  const separatorRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    loadComments();

    // Subscribe to ticket changes (real-time updates from webhooks)
    const unsubscribe = base44.entities.Ticket.subscribe((event) => {
      if (event.id === ticket.id) {
        setTicket(event.data || ticket);
      }
    });

    return () => unsubscribe();
  }, [ticket.id]);

  const loadComments = async () => {
    try {
      // Capture firstUnreadId BEFORE marking as read
      if (ticket.has_unread_updates && ticket.first_unread_comment_id) {
        setFirstUnreadId(ticket.first_unread_comment_id);
      }

      const allComments = await base44.entities.TicketComment.filter({ ticket_id: ticket.id });
      const visible = allComments.filter(c => !c.is_internal);
      visible.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setComments(visible);

      // Mark as read
      if (ticket.has_unread_updates) {
        await base44.functions.invoke("markCrsTicketRead", { ticket_id: ticket.id });
        setTicket(t => ({
          ...t,
          has_unread_updates: false,
          unread_updates_count: 0,
          unread_update_summary: []
        }));
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  };

  // Scroll to new messages separator
  useEffect(() => {
    if (firstUnreadId && separatorRef.current) {
      separatorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, firstUnreadId]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setAttachments(prev => [...prev, { file_url, file_name: file.name, file_type: file.type, file_size: file.size }]);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    setUploading(false);
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);

    const commentRole = user.app_role === "tenant_admin" ? "tenant_admin" : "tenant_user";

    try {
      // Create local TicketComment
      const newComment = await base44.entities.TicketComment.create({
        ticket_id: ticket.id,
        comment_text: replyText,
        created_by_user_id: user.id,
        created_by_user_email: user.email,
        created_by_name: user.full_name,
        created_by_role: commentRole,
        is_internal: false,
        source_app: "crs_compliance",
        attachment_urls: attachments
      });

      setComments(prev => [...prev, newComment]);
      setReplyText("");
      setAttachments([]);

      // Non-blocking sync to Support Hub
      if (ticket.support_hub_ticket_id) {
        base44.functions.invoke("sendCommentToSupportHub", {
          support_hub_ticket_id: ticket.support_hub_ticket_id,
          crs_comment_id: newComment.id,
          comment_text: replyText,
          is_internal: false,
          created_by_user_id: user.id,
          created_by_name: user.full_name,
          created_by_email: user.email,
          created_by_role: commentRole,
          attachment_urls: attachments
        }).then(res => {
          if (res.data?.support_hub_comment_id) {
            base44.entities.TicketComment.update(newComment.id, {
              support_hub_comment_id: res.data.support_hub_comment_id
            });
          }
        }).catch(err => console.warn("Comment sync to hub failed (non-blocking):", err.message));
      }

    } catch (err) {
      console.error("Failed to send reply:", err);
    }
    setSending(false);
  };

  const isClosed = ticket.status === "Closed";
  const canReopen = isClosed && user.app_role === "tenant_admin";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-200">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="text-slate-400 hover:text-slate-700 mt-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-400">{ticket.ticket_id}</span>
              <Badge className={STATUS_COLORS[ticket.status]}>{ticket.status}</Badge>
              <Badge className={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
              <Badge variant="outline" className="text-xs">{ticket.ticket_type}</Badge>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">{ticket.ticket_title}</h2>
            {ticket.assigned_agent_name && (
              <p className="text-sm text-slate-500 mt-0.5">Assigned to: {ticket.assigned_agent_name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {ticket.has_unread_updates && (
            <Button variant="outline" size="sm" onClick={loadComments} className="gap-1 text-xs">
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          )}
          {canReopen && (
            <Button variant="outline" size="sm" onClick={() => setShowReopen(true)} className="text-indigo-600 border-indigo-300 hover:bg-indigo-50">
              Reopen Ticket
            </Button>
          )}
        </div>
      </div>

      {/* Original description */}
      <div className="bg-slate-50 rounded-lg p-4 mb-4 text-sm text-slate-700">
        <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Original Request</p>
        <p className="whitespace-pre-wrap">{ticket.description}</p>
        {ticket.attachment_urls?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {ticket.attachment_urls.map((a, i) => (
              <a key={i} href={a.file_url} target="_blank" rel="noreferrer"
                className="text-xs text-indigo-600 underline">{a.file_name}</a>
            ))}
          </div>
        )}
      </div>

      {/* Comment thread */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {comments.map((comment) => {
          const isSupport = comment.created_by_role === "support_team";
          const isFirstUnread = comment.id === firstUnreadId;

          return (
            <React.Fragment key={comment.id}>
              {isFirstUnread && (
                <div ref={separatorRef} className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-red-300" />
                  <span className="text-xs font-semibold text-red-500 whitespace-nowrap">New Messages</span>
                  <div className="flex-1 h-px bg-red-300" />
                </div>
              )}
              <div className={`flex ${isSupport ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                  isSupport
                    ? "bg-white border border-slate-200 text-slate-800"
                    : "bg-indigo-600 text-white"
                }`}>
                  <p className={`text-xs font-semibold mb-1 ${isSupport ? "text-slate-500" : "text-indigo-200"}`}>
                    {isSupport ? (comment.created_by_name || "Support Team") : (comment.created_by_name || "You")}
                  </p>
                  <p className="whitespace-pre-wrap">{comment.comment_text}</p>
                  {comment.attachment_urls?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {comment.attachment_urls.map((a, i) => (
                        <a key={i} href={a.file_url} target="_blank" rel="noreferrer"
                          className={`text-xs underline ${isSupport ? "text-indigo-600" : "text-indigo-200"}`}>{a.file_name}</a>
                      ))}
                    </div>
                  )}
                  <p className={`text-xs mt-1.5 ${isSupport ? "text-slate-400" : "text-indigo-300"}`}>
                    {new Date(comment.created_date).toLocaleString()}
                  </p>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {!isClosed && (
        <div className="border-t border-slate-200 pt-4">
          <Textarea
            placeholder="Type your reply..."
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            className="mb-2 min-h-[80px]"
            onKeyDown={e => {
              if (e.key === "Enter" && e.ctrlKey) handleSendReply();
            }}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1 text-sm text-slate-500 cursor-pointer hover:text-slate-700">
              <Paperclip className="w-4 h-4" />
              {uploading ? "Uploading..." : "Attach"}
              <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
            {attachments.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {attachments.map((a, i) => (
                  <span key={i} className="text-xs bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                    {a.file_name}
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Button onClick={handleSendReply} disabled={sending || !replyText.trim()} size="sm" className="gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </Button>
          </div>
        </div>
      )}

      {isClosed && !canReopen && (
        <div className="border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
          This ticket is closed. Contact your admin to reopen it.
        </div>
      )}

      <ReopenTicketModal
        ticket={ticket}
        open={showReopen}
        onClose={() => setShowReopen(false)}
        onSuccess={loadComments}
      />
    </div>
  );
}