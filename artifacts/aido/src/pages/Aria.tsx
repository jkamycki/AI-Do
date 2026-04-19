import { useState, useRef, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/authFetch";
import { useGetProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Send,
  RotateCcw,
  User,
  ChevronDown,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const STARTERS = [
  "What should I prioritize 6 months before my wedding?",
  "How do I negotiate with a venue that's over budget?",
  "What's a realistic catering cost per head?",
  "How do I create a seating chart that avoids drama?",
  "What questions should I ask a photographer before booking?",
  "What's typically included in a wedding planner contract?",
];

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

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5">
        <div className="max-w-[78%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
          {msg.content}
        </div>
        <UserAvatar />
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <AriaAvatar />
      <div className="max-w-[78%] bg-card border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        {msg.content ? (
          <div className="prose prose-sm max-w-none text-foreground prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-foreground">
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
    </div>
  );
}

export default function Aria() {
  const { toast } = useToast();
  const { data: profile } = useGetProfile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    const placeholderIdx = nextMessages.length;
    setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);

    abortRef.current = new AbortController();

    try {
      const res = await authFetch(`${API}/api/support/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          preferredLanguage: profile?.preferredLanguage ?? "English",
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to connect to Aria");
      }

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
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              accumulated += parsed.content;
              const snap = accumulated;
              setMessages(prev =>
                prev.map((m, i) =>
                  i === placeholderIdx ? { ...m, content: snap, streaming: true } : m
                )
              );
            }
          } catch {
          }
        }
      }

      setMessages(prev =>
        prev.map((m, i) =>
          i === placeholderIdx ? { ...m, streaming: false } : m
        )
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages(prev => prev.filter((_, i) => i !== placeholderIdx));
        return;
      }
      toast({
        title: "Aria is unavailable",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      setMessages(prev => prev.filter((_, i) => i !== placeholderIdx));
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

  function clearChat() {
    if (streaming) {
      abortRef.current?.abort();
    }
    setMessages([]);
    setInput("");
    setStreaming(false);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-serif text-lg text-primary leading-tight">Aria</h1>
            <p className="text-xs text-muted-foreground">AI Wedding Planning Assistant</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground text-xs"
            onClick={clearChat}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New Chat
          </Button>
        )}
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
              <h2 className="font-serif text-2xl text-primary">Hi, I'm Aria</h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                Your personal wedding planning assistant. Ask me anything — vendor tips, budget advice, timeline questions, or whatever's on your mind.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
              {STARTERS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left px-4 py-3 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/3 transition-all text-sm text-foreground/80 hover:text-foreground leading-snug"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
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
            <ChevronDown className="h-3.5 w-3.5" /> Scroll to bottom
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur px-4 py-3">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            placeholder="Ask Aria anything about your wedding…"
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
          Press <kbd className="font-mono bg-muted px-1 rounded text-[10px]">Enter</kbd> to send · <kbd className="font-mono bg-muted px-1 rounded text-[10px]">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}
