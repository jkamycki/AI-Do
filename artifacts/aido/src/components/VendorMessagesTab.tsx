import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOrCreateConversationByVendor,
  useListMessages,
  useSendMessage,
  useSuggestReply,
  useMarkConversationRead,
  useGetProfile,
  useSaveProfile,
  useGenerateVendorEmail,
  useGetVendor,
  getListMessagesQueryKey,
  getGetOrCreateConversationByVendorQueryKey,
  getListConversationsQueryKey,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Send, Sparkles, Paperclip, X, Mail, AlertCircle, CheckCircle2, Inbox, Check } from "lucide-react";

interface Props {
  vendorId: number;
}

interface PendingAttachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

export function VendorMessagesTab({ vendorId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const { data: conv, isLoading: convLoading } = useGetOrCreateConversationByVendor(vendorId);
  const conversationId = conv?.id;
  const { data: vendor } = useGetVendor(vendorId);

  // AI Draft (first-contact / standalone email) — embedded so users don't bounce to /vendor-email
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftPurpose, setDraftPurpose] = useState("");
  const [draftVendorType, setDraftVendorType] = useState("");
  const [draftOtherVendorType, setDraftOtherVendorType] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const generateEmail = useGenerateVendorEmail();

  const { data: messages, isLoading: msgsLoading } = useListMessages(conversationId ?? 0, {
    query: {
      enabled: !!conversationId,
      refetchInterval: 15000,
    },
  });

  const sendMutation = useSendMessage({
    mutation: {
      onSuccess: () => {
        if (!conversationId) return;
        qc.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) });
        qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setDraft("");
        setAttachments([]);
      },
      onError: (e) => toast({ title: "Send failed", description: String(e), variant: "destructive" }),
    },
  });

  const suggestMutation = useSuggestReply({
    mutation: {
      onSuccess: (r) => {
        setDraft((d) => (d ? `${d}\n\n${r.draft}` : r.draft));
        setIsSuggesting(false);
      },
      onError: (e) => {
        setIsSuggesting(false);
        toast({ title: "AI suggestion failed", description: String(e), variant: "destructive" });
      },
    },
  });

  const markReadMutation = useMarkConversationRead();

  const { data: profile } = useGetProfile();
  const savedBcc = (profile as { vendorBccEmail?: string | null } | undefined)?.vendorBccEmail ?? "";
  const [bccDraft, setBccDraft] = useState<string | null>(null);
  const bccValue = bccDraft ?? savedBcc;
  const bccChanged = bccDraft !== null && bccDraft.trim() !== savedBcc.trim();
  const bccValid = !bccValue || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bccValue.trim());
  const saveProfile = useSaveProfile({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        setBccDraft(null);
        toast({ title: bccValue.trim() ? "BCC saved" : "BCC removed", description: bccValue.trim() ? `Vendor messages will also go to ${bccValue.trim()}.` : undefined });
      },
      onError: () => toast({ title: "Could not save BCC", variant: "destructive" }),
    },
  });
  const saveBcc = () => {
    if (!profile || !bccValid) return;
    saveProfile.mutate({
      data: {
        partner1Name: profile.partner1Name,
        partner2Name: profile.partner2Name,
        weddingDate: profile.weddingDate,
        ceremonyTime: profile.ceremonyTime,
        receptionTime: profile.receptionTime,
        venue: profile.venue,
        location: profile.location,
        venueCity: profile.venueCity ?? undefined,
        venueState: profile.venueState ?? undefined,
        guestCount: profile.guestCount,
        totalBudget: profile.totalBudget,
        weddingVibe: profile.weddingVibe,
        preferredLanguage: profile.preferredLanguage ?? "English",
        vendorBccEmail: bccValue.trim() || null,
      } as never,
    });
  };

  useEffect(() => {
    if (conversationId && messages && messages.length > 0) {
      markReadMutation.mutate({ id: conversationId });
      qc.invalidateQueries({ queryKey: getGetOrCreateConversationByVendorQueryKey(vendorId) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages?.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages?.length]);

  const upload = useUpload({
    onError: (e) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await upload.uploadFile(file);
    if (result) {
      setAttachments((a) => [...a, { name: file.name, url: result.objectPath, type: file.type || "application/octet-stream", size: file.size }]);
    }
    e.target.value = "";
  };

  const handleSend = () => {
    if (!conversationId || !draft.trim()) return;
    sendMutation.mutate({
      id: conversationId,
      data: { body: draft.trim(), attachments },
    });
  };

  const handleSuggest = () => {
    if (!conversationId) return;
    setIsSuggesting(true);
    suggestMutation.mutate({ id: conversationId });
  };

  if (convLoading || !conv) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const hasVendorEmail = !!conv.vendorEmail;

  return (
    <div className="flex flex-col gap-3">
      {!hasVendorEmail && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <span className="text-amber-800 dark:text-amber-200">
            This vendor has no email address. Add one in the Edit dialog so messages can be delivered.
          </span>
        </div>
      )}

      <div
        ref={scrollRef}
        className="border rounded-xl bg-muted/20 p-4 space-y-3 overflow-y-auto"
        style={{ minHeight: 320, maxHeight: 420 }}
      >
        {msgsLoading && (
          <>
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="h-16 w-3/4 ml-auto" />
          </>
        )}
        {!msgsLoading && messages && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
            <Inbox className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No messages yet. Start the conversation below.</p>
            <p className="text-xs mt-1">Vendor replies arrive here automatically when they reply to your email.</p>
          </div>
        )}
        {messages?.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        <span>Replies from {conv.vendorEmail ?? "the vendor"} land here automatically.</span>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs flex items-start gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
        <span className="text-amber-800 dark:text-amber-200">
          <strong>Heads up:</strong> First-time emails to vendors may land in their <strong>spam or promotions</strong> folder. If you don't hear back in 1–2 days, give them a quick text or call to check, and ask them to mark this address as "not spam" so future messages reach their inbox.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          CC my email:
        </label>
        <Input
          type="email"
          placeholder="your@email.com (optional)"
          value={bccValue}
          onChange={(e) => setBccDraft(e.target.value)}
          className="h-8 flex-1 min-w-[180px] max-w-sm bg-background text-sm"
        />
        <Button
          size="sm"
          variant={bccChanged ? "default" : "outline"}
          onClick={saveBcc}
          disabled={!bccChanged || !bccValid || saveProfile.isPending}
        >
          {saveProfile.isPending ? "Saving…" : bccChanged ? "Save" : (<><Check className="h-3.5 w-3.5 mr-1" />Saved</>)}
        </Button>
        {!bccValid && bccValue && (
          <p className="w-full text-xs text-destructive">Enter a valid email address.</p>
        )}
        <p className="w-full text-[11px] text-muted-foreground">
          You'll be CC'd on every message. The vendor will see this address and can reply-all to include you directly.
        </p>
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <Badge key={i} variant="secondary" className="gap-1.5">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[180px] truncate">{a.name}</span>
              <button
                onClick={() => setAttachments((arr) => arr.filter((_, idx) => idx !== i))}
                className="ml-1 hover:text-destructive"
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (draft.trim() && hasVendorEmail && !sendMutation.isPending) {
              handleSend();
            }
          }
        }}
        placeholder={hasVendorEmail ? "Write a message to the vendor... (Enter to send, Shift+Enter for new line)" : "Add an email address for this vendor first."}
        className="min-h-[100px] resize-none"
        disabled={!hasVendorEmail}
      />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={handleFile} disabled={upload.isUploading} />
            <Button size="sm" variant="outline" type="button" asChild disabled={upload.isUploading}>
              <span>
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                {upload.isUploading ? "Uploading..." : "Attach"}
              </span>
            </Button>
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSuggest}
            disabled={isSuggesting || !conversationId}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {isSuggesting ? "Drafting..." : "AI Suggest Reply"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              setDraftPurpose("");
              setDraftNotes("");
              const knownTypes = ["Venue","Hotel","Photographer","Videographer","Florist","Caterer","DJ/Band","Hair & Makeup","Planner/Coordinator"];
              const cat = vendor?.category ?? "";
              if (knownTypes.includes(cat)) {
                setDraftVendorType(cat);
                setDraftOtherVendorType("");
              } else if (cat) {
                setDraftVendorType("Other");
                setDraftOtherVendorType(cat);
              } else {
                setDraftVendorType("");
                setDraftOtherVendorType("");
              }
              setShowDraftDialog(true);
            }}
          >
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            AI Draft Email
          </Button>
        </div>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!draft.trim() || !hasVendorEmail || sendMutation.isPending}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {sendMutation.isPending ? "Sending..." : "Send"}
        </Button>
      </div>

      <Dialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Draft Email{vendor?.name ? ` to ${vendor.name}` : ""}
            </DialogTitle>
            <DialogDescription>
              The draft will appear in your message box below — review and edit before sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Vendor Type</Label>
              <Select value={draftVendorType} onValueChange={setDraftVendorType}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select vendor type" />
                </SelectTrigger>
                <SelectContent>
                  {["Venue","Hotel","Photographer","Videographer","Florist","Caterer","DJ/Band","Hair & Makeup","Planner/Coordinator","Other"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draftVendorType === "Other" && (
                <Input
                  placeholder="e.g. Officiant, Transportation, Photo Booth…"
                  value={draftOtherVendorType}
                  onChange={(e) => setDraftOtherVendorType(e.target.value)}
                  className="bg-background mt-1.5"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Purpose</Label>
              <Select value={draftPurpose} onValueChange={setDraftPurpose}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="What's this email about?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Initial Inquiry / Availability">Initial Inquiry / Availability</SelectItem>
                  <SelectItem value="Quote Request">Request a Quote</SelectItem>
                  <SelectItem value="Follow-up">Follow-up on Previous Email</SelectItem>
                  <SelectItem value="Negotiation / Budget Discussion">Negotiate Budget / Package</SelectItem>
                  <SelectItem value="Contract Confirmation">Confirm Contract / Booking</SelectItem>
                  <SelectItem value="Polite Decline">Polite Decline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Specific details <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="e.g. We love your dark and moody style, want an 8-hour package…"
                className="resize-none h-24 bg-background"
              />
            </div>
            {vendor && (
              <p className="text-[11px] text-muted-foreground">
                Vendor: <strong>{vendor.name}</strong> · {vendor.category}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDraftDialog(false)}>Cancel</Button>
            <Button
              disabled={
                !draftPurpose ||
                !draftVendorType ||
                (draftVendorType === "Other" && !draftOtherVendorType.trim()) ||
                generateEmail.isPending ||
                !vendor
              }
              onClick={() => {
                if (!vendor) return;
                const resolvedVendorType =
                  draftVendorType === "Other"
                    ? (draftOtherVendorType.trim() || "Vendor")
                    : (draftVendorType || vendor.category || "Vendor");
                generateEmail.mutate(
                  {
                    data: {
                      vendorType: resolvedVendorType,
                      emailType: draftPurpose,
                      vendorName: vendor.name,
                      weddingDate: profile?.weddingDate ?? "",
                      venue: profile?.venue ?? "",
                      guestCount: profile?.guestCount ?? 0,
                      additionalNotes: draftNotes,
                      preferredLanguage: profile?.preferredLanguage ?? "English",
                    },
                  },
                  {
                    onSuccess: (result) => {
                      const composed = `Subject: ${result.subject}\n\n${result.body}`;
                      setDraft((d) => (d ? `${d}\n\n${composed}` : composed));
                      setShowDraftDialog(false);
                      toast({ title: "Draft ready", description: "Inserted into your message box — edit and send when ready." });
                    },
                    onError: () => toast({ title: "Could not generate draft", variant: "destructive" }),
                  }
                );
              }}
            >
              {generateEmail.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                  Drafting…
                </span>
              ) : (
                <span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" />Generate</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isCouple = message.senderType === "couple";
  const isSystem = message.senderType === "system";
  const time = new Date(message.createdAt).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  if (isSystem) {
    return (
      <div className="text-center text-xs text-muted-foreground py-1">
        {message.body} · {time}
      </div>
    );
  }

  return (
    <div className={`flex ${isCouple ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] space-y-1`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
            isCouple
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-background border rounded-bl-sm"
          }`}
        >
          {!isCouple && message.senderName && (
            <div className="text-xs font-semibold opacity-80 mb-1">{message.senderName}</div>
          )}
          {message.body}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.attachments.map((a, i) => {
                const href = a.url.startsWith("/objects/") ? `/api/storage${a.url}` : a.url;
                return (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 text-xs underline ${isCouple ? "text-primary-foreground/90" : "text-primary"}`}
                  >
                    <Paperclip className="h-3 w-3" />
                    {a.name}
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] text-muted-foreground ${isCouple ? "justify-end" : "justify-start"}`}>
          <span>{time}</span>
          {isCouple && message.deliveryStatus === "sent" && (
            <span className="flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3 text-green-600" /> Delivered to vendor via email
            </span>
          )}
          {isCouple && message.deliveryStatus === "queued" && <span>Sending…</span>}
          {isCouple && message.deliveryStatus === "failed" && (
            <span className="flex items-center gap-0.5 text-destructive">
              <AlertCircle className="h-3 w-3" /> {message.errorMessage ?? "Failed"}
            </span>
          )}
          {!isCouple && message.deliveryStatus === "received" && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">Vendor replied by email</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
