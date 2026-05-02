import { useState, useRef, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/authFetch";
import { useGetProfile } from "@workspace/api-client-react";
import { X, Send, Sparkles, ChevronDown, RotateCcw, MessageCircle } from "lucide-react";
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
  const { data: profile } = useGetProfile();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
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

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timeoutId = setTimeout(() => ctrl.abort(), 90_000);

    try {
      const res = await authFetch("/api/support/chat", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, preferredLanguage: profile?.preferredLanguage ?? "English" }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      let serverError: string | null = null;
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
            } else if (parsed.error) {
              // Server-emitted error — capture it so we can show it as
              // the assistant's reply once the stream closes. Without
              // this branch the bubble would end up empty and look like
              // Aria simply didn't respond.
              serverError = String(parsed.error);
            } else if (parsed.status) {
              // Transient status update (e.g. "catching her breath"
              // during a 429 retry) — show it inline so the user knows
              // we're still working.
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: accumulated || `_${parsed.status}_`, streaming: true }
                    : m
                )
              );
            }
          } catch {}
        }
      }

      // If the server signaled an error OR the stream closed with zero
      // content, surface a clear message instead of an empty bubble.
      const finalContent = serverError
        ? serverError
        : accumulated || "Sorry, no response came back. Please try again in a moment.";
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: finalContent, streaming: false }
            : m
        )
      );

      if (!open) setHasUnread(true);
    } catch (err: unknown) {
      const isAbort = (err as Error).name === "AbortError";
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content: isAbort
                  ? "Aria's reply took too long. Please try again."
                  : "Sorry, something went wrong. Please try again.",
                streaming: false,
              }
            : m
        )
      );
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      abortRef.current = null;
    }
  }, [loading, messages, open]);

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

  const handleHide = () => {
    setOpen(false);
    setHidden(true);
  };

  const handleShow = () => {
    setHidden(false);
  };

  if (hidden) {
    return (
      <button
        onClick={handleShow}
        className="fixed bottom-20 right-0 z-50 flex flex-col items-center gap-1 bg-primary text-primary-foreground pl-2 pr-1.5 py-3 rounded-l-xl shadow-lg hover:pr-2.5 transition-all duration-200 group"
        aria-label="Open support assistant"
      >
        <MessageCircle className="h-4 w-4" />
        {hasUnread && (
          <span className="w-2 h-2 bg-rose-400 rounded-full" />
        )}
        <span
          className="text-[10px] font-medium leading-none tracking-wide"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Aria
        </span>
      </button>
    );
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-1.5">
        <button
          onClick={() => setOpen(prev => !prev)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 relative
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

        {!open && (
          <button
            onClick={handleHide}
            className="text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors px-2 py-0.5 rounded-full hover:bg-background/60 backdrop-blur-sm"
            aria-label="Hide assistant"
          >
            Hide
          </button>
        )}
      </div>

      <div
        className={`fixed bottom-24 right-6 z-50 w-[380px] max-h-[580px] bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300
          ${open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
        style={{ maxWidth: "calc(100vw - 3rem)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 bg-primary text-primary-foreground flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight text-primary-foreground">Aria</p>
            <p className="text-xs text-primary-foreground/80">A.IDO Support Assistant · Always here</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg hover:bg-primary-foreground/15 transition-colors"
              title="New conversation"
            >
              <RotateCcw className="h-4 w-4 text-primary-foreground/90" />
            </button>
            <button
              onClick={handleHide}
              className="p-1.5 rounded-lg hover:bg-primary-foreground/15 transition-colors"
              title="Hide assistant"
            >
              <X className="h-4 w-4 text-primary-foreground/90" />
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
                    : "bg-muted text-foreground border border-border/50 rounded-tl-sm"
                  }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-p:my-0.5 prose-p:text-foreground prose-ul:my-1 prose-li:my-0 prose-li:text-foreground prose-strong:text-primary prose-headings:text-foreground prose-a:text-primary">
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
