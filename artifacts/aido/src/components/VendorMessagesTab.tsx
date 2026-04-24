import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/react";
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
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [subjectCleared, setSubjectCleared] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const { data: conv, isLoading: convLoading } = useGetOrCreateConversationByVendor(vendorId);
  const conversationId = conv?.id;
  const { data: vendor } = useGetVendor(vendorId);

  const subjectStorageKey = conversationId ? `aido_subject_v1_${conversationId}` : null;

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
      onError: (e) => toast({ title: t("vendors.msg_send_failed"), description: String(e), variant: "destructive" }),
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
        toast({ title: t("vendors.msg_ai_suggest_failed"), description: String(e), variant: "destructive" });
      },
    },
  });

  const markReadMutation = useMarkConversationRead();

  const { data: profile } = useGetProfile();
  const savedCcRaw = (profile as { vendorBccEmail?: string | null } | undefined)?.vendorBccEmail ?? "";

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const parseEmails = (raw: string): string[] =>
    Array.from(
      new Set(
        raw
          .split(/[,;\s]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => EMAIL_RE.test(e))
      )
    );

  const savedCcList = parseEmails(savedCcRaw);
  const [ccDraftList, setCcDraftList] = useState<string[] | null>(null);
  const [ccInput, setCcInput] = useState("");
  const ccList = ccDraftList ?? savedCcList;
  const ccDirty =
    ccDraftList !== null &&
    (ccDraftList.length !== savedCcList.length ||
      ccDraftList.some((e, i) => e !== savedCcList[i]));
  const ccInputInvalid = ccInput.trim() !== "" && !EMAIL_RE.test(ccInput.trim());

  const setCc = (next: string[]) => setCcDraftList(next);
  const addCcEmail = (raw: string) => {
    const candidates = parseEmails(raw);
    if (candidates.length === 0) return false;
    const merged = Array.from(new Set([...ccList, ...candidates]));
    setCc(merged);
    return true;
  };
  const removeCcEmail = (email: string) => {
    setCc(ccList.filter((e) => e !== email));
  };
  const handleCcKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === " " || e.key === "Tab") {
      const v = ccInput.trim();
      if (v) {
        if (addCcEmail(v)) {
          e.preventDefault();
          setCcInput("");
        } else if (e.key !== "Tab") {
          e.preventDefault();
        }
      }
    } else if (e.key === "Backspace" && ccInput === "" && ccList.length > 0) {
      e.preventDefault();
      setCc(ccList.slice(0, -1));
    }
  };
  const handleCcPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (/[,;\s]/.test(pasted)) {
      e.preventDefault();
      addCcEmail(pasted);
      setCcInput("");
    }
  };
  const handleCcBlur = () => {
    const v = ccInput.trim();
    if (v && addCcEmail(v)) setCcInput("");
  };

  const saveProfile = useSaveProfile({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        setCcDraftList(null);
        toast({
          title: ccList.length > 0 ? t("vendors.msg_cc_saved_toast") : t("vendors.msg_cc_cleared_toast"),
          description:
            ccList.length > 0
              ? ccList.length === 1
                ? t("vendors.msg_cc_recipients_one", { n: ccList.length })
                : t("vendors.msg_cc_recipients_other", { n: ccList.length })
              : undefined,
        });
      },
      onError: () => toast({ title: t("vendors.msg_cc_save_error"), variant: "destructive" }),
    },
  });
  const saveCc = () => {
    if (!profile) return;
    // Flush any pending input first
    const pending = ccInput.trim();
    let finalList = ccList;
    if (pending && EMAIL_RE.test(pending)) {
      finalList = Array.from(new Set([...ccList, pending.toLowerCase()]));
      setCc(finalList);
      setCcInput("");
    }
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
        vendorBccEmail: finalList.length > 0 ? finalList.join(", ") : null,
      } as never,
    });
  };

  useEffect(() => {
    if (!conversationId) return;
    const key = `aido_subject_v1_${conversationId}`;
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      // User previously set or cleared the subject — respect that value
      setSubject(stored);
      if (!stored) setSubjectCleared(true);
    } else if (conv?.subject) {
      // Nothing stored yet — seed from server value
      setSubject(conv.subject);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, conv?.subject]);

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
    getToken,
    onError: (e) => toast({ title: t("vendors.msg_upload_failed"), description: e.message, variant: "destructive" }),
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
      data: { body: draft.trim(), subject: subject.trim() || undefined, attachments, cc: ccList.length > 0 ? ccList : undefined } as never,
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
            {t("vendors.msg_no_email_warning")}
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
            <p className="text-sm">{t("vendors.msg_no_messages")}</p>
            <p className="text-xs mt-1">{t("vendors.msg_replies_arrive_hint")}</p>
          </div>
        )}
        {messages?.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        <span>{t("vendors.msg_replies_from", { email: conv.vendorEmail ?? conv.vendorEmail })}</span>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs flex items-start gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
        <span className="text-amber-800 dark:text-amber-200">
          <strong>{t("vendors.msg_spam_warning_bold")}</strong> {t("vendors.msg_spam_warning")}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <label htmlFor="message-subject-input" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {t("vendors.msg_subject_label")}
        </label>
        <Input
          id="message-subject-input"
          value={subject}
          onChange={(e) => {
            const val = e.target.value;
            setSubject(val);
            if (subjectStorageKey) localStorage.setItem(subjectStorageKey, val);
            if (!val) setSubjectCleared(true);
          }}
          placeholder={t("vendors.msg_subject_placeholder")}
          className="flex-1 h-8 text-sm bg-background"
          data-testid="input-message-subject"
        />
        {subject && (
          <button
            type="button"
            onClick={() => {
              setSubject("");
              setSubjectCleared(true);
              if (subjectStorageKey) localStorage.setItem(subjectStorageKey, "");
            }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={t("vendors.msg_clear_subject")}
            aria-label={t("vendors.msg_clear_subject")}
            data-testid="btn-clear-subject"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label htmlFor="cc-emails-input" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {t("vendors.msg_cc_label")}{ccList.length > 0 ? ` (${ccList.length})` : ""}:
          </label>
          <Button
            size="sm"
            variant={ccDirty ? "default" : "outline"}
            onClick={saveCc}
            disabled={(!ccDirty && !(ccInput.trim() && !ccInputInvalid)) || ccInputInvalid || saveProfile.isPending}
            data-testid="btn-save-cc"
          >
            {saveProfile.isPending ? t("vendors.msg_cc_saving") : ccDirty || (ccInput.trim() && !ccInputInvalid) ? t("vendors.msg_cc_save") : (<><Check className="h-3.5 w-3.5 mr-1" />{t("vendors.msg_cc_saved")}</>)}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 min-h-[36px]">
          {ccList.map((email) => (
            <Badge
              key={email}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal"
              data-testid={`cc-chip-${email}`}
            >
              <span className="max-w-[220px] truncate">{email}</span>
              <button
                type="button"
                onClick={() => removeCcEmail(email)}
                className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                aria-label={t("vendors.msg_cc_label") + " " + email}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <input
            id="cc-emails-input"
            type="email"
            aria-describedby="cc-emails-help"
            placeholder={ccList.length === 0 ? t("vendors.msg_cc_placeholder_empty") : t("vendors.msg_cc_placeholder_more")}
            value={ccInput}
            onChange={(e) => setCcInput(e.target.value)}
            onKeyDown={handleCcKeyDown}
            onPaste={handleCcPaste}
            onBlur={handleCcBlur}
            className="flex-1 min-w-[180px] bg-transparent outline-none text-sm placeholder:text-muted-foreground/70"
            data-testid="input-cc-email"
          />
        </div>
        {ccInputInvalid && (
          <p className="text-xs text-destructive">{t("vendors.msg_cc_invalid")}</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          {t("vendors.msg_cc_hint")}
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
                aria-label={t("vendors.msg_remove_attachment")}
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
        placeholder={hasVendorEmail ? t("vendors.msg_placeholder") : t("vendors.msg_placeholder_no_email")}
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
                {upload.isUploading ? t("vendors.msg_uploading") : t("vendors.msg_attach")}
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
            {isSuggesting ? t("vendors.msg_ai_suggesting") : t("vendors.msg_ai_suggest")}
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
            {t("vendors.msg_ai_draft")}
          </Button>
        </div>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!draft.trim() || !hasVendorEmail || sendMutation.isPending}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {sendMutation.isPending ? t("vendors.msg_sending") : t("vendors.msg_send")}
        </Button>
      </div>

      <Dialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {vendor?.name ? t("vendors.draft_to_vendor", { name: vendor.name }) : t("vendors.draft_dialog_title")}
            </DialogTitle>
            <DialogDescription>
              {t("vendors.draft_dialog_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("vendors.draft_vendor_type")}</Label>
              <Select value={draftVendorType} onValueChange={setDraftVendorType}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={t("vendors.draft_vendor_type_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(["Venue","Hotel","Photographer","Videographer","Florist","Caterer","DJ/Band","Hair & Makeup","Planner/Coordinator","Other"] as const).map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
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
              <Label className="text-xs">{t("vendors.draft_purpose")}</Label>
              <Select value={draftPurpose} onValueChange={setDraftPurpose}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={t("vendors.draft_purpose_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Initial Inquiry / Availability">{t("vendors.purpose_initial_inquiry")}</SelectItem>
                  <SelectItem value="Quote Request">{t("vendors.purpose_quote")}</SelectItem>
                  <SelectItem value="Follow-up">{t("vendors.purpose_followup")}</SelectItem>
                  <SelectItem value="Negotiation / Budget Discussion">{t("vendors.purpose_negotiate")}</SelectItem>
                  <SelectItem value="Contract Confirmation">{t("vendors.purpose_confirm")}</SelectItem>
                  <SelectItem value="Polite Decline">{t("vendors.purpose_decline")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("vendors.draft_details_label")} <span className="text-muted-foreground font-normal">{t("vendors.draft_details_optional")}</span></Label>
              <Textarea
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder={t("vendors.draft_details_placeholder")}
                className="resize-none h-24 bg-background"
              />
            </div>
            {vendor && (
              <p className="text-[11px] text-muted-foreground">
                {t("vendors.draft_vendor_label")} <strong>{vendor.name}</strong> · {vendor.category}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDraftDialog(false)}>{t("vendors.draft_cancel")}</Button>
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
                      if (result.subject) setSubject(result.subject);
                      setDraft((d) => (d ? `${d}\n\n${result.body}` : result.body));
                      setShowDraftDialog(false);
                      toast({ title: t("vendors.draft_ready"), description: t("vendors.draft_ready_desc") });
                    },
                    onError: () => toast({ title: t("vendors.draft_failed"), variant: "destructive" }),
                  }
                );
              }}
            >
              {generateEmail.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                  {t("vendors.draft_generating")}
                </span>
              ) : (
                <span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" />{t("vendors.draft_generate")}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const { t } = useTranslation();
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
          {!isCouple && (message.senderName || message.senderEmail) && (
            <div className="text-xs font-semibold opacity-80 mb-1">
              {message.senderName ?? message.senderEmail}
              {message.senderName && message.senderEmail && (
                <span className="font-normal ml-1 opacity-70">&lt;{message.senderEmail}&gt;</span>
              )}
            </div>
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
              <CheckCircle2 className="h-3 w-3 text-green-600" /> {t("vendors.msg_delivered")}
            </span>
          )}
          {isCouple && message.deliveryStatus === "queued" && <span>{t("vendors.msg_sending_status")}</span>}
          {isCouple && message.deliveryStatus === "failed" && (
            <span className="flex items-center gap-0.5 text-destructive">
              <AlertCircle className="h-3 w-3" /> {message.errorMessage ?? t("vendors.msg_send_failed")}
            </span>
          )}
          {!isCouple && message.deliveryStatus === "received" && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">{t("vendors.msg_vendor_replied")}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
