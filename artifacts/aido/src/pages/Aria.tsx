import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@clerk/react";
import {
  useGetProfile,
  getListVendorsQueryKey,
  getGetChecklistQueryKey,
  getGetTimelineQueryKey,
  getGetProfileQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Send,
  Plus,
  User,
  ChevronDown,
  MessageSquare,
  Trash2,
  Menu,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const API = import.meta.env.VITE_API_URL ?? "";

type ActionStatus = "running" | "ok" | "error";
interface ActionLog {
  name: string;
  args?: Record<string, unknown>;
  status: ActionStatus;
  error?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  actions?: ActionLog[];
  createdAt: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}


const STORAGE_PREFIX = "aido:aria:conversations:";
const MAX_STORED = 30;

function storageKey(userId: string | null | undefined) {
  return `${STORAGE_PREFIX}${userId ?? "anon"}`;
}

function loadConversations(userId: string | null | undefined): Conversation[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(c => c && typeof c.id === "string" && Array.isArray(c.messages));
  } catch {
    return [];
  }
}

function saveConversations(userId: string | null | undefined, convos: Conversation[]) {
  try {
    const trimmed = convos.slice(0, MAX_STORED).map(c => ({
      ...c,
      messages: c.messages.map(m => ({ ...m, streaming: false })),
    }));
    localStorage.setItem(storageKey(userId), JSON.stringify(trimmed));
  } catch {}
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m.role === "user");
  if (!firstUser) return "";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > 60 ? text.slice(0, 57) + "…" : text;
}

function AriaAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-sm">
      <Sparkles className="h-4 w-4 text-white" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
      <User className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function actionLabel(name: string, args?: Record<string, unknown>): string {
  switch (name) {
    case "add_vendor": return `Adding vendor${args?.name ? ` "${args.name}"` : ""}`;
    case "add_checklist_item": return `Adding checklist item${args?.task ? ` "${args.task}"` : ""}`;
    case "add_timeline_event": return `Adding timeline event${args?.title ? ` "${args.title}"` : ""}`;
    case "update_profile": return "Updating wedding profile";
    case "list_vendors": return "Reading your vendor list";
    case "get_profile": return "Reading your wedding profile";
    default: return name;
  }
}

function ActionPill({ action }: { action: ActionLog }) {
  const Icon = action.status === "running" ? Loader2 : action.status === "ok" ? CheckCircle2 : AlertCircle;
  const colorClass =
    action.status === "running" ? "text-muted-foreground bg-muted/60 border-border" :
    action.status === "ok" ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50" :
    "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50";
  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border ${colorClass}`}>
      <Icon className={`h-3 w-3 ${action.status === "running" ? "animate-spin" : ""}`} />
      <span>{actionLabel(action.name, action.args)}</span>
      {action.status === "error" && action.error && (
        <span className="ml-1 opacity-80">— {action.error}</span>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5">
        <div className="max-w-[78%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm whitespace-pre-wrap">
          {msg.content}
        </div>
        <UserAvatar />
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <AriaAvatar />
      <div className="max-w-[78%] space-y-2">
        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.actions.map((a, i) => <ActionPill key={i} action={a} />)}
          </div>
        )}
        {(msg.content || !msg.actions || msg.actions.length === 0) && (
          <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            {msg.content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-foreground">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex gap-1 items-center py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Aria() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { userId } = useAuth();
  const { data: profile } = useGetProfile();
  const queryClient = useQueryClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hydratedUserId, setHydratedUserId] = useState<string | null | undefined>(undefined);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations on mount / when user changes
  useEffect(() => {
    // Reset hydration so saves don't fire under the previous user's id
    setHydratedUserId(undefined);
    const loaded = loadConversations(userId);
    setConversations(loaded);
    setActiveId(loaded[0]?.id ?? null);
    setHydratedUserId(userId);
  }, [userId]);

  // Persist whenever conversations change — only after we've hydrated for THIS user
  useEffect(() => {
    if (hydratedUserId !== userId) return;
    saveConversations(userId, conversations);
  }, [conversations, userId, hydratedUserId]);

  const activeConvo = useMemo(
    () => conversations.find(c => c.id === activeId) ?? null,
    [conversations, activeId]
  );
  const messages = activeConvo?.messages ?? [];

  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  function startNewChat() {
    const c: Conversation = {
      id: newId(),
      title: "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations(prev => [c, ...prev]);
    setActiveId(c.id);
    setInput("");
    setHistoryOpen(false);
  }

  function deleteConversation(id: string) {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  function clearAllConversations() {
    if (!window.confirm(t("aria.clear_all_confirm"))) {
      return;
    }
    setConversations([]);
    setActiveId(null);
  }

  function selectConversation(id: string) {
    setActiveId(id);
    setHistoryOpen(false);
  }

  function updateActiveMessages(updater: (msgs: Message[]) => Message[]) {
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== activeId) return c;
        const newMsgs = updater(c.messages);
        return {
          ...c,
          messages: newMsgs,
          updatedAt: Date.now(),
          title: !c.title ? deriveTitle(newMsgs) : c.title,
        };
      })
    );
  }

  function refreshAfterActions(actions: ActionLog[]) {
    const names = new Set(actions.filter(a => a.status === "ok").map(a => a.name));
    const dashboardKey = getGetDashboardSummaryQueryKey();
    if (names.has("add_vendor")) {
      queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardKey });
    }
    if (names.has("add_checklist_item")) {
      queryClient.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardKey });
    }
    if (names.has("add_timeline_event")) {
      queryClient.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
    }
    if (names.has("update_profile")) {
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardKey });
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    // Ensure there's an active conversation
    let convoId = activeId;
    if (!convoId) {
      const c: Conversation = {
        id: newId(),
        title: "",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversations(prev => [c, ...prev]);
      setActiveId(c.id);
      convoId = c.id;
    }

    const userMsg: Message = { id: newId(), role: "user", content: trimmed, createdAt: Date.now() };
    const placeholder: Message = { id: newId(), role: "assistant", content: "", streaming: true, actions: [], createdAt: Date.now() };

    setConversations(prev =>
      prev.map(c => {
        if (c.id !== convoId) return c;
        const newMsgs = [...c.messages, userMsg, placeholder];
        return { ...c, messages: newMsgs, updatedAt: Date.now(), title: !c.title ? deriveTitle(newMsgs) : c.title };
      })
    );

    const historyForApi = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    setInput("");
    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const res = await authFetch(`${API}/api/aria/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyForApi,
          preferredLanguage: profile?.preferredLanguage ?? "English",
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Failed to connect to Aria");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      const liveActions: ActionLog[] = [];

      const updatePlaceholder = (patch: Partial<Message>) => {
        setConversations(prev =>
          prev.map(c => {
            if (c.id !== convoId) return c;
            return {
              ...c,
              updatedAt: Date.now(),
              messages: c.messages.map(m => (m.id === placeholder.id ? { ...m, ...patch } : m)),
            };
          })
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "action_start") {
              liveActions.push({ name: parsed.name, args: parsed.args, status: "running" });
              updatePlaceholder({ actions: [...liveActions] });
            } else if (parsed.type === "action_result") {
              const idx = liveActions.findIndex(a => a.name === parsed.name && a.status === "running");
              if (idx !== -1) {
                liveActions[idx] = {
                  ...liveActions[idx],
                  status: parsed.ok ? "ok" : "error",
                  error: parsed.error,
                };
                updatePlaceholder({ actions: [...liveActions] });
              }
            } else if (parsed.type === "content") {
              accumulated = (accumulated || "") + parsed.content;
              updatePlaceholder({ content: accumulated, streaming: true });
            } else if (parsed.type === "done") {
              updatePlaceholder({ streaming: false });
            } else if (parsed.type === "error") {
              throw new Error(parsed.error || "Aria error");
            }
          } catch {
            // ignore JSON parse error for non-JSON lines
          }
        }
      }

      updatePlaceholder({ streaming: false });
      refreshAfterActions(liveActions);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        updateActiveMessages(msgs => msgs.filter(m => m.id !== placeholder.id));
        return;
      }
      toast({
        title: "Aria is unavailable",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      updateActiveMessages(msgs => msgs.filter(m => m.id !== placeholder.id));
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = messages.length === 0;
  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex h-[calc(100vh-4rem)] max-w-6xl mx-auto">
      {/* History sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border/40 bg-background/40 shrink-0">
        <div className="p-3 border-b border-border/40">
          <Button
            onClick={startNewChat}
            className="w-full gap-2"
            variant="outline"
            data-testid="btn-aria-new-chat"
          >
            <Plus className="h-4 w-4" /> {t("aria.new_chat")}
          </Button>
        </div>
        {sortedConversations.length > 0 && (
          <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("aria.past_chats")}
            </p>
            <button
              onClick={clearAllConversations}
              className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              title={t("aria.clear_all")}
              data-testid="btn-aria-clear-all"
            >
              <Trash2 className="h-3 w-3" /> {t("aria.clear_all")}
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedConversations.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3">
              {t("aria.conversations_empty")}
            </p>
          )}
          {sortedConversations.map(c => (
            <ConversationRow
              key={c.id}
              convo={c}
              active={c.id === activeId}
              onSelect={() => selectConversation(c.id)}
              onDelete={() => deleteConversation(c.id)}
            />
          ))}
        </div>
      </aside>

      {/* Mobile drawer */}
      {historyOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setHistoryOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r border-border shadow-xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border/50">
              <p className="font-medium text-sm">{t("aria.conversations")}</p>
              <button onClick={() => setHistoryOpen(false)} className="p-1 rounded hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 border-b border-border/40">
              <Button onClick={startNewChat} className="w-full gap-2" variant="outline">
                <Plus className="h-4 w-4" /> {t("aria.new_chat")}
              </Button>
            </div>
            {sortedConversations.length > 0 && (
              <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("aria.past_chats")}
                </p>
                <button
                  onClick={clearAllConversations}
                  className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                  title={t("aria.clear_all")}
                >
                  <Trash2 className="h-3 w-3" /> {t("aria.clear_all")}
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sortedConversations.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-3">{t("aria.mobile_conversations_empty")}</p>
              )}
              {sortedConversations.map(c => (
                <ConversationRow
                  key={c.id}
                  convo={c}
                  active={c.id === activeId}
                  onSelect={() => selectConversation(c.id)}
                  onDelete={() => deleteConversation(c.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded hover:bg-muted"
              onClick={() => setHistoryOpen(true)}
              aria-label="Open conversation history"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-lg text-primary leading-tight">{t("aria.name")}</h1>
              <p className="text-xs text-muted-foreground">{t("aria.subtitle")}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground text-xs"
            onClick={startNewChat}
            data-testid="btn-aria-new-chat-header"
          >
            <Plus className="h-3.5 w-3.5" /> {t("aria.new_chat")}
          </Button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-5 relative"
        >
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-8 pb-8">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 border border-primary/15">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="font-serif text-2xl text-primary">{t("aria.title")}</h2>
                <p className="text-muted-foreground text-sm max-w-md">
                  {t("aria.welcome_body")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
                {(["starter_1","starter_2","starter_3","starter_4","starter_5","starter_6"] as const).map(key => (
                  <button
                    key={key}
                    onClick={() => send(t(`aria.${key}`))}
                    className="text-left px-4 py-3 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-sm text-foreground/80 hover:text-foreground leading-snug"
                  >
                    {t(`aria.${key}`)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
          )}
          <div ref={bottomRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <div className="flex justify-center pb-2 shrink-0">
            <button
              onClick={() => scrollToBottom()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5 shadow hover:shadow-md hover:text-foreground transition-all"
            >
              <ChevronDown className="h-3.5 w-3.5" /> {t("aria.scroll_to_bottom")}
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur px-4 py-3">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              placeholder={t("aria.input_placeholder")}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={streaming}
              className="resize-none min-h-[44px] max-h-36 border-primary/20 focus:border-primary text-sm leading-relaxed py-2.5"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <Button
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl"
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            {t("aria.keyboard_hint")}
          </p>
        </div>
      </div>
    </div>
  );
}

function ConversationRow({
  convo,
  active,
  onSelect,
  onDelete,
}: {
  convo: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  function formatRelative(ts: number) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return t("aria.just_now");
    if (m < 60) return t("aria.minutes_ago", { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t("aria.hours_ago", { n: h });
    const d = Math.floor(h / 24);
    if (d < 7) return t("aria.days_ago", { n: d });
    return new Date(ts).toLocaleDateString();
  }

  return (
    <div
      className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
        active ? "bg-primary/10 text-foreground" : "hover:bg-muted text-foreground/80"
      }`}
      onClick={onSelect}
    >
      <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" title={convo.title || t("aria.new_chat")}>{convo.title || t("aria.new_chat")}</p>
        <p className="text-[10px] text-muted-foreground">{formatRelative(convo.updatedAt)}</p>
      </div>
      <button
        onClick={e => {
          e.stopPropagation();
          if (window.confirm(t("aria.delete_confirm"))) {
            onDelete();
          }
        }}
        className="p-1.5 rounded text-muted-foreground hover:bg-background hover:text-destructive opacity-70 md:opacity-50 md:group-hover:opacity-100 transition-all"
        title={t("aria.delete_chat")}
        aria-label={t("aria.delete_chat")}
        data-testid={`btn-aria-delete-${convo.id}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
