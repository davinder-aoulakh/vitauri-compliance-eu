import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Paperclip, X, Send, Loader2, RefreshCw, UploadCloud, Download } from "lucide-react";
import ReopenTicketModal from "./ReopenTicketModal";
import { format } from "date-fns";

const STATUS_COLORS = {
  "Open": "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  "Waiting for Customer": "bg-purple-50 text-purple-700 border-purple-200",
  "Resolved": "bg-green-50 text-green-700 border-green-200",
  "Closed": "bg-slate-100 text-slate-500 border-slate-200"
};

const PRIORITY_COLORS = {
  "Critical": "bg-red-50 text-red-700 border-red-200",
  "High": "bg-orange-50 text-orange-700 border-orange-200",
  "Medium": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Low": "bg-slate-100 text-slate-500 border-slate-200"
};

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UserAvatar({ name, isSupport }) {
  const initial = (name || (isSupport ? "S" : "U")).charAt(0).toUpperCase();
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
      isSupport ? "bg-indigo-500" : "bg-slate-600"
    }`}>
      {initial}
    </div>
  );
}

export default function TicketDetail({ ticket: initialTicket, user, onBack }) {
  const [ticket, setTicket] = useState(initialTicket);
  const [comments, setComments] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState(null);
  const separatorRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadComments();
    const unsubscribe = base44.entities.Ticket.subscribe((event) => {
      if (event.id === ticket.id) {
        setTicket(event.data || ticket);
      }
    });
    return () => unsubscribe();
  }, [ticket.id]);

  const loadComments = async () => {
    try {
      if (ticket.has_unread_updates && ticket.first_unread_comment_id) {
        setFirstUnreadId(ticket.first_unread_comment_id);
      }
      const allComments = await base44.entities.TicketComment.filter({ ticket_id: ticket.id });
      const visible = allComments.filter(c => !c.is_internal);
      visible.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setComments(visible);
      if (ticket.has_unread_updates) {
        await base44.functions.invoke("markCrsTicketRead", { ticket_id: ticket.id });
        setTicket(t => ({ ...t, has_unread_updates: false, unread_updates_count: 0, unread_update_summary: [] }));
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  };

  useEffect(() => {
    if (firstUnreadId && separatorRef.current) {
      separatorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, firstUnreadId]);

  const uploadFiles = useCallback(async (files) => {
    if (!files.length) return;
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
  }, []);

  const handleFileInput = (e) => {
    uploadFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const handleSendReply = async () => {
    if (!replyText.trim() && attachments.length === 0) return;
    setSending(true);
    const commentRole = user.app_role === "tenant_admin" ? "tenant_admin" : "tenant_user";
    try {
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
            base44.entities.TicketComment.update(newComment.id, { support_hub_comment_id: res.data.support_hub_comment_id });
          }
        }).catch(err => console.warn("Comment sync failed:", err.message));
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
    }
    setSending(false);
  };

  const isClosed = ticket.status === "Closed";
  const canReopen = isClosed && user.app_role === "tenant_admin";

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to My Tickets
      </button>

      {/* Ticket Info Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{ticket.ticket_title}</h2>
        {ticket.description && (
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{ticket.description}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 mt-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Ticket ID</p>
            <span className="text-sm font-mono font-semibold text-indigo-600">{ticket.ticket_id}</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</p>
            <Badge variant="outline" className={`text-xs font-semibold ${STATUS_COLORS[ticket.status] || ""}`}>
              {ticket.status}
            </Badge>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Priority</p>
            <Badge variant="outline" className={`text-xs font-semibold ${PRIORITY_COLORS[ticket.priority] || ""}`}>
              {ticket.priority}
            </Badge>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Type</p>
            <span className="text-sm text-slate-700">{ticket.ticket_type || "—"}</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Assigned To</p>
            <span className="text-sm text-slate-700">{ticket.assigned_agent_name || <span className="text-slate-400 italic">Unassigned</span>}</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Created</p>
            <span className="text-sm text-slate-700">
              {ticket.created_date ? format(new Date(ticket.created_date), "d MMM yyyy, HH:mm") : "—"}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Last Updated</p>
            <span className="text-sm text-slate-700">
              {ticket.updated_date ? format(new Date(ticket.updated_date), "d MMM yyyy, HH:mm") : "—"}
            </span>
          </div>
          {canReopen && (
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={() => setShowReopen(true)} className="text-indigo-600 border-indigo-300 hover:bg-indigo-50 text-xs">
                Reopen Ticket
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Conversation Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Conversation</h3>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {comments.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No messages yet. Start the conversation below.</p>
          )}
          {comments.map((comment) => {
            const isSupport = comment.created_by_role === "support_team";
            const isFirstUnread = comment.id === firstUnreadId;
            const name = comment.created_by_name || (isSupport ? "Support Team" : "You");

            return (
              <React.Fragment key={comment.id}>
                {isFirstUnread && (
                  <div ref={separatorRef} className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-red-300" />
                    <span className="text-xs font-semibold text-red-500 whitespace-nowrap">New Messages</span>
                    <div className="flex-1 h-px bg-red-300" />
                  </div>
                )}

                <div className={`flex items-end gap-2 ${isSupport ? "justify-start" : "justify-end"}`}>
                  {isSupport && <UserAvatar name={name} isSupport={true} />}

                  <div className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    isSupport
                      ? "bg-slate-100 text-slate-800 rounded-bl-sm"
                      : "bg-indigo-600 text-white rounded-br-sm"
                  }`}>
                    <p className={`text-xs font-semibold mb-1 ${isSupport ? "text-indigo-600" : "text-indigo-200"}`}>
                      {name}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{comment.comment_text}</p>

                    {comment.attachment_urls?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {comment.attachment_urls.map((a, i) => (
                          <a
                            key={i}
                            href={a.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-1.5 text-xs underline ${isSupport ? "text-indigo-600" : "text-indigo-200"}`}
                          >
                            <Download className="w-3 h-3 flex-shrink-0" />
                            {a.file_name}
                            {a.file_size && <span className="opacity-70">({formatBytes(a.file_size)})</span>}
                          </a>
                        ))}
                      </div>
                    )}

                    <p className={`text-xs mt-2 ${isSupport ? "text-slate-400" : "text-indigo-300"}`}>
                      {format(new Date(comment.created_date), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>

                  {!isSupport && <UserAvatar name={name} isSupport={false} />}
                </div>
              </React.Fragment>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Reply Box */}
        {!isClosed ? (
          <div className="border-t border-slate-100 p-4 space-y-2">
            <Textarea
              placeholder="Write a reply..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              className="min-h-[80px] resize-none border-slate-200 text-sm"
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleSendReply(); }}
            />

            {/* Drag & drop attachment zone */}
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center py-3 border border-dashed rounded-lg cursor-pointer transition-all text-sm ${
                dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40"
              }`}
            >
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} disabled={uploading} />
              {uploading ? (
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              ) : (
                <>
                  <UploadCloud className={`w-5 h-5 mb-1 ${dragOver ? "text-indigo-500" : "text-slate-400"}`} />
                  <p className="text-slate-500 text-xs">
                    Drag & drop or{" "}
                    <span className="text-indigo-600 font-medium underline underline-offset-2">click to attach files</span>
                  </p>
                </>
              )}
            </div>

            {/* Staged attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                    <Paperclip className="w-3 h-3 text-slate-400" />
                    <span className="max-w-[120px] truncate text-slate-700">{a.file_name}</span>
                    <span className="text-slate-400">({formatBytes(a.file_size)})</span>
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>
                      <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              {ticket.has_unread_updates && (
                <Button variant="ghost" size="sm" onClick={loadComments} className="gap-1 text-xs text-slate-500">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </Button>
              )}
              <Button
                onClick={handleSendReply}
                disabled={sending || (!replyText.trim() && attachments.length === 0)}
                size="sm"
                className="gap-2 ml-auto bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Reply
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-100 p-4 text-center text-sm text-slate-500">
            This ticket is closed.{" "}
            {!canReopen && "Contact your admin to reopen it."}
          </div>
        )}
      </div>

      <ReopenTicketModal
        ticket={ticket}
        open={showReopen}
        onClose={() => setShowReopen(false)}
        onSuccess={loadComments}
      />
    </div>
  );
}