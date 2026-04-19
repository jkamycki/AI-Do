import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { useGetProfile } from "@workspace/api-client-react";
import { X, Send, Sparkles, ChevronDown, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const QUICK_PROMPTS = [
  "How do I generate a wedding timeline?",
  "What can a Planner collaborator do?",
  "How do I track my budget?",
  "What does the Day-Of Coordinator do?",
];

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm **Aria**, your A.IDO planning assistant 💐\n\nI can help you use any feature in A.IDO or answer general wedding planning questions. What's on your mind?",
};

export function SupportChat() {
  const { getToken } = useAuth();
  const { data: profile } = useGetProfile();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);

    const history = [...messages, userMsg].filter(m => m.id !== "welcome").map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const token = await getToken();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const res = await fetch("/api/support/chat", {
        method: "POST",
        signal: ctrl.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: history, preferredLanguage: profile?.preferredLanguage ?? "English" }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              accumulated += parsed.content;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, content: accumulated, streaming: true } : m
                )
              );
            }
          } catch {}
        }
      }

      setMessages(prev =>
        prev.map(m => (m.id === assistantId ? { ...m, streaming: false } : m))
      );

      if (!open) setHasUnread(true);
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: "Sorry, something went wrong. Please try again.", streaming: false }
            : m
        )
      );
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [loading, messages, getToken, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setMessages([WELCOME_MESSAGE]);
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95
          ${open ? "bg-primary/90" : "bg-primary"}`}
        aria-label="Toggle support chat"
      >
        {open ? (
          <ChevronDown className="h-6 w-6 text-white" />
        ) : (
          <Sparkles className="h-6 w-6 text-white" />
        )}
        {hasUnread && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white" />
        )}
      </button>

      <div
        className={`fixed bottom-24 right-6 z-50 w-[380px] max-h-[580px] bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300
          ${open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
        style={{ maxWidth: "calc(100vw - 3rem)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 bg-primary text-primary-foreground flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">Aria</p>
            <p className="text-xs text-white/70">A.IDO Support Assistant · Always here</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="New conversation"
            >
              <RotateCcw className="h-4 w-4 text-white/80" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4 text-white/80" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
                  ${msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted/60 text-foreground rounded-tl-sm"
                  }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-ul:my-1 prose-li:my-0 prose-strong:text-foreground">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {msg.streaming && msg.content && (
                      <span className="inline-block w-1.5 h-4 bg-primary/60 rounded-sm ml-0.5 animate-pulse" />
                    )}
                    {msg.streaming && !msg.content && (
                      <span className="flex gap-1 py-1">
                        {[0, 1, 2].map(i => (
                          <span
                            key={i}
                            className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {messages.length === 1 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground px-1">Quick questions:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="px-3 py-3 border-t border-border/50 flex-shrink-0">
          <div className="flex items-end gap-2 bg-muted/40 rounded-xl px-3 py-2 border border-border/40 focus-within:border-primary/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your wedding…"
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-24 leading-relaxed disabled:opacity-60"
              style={{ minHeight: "24px" }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 96) + "px";
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-primary/90 transition-colors active:scale-95"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-1.5">
            Powered by A.IDO AI · Aria may occasionally make mistakes
          </p>
        </div>
      </div>
    </>
  );
}
