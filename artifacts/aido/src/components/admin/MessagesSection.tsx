import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Mail, MessageSquare, Bug, Lightbulb, Heart, ThumbsUp,
  Circle, CheckCircle2, Inbox, Star, Trash2, Loader2, Send,
} from "lucide-react";

interface ContactReply {
  id: number;
  contactMessageId: number;
  direction: "outbound" | "inbound";
  body: string;
  senderUserId: string | null;
  senderEmail: string | null;
  senderName: string | null;
  createdAt: string;
}

interface HelpMessage {
  id: number;
  userId: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  source?: string | null;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
  replies?: ContactReply[];
}

interface FeedbackItem {
  id: number;
  userId: string | null;
  rating: number | null;
  category: string | null;
  message: string;
  source?: string | null;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  bug: { label: "Bug Report", icon: Bug, color: "text-red-600 bg-red-50" },
  feature: { label: "Feature Request", icon: Lightbulb, color: "text-amber-600 bg-amber-50" },
  general: { label: "General Feedback", icon: ThumbsUp, color: "text-blue-600 bg-blue-50" },
  praise: { label: "Something I Love", icon: Heart, color: "text-rose-600 bg-rose-50" },
};

function issueSourceLabel(item: { message?: string; source?: string | null }) {
  const source = item.source?.toLowerCase();
  const message = item.message?.toLowerCase() ?? "";
  if (source?.includes("app") || message.includes("source: app")) return "App";
  if (source?.includes("website") || message.includes("source: website")) return "Website";
  return "Website";
}

interface MessagesSectionProps {
  title?: string;
  description?: string;
}

export default function MessagesSection({
  title = "Messages & Feedback",
  description = "Contact requests and user feedback submitted through the Help page.",
}: MessagesSectionProps = {}) {
  const { getToken } = useAuth();
  const [subTab, setSubTab] = useState<"contact" | "feedback">("contact");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [replyOpenId, setReplyOpenId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const queryClient = useQueryClient();

  const authedFetch = async (url: string, init: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-messages"],
    queryFn: async () => {
      const r = await authedFetch("/api/help/messages");
      if (!r.ok) throw new Error("Fetch failed");
      return r.json() as Promise<{ contacts: HelpMessage[]; feedback: FeedbackItem[]; unreadCount: number }>;
    },
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async ({ type, id }: { type: "contact" | "feedback"; id: number }) => {
      await authedFetch(`/api/help/messages/${type}/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ type, id, resolved }: { type: "contact" | "feedback"; id: number; resolved: boolean }) => {
      await authedFetch(`/api/help/messages/${type}/${id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ resolved }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ type, id }: { type: "contact" | "feedback"; id: number }) => {
      const r = await authedFetch(`/api/help/messages/${type}/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, text }: { id: number; text: string }) => {
      const r = await authedFetch(`/api/help/messages/contact/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ replyText: text }),
      });
      if (!r.ok) {
        let detail = "";
        try { detail = (await r.json())?.error ?? ""; } catch { /* ignore */ }
        throw new Error(detail || `Failed to send reply (${r.status})`);
      }
    },
    onSuccess: () => {
      setReplyOpenId(null);
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
    },
  });

  const handleExpand = (id: number, type: "contact" | "feedback") => {
    setExpanded(prev => {
      if (prev === id) return null;
      markReadMutation.mutate({ type, id });
      return id;
    });
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  const allContacts = data?.contacts ?? [];
  const allFeedback = data?.feedback ?? [];
  const contacts = showResolved ? allContacts : allContacts.filter(c => !c.isResolved);
  const feedback = showResolved ? allFeedback : allFeedback.filter(f => !f.isResolved);
  const unreadC = allContacts.filter(c => !c.isRead && !c.isResolved).length;
  const unreadF = allFeedback.filter(f => !f.isRead && !f.isResolved).length;
  const resolvedCount = allContacts.filter(c => c.isResolved).length + allFeedback.filter(f => f.isResolved).length;

  return (
    <div className="space-y-6 text-[#24171D]">
      <div className="mb-6">
        <h2 className="text-2xl font-serif font-semibold text-[#24171D]">{title}</h2>
        <p className="mt-1 text-sm font-medium text-[#4A3941]">{description}</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab("contact")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
              ${subTab === "contact" ? "bg-primary text-white border-primary" : "bg-card border-border text-[#4A3941] hover:text-[#24171D]"}`}
          >
            <Mail className="h-4 w-4" />
            Contact Messages
            {unreadC > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-bold min-w-[18px] text-center
                ${subTab === "contact" ? "bg-white/20 text-white" : "bg-primary/15 text-primary"}`}>
                {unreadC}
              </span>
            )}
          </button>
          <button
            onClick={() => setSubTab("feedback")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
              ${subTab === "feedback" ? "bg-primary text-white border-primary" : "bg-card border-border text-[#4A3941] hover:text-[#24171D]"}`}
          >
            <MessageSquare className="h-4 w-4" />
            Feedback
            {unreadF > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-bold min-w-[18px] text-center
                ${subTab === "feedback" ? "bg-white/20 text-white" : "bg-primary/15 text-primary"}`}>
                {unreadF}
              </span>
            )}
          </button>
        </div>

        {resolvedCount > 0 && (
          <button
            onClick={() => setShowResolved(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
              ${showResolved ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted/50 text-[#4A3941] border-border hover:border-primary/30"}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {showResolved ? "Hiding resolved" : `Show resolved (${resolvedCount})`}
          </button>
        )}
      </div>

      {subTab === "contact" && (
        <div className="space-y-2">
          {contacts.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="py-12 text-center font-medium text-[#4A3941]">
                <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
                {allContacts.length === 0 ? "No contact messages yet." : "All messages are resolved."}
              </CardContent>
            </Card>
          ) : (
            contacts.map(msg => (
              <Card
                key={msg.id}
                className={`border-none shadow-sm overflow-hidden transition-all
                  ${msg.isResolved ? "opacity-60" : !msg.isRead ? "ring-1 ring-primary/30" : ""}`}
              >
                <button
                  className="w-full text-left px-5 py-4 hover:bg-muted/20 transition-colors"
                  onClick={() => handleExpand(msg.id, "contact")}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {!msg.isRead && !msg.isResolved && (
                        <Circle className="h-2 w-2 fill-primary text-primary flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold text-sm truncate ${!msg.isRead && !msg.isResolved ? "text-[#24171D]" : "text-[#4A3941]"}`}>
                            {msg.subject}
                          </p>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                            {issueSourceLabel(msg)}
                          </span>
                          {msg.isResolved && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                              Resolved
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-[#4A3941] truncate">
                          {msg.name} &lt;{msg.email}&gt;
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-[#4A3941] whitespace-nowrap flex-shrink-0">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
                {expanded === msg.id && (
                  <div className="px-5 pb-4 pt-0 border-t border-border/30 bg-muted/5">
                    <div className="grid grid-cols-2 gap-2 text-xs font-medium text-[#4A3941] mb-3 mt-3">
                      <span><strong>From:</strong> {msg.name}</span>
                      <span><strong>Email:</strong> {msg.email}</span>
                      <span><strong>Source:</strong> {issueSourceLabel(msg)}</span>
                      <span><strong>Submitted:</strong> {new Date(msg.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-medium text-[#24171D] leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                      {msg.message}
                    </p>
                    {msg.replies && msg.replies.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-[#4A3941] uppercase tracking-wide">
                          Conversation ({msg.replies.length})
                        </p>
                        {msg.replies.map(reply => {
                          const isOutbound = reply.direction === "outbound";
                          return (
                            <div
                              key={reply.id}
                              className={`rounded-lg p-3 border ${isOutbound ? "bg-primary/5 border-primary/20 ml-6" : "bg-muted/30 border-border/40 mr-6"}`}
                            >
                              <div className="flex items-center justify-between text-xs font-medium text-[#4A3941] mb-1.5">
                                <span className="font-medium">
                                  {isOutbound
                                    ? `You replied${reply.senderEmail ? ` (as ${reply.senderEmail})` : ""}`
                                    : `${reply.senderName ?? reply.senderEmail ?? "Reply"}`}
                                </span>
                                <span>{new Date(reply.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="text-sm font-medium text-[#24171D] whitespace-pre-wrap leading-relaxed">
                                {reply.body}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={e => { e.stopPropagation(); if (confirm("Delete this message? This cannot be undone.")) deleteMessageMutation.mutate({ type: "contact", id: msg.id }); }}
                        disabled={deleteMessageMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={e => {
                          e.stopPropagation();
                          if (replyOpenId === msg.id) {
                            setReplyOpenId(null);
                            setReplyText("");
                          } else {
                            setReplyOpenId(msg.id);
                            setReplyText("");
                          }
                        }}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {replyOpenId === msg.id ? "Cancel Reply" : "Reply"}
                      </Button>
                      <Button
                        size="sm"
                        variant={msg.isResolved ? "outline" : "default"}
                        className={`gap-1.5 ${msg.isResolved ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"}`}
                        onClick={e => { e.stopPropagation(); resolveMutation.mutate({ type: "contact", id: msg.id, resolved: !msg.isResolved }); }}
                        disabled={resolveMutation.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {msg.isResolved ? "Mark as Open" : "Mark as Resolved"}
                      </Button>
                    </div>
                    {replyOpenId === msg.id && (
                      <div
                        className="mt-3 border border-border/40 rounded-lg p-3 bg-background"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="text-xs font-medium text-[#4A3941] mb-2">
                          Replying to <strong>{msg.email}</strong> · subject: <strong>Re: {msg.subject}</strong>
                        </div>
                        <textarea
                          className="w-full min-h-[120px] rounded-md border border-border/60 bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Type your reply…"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          disabled={replyMutation.isPending}
                        />
                        {replyMutation.isError && (
                          <p className="text-xs text-destructive mt-2">
                            {(replyMutation.error as Error)?.message ?? "Failed to send reply."}
                          </p>
                        )}
                        <div className="mt-2 flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setReplyOpenId(null); setReplyText(""); }}
                            disabled={replyMutation.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => replyMutation.mutate({ id: msg.id, text: replyText })}
                            disabled={replyMutation.isPending || !replyText.trim()}
                          >
                            {replyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {subTab === "feedback" && (
        <div className="space-y-2">
          {feedback.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="py-12 text-center font-medium text-[#4A3941]">
                <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                {allFeedback.length === 0 ? "No feedback submissions yet." : "All feedback is resolved."}
              </CardContent>
            </Card>
          ) : (
            feedback.map(item => {
              const catMeta = item.category ? CATEGORY_META[item.category] : null;
              const CatIcon = catMeta?.icon ?? MessageSquare;
              return (
                <Card
                  key={item.id}
                  className={`border-none shadow-sm overflow-hidden transition-all
                    ${item.isResolved ? "opacity-60" : !item.isRead ? "ring-1 ring-primary/30" : ""}`}
                >
                  <button
                    className="w-full text-left px-5 py-4 hover:bg-muted/20 transition-colors"
                    onClick={() => handleExpand(item.id, "feedback")}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {!item.isRead && !item.isResolved && (
                          <Circle className="h-2 w-2 fill-primary text-primary flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          {catMeta && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${catMeta.color}`}>
                              <CatIcon className="h-3 w-3" />
                              {catMeta.label}
                            </span>
                          )}
                          {item.rating != null && (
                            <span className="flex items-center gap-0.5 text-amber-500 text-xs font-medium">
                              {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {issueSourceLabel(item)}
                          </span>
                          {item.isResolved && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Resolved
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-[#4A3941] whitespace-nowrap flex-shrink-0">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 truncate px-5 -mx-5 text-sm font-medium text-[#4A3941]">
                      {item.message.slice(0, 80)}{item.message.length > 80 ? "…" : ""}
                    </p>
                  </button>
                  {expanded === item.id && (
                    <div className="px-5 pb-4 pt-0 border-t border-border/30 bg-muted/5">
                      <p className="text-sm font-medium text-[#24171D] leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3 mt-3">
                        {item.message}
                      </p>
                      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                        <p className="text-xs font-medium text-[#4A3941]">
                          Source: {issueSourceLabel(item)} | Submitted: {new Date(item.createdAt).toLocaleString()}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={e => { e.stopPropagation(); if (confirm("Delete this feedback? This cannot be undone.")) deleteMessageMutation.mutate({ type: "feedback", id: item.id }); }}
                            disabled={deleteMessageMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant={item.isResolved ? "outline" : "default"}
                            className={`gap-1.5 ${item.isResolved ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"}`}
                            onClick={e => { e.stopPropagation(); resolveMutation.mutate({ type: "feedback", id: item.id, resolved: !item.isResolved }); }}
                            disabled={resolveMutation.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {item.isResolved ? "Mark as Open" : "Mark as Resolved"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
