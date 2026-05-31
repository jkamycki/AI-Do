import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { API_BASE_URL } from "@/lib/apiBase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { LanguagePicker } from "@/components/LanguagePicker";
import { coupleFirstNames } from "@/lib/coupleNames";
import { useGetProfile, useSaveProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import i18n, { LANG_NAME_TO_CODE } from "@/i18n";
import { useTranslation } from "react-i18next";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users, UserPlus, Mail, Shield, Eye, Briefcase, Copy,
  CheckCircle2, Clock, XCircle, Trash2, RefreshCw, ChevronDown,
  Settings as SettingsIcon, Crown, Globe, Check, TriangleAlert, Sparkles, HelpCircle, Download, Plus,
} from "lucide-react";

type CollabRole = "partner" | "planner" | "vendor";
type CollabStatus = "pending" | "active" | "declined";

interface Collaborator {
  id: number;
  profileId: number;
  inviterUserId?: string | null;
  inviteeEmail?: string | null;
  inviteeUserId?: string | null;
  role: CollabRole;
  status: CollabStatus;
  inviteToken?: string | null;
  inviteUrl?: string | null;
  emailSent?: boolean;
  emailError?: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}

const ROLE_CONFIG: Record<CollabRole, { label: string; description: string; icon: React.ElementType; color: string }> = {
  partner: {
    label: "Partner",
    description: "Full access to all planning tools",
    icon: Crown,
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
  planner: {
    label: "Planner",
    description: "Edit timeline, checklist, emails & budget",
    icon: Briefcase,
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  vendor: {
    label: "Vendor",
    description: "View timeline + download documents",
    icon: Eye,
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
};

const STATUS_CONFIG: Record<CollabStatus, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  active: { label: "Active", icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  declined: { label: "Declined", icon: XCircle, color: "bg-red-100 text-red-700" },
};

const REMINDER_DAY_OPTIONS = [
  { value: "1", label: "1 day before" },
  { value: "3", label: "3 days before" },
  { value: "7", label: "7 days before" },
  { value: "14", label: "14 days before" },
  { value: "30", label: "30 days before" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ReminderPreferences = {
  enabled: boolean;
  daysBefore: number;
};

type RsvpNotificationPreferences = {
  enabled: boolean;
  emails: string[];
};

function normalizeReminderDays(value: unknown): number {
  const days = Number(value);
  return REMINDER_DAY_OPTIONS.some((option) => Number(option.value) === days) ? days : 7;
}

function normalizeNotificationEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => EMAIL_PATTERN.test(item))
  )).slice(0, 10);
}

function sameEmailList(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((email, index) => email === b[index]);
}

function RoleBadge({ role }: { role: CollabRole }) {
  const { t } = useTranslation();
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  const labelKey = `settings.role_${role}` as const;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {t(labelKey)}
    </span>
  );
}

function StatusBadge({ status }: { status: CollabStatus }) {
  const { t } = useTranslation();
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const labelKey = `settings.status_${status}` as const;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {t(labelKey)}
    </span>
  );
}

function DeleteAccountCard() {
  const { t } = useTranslation();
  const { getToken, signOut } = useAuth();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await authFetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete account");
      }
      try {
        // Wipe any cached workspace so a fresh sign-up in the same browser
        // doesn't inherit the now-deleted account's shared workspace.
        localStorage.removeItem("aido_active_workspace");
      } catch {}
      await signOut({ redirectUrl: "/" });
    } catch (err: unknown) {
      setDeleting(false);
      toast({
        variant: "destructive",
        title: "Could not delete account",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  return (
    <Card className="border border-destructive/30 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
            <TriangleAlert className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <CardTitle className="font-serif text-lg text-destructive">{t("settings.danger_zone")}</CardTitle>
            <CardDescription>{t("settings.danger_desc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div>
            <p className="font-medium text-sm">{t("settings.delete_account")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.delete_account_desc")}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t("settings.delete_account_button")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-serif text-xl text-destructive">
                  {t("settings.delete_account_confirm_title")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm space-y-2">
                  <span className="block">{t("settings.delete_account_will_delete")}</span>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>{t("settings.delete_account_item_1")}</li>
                    <li>{t("settings.delete_account_item_2")}</li>
                    <li>{t("settings.delete_account_item_3")}</li>
                    <li>{t("settings.delete_account_item_4")}</li>
                    <li>{t("settings.delete_account_item_5")}</li>
                  </ul>
                  <span className="block font-medium text-foreground mt-2">
                    {t("settings.delete_account_warning")}
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("settings.delete_account_keep")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t("settings.deleting") : t("settings.delete_account_yes")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function LanguageSwitcherCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useUser();
  const { data: profile } = useGetProfile();
  const [selected, setSelected] = useState<string | null>(null);

  const storedCode = user?.id
    ? localStorage.getItem(`aido_language_${user.id}`)
    : localStorage.getItem("aido_language");
  const storedName = storedCode
    ? (Object.entries(LANG_NAME_TO_CODE).find(([, c]) => c === storedCode)?.[0] ?? "English")
    : (profile?.preferredLanguage ?? "English");
  const current = selected ?? storedName;
  const hasChange = selected !== null;

  function save() {
    if (!hasChange) return;
    const code = LANG_NAME_TO_CODE[current] ?? "en";
    i18n.changeLanguage(code);
    const key = user?.id ? `aido_language_${user.id}` : "aido_language";
    localStorage.setItem(key, code);
    localStorage.setItem("aido_language", code);
    setSelected(null);

    toast({ title: t("settings.language_updated"), description: `${t("settings.language_switched")} ${current}.` });
  }

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-serif text-lg">{t("settings.language_title")}</CardTitle>
            <CardDescription>{t("settings.language_desc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-3">
          <LanguagePicker value={current} onChange={setSelected} />
          <Button
            onClick={save}
            disabled={!hasChange}
            size="sm"
            variant={hasChange ? "default" : "outline"}
          >
            {hasChange ? (
              <>{t("settings.save")}</>
            ) : (
              <><Check className="h-3.5 w-3.5 mr-1" /> {t("settings.saved")}</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function buildProfileSavePayload(profile: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    partner1Name: String(profile.partner1Name ?? ""),
    partner2Name: String(profile.partner2Name ?? ""),
    weddingDate: String(profile.weddingDate ?? ""),
    ceremonyTime: String(profile.ceremonyTime ?? ""),
    receptionTime: String(profile.receptionTime ?? ""),
    venue: String(profile.venue ?? ""),
    location: String(profile.location ?? ""),
    venueCity: profile.venueCity ?? undefined,
    venueState: profile.venueState ?? undefined,
    venueZip: profile.venueZip ?? undefined,
    venueCountry: profile.venueCountry ?? undefined,
    venueStatus: profile.venueStatus ?? "booked",
    venueDiscovery: profile.venueDiscovery ?? null,
    venueBrainstorm: profile.venueBrainstorm ?? null,
    planningPriorities: profile.planningPriorities ?? null,
    ceremonyAtVenue: typeof profile.ceremonyAtVenue === "boolean" ? profile.ceremonyAtVenue : true,
    ceremonyVenueName: profile.ceremonyVenueName ?? undefined,
    ceremonyAddress: profile.ceremonyAddress ?? undefined,
    ceremonyCity: profile.ceremonyCity ?? undefined,
    ceremonyState: profile.ceremonyState ?? undefined,
    ceremonyZip: profile.ceremonyZip ?? undefined,
    guestCount: Number(profile.guestCount ?? 1),
    totalBudget: Number(profile.totalBudget ?? 0),
    weddingVibe: String(profile.weddingVibe ?? ""),
    preferredLanguage: typeof profile.preferredLanguage === "string" ? profile.preferredLanguage : "English",
    vendorBccEmail: profile.vendorBccEmail ?? null,
    taskEmailRemindersEnabled: typeof profile.taskEmailRemindersEnabled === "boolean" ? profile.taskEmailRemindersEnabled : true,
    taskReminderDaysBefore: normalizeReminderDays(profile.taskReminderDaysBefore),
    rsvpEmailNotificationsEnabled: typeof profile.rsvpEmailNotificationsEnabled === "boolean" ? profile.rsvpEmailNotificationsEnabled : true,
    rsvpNotificationEmails: normalizeNotificationEmails(profile.rsvpNotificationEmails),
    ariaMemory: profile.ariaMemory ?? null,
    ...overrides,
  } as never;
}

function AriaMemoryCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useGetProfile();
  const saveProfile = useSaveProfile();
  const [draft, setDraft] = useState<string | null>(null);

  const original = ((profile as { ariaMemory?: string | null } | undefined)?.ariaMemory ?? "").trim();
  const current = draft ?? original;
  const hasChange = draft !== null && draft.trim() !== original;
  const remaining = Math.max(0, 4000 - current.length);

  function save() {
    if (!profile) return;
    saveProfile.mutate(
      {
        data: buildProfileSavePayload(profile as unknown as Record<string, unknown>, {
          ariaMemory: current.trim() || null,
        }),
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          setDraft(null);
          toast({
            title: "Aria memory saved",
            description: "Aria will use these notes when giving planning guidance.",
          });
        },
        onError: () => toast({
          variant: "destructive",
          title: "Could not save Aria memory",
          description: "Please try again.",
        }),
      }
    );
  }

  return (
    <Card className="overflow-hidden border-none shadow-sm">
      <CardHeader className="border-b border-primary/10 bg-gradient-to-br from-primary/5 via-background to-[#f7dde2]/30 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <CardTitle className="font-serif text-2xl flex items-center gap-2">
              Things Aria should know
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground" title="Aria reads these notes at the start of every chat.">
                <HelpCircle className="h-3.5 w-3.5" />
              </span>
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6">
              Key decisions and preferences that Aria will remember across conversations. Add anything important like theme, allergies, must-haves, family dynamics, traditions, accessibility needs, or hard no's.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {isLoading ? (
          <Skeleton className="h-56 w-full rounded-2xl" />
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">Complete your wedding profile first, then Aria can remember planning context.</p>
        ) : (
          <>
            <Textarea
              value={current}
              onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
              placeholder={[
                "e.g.",
                "- We are going rustic-elegant with a woodland feel",
                "- No shellfish because my partner has an allergy",
                "- Ceremony will be outdoors rain or shine",
                "- Colors are blush, sage, ivory, and gold",
                "- We want a first look before the ceremony",
                "- Budget comfort zone is more important than extra decor",
              ].join("\n")}
              className="min-h-64 resize-y rounded-2xl border-primary/20 bg-background p-5 text-base leading-7 shadow-inner"
            />
            <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-foreground/80">
              Aria reads these notes every time you chat. They shape suggestions, vendor briefs, task plans, and planning guidance.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">{remaining.toLocaleString()} characters left</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasChange || saveProfile.isPending}
                  onClick={() => setDraft(null)}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  disabled={!hasChange || saveProfile.isPending}
                  onClick={save}
                  className="gap-2"
                >
                  {saveProfile.isPending ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save Aria Memory
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function VendorBccEmailCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useGetProfile();
  const saveProfile = useSaveProfile();
  const [draft, setDraft] = useState<string | null>(null);

  const current = draft ?? (profile as { vendorBccEmail?: string | null } | undefined)?.vendorBccEmail ?? "";
  const original = (profile as { vendorBccEmail?: string | null } | undefined)?.vendorBccEmail ?? "";
  const hasChange = draft !== null && draft.trim() !== original.trim();
  const isValid = !current || EMAIL_PATTERN.test(current.trim());

  function save() {
    if (!profile || !isValid) return;
    saveProfile.mutate(
      {
        data: buildProfileSavePayload(profile as unknown as Record<string, unknown>, {
          vendorBccEmail: current.trim() || null,
        }),
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          setDraft(null);
          toast({ title: t("settings.cc_email_saved_toast"), description: current ? t("settings.cc_email_saved_desc", { email: current }) : t("settings.cc_removed") });
        },
        onError: () => toast({ variant: "destructive", title: t("common.error"), description: t("settings.cc_email_invalid") }),
      }
    );
  }

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-serif text-lg">{t("settings.cc_email_title")}</CardTitle>
            <CardDescription>
              {t("settings.cc_email_desc")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="h-10 bg-muted animate-pulse rounded-md" />
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">{t("settings.complete_profile_first")}</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Input
                type="email"
                placeholder={t("settings.cc_email_placeholder")}
                value={current}
                onChange={(e) => setDraft(e.target.value)}
                className="max-w-sm bg-background"
              />
              <Button
                onClick={save}
                disabled={!hasChange || !isValid || saveProfile.isPending}
                size="sm"
                variant={hasChange ? "default" : "outline"}
              >
                {saveProfile.isPending ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                ) : hasChange ? (
                  <>{t("settings.cc_email_save")}</>
                ) : (
                  <><Check className="h-3.5 w-3.5 mr-1" /> {t("settings.cc_email_saved")}</>
                )}
              </Button>
            </div>
            {!isValid && current && (
              <p className="text-xs text-destructive">{t("settings.cc_email_invalid")}</p>
            )}
            <p className="text-xs text-muted-foreground">{t("settings.cc_email_hint")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskReminderSettingsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useGetProfile();
  const saveProfile = useSaveProfile();
  const [draft, setDraft] = useState<ReminderPreferences | null>(null);

  const profilePrefs = profile as ({ taskEmailRemindersEnabled?: boolean | null; taskReminderDaysBefore?: number | null } | undefined);
  const savedEnabled = typeof profilePrefs?.taskEmailRemindersEnabled === "boolean" ? profilePrefs.taskEmailRemindersEnabled : true;
  const savedDays = normalizeReminderDays(profilePrefs?.taskReminderDaysBefore);
  const current = draft ?? { enabled: savedEnabled, daysBefore: savedDays };
  const hasChange = Boolean(profile && draft && (draft.enabled !== savedEnabled || draft.daysBefore !== savedDays));

  function updateDraft(next: Partial<ReminderPreferences>) {
    setDraft((existing) => ({
      enabled: existing?.enabled ?? savedEnabled,
      daysBefore: existing?.daysBefore ?? savedDays,
      ...next,
    }));
  }

  function save() {
    if (!profile) return;
    saveProfile.mutate(
      {
        data: buildProfileSavePayload(profile as unknown as Record<string, unknown>, {
          taskEmailRemindersEnabled: current.enabled,
          taskReminderDaysBefore: current.daysBefore,
        }),
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          setDraft(null);
          toast({
            title: "Reminder settings saved",
            description: current.enabled
              ? `We will remind you ${current.daysBefore} day${current.daysBefore === 1 ? "" : "s"} before task deadlines.`
              : "Email task reminders are turned off.",
          });
        },
        onError: () => toast({
          variant: "destructive",
          title: "Could not save reminder settings",
          description: "Please try again.",
        }),
      }
    );
  }

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="space-y-5 p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">Complete your wedding profile first, then you can set task reminder preferences.</p>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <Checkbox
                checked={current.enabled}
                onCheckedChange={(checked) => updateDraft({ enabled: checked === true })}
                aria-label="Enable email reminders"
                className="mt-1 h-5 w-5 rounded-md border-primary/60"
              />
              <div>
                <h3 className="text-xl font-semibold text-foreground">Email reminders</h3>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Receive email notifications for upcoming task deadlines</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                Remind me before deadline
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  title="This controls how early A.I Do reminds you about dated checklist tasks."
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </span>
              </label>
              <Select
                value={String(current.daysBefore)}
                onValueChange={(value) => updateDraft({ daysBefore: normalizeReminderDays(value) })}
                disabled={!current.enabled}
              >
                <SelectTrigger className="h-14 rounded-xl border-primary/20 bg-background text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_DAY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                You will also receive in-app notifications via the bell icon. Push notifications can be enabled in your browser settings.
              </p>
            </div>

            <Button
              type="button"
              onClick={save}
              disabled={!hasChange || saveProfile.isPending}
              className="h-12 rounded-full px-8 text-base font-semibold"
            >
              {saveProfile.isPending ? (
                <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              ) : (
                "Save Settings"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RsvpNotificationSettingsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useGetProfile();
  const saveProfile = useSaveProfile();
  const [draft, setDraft] = useState<RsvpNotificationPreferences | null>(null);
  const [emailDraft, setEmailDraft] = useState("");

  const profilePrefs = profile as ({
    rsvpEmailNotificationsEnabled?: boolean | null;
    rsvpNotificationEmails?: unknown;
  } | undefined);
  const savedEnabled = typeof profilePrefs?.rsvpEmailNotificationsEnabled === "boolean"
    ? profilePrefs.rsvpEmailNotificationsEnabled
    : true;
  const savedEmails = normalizeNotificationEmails(profilePrefs?.rsvpNotificationEmails);
  const current = draft ?? { enabled: savedEnabled, emails: savedEmails };
  const pendingEmail = emailDraft.trim().toLowerCase();
  const canAddEmail =
    pendingEmail.length > 0 &&
    EMAIL_PATTERN.test(pendingEmail) &&
    !current.emails.includes(pendingEmail) &&
    current.emails.length < 10;
  const hasChange = Boolean(
    profile &&
    draft &&
    (draft.enabled !== savedEnabled || !sameEmailList(draft.emails, savedEmails))
  );

  function updateDraft(next: Partial<RsvpNotificationPreferences>) {
    setDraft((existing) => ({
      enabled: existing?.enabled ?? savedEnabled,
      emails: existing?.emails ?? savedEmails,
      ...next,
    }));
  }

  function addEmail() {
    if (!canAddEmail) return;
    updateDraft({ emails: [...current.emails, pendingEmail] });
    setEmailDraft("");
  }

  function removeEmail(email: string) {
    updateDraft({ emails: current.emails.filter((item) => item !== email) });
  }

  function save() {
    if (!profile) return;
    saveProfile.mutate(
      {
        data: buildProfileSavePayload(profile as unknown as Record<string, unknown>, {
          rsvpEmailNotificationsEnabled: current.enabled,
          rsvpNotificationEmails: current.emails,
        }),
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          setDraft(null);
          setEmailDraft("");
          toast({
            title: "RSVP email settings saved",
            description: current.enabled
              ? "New RSVP responses will be emailed to your account and any extra recipients listed here."
              : "RSVP response emails are turned off.",
          });
        },
        onError: () => toast({
          variant: "destructive",
          title: "Could not save RSVP email settings",
          description: "Please check the email addresses and try again.",
        }),
      }
    );
  }

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="space-y-5 p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">Complete your wedding profile first, then you can manage RSVP response emails.</p>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <Checkbox
                checked={current.enabled}
                onCheckedChange={(checked) => updateDraft({ enabled: checked === true })}
                aria-label="Email me RSVP responses"
                className="mt-1 h-5 w-5 rounded-md border-primary/60"
              />
              <div>
                <h3 className="text-xl font-semibold text-foreground">RSVP response emails</h3>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Email each new RSVP response to your account inbox.
                </p>
              </div>
            </div>

            <div className={`space-y-3 ${current.enabled ? "" : "opacity-60"}`}>
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                Send copies to additional emails
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  title="Your account email is included automatically while RSVP response emails are turned on."
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                  placeholder="planner@example.com"
                  disabled={!current.enabled}
                  className="h-12 rounded-xl border-primary/20 bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addEmail}
                  disabled={!current.enabled || !canAddEmail}
                  className="h-12 gap-2 rounded-xl"
                >
                  <Plus className="h-4 w-4" />
                  Add Email
                </Button>
              </div>
              {pendingEmail && !EMAIL_PATTERN.test(pendingEmail) && (
                <p className="text-xs text-destructive">Enter a valid email address before adding it.</p>
              )}
              {current.emails.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {current.emails.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-2 rounded-full px-3 py-1.5">
                      {email}
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="rounded-full text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${email}`}
                        disabled={!current.enabled}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No extra recipients yet. Your account email is still included automatically while this is on.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Turn this off if you only want RSVP responses stored inside A.I Do.
              </p>
            </div>

            <Button
              type="button"
              onClick={save}
              disabled={!hasChange || saveProfile.isPending}
              className="h-12 rounded-full px-8 text-base font-semibold"
            >
              {saveProfile.isPending ? (
                <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              ) : (
                "Save RSVP Settings"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function filenameFromContentDisposition(header: string | null): string | null {
  const match = header?.match(/filename="([^"]+)"/i) ?? header?.match(/filename=([^;]+)/i);
  return match?.[1]?.trim() || null;
}

function DataExportCard() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  async function downloadData() {
    setDownloading(true);
    try {
      const res = await authFetch("/api/account/export");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Could not download your data.");
      }
      const blob = await res.blob();
      const filename =
        filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
        `aido-data-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "Data backup downloaded",
        description: "Your wedding planning data was saved as a JSON backup.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not download your data",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="border border-primary/10 bg-gradient-to-br from-white via-[#FFF7F2] to-[#F7DDE2]/35 shadow-[0_14px_36px_rgba(141,41,77,0.08)]">
      <CardContent className="space-y-5 p-6">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            Your Data
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-[#F7DDE2] text-primary"
              title="Downloads a JSON backup of the wedding workspace and your account-related planning records."
            >
              <HelpCircle className="h-4 w-4" />
            </span>
          </h3>
          <p className="mt-3 text-base text-muted-foreground">
            Download a complete backup of all your wedding planning data
          </p>
        </div>
        <Button
          type="button"
          onClick={downloadData}
          disabled={downloading}
          className="h-14 rounded-full border border-primary/20 bg-gradient-to-r from-primary via-[#B16C8E] to-[#D4A373] px-9 text-base font-semibold text-white shadow-[0_14px_28px_rgba(141,41,77,0.22)] transition-all hover:from-[#7A2142] hover:via-primary hover:to-[#C49462] hover:shadow-[0_16px_34px_rgba(141,41,77,0.28)]"
        >
          {downloading ? (
            <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download My Data
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

type ActivityLogEntry = {
  id: number;
  action: string;
  resourceType?: string | null;
  userName?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
};

type RecoveryPoint = {
  id: number;
  reason: string;
  resourceType?: string | null;
  summary?: Record<string, unknown>;
  createdAt: string;
  restoredAt?: string | null;
  restoredBy?: string | null;
};

function formatRecoveryCount(value: unknown) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function recoverySummaryLabel(summary?: Record<string, unknown>) {
  if (!summary) return "Workspace snapshot";
  const parts = [
    `${formatRecoveryCount(summary.guests)} guests`,
    `${formatRecoveryCount(summary.vendors)} vendors`,
    `${formatRecoveryCount(summary.checklistItems)} tasks`,
    `${formatRecoveryCount(summary.budgetItems)} budget items`,
  ];
  return parts.join(" • ");
}

function AccountRecoveryCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["account-recovery"],
    queryFn: async () => {
      const res = await authFetch("/api/account/recovery");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Could not load recovery points.");
      }
      return res.json() as Promise<{ recoveryPoints: RecoveryPoint[]; canRestore: boolean }>;
    },
    staleTime: 30000,
  });

  const createSnapshot = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/account/recovery/snapshot", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Could not save recovery point.");
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-recovery"] });
      toast({
        title: "Recovery point saved",
        description: "A.I Do saved the current state of your wedding workspace.",
      });
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "Could not save recovery point",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    },
  });

  const restoreSnapshot = useMutation({
    mutationFn: async (snapshotId: number) => {
      const res = await authFetch("/api/account/recovery/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId, confirm: "RESTORE" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Could not restore recovery point.");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Workspace restored",
        description: "Your last saved planning data has been restored. Reloading now.",
      });
      window.setTimeout(() => window.location.reload(), 900);
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "Could not restore backup",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    },
  });

  const recoveryPoints = data?.recoveryPoints ?? [];
  const latest = recoveryPoints[0];

  return (
    <Card className="border border-primary/10 bg-gradient-to-br from-white via-[#FFF7F2] to-[#F7DDE2]/25 shadow-[0_14px_36px_rgba(141,41,77,0.08)]">
      <CardContent className="space-y-5 p-6">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            Account Recovery
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-[#F7DDE2] text-primary"
              title="A.I Do saves recovery points after important planning actions so accidental deletes can be restored."
            >
              <Shield className="h-4 w-4" />
            </span>
          </h3>
          <p className="mt-3 text-base text-muted-foreground">
            Recovery points are saved after important actions. If guests, vendors, budgets, or tasks get deleted by mistake, restore a recent saved version here.
          </p>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-white/80 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary/80">Latest backup</p>
          {isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : isError ? (
            <p className="mt-3 text-sm text-muted-foreground">Recovery points could not load right now.</p>
          ) : latest ? (
            <div className="mt-3 space-y-1">
              <p className="text-base font-semibold text-foreground">{formatActivityDate(latest.createdAt)}</p>
              <p className="text-sm text-muted-foreground">{recoverySummaryLabel(latest.summary)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No recovery points yet. Save one now, and future logged planning actions will create more automatically.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => createSnapshot.mutate()}
            disabled={createSnapshot.isPending}
            className="rounded-full border-primary/20 bg-white/80 text-primary hover:bg-[#F7DDE2]/50"
          >
            {createSnapshot.isPending ? (
              <div className="mr-2 h-4 w-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Save Recovery Point
          </Button>
          {latest && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  disabled={!data?.canRestore || restoreSnapshot.isPending}
                  className="rounded-full border border-primary/20 bg-gradient-to-r from-primary via-[#B16C8E] to-[#D4A373] px-6 text-white shadow-[0_12px_24px_rgba(141,41,77,0.18)] hover:from-[#7A2142] hover:via-primary hover:to-[#C49462]"
                >
                  Restore Latest Backup
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore this recovery point?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will replace the current planning workspace with the backup from {formatActivityDate(latest.createdAt)}.
                    A safety copy of the current workspace will be saved first.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => restoreSnapshot.mutate(latest.id)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Restore Backup
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {recoveryPoints.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Recent recovery points</p>
            {recoveryPoints.slice(1, 4).map((point) => (
              <div key={point.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E7CDAF]/70 bg-white/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{formatActivityDate(point.createdAt)}</p>
                  <p className="text-xs text-muted-foreground">{recoverySummaryLabel(point.summary)}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!data?.canRestore || restoreSnapshot.isPending}
                      className="text-primary hover:bg-[#F7DDE2]/50"
                    >
                      Restore
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restore this older recovery point?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will replace the current planning workspace with the backup from {formatActivityDate(point.createdAt)}.
                        A safety copy of the current workspace will be saved first.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => restoreSnapshot.mutate(point.id)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Restore Backup
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        {!data?.canRestore && !isLoading && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Only workspace owners and partners can restore account data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function activityTone(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes("created") || normalized.includes("added")) {
    return {
      symbol: "+",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (normalized.includes("deleted") || normalized.includes("removed")) {
    return {
      symbol: "-",
      className: "bg-rose-100 text-rose-700",
    };
  }
  if (normalized.includes("completed")) {
    return {
      Icon: Check,
      symbol: null,
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  return {
    symbol: "~",
    className: "bg-amber-100 text-[#24432F]",
  };
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function ActivityLogCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["account-activity"],
    queryFn: async () => {
      const res = await authFetch("/api/account/activity?limit=8");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Could not load activity.");
      }
      return res.json() as Promise<{ activities: ActivityLogEntry[] }>;
    },
    staleTime: 30000,
  });

  const activities = data?.activities ?? [];

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="space-y-5 p-6">
        <div>
          <h3 className="text-2xl font-semibold text-foreground">Activity Log</h3>
          <p className="mt-3 text-base text-muted-foreground">Recent changes to your wedding data</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-2xl border border-[#E7CDAF] bg-background p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-[#E7CDAF] bg-background p-5 text-sm text-muted-foreground">
            Activity could not load right now.
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-2xl border border-[#E7CDAF] bg-background p-5 text-sm text-muted-foreground">
            No recent changes yet. Updates will appear here as you edit guests, budgets, vendors, tasks, and Aria-generated plans.
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const tone = activityTone(activity.action);
              const ToneIcon = "Icon" in tone ? tone.Icon : null;
              return (
                <div
                  key={activity.id}
                  className="rounded-2xl border border-[#E7CDAF] bg-background p-5 shadow-[0_1px_0_rgba(139,61,88,0.03)]"
                >
                  <div className="flex items-start gap-4">
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${tone.className}`}>
                      {tone.symbol ? (
                        <span aria-hidden="true">{tone.symbol}</span>
                      ) : ToneIcon ? (
                        <ToneIcon className="h-4 w-4" aria-hidden="true" />
                      ) : null}
                      <span className="sr-only">Activity type</span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-lg font-semibold leading-snug text-foreground">{activity.action}</p>
                      <p className="mt-1 text-base text-muted-foreground">{formatActivityDate(activity.createdAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"collaborators" | "aria" | "account">("collaborators");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CollabRole>("planner");
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);

  const sharedProfileId = activeWorkspace?.profileId ?? null;

  const authedFetch = async (url: string, init: RequestInit = {}) => {
    const token = await getToken();
    const apiBase = API_BASE_URL;
    const resolved = url.startsWith("/") && apiBase ? `${apiBase}${url}` : url;
    return fetch(resolved, {
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
    queryKey: ["collaborators", sharedProfileId],
    queryFn: async () => {
      const url = sharedProfileId
        ? `/api/collaborators?workspaceId=${sharedProfileId}`
        : "/api/collaborators";
      const r = await authedFetch(url);
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json() as Promise<{
        collaborators: Collaborator[];
        workspaceName: string;
        profileId: number;
        myRole: string;
      }>;
    },
    staleTime: 10000,
    refetchInterval: 15000,
  });

  const myRole = data?.myRole ?? (sharedProfileId ? activeWorkspace?.role ?? "viewer" : "owner");
  const canManage = myRole === "owner" || myRole === "partner";
  const activeWorkspaceName = data?.workspaceName
    ?? (activeWorkspace ? coupleFirstNames(activeWorkspace.partner2Name, activeWorkspace.partner1Name) : null)
    ?? "My Workspace";

  useEffect(() => {
    setNewInviteLink(null);
  }, [sharedProfileId]);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { email: inviteEmail, role: inviteRole };
      if (sharedProfileId) body.workspaceId = sharedProfileId;
      const r = await authedFetch("/api/collaborators/invite", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to invite");
      }
      return r.json() as Promise<Collaborator>;
    },
    onSuccess: (collab) => {
      qc.invalidateQueries({ queryKey: ["collaborators", sharedProfileId] });
      const link = collab.inviteUrl ?? `${window.location.origin}/invite/${collab.inviteToken ?? ""}`;
      setNewInviteLink(link);

      const workspaceName = data?.workspaceName ?? "our wedding";
      const role = ROLE_CONFIG[inviteRole]?.label ?? inviteRole;
      if (!collab.emailSent) {
        const subject = encodeURIComponent(`You're invited to collaborate on ${workspaceName}'s wedding planning`);
        const body = encodeURIComponent(
          `Hi there!\n\nYou've been invited to collaborate on ${workspaceName}'s wedding workspace as a ${role} on A.IDO.\n\nAccept your invitation by clicking the link below:\n\n${link}\n\n(If the link doesn't appear clickable, copy and paste it into your browser.)\n\nSee you there!\n${workspaceName}`
        );
        window.location.href = `mailto:${encodeURIComponent(inviteEmail)}?subject=${subject}&body=${body}`;
      }

      setInviteEmail("");
      toast({
        title: collab.emailSent ? t("settings.invite_sent") : t("settings.invite_ready"),
        description: collab.emailSent
          ? "The collaborator invite email was sent with a clickable accept button."
          : t("settings.invite_ready_desc"),
      });
    },
    onError: (err: Error) => {
      toast({ title: t("settings.invite_failed"), description: err.message, variant: "destructive" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: CollabRole }) => {
      const r = await authedFetch(`/api/collaborators/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      if (!r.ok) throw new Error("Failed to update role");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collaborators", sharedProfileId] });
      setEditingRoleId(null);
      toast({ title: t("settings.role_change_saved") });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authedFetch(`/api/collaborators/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to remove");
      }
    },
    onSuccess: () => {
      setConfirmRemoveId(null);
      qc.invalidateQueries({ queryKey: ["collaborators", sharedProfileId] });
      toast({ title: t("settings.collab_removed") });
    },
    onError: (err: Error) => {
      setConfirmRemoveId(null);
      toast({ title: t("settings.could_not_remove"), description: err.message, variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authedFetch(`/api/collaborators/${id}/resend`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to resend");
      return r.json() as Promise<Collaborator>;
    },
    onSuccess: (collab) => {
      qc.invalidateQueries({ queryKey: ["collaborators", sharedProfileId] });
      const link = collab.inviteUrl ?? `${window.location.origin}/invite/${collab.inviteToken ?? ""}`;
      setNewInviteLink(link);
      toast({
        title: collab.emailSent ? t("settings.invite_sent") : t("settings.new_invite_link"),
        description: collab.emailSent
          ? "The collaborator invite email was resent with a clickable accept button."
          : undefined,
      });
    },
  });

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: t("settings.link_copied") });
  };

  const getInviteLink = (token: string | null | undefined) =>
    `${window.location.origin}/invite/${token ?? ""}`;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          {t("settings.title")}
        </h1>
        <p className="text-lg text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-1 p-1 bg-muted/40 rounded-xl w-fit">
        {([
          ["collaborators", t("settings.collab_tab"), Users],
          ["aria", "Aria", Sparkles],
          ["account", t("settings.account_tab"), SettingsIcon],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === key ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "collaborators" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              Collaborators for {activeWorkspaceName}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Invites, roles, and removals apply only to this selected workstation.
            </p>
          </div>
          {canManage && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                {t("settings.invite_collaborator")}
              </CardTitle>
              <CardDescription>
                {t("settings.invite_collaborator_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">{t("settings.email_address_label")}</label>
                  <Input
                    type="email"
                    placeholder={t("settings.email_placeholder")}
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">{t("settings.invite_role")}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(ROLE_CONFIG) as [CollabRole, typeof ROLE_CONFIG[CollabRole]][]).map(([role, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={role}
                          onClick={() => setInviteRole(role)}
                          className={`p-2.5 rounded-lg border text-left transition-all text-xs
                            ${inviteRole === role
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:border-primary/40 text-foreground"
                            }`}
                        >
                          <Icon className="h-4 w-4 mb-1" />
                          <div className="font-semibold">{t(`settings.role_${role}`)}</div>
                          <div className="text-muted-foreground mt-0.5 leading-tight">{t(`settings.role_${role}_desc`)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => inviteMutation.mutate()}
                disabled={!inviteEmail || inviteMutation.isPending}
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                {inviteMutation.isPending ? t("settings.creating_invite") : t("settings.create_invite")}
              </Button>

              {newInviteLink && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-primary">{t("settings.invite_link_created_msg")}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <a
                      href={newInviteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2 font-mono truncate text-foreground underline decoration-primary/60 underline-offset-2 hover:text-primary transition-colors"
                    >
                      {newInviteLink}
                    </a>
                    <Button size="sm" variant="outline" onClick={() => copyLink(newInviteLink)} className="gap-1.5 shrink-0">
                      <Copy className="h-3.5 w-3.5" />
                      {t("settings.copy_btn")}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-primary border-primary/30"
                      onClick={() => {
                        const workspaceName = data?.workspaceName ?? "our wedding";
                        const subject = encodeURIComponent(`You're invited to collaborate on ${workspaceName}'s wedding planning`);
                        const body = encodeURIComponent(
                          `Hi there!\n\nYou've been invited to collaborate on ${workspaceName}'s wedding workspace on A.IDO.\n\nAccept your invitation by clicking the link below:\n\n${newInviteLink}\n\n(If the link doesn't appear clickable, copy and paste it into your browser.)\n\nSee you there!\n${workspaceName}`
                        );
                        window.location.href = `mailto:?subject=${subject}&body=${body}`;
                      }}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {t("settings.open_email_again")}
                    </Button>
                    <p className="text-xs text-muted-foreground">{t("settings.email_didnt_open")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {t("settings.your_collaborators")}
              </CardTitle>
              <CardDescription>
                {t("settings.collab_section_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !data?.collaborators.length ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Users className="h-8 w-8 text-primary/50" />
                  </div>
                  <p className="text-muted-foreground">{t("settings.no_collabs_invite")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.collaborators.map(collab => {
                    const statusCfg = STATUS_CONFIG[collab.status as CollabStatus];
                    const StatusIcon = statusCfg.icon;
                    return (
                      <div key={collab.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 hover:border-primary/20 transition-colors bg-card">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                          {collab.inviteeEmail ? collab.inviteeEmail[0].toUpperCase() : collab.role[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{collab.inviteeEmail ?? `${collab.role} collaborator`}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("settings.invited_on", { date: new Date(collab.invitedAt).toLocaleDateString() })}
                            {collab.acceptedAt && t("settings.accepted_on", { date: new Date(collab.acceptedAt).toLocaleDateString() })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <RoleBadge role={collab.role as CollabRole} />
                          <StatusBadge status={collab.status as CollabStatus} />
                        </div>
                        {canManage && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {collab.status !== "declined" && (
                            <div className="relative">
                              <button
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs"
                                onClick={() => setEditingRoleId(editingRoleId === collab.id ? null : collab.id)}
                                title={t("settings.change_role")}
                              >
                                <Shield className="h-4 w-4" />
                              </button>
                              {editingRoleId === collab.id && (
                                <div className="absolute right-0 top-8 z-20 bg-card border border-border rounded-xl shadow-lg p-2 min-w-[160px] space-y-1">
                                  {(["partner", "planner", "vendor"] as CollabRole[]).map(r => (
                                    <button
                                      key={r}
                                      onClick={() => roleMutation.mutate({ id: collab.id, role: r })}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors
                                        ${collab.role === r ? "text-primary font-medium" : "text-foreground"}`}
                                    >
                                      {t(`settings.role_${r}`)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {collab.status === "pending" && (
                            <>
                              <button
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => copyLink(getInviteLink(collab.inviteToken))}
                                title={t("settings.copy_invite_link")}
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => resendMutation.mutate(collab.id)}
                                title={t("settings.regen_invite_link")}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {confirmRemoveId === collab.id ? (
                            <div className="flex items-center gap-1.5 bg-destructive/5 border border-destructive/20 rounded-lg px-2.5 py-1.5">
                              <span className="text-xs text-destructive font-medium whitespace-nowrap">{t("settings.remove_access")}</span>
                              <button
                                className="text-xs font-semibold text-destructive hover:underline"
                                onClick={() => removeMutation.mutate(collab.id)}
                                disabled={removeMutation.isPending}
                              >
                                {removeMutation.isPending ? "…" : t("common.yes")}
                              </button>
                              <span className="text-muted-foreground text-xs">·</span>
                              <button
                                className="text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setConfirmRemoveId(null)}
                              >
                                {t("common.no")}
                              </button>
                            </div>
                          ) : (
                            <button
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => setConfirmRemoveId(collab.id)}
                              title="Remove this collaborator's access (your wedding data is kept)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-lg">{t("settings.permission_ref")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">{t("settings.col_feature")}</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("settings.role_partner")}</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("settings.role_planner")}</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">{t("settings.role_vendor")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {[
                      [t("settings.feat_view_timeline"), true, true, true],
                      [t("settings.feat_download_pdfs"), true, true, true],
                      [t("settings.feat_view_budget"), true, true, false],
                      [t("settings.feat_edit_timeline"), true, true, false],
                      [t("settings.feat_edit_budget"), true, true, false],
                      [t("settings.feat_manage_vendors"), true, true, false],
                      [t("settings.feat_manage_collabs"), true, false, false],
                      [t("settings.feat_delete_workspace"), false, false, false],
                    ].map(([feature, partner, planner, vendor]) => (
                      <tr key={String(feature)}>
                        <td className="py-2.5 pr-4 text-foreground">{feature}</td>
                        {[partner, planner, vendor].map((has, i) => (
                          <td key={i} className="text-center py-2.5 px-3">
                            {has
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                              : <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "aria" && (
        <div className="space-y-4">
          <AriaMemoryCard />
        </div>
      )}

      {activeTab === "account" && (
        <div className="space-y-4">
          <LanguageSwitcherCard />
          <TaskReminderSettingsCard />
          <RsvpNotificationSettingsCard />
          <VendorBccEmailCard />
          <div className="grid gap-4 xl:grid-cols-2">
            <DataExportCard />
            <AccountRecoveryCard />
          </div>
          <ActivityLogCard />
          <DeleteAccountCard />
          <Card className="border-none shadow-sm">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <SettingsIcon className="h-8 w-8 text-primary/60" />
              </div>
              <h3 className="font-serif text-xl text-foreground">{t("settings.account_settings")}</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                {t("settings.account_settings_desc")}
              </p>
              <Button variant="outline" onClick={() => window.open("https://accounts.clerk.dev", "_blank", "noopener,noreferrer")}>
                {t("settings.manage_account")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
