import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AISupport() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi there! 👋 I'm Aria, A.IDO's AI support assistant. I'm here to help with any questions or issues you're experiencing. What can I help you with today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitterInfo, setSubmitterInfo] = useState({
    name: user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "",
    email: user?.emailAddresses[0]?.emailAddress ?? "",
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const updatedMessages = [...messages, { role: "user" as const, content: userMessage }];

      const r = await authedFetch("/api/support/bot", {
        method: "POST",
        body: JSON.stringify({
          messages: updatedMessages,
          preferredLanguage: "English",
        }),
      });

      if (!r.ok) throw new Error("Failed to get response");

      const reader = r.body?.getReader();
      if (!reader) throw new Error("No response body");

      let assistantMessage = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessage += parsed.content;
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Skip parse errors
            }
          }
        }
      }

      return assistantMessage;
    },
    onSuccess: (assistantMessage) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantMessage },
      ]);
      setInput("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const submitTicketMutation = useMutation({
    mutationFn: async () => {
      // Extract issue summary from conversation
      const userMessages = messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join(" ");

      const subject =
        userMessages.slice(0, 100) || "Support Request from Chat";

      const r = await authedFetch("/api/help/support-ticket", {
        method: "POST",
        body: JSON.stringify({
          name: submitterInfo.name,
          email: submitterInfo.email,
          category: "support",
          subject,
          message: messages.map((m) => `${m.role}: ${m.content}`).join("\n\n"),
        }),
      });

      if (!r.ok) throw new Error("Failed to submit ticket");
      return r.json();
    },
    onSuccess: (data) => {
      setSubmitted(true);
      toast({
        title: "Support Ticket Created",
        description: `Ticket #${data.ticketNumber} has been sent to our support team. We'll get back to you soon!`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit ticket. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    const userMessage = input;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      await chatMutation.mutateAsync(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
            Thank You!
          </h2>
          <p className="text-muted-foreground mb-6">
            Your support ticket has been submitted to our operations team. We'll review your issue and get back to you as soon as possible via email.
          </p>
          <Button onClick={() => setSubmitted(false)}>Start New Chat</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💬 AI Support Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Chat Messages */}
            <div className="h-96 bg-muted/20 rounded-lg p-4 space-y-3 overflow-y-auto border border-border/50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted text-foreground rounded-bl-none"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground px-4 py-2 rounded-lg rounded-bl-none">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isLoading) {
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Submit to Support */}
            {messages.length > 1 && (
              <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-foreground">
                  Ready to submit this conversation as a support ticket to our team?
                </p>
                {!isSignedIn && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Your name"
                      value={submitterInfo.name}
                      onChange={(e) =>
                        setSubmitterInfo((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                    <Input
                      type="email"
                      placeholder="Your email"
                      value={submitterInfo.email}
                      onChange={(e) =>
                        setSubmitterInfo((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>
                )}
                <Button
                  onClick={() => submitTicketMutation.mutate()}
                  disabled={
                    submitTicketMutation.isPending ||
                    !submitterInfo.name ||
                    !submitterInfo.email
                  }
                  className="w-full"
                >
                  {submitTicketMutation.isPending
                    ? "Submitting..."
                    : "Submit to Support Team"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
